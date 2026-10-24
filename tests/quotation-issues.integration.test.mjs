import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { issueDocument } from "@aarili/core/documents";
import {
  issueQuotation,
  recordQuoteResponse,
} from "@aarili/core/quotation-issues";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withQuotationIssues } from "../scripts/test-support/quotation-issue-fixtures.mjs";

const read = (f, e) =>
  f.setup("quotation-issues/read", {
    body: { docId: e.docId, revision: e.revision },
  });
const issue = (f, c, key = randomUUID()) =>
  f.setup("quotation-issues", { body: c.input, key, etag: `"v${c.version}"` });
const snapshot = async (f) =>
  (
    await f.admin.query(
      "select (select jsonb_agg(to_jsonb(o) order by id) from garment_order o) orders,(select jsonb_agg(content order by order_id) from order_acceptance_snapshot) accepted,(select jsonb_agg(to_jsonb(d) order by order_id) from order_capacity_demand d) demand,(select count(*) from journal_batch) journal",
    )
  ).rows[0];

test("C-04/09 populated 0055 upgrade preserves existing proposal, issued document, queued locator and stored bytes", {
  timeout: 300000,
}, () => {
  let old, before, bytes, proposal;
  const history = async (f) =>
    (
      await f.admin.query(
        "select (select jsonb_agg(to_jsonb(d) order by doc_id,revision) from document_revision d) documents,(select jsonb_agg(to_jsonb(a) order by doc_id,revision) from document_artifact a) artifacts,(select jsonb_agg(data order by id) from pgboss.job where name='pdf.render') jobs",
      )
    ).rows[0];
  return withQuotationIssues(
    async (f) => {
      await migrateDatabase(f.migrationConnectionString);
      assert.deepEqual(await history(f), before);
      assert.deepEqual(
        await f.setup("quotations/read", { body: { id: f.proposalId } }),
        proposal,
      );
      const response = await f.request(`documents/${old.docId}/1/file`, {
        method: "GET",
      });
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
      assert.equal(
        (await f.admin.query("select * from quotation_issue")).rowCount,
        0,
      );
      assert.equal(
        (await issue(f, await f.issueInput())).entry.number,
        "QT-000001",
      );
    },
    {
      migrationThrough: "0055_booking_quotations.sql",
      beforeUpgrade: async (f) => {
        proposal = await f.setup("quotations/read", {
          body: { id: f.proposalId },
        });
        old = await f.transaction((c) =>
          issueDocument(
            c.documents,
            {
              docId: randomUUID(),
              revision: 1,
              template: "synthetic.document",
              templateRevision: 1,
              language: "ta",
              paper: "A4",
              model: {
                title: "SYNTHETIC pre-existing document",
                lines: ["SYNTHETIC retained bytes"],
              },
            },
            randomUUID(),
          ),
        );
        assert.equal(await f.process(old), "accepted");
        const response = await f.request(`documents/${old.docId}/1/file`, {
          method: "GET",
        });
        assert.equal(response.status, 200);
        bytes = Buffer.from(await response.arrayBuffer());
        before = await history(f);
      },
    },
  );
});
test(
  "C-01/02/04/05/06/09 exact numbered issue, durable replay, revision responses and unchanged accepted money/capacity",
  { timeout: 300000 },
  () =>
    withQuotationIssues(async (f) => {
      const privateProposal = await f.setup("quotations/read", {
        body: { id: f.proposalId },
      });
      assert.equal(
        privateProposal.version.privateCosts.shared.amountPaise,
        2501,
      );
      const before = await snapshot(f),
        c = await f.issueInput(),
        key = randomUUID();
      assert.equal(
        (await f.request("quotation-issues", { body: c.input, key })).status,
        428,
      );
      const concurrent = await Promise.all([
        issue(f, c, key),
        issue(f, c, key),
      ]);
      assert.deepEqual(concurrent[0], concurrent[1]);
      const e = concurrent[0].entry;
      assert.equal(e.number, "QT-000001");
      assert.equal(concurrent[0].status.state, "pending");
      assert.equal(
        (
          await f.request("quotation-issues", {
            body: c.input,
            etag: `"v${c.version}"`,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await f.request("quotation-issues", {
            body: { ...c.input, reason: "changed" },
            key,
            etag: `"v${c.version}"`,
          })
        ).status,
        422,
      );
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      );
      assert.equal((await issue(f, c, key)).entry.number, e.number);
      const r = await read(f, e);
      assert.equal(r.model.proposal.totalPaise, 195000);
      assert(!JSON.stringify(r.model).includes("privateCosts"));
      assert(!JSON.stringify(r.model).includes("PRIVATE"));
      assert.equal(r.events.length, 0);
      const response = {
          docId: e.docId,
          revision: e.revision,
          modelHash: e.modelHash,
          previousId: null,
          acknowledged: true,
          value: {
            kind: "rejected",
            respondentCustomerId: r.respondentCustomerIds[0],
            reportedAt: new Date(Date.now() - 1000).toISOString(),
            channel: "verbal",
            evidence: "SYNTHETIC evidence",
            reason: "SYNTHETIC rejection",
          },
        },
        responseKey = randomUUID();
      const first = await f.setup("quotation-issues/response", {
        body: response,
        key: responseKey,
        etag: '"v1"',
      });
      const correction = {
        ...response,
        previousId: first.event.id,
        value: {
          ...response.value,
          kind: "approved",
          reason: "SYNTHETIC correction",
        },
      };
      await f.setup("quotation-issues/response", {
        body: correction,
        etag: '"v2"',
      });
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, responseKey],
      );
      assert.deepEqual(
        await f.setup("quotation-issues/response", {
          body: response,
          key: responseKey,
          etag: '"v1"',
        }),
        first,
      );
      assert.equal(
        (
          await f.request("quotation-issues/response", {
            body: response,
            etag: '"v1"',
          })
        ).status,
        412,
      );
      assert.equal(
        (
          await f.request("quotation-issues/read", {
            who: f.b,
            body: { docId: e.docId, revision: e.revision },
          })
        ).status,
        404,
      );
      assert.equal(
        (await f.runtime.pool.query("select * from quotation_issue")).rowCount,
        0,
      );
      await assert.rejects(
        f.admin.query(
          "update quotation_issue set number='QT-999999' where shop_id=$1",
          [f.a.shop],
        ),
      );
      const oldModel = JSON.stringify((await read(f, e)).model),
        nextProposal = await f.revise(),
        next = await f.issueInput(nextProposal, { language: "en" });
      const competing = await Promise.allSettled([
        f.transaction((ctx) =>
          issueQuotation(ctx, next.input, randomUUID(), `"v${next.version}"`),
        ),
        f.transaction((ctx) =>
          issueQuotation(ctx, next.input, randomUUID(), `"v${next.version}"`),
        ),
      ]);
      assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        competing.find((r) => r.status === "rejected").reason.status,
        409,
      );
      const issued = competing.find((r) => r.status === "fulfilled").value;
      assert.equal(issued.entry.number, "QT-000002");
      assert.equal(issued.entry.revision, 2);
      assert.equal((await read(f, issued.entry)).events.length, 0);
      const historical = await read(f, e);
      assert.equal(historical.historical, true);
      assert.equal(historical.events.length, 2);
      assert.equal(JSON.stringify(historical.model), oldModel);
      assert.deepEqual(await snapshot(f), before);
      await assertIsolationCatalog(f.runtime.db);
    }),
);

test(
  "C-02/03/04/06/08/09 real queue rollback, storage/render retries, immutable bytes and audited purge",
  { timeout: 300000 },
  () =>
    withQuotationIssues(async (f) => {
      const c = await f.issueInput(),
        key = randomUUID();
      await assert.rejects(
        f.transaction(async (ctx) => {
          const enqueue = ctx.documents.jobs.enqueue;
          ctx.documents.jobs = {
            ...ctx.documents.jobs,
            enqueue: async (a) => {
              await enqueue(a);
              throw Error("injected enqueue commit failure");
            },
          };
          return issueQuotation(ctx, c.input, key, `"v${c.version}"`);
        }),
        /injected/,
      );
      assert.equal(
        (await f.admin.query("select * from quotation_issue")).rowCount,
        0,
      );
      assert.equal(
        (await f.admin.query("select * from quotation_counter")).rowCount,
        0,
      );
      assert.equal(
        (
          await f.admin.query(
            "select * from pgboss.job where name='pdf.render'",
          )
        ).rowCount,
        0,
      );
      const issued = await issue(f, c, key),
        e = issued.entry;
      f.failRender(true);
      await assert.rejects(f.process(e), /Injected/);
      assert.equal((await read(f, e)).status.state, "failed");
      f.failRender(false);
      f.failPut(true);
      await assert.rejects(f.process(e), /Injected/);
      f.failPut(false);
      f.afterPut(() => {
        throw Error("Injected post-storage failure");
      });
      await assert.rejects(f.process(e), /Injected post-storage/);
      assert.equal(
        (await f.admin.query("select * from document_artifact")).rowCount,
        0,
      );
      f.afterPut(undefined);
      const retryRace = await Promise.allSettled([f.process(e), f.process(e)]);
      assert(
        retryRace.some(
          (r) => r.status === "fulfilled" && r.value === "accepted",
        ),
      );
      for (const result of retryRace)
        if (result.status === "rejected")
          assert.equal(result.reason.message, "DOCUMENT_BUSY");
      assert.equal(
        (await f.admin.query("select * from document_artifact")).rowCount,
        1,
      );
      const getFile = () =>
        f.request(`documents/${e.docId}/${e.revision}/file`, {
          method: "GET",
        });
      const file = await getFile();
      assert.equal(file.status, 200);
      const bytes = Buffer.from(await file.arrayBuffer()),
        sha = createHash("sha256").update(bytes).digest("hex");
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.equal((await read(f, e)).status.sha256, sha);
      const p = await f.setup("settings/profile", { method: "GET" });
      await f.setup("settings/profile", {
        method: "PUT",
        etag: `"v${p.version}"`,
        body: {
          ...p.profile,
          displayName: "SYNTHETIC later profile",
          address: "SYNTHETIC changed address",
        },
      });
      assert.deepEqual(
        Buffer.from(await (await getFile()).arrayBuffer()),
        bytes,
      );
      assert.equal((await read(f, e)).status.sha256, sha);
      const privacy = await f.admin.connect();
      await privacy.query("begin");
      try {
        await privacy.query("set local role app_privacy");
        await privacy.query(
          "select set_config('app.user_id',$1,true),set_config('app.shop_id',$2,true),set_config('app.actor_id',$1,true)",
          [f.a.user, f.a.shop],
        );
        await privacy.query("select redact_quotation($1,$2,$3,$4)", [
          f.a.shop,
          e.docId,
          e.revision,
          randomUUID(),
        ]);
        await privacy.query("commit");
      } catch (err) {
        await privacy.query("rollback");
        throw err;
      } finally {
        privacy.release();
      }
      assert.equal((await getFile()).status, 404);
      assert.equal(
        (
          await f.request("quotation-issues", {
            body: c.input,
            key,
            etag: `"v${c.version}"`,
          })
        ).status,
        403,
      );
      const purges = (
        await f.admin.query(
          "select data from pgboss.job where name='media.process' and data->>'kind'='quotation-purge'",
        )
      ).rows;
      assert.equal(purges.length, 1);
      assert.equal(
        await f.composition.handlers.get("media.process")(
          f.parallel.db,
          purges[0].data,
          async () => {},
        ),
        "accepted",
      );
      const rows = (
        await f.admin.query(
          "select model from document_revision where template='quotation'",
        )
      ).rows;
      assert.deepEqual(rows[0].model, {});
      assert.equal(
        (await f.admin.query("select * from quotation_purge_receipt")).rowCount,
        (
          await f.admin.query(
            "select count(distinct object_key)::int as n from document_output",
          )
        ).rows[0].n,
      );
      assert.equal(
        (await f.admin.query("select number from quotation_issue")).rows[0]
          .number,
        "QT-000001",
      );
    }),
);

test(
  "C-01/02/03/05/09 source staleness, response CAS, privacy-before-render and restore fences",
  { timeout: 300000 },
  () =>
    withQuotationIssues(async (f) => {
      const c = await f.issueInput();
      const p = await f.setup("settings/profile", { method: "GET" });
      await f.setup("settings/profile", {
        method: "PUT",
        etag: `"v${p.version}"`,
        body: {
          ...p.profile,
          address: "SYNTHETIC profile changed after review",
        },
      });
      assert.equal(
        (
          await f.request("quotation-issues", {
            body: c.input,
            etag: `"v${c.version}"`,
          })
        ).status,
        412,
      );
      const fresh = await f.issueInput(),
        issued = await issue(f, fresh),
        e = issued.entry,
        r = await read(f, e);
      const v = {
        docId: e.docId,
        revision: e.revision,
        modelHash: e.modelHash,
        previousId: null,
        acknowledged: true,
        value: {
          kind: "approved",
          respondentCustomerId: r.respondentCustomerIds[0],
          reportedAt: new Date(Date.now() - 1000).toISOString(),
          channel: "manual-message",
          evidence: "SYNTHETIC",
          reason: "SYNTHETIC",
        },
      };
      const race = await Promise.allSettled([
        f.transaction((ctx) =>
          recordQuoteResponse(ctx, v, randomUUID(), '"v1"'),
        ),
        f.transaction((ctx) =>
          recordQuoteResponse(
            ctx,
            { ...v, value: { ...v.value, kind: "rejected" } },
            randomUUID(),
            '"v1"',
          ),
        ),
      ]);
      assert.equal(race.filter((v) => v.status === "fulfilled").length, 1);
      assert.equal(
        race.find((v) => v.status === "rejected").reason.status,
        412,
      );
      const job = await f.job(e);
      await f.admin.query("update system_state set side_effects_enabled=false");
      assert.equal(await f.process(e), "quarantined");
      await f.admin.query(
        "update system_state set side_effects_enabled=true,restore_epoch=$1",
        [randomUUID()],
      );
      assert.equal(
        await f.composition.handlers.get("pdf.render")(
          f.parallel.db,
          job,
          async () => {},
        ),
        "quarantined",
      );
      assert.equal(
        (
          await f.admin.query(
            "select * from document_artifact where doc_id=$1",
            [e.docId],
          )
        ).rowCount,
        0,
      );
      await f.admin.query("update system_state set restore_epoch=$1", [
        job.epoch,
      ]);
      await f.admin.query(
        "update customer_wearer_relationship set authorised=false,authorisation_declined=true where shop_id=$1 and customer_id=$2 and wearer_id=$3",
        [f.a.shop, f.seed.customer.customerId, f.seed.wearer.wearerId],
      );
      assert.equal(
        (
          await f.request("quotation-issues/read", {
            body: { docId: e.docId, revision: e.revision },
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await f.request("quotation-issues/response", {
            body: v,
            etag: '"v1"',
          })
        ).status,
        404,
      );
      await assert.rejects(f.process(e), (error) => error.status === 403);
      assert.equal(
        (
          await f.admin.query(
            "select * from document_artifact where doc_id=$1",
            [e.docId],
          )
        ).rowCount,
        0,
      );
    }),
);
