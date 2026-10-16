import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { recordDocumentShare } from "@aarili/core/documents";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { withDocuments } from "../scripts/test-support/documents.mjs";

test("0.4.4b J1/J4/J5 authorised immutable PDF bytes and durable audited sharing history under concurrency, denial and rollback", async () => {
  await withDocuments(async (f) => {
    const { input } = await f.issue();
    const path = `/${input.docId}/1`;
    assert.equal((await f.request(`${path}/file`)).status, 404);
    assert.equal(
      (
        await f.request(`${path}/history`, {
          method: "POST",
          body: { kind: "prepared" },
        })
      ).status,
      409,
    );
    await f.process(input);
    const bytes = await f.request(`${path}/file`);
    assert.equal(bytes.status, 200);
    assert.equal(bytes.headers.get("Cache-Control"), "no-store");
    assert.equal(bytes.headers.get("Referrer-Policy"), "no-referrer");
    const content = Buffer.from(await bytes.arrayBuffer());
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      bytes.headers.get("X-Document-Sha256"),
    );
    const key = randomUUID();
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        f.transaction((ctx) =>
          recordDocumentShare(ctx, input.docId, 1, { kind: "prepared" }, key),
        ),
      ),
    );
    const prepared = concurrent[0];
    assert.deepEqual(concurrent[1], prepared);
    const replay = await f.request(`${path}/history`, {
      method: "POST",
      body: { kind: "prepared" },
      key,
    });
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), prepared);
    assert.equal(prepared.actorId, f.a.user);
    assert.equal(
      (
        await f.request(`${path}/history`, {
          method: "POST",
          body: { kind: "marked-sent", preparedId: randomUUID() },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request(`${path}/history`, {
          method: "POST",
          body: { kind: "marked-sent", preparedId: prepared.id },
          key,
        })
      ).status,
      422,
    );
    const markKey = randomUUID();
    const mark = () =>
      f.request(`${path}/history`, {
        method: "POST",
        body: { kind: "marked-sent", preparedId: prepared.id },
        key: markKey,
      });
    const sent = await (await mark()).json();
    assert.equal(sent.kind, "marked-sent");
    await f.admin.query(
      "delete from idempotency_key where key=any($1::uuid[])",
      [[key, markKey]],
    );
    assert.deepEqual(
      await (await mark()).json(),
      sent,
      "durable event replays after generic request-key expiry",
    );
    assert.deepEqual(
      await (
        await f.request(`${path}/history`, {
          method: "POST",
          body: { kind: "prepared" },
          key,
        })
      ).json(),
      prepared,
    );
    assert.equal(
      (
        await f.request("", {
          method: "POST",
          body: { ...input, docId: randomUUID() },
          key,
        })
      ).status,
      422,
    );
    for (const suffix of ["file", "history"]) {
      assert.equal(
        (await f.request(`${path}/${suffix}`, { who: f.b })).status,
        404,
      );
    }
    assert.equal(
      (
        await f.request(`${path}/history`, {
          who: f.b,
          method: "POST",
          body: { kind: "prepared" },
        })
      ).status,
      404,
    );
    const h = await (await f.request(`${path}/history`)).json();
    assert.equal(h.length, 2);
    assert.equal(
      (
        await f.admin.query(
          "select * from audit_event where action in ('document.prepared','document.marked-sent')",
        )
      ).rowCount,
      2,
    );
    assert.ok(
      (await assertIsolationCatalog(f.runtime.db)).includes(
        "public.document_share_event",
      ),
    );
    assert.equal(
      (await f.runtime.pool.query("select * from document_share_event"))
        .rowCount,
      0,
    );
    await assert.rejects(() =>
      f.transaction((c) =>
        c.repository.appendShare(
          input.docId,
          1,
          { ...prepared, id: randomUUID(), actorId: f.b.user },
          randomUUID(),
          "0".repeat(64),
        ),
      ),
    );
    await assert.rejects(() =>
      f.admin.query("update document_share_event set kind='prepared'"),
    );
    await assert.rejects(() =>
      f.admin.query("delete from document_share_event"),
    );
    // A failure after append must roll back history, audit and replay together.
    const rollbackKey = randomUUID();
    await assert.rejects(() =>
      f.transaction(async (c) => {
        await c.repository.appendShare(
          input.docId,
          1,
          { ...prepared, id: randomUUID() },
          rollbackKey,
          "0".repeat(64),
        );
        throw Error("Injected transaction failure");
      }),
    );
    assert.equal(
      (
        await f.admin.query(
          "select * from document_share_event where request_key=$1",
          [rollbackKey],
        )
      ).rowCount,
      0,
    );
    await f.transaction((c) => c.repository.now());
    await f.admin.query(
      "update document_test_policy set allowed=false where shop_id=$1",
      [f.a.shop],
    );
    assert.equal((await f.request(`${path}/file`)).status, 404);
    assert.equal((await f.request(`${path}/history`)).status, 404);
    assert.equal(
      (await mark()).status,
      404,
      "a replay never bypasses current authority",
    );
    await f.admin.query(
      "update document_test_policy set allowed=true where shop_id=$1",
      [f.a.shop],
    );
    const read = f.storage.read;
    f.storage.read = async () => new TextEncoder().encode("%PDF-corrupt");
    assert.equal((await f.request(`${path}/file`)).status, 503);
    f.storage.read = read;
    assert.deepEqual(
      Buffer.from(await (await f.request(`${path}/file`)).arrayBuffer()),
      content,
      "historical bytes unchanged",
    );
    const r = await f.transaction((c) => c.repository.shares(input.docId, 1));
    assert.equal(r.length, 2);
  });
}, 180000);
