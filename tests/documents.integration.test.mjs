import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  issueDocument,
  reconcileDocumentOutputs,
} from "@aarili/core/documents";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { startJobRuntime } from "@aarili/jobs/runtime";
import { test } from "vitest";
import { withDocuments } from "../scripts/test-support/documents.mjs";

async function until(run, description) {
  for (let i = 0; i < 180; i++) {
    if (await run()) return;
    await delay(100);
  }
  throw Error(`Timed out: ${description}`);
}
async function snapshot(f, d) {
  return f.transaction(async (c) => ({
    revision: await c.repository.read(d.docId, d.revision),
    attempt: await c.repository.attempt(d.docId, d.revision),
    artifact: await c.repository.artifact(d.docId, d.revision),
  }));
}
async function expireLease(f, id) {
  // Disposable technical-clock simulation, never a runtime/history operation.
  await f.admin.query("alter table document_attempt disable trigger user");
  try {
    await f.admin.query(
      "update document_attempt set lease_until=now()-interval '1 minute' where doc_id=$1",
      [id],
    );
  } finally {
    await f.admin.query("alter table document_attempt enable trigger user");
  }
}
async function download(f, d) {
  const r = await f.request(`/${d.docId}/${d.revision}/access`);
  assert.equal(r.status, 200);
  const access = await r.json(),
    file = await fetch(access.url);
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-disposition"), /^attachment/);
  assert.match(file.headers.get("cache-control"), /no-store/);
  const bytes = Buffer.from(await file.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), access.sha256);
  return bytes;
}

test("0.4.4a I1/I2/I6 issuance is atomic, revision binding outlives replay expiry, forced isolation and immutable history", async () => {
  await withDocuments(async (f) => {
    const bad = await f.request("", {
      method: "POST",
      body: {
        docId: randomUUID(),
        revision: 1,
        template: "unknown",
        templateRevision: 1,
        language: "ta",
        model: {},
      },
    });
    assert.equal(bad.status, 422);
    const input = {
      docId: randomUUID(),
      revision: 1,
      template: "synthetic.document",
      templateRevision: 1,
      language: "ta",
      model: { title: "சோதனை", lines: ["synthetic"] },
    };
    const key = randomUUID();
    await assert.rejects(
      () =>
        f.transaction((c) =>
          issueDocument(
            {
              ...c,
              jobs: {
                ...c.jobs,
                async enqueue(a) {
                  await c.jobs.enqueue(a);
                  throw Error("Injected transactional enqueue rollback");
                },
              },
            },
            input,
            key,
          ),
        ),
      /enqueue rollback/,
    );
    assert.equal(
      (
        await f.admin.query("select * from document_revision where doc_id=$1", [
          input.docId,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (await f.admin.query("select * from idempotency_key where key=$1", [key]))
        .rowCount,
      0,
    );
    assert.equal(
      (await f.admin.query("select * from pgboss.job where name='pdf.render'"))
        .rowCount,
      0,
    );
    const a = await f.issue(input, key);
    assert.equal(a.status.state, "pending");
    assert.equal(a.status.paper, "A4");
    const replay = await f.issue(input, key);
    assert.deepEqual(replay.status, a.status);
    const meta = (
      await f.admin.query(
        "select retry_limit,singleton_key,data from pgboss.job where name='pdf.render'",
      )
    ).rows[0];
    assert.equal(meta.retry_limit, 3);
    assert.equal(meta.singleton_key, `${f.a.shop}:${input.docId}:1`);
    assert.deepEqual(Object.keys(meta.data).sort(), [
      "docId",
      "epoch",
      "initiatorId",
      "jobId",
      "revision",
      "shopId",
    ]);
    await f.admin.query("delete from idempotency_key where key=$1", [key]);
    await f.issue(input, key);
    assert.equal(
      (await f.admin.query("select * from document_revision")).rowCount,
      1,
    );
    const changed = await f.request("", {
      method: "POST",
      body: { ...input, model: { title: "changed", lines: [] } },
      key,
    });
    assert.equal(changed.status, 422);
    const collision = await f.request("", { method: "POST", body: input });
    assert.equal(collision.status, 409);
    const cross = await f.request(`/${input.docId}/1/status`, { who: f.b });
    assert.equal(cross.status, 404);
    await f.issue({ ...input }, randomUUID(), f.b);
    assert.equal(
      (await f.admin.query("select * from document_revision")).rowCount,
      2,
      "same opaque document id remains tenant-scoped",
    );
    await f.admin.query(
      "delete from pgboss.job where name='pdf.render' and data->>'shopId'=$1",
      [f.a.shop],
    );
    const missing = await (await f.request(`/${input.docId}/1/status`)).json();
    assert.equal(missing.failure, "PROCESSING_UNAVAILABLE");
    assert.equal(missing.canRetry, true);
    assert.equal(
      (
        await f.request(`/${input.docId}/1/retry`, {
          method: "POST",
          body: {},
          etag: `"v${missing.version}"`,
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.admin.query("select * from document_revision")).rowCount,
      2,
      "queue expiry retry preserves the same issued revision",
    );
    const tables = await assertIsolationCatalog(f.runtime.db);
    for (const t of [
      "document_revision",
      "document_attempt",
      "document_output",
      "document_artifact",
      "document_cleanup",
    ])
      assert(tables.includes(`public.${t}`));
    assert.equal(
      (await f.runtime.pool.query("select * from document_revision")).rowCount,
      0,
    );
    await assert.rejects(() =>
      f.admin.query(
        "update document_revision set language='en' where doc_id=$1",
        [input.docId],
      ),
    );
    await assert.rejects(() =>
      f.admin.query("delete from document_revision where doc_id=$1", [
        input.docId,
      ]),
    );
  });
}, 120000);

test("0.4.4a I7 orphan reconciliation pages beyond twenty planned outputs and preserves an active lease", async () => {
  await withDocuments(async (f) => {
    const d = (await f.issue()).input;
    const planned = await f.transaction(async (c) => {
      await c.repository.lock(d.docId, 1);
      const a = await c.repository.attempt(d.docId, 1),
        fence = await c.repository.id();
      await c.repository.claim(
        a,
        fence,
        new Date((await c.repository.now()).getTime() + 300000).toISOString(),
      );
      await c.repository.audit({
        id: fence,
        actor: c.actor,
        action: "document.claim",
        docId: d.docId,
        requestId: fence,
        key: fence,
      });
      const list = [];
      for (let i = 0; i < 22; i++) {
        // Technical unaccepted synthetic objects, not PDF validation positives.
        const bytes = Buffer.from(`%PDF-1.7\n% synthetic orphan ${i}\n`),
          sha256 = createHash("sha256").update(bytes).digest("hex"),
          id = await c.repository.id();
        const o = {
          id,
          docId: d.docId,
          revision: 1,
          fence,
          key: `shops/${f.a.shop}/docs/${d.docId}/1-${sha256}.pdf`,
          sha256,
          bytes: bytes.length,
        };
        await c.repository.plan(o);
        list.push({ o, bytes });
      }
      return list;
    });
    for (const { o, bytes } of planned)
      await f.actual.put(o.key, bytes, o.sha256);
    await f.admin.query("alter table document_output disable trigger user");
    try {
      await f.admin.query(
        "update document_output set created_at=now()-interval '10 minutes' where doc_id=$1",
        [d.docId],
      );
    } finally {
      await f.admin.query("alter table document_output enable trigger user");
    }
    assert.equal(
      (await reconcileDocumentOutputs(f.host, d.docId, 1, f.maintenance, 300))
        .removed,
      0,
    );
    await expireLease(f, d.docId);
    const first = await reconcileDocumentOutputs(
      f.host,
      d.docId,
      1,
      f.maintenance,
      300,
    );
    assert.equal(first.removed, 20);
    assert(first.next);
    const second = await reconcileDocumentOutputs(
      f.host,
      d.docId,
      1,
      f.maintenance,
      300,
      first.next,
    );
    assert.equal(second.removed, 2);
    assert.equal(second.next, null);
    for (const { o } of planned)
      assert.equal(await f.maintenance.has(o.key), false);
    assert.equal(
      (
        await f.admin.query(
          "select * from document_cleanup where completed_at is not null",
        )
      ).rowCount,
      22,
    );
  });
}, 120000);

test("0.4.4a I6/I10 worker stop after usage vetoes acceptance, crash expiry recovers once and resource shutdown stays bounded", async () => {
  await withDocuments(async (f) => {
    const d = (await f.issue()).input,
      p = await f.job(d);
    let count = 0,
      reached,
      release;
    const barrier = new Promise((r) => {
      reached = r;
    });
    const runtime = await startJobRuntime(
      f.runtime.pool.options.connectionString,
      {
        mode: "worker",
        pollMilliseconds: 50,
        hooks: {
          async beforeCommit() {
            if (++count === 4) {
              reached();
              await new Promise((r) => {
                release = r;
              });
            }
          },
        },
      },
      f.composition,
    );
    await barrier;
    assert.equal(await runtime.stop(20), "timed-out");
    release();
    await delay(150);
    assert.equal((await snapshot(f, d)).artifact, undefined);
    assert.equal(
      (
        await f.admin.query("select * from product_event where subject_id=$1", [
          d.docId,
        ])
      ).rowCount,
      0,
    );
    await expireLease(f, d.docId);
    await f.admin.query(
      "update pgboss.job set started_on=now()-interval '1 hour' where id=$1",
      [p.jobId],
    );
    const next = await startJobRuntime(
      f.runtime.pool.options.connectionString,
      { mode: "worker", pollMilliseconds: 50 },
      f.composition,
    );
    try {
      await until(
        async () =>
          (
            await f.admin.query("select state from pgboss.job where id=$1", [
              p.jobId,
            ])
          ).rows[0]?.state === "completed",
        "PDF crash expiry recovery",
      );
    } finally {
      assert.equal(await next.stop(), "stopped");
    }
    assert.equal(
      (
        await f.admin.query("select * from document_artifact where doc_id=$1", [
          d.docId,
        ])
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await f.admin.query(
          "select * from product_event where name='pdf.rendered' and subject_id=$1",
          [d.docId],
        )
      ).rowCount,
      1,
    );
    let finish;
    const cleanup = new Promise((r) => {
      finish = r;
    });
    const stuck = await startJobRuntime(
      f.runtime.pool.options.connectionString,
      { mode: "worker", pollMilliseconds: 50 },
      { ...f.composition, close: () => cleanup },
    );
    assert.equal(await stuck.stop(20), "timed-out");
    finish();
  });
}, 120000);

test("0.4.4a I2/I3/I7/I10 real render+S3 accepts once, freezes historical bytes and counts PDF/media events separately", async () => {
  await withDocuments(async (f) => {
    const a = await f.issue(),
      d = a.input;
    f.setStorageFailure(true);
    await assert.rejects(() => f.process(d));
    f.setStorageFailure(false);
    const [one, two] = await Promise.allSettled([f.process(d), f.process(d)]);
    assert(
      [one, two].some(
        (x) => x.status === "fulfilled" && x.value === "accepted",
      ),
    );
    assert.equal(await f.process(d), "accepted");
    const row = await snapshot(f, d);
    assert.equal(row.attempt.state, "ready");
    assert(row.artifact);
    assert.equal(
      row.artifact.key,
      `shops/${f.a.shop}/docs/${d.docId}/1-${row.artifact.sha256}.pdf`,
    );
    const bytes = await download(f, d),
      count = f.renderCount();
    await f.issue({
      ...d,
      revision: 2,
      language: "en",
      paper: "A3",
      model: { title: "Later synthetic source", lines: ["different"] },
    });
    assert.deepEqual(await download(f, d), bytes);
    assert.equal(await f.process(d), "accepted");
    assert.equal(f.renderCount(), count);
    const events = (
      await f.admin.query(
        "select name,action_id,bytes from product_event where subject_id=$1 order by name",
        [d.docId],
      )
    ).rows;
    assert.equal(events.length, 2);
    assert.equal(new Set(events.map((x) => x.action_id)).size, 2);
    assert.deepEqual(
      events.map((x) => x.name),
      ["media.stored", "pdf.rendered"],
    );
    assert.equal(Number(events[0].bytes), bytes.length);
    await f.actual.put(row.artifact.key, bytes, row.artifact.sha256);
    assert.deepEqual(await download(f, d), bytes);
    await assert.rejects(() =>
      f.actual.put(
        row.artifact.key,
        new Uint8Array([1, 2, 3]),
        row.artifact.sha256,
      ),
    );
    await assert.rejects(() =>
      f.admin.query("update document_artifact set output_id=uuidv7()"),
    );
    await assert.rejects(() =>
      f.admin.query("update document_output set sha256=repeat('0',64)"),
    );
    await assert.rejects(() =>
      withShop(f.parallel.db, f.b.user, f.b.shop, (tx) =>
        tx.execute(
          sql`insert into document_artifact(shop_id,doc_id,revision,output_id,action_id) values(${f.b.shop}::uuid,${d.docId}::uuid,1,${row.artifact.id}::uuid,uuidv7())`,
        ),
      ),
    );
    await f.admin.query("delete from pgboss.job where name='pdf.render'");
    assert.equal(await f.process(d), "accepted");
    assert.deepEqual(await download(f, d), bytes);
  });
}, 120000);

test("0.4.4a I6 stale policy/epoch/fence and final-transaction veto leave planned private orphans, never accepted artifacts", async () => {
  await withDocuments(async (f) => {
    for (const veto of ["policy", "epoch", "fence", "usage"]) {
      const d = (await f.issue()).input;
      f.setAfterPut(async () => {
        if (veto === "policy")
          await f.admin.query(
            "update document_test_policy set allowed=false where shop_id=$1",
            [f.a.shop],
          );
        if (veto === "epoch")
          await f.admin.query("update system_state set restore_epoch=uuidv7()");
      });
      // The fence edit uses a committed claim with an existing audit identity.
      if (veto === "fence")
        f.setAfterPut(async () => {
          await expireLease(f, d.docId);
          await f.transaction(async (c) => {
            await c.repository.lock(d.docId, 1);
            const a = await c.repository.attempt(d.docId, 1),
              fence = await c.repository.id();
            await c.repository.claim(
              a,
              fence,
              new Date(
                (await c.repository.now()).getTime() + 300000,
              ).toISOString(),
            );
            await c.repository.audit({
              id: fence,
              actor: c.actor,
              action: "document.claim",
              docId: d.docId,
              requestId: fence,
              key: fence,
            });
          });
        });
      if (veto === "policy") await assert.rejects(() => f.process(d));
      else if (veto === "usage") {
        let barrier = 0;
        await assert.rejects(() =>
          f.process(d, async () => {
            if (++barrier === 4) throw Error("Injected transaction veto");
          }),
        );
        assert.equal(barrier, 4);
      } else assert.equal(await f.process(d), "quarantined");
      f.setAfterPut(undefined);
      await f.admin.query(
        "update document_test_policy set allowed=true where shop_id=$1",
        [f.a.shop],
      );
      const s = await snapshot(f, d);
      assert.equal(s.artifact, undefined);
      assert.equal(
        (
          await f.admin.query(
            "select * from product_event where subject_id=$1",
            [d.docId],
          )
        ).rowCount,
        0,
      );
      assert.equal((await f.request(`/${d.docId}/1/access`)).status, 404);
    }
  });
}, 120000);

test("0.4.4a I8/I10 shared production runner retries real renderer failure, exposes exhaustion and explicitly retries the same revision", async () => {
  await withDocuments(async (f) => {
    const d = (await f.issue()).input;
    f.setRenderFailure(true);
    const runtime = await startJobRuntime(
      f.runtime.pool.options.connectionString,
      { mode: "inprocess", pollMilliseconds: 50 },
      f.composition,
    );
    try {
      await until(
        async () =>
          (
            await f.admin.query("select state from pgboss.job where id=$1", [
              (await f.job(d)).jobId,
            ])
          ).rows[0]?.state === "failed",
        "PDF retry exhaustion",
      );
      const current = await (await f.request(`/${d.docId}/1/status`)).json();
      assert.equal(current.state, "failed");
      assert.equal(current.failure, "RETRIES_EXHAUSTED");
      assert.equal(
        (await f.admin.query("select * from document_revision")).rowCount,
        1,
      );
      assert.equal(
        (await f.request(`/${d.docId}/1/retry`, { method: "POST", body: {} }))
          .status,
        428,
      );
      assert.equal(
        (
          await f.request(`/${d.docId}/1/retry`, {
            method: "POST",
            body: {},
            etag: '"v999"',
          })
        ).status,
        412,
      );
      f.setRenderFailure(false);
      const key = randomUUID(),
        etag = `"v${current.version}"`;
      const retry = await f.request(`/${d.docId}/1/retry`, {
        method: "POST",
        body: {},
        key,
        etag,
      });
      assert.equal(retry.status, 200);
      const repeated = await f.request(`/${d.docId}/1/retry`, {
        method: "POST",
        body: {},
        key,
        etag,
      });
      assert.equal(repeated.status, 200);
      await until(
        async () =>
          (await f.transaction((c) => c.repository.attempt(d.docId, 1)))
            .state === "ready",
        "same PDF revision retry succeeds",
      );
      assert.equal(
        (await f.admin.query("select * from document_revision")).rowCount,
        1,
      );
      assert.equal(
        (await f.admin.query("select * from document_artifact")).rowCount,
        1,
      );
      assert.equal(
        (
          await f.admin.query(
            "select * from product_event where name='pdf.rendered'",
          )
        ).rowCount,
        1,
      );
    } finally {
      assert.equal(await runtime.stop(), "stopped");
    }
  });
}, 120000);

test("0.4.4a I7 committed orphan intent precedes exact deletion, partial crash retries, accepted and active outputs are protected", async () => {
  await withDocuments(async (f) => {
    const d = (await f.issue()).input;
    let crash = true;
    f.setAfterPut(async () => {
      if (crash) {
        crash = false;
        throw Error("Injected post-write crash");
      }
    });
    await assert.rejects(() => f.process(d));
    f.setAfterPut(undefined);
    const outputs = await f.transaction((c) =>
      c.repository.outputs(d.docId, 1),
    );
    assert.equal(outputs.length, 1);
    await f.admin.query("alter table document_output disable trigger user");
    try {
      await f.admin.query(
        "update document_output set created_at=now()-interval '10 minutes' where doc_id=$1",
        [d.docId],
      );
    } finally {
      await f.admin.query("alter table document_output enable trigger user");
    }
    let failed = false;
    const maintenance = {
      has: f.maintenance.has,
      async remove(key) {
        assert.equal(
          (
            await f.admin.query(
              "select * from document_cleanup where completed_at is null",
            )
          ).rowCount,
          1,
        );
        await f.maintenance.remove(key);
        if (!failed) {
          failed = true;
          throw Error("Injected delete acknowledgement loss");
        }
      },
    };
    await assert.rejects(() =>
      reconcileDocumentOutputs(f.host, d.docId, 1, maintenance, 300),
    );
    assert.equal(
      (await reconcileDocumentOutputs(f.host, d.docId, 1, maintenance, 3600))
        .removed,
      0,
    );
    assert.equal(
      (await reconcileDocumentOutputs(f.host, d.docId, 1, maintenance, 300))
        .removed,
      1,
    );
    assert.equal(await f.maintenance.has(outputs[0].key), false);
    assert.equal(await f.process(d), "accepted");
    await f.admin.query("alter table document_output disable trigger user");
    try {
      await f.admin.query(
        "update document_output set created_at=now()-interval '10 minutes' where doc_id=$1",
        [d.docId],
      );
    } finally {
      await f.admin.query("alter table document_output enable trigger user");
    }
    assert.equal(
      (await reconcileDocumentOutputs(f.host, d.docId, 1, f.maintenance, 300))
        .removed,
      0,
    );
    await download(f, d);
    const current = await snapshot(f, d);
    assert.equal(current.attempt.state, "ready");
    await assert.rejects(() => f.admin.query("delete from document_cleanup"));
    assert.equal(
      (await f.runtime.pool.query("select * from document_cleanup")).rowCount,
      0,
    );
  });
}, 120000);
