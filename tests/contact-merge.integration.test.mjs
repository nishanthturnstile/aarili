import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  applyContactMerge,
  previewContactMerge,
} from "@aarili/core/customer-history";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withHistoryFixture } from "../scripts/test-support/customer-history.mjs";
import { serviceDraftId } from "../scripts/test-support/small-services.mjs";

const fields = {
  displayName: "survivor",
  phone: "survivor",
  email: "survivor",
  aliases: "survivor",
  notes: "survivor",
};
const create = (name, phone = "9000000138") => ({
  displayName: name,
  phone,
  aliases: [],
  serviceEvidence: {
    noticeId: syntheticCustomerPolicy.notice.id,
    language: "en",
    decision: "grant",
    giver: "self",
    noticeExplained: true,
    source: "in-person",
    occurredAt: new Date().toISOString(),
  },
});
async function request(
  f,
  path,
  body,
  { key = randomUUID(), etag, who = f.a } = {},
) {
  return f.api.fetch(
    new Request(`${f.owner.origin}/api/shops/${who.shop}/${path}`, {
      method: "POST",
      headers: {
        Origin: f.owner.origin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...(etag ? { "If-Match": etag } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}
async function ok(r) {
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  return body;
}
async function prepare(f, sourceId = f.customerId, survivorId, mode = "merge") {
  survivorId ??= (
    await f.ok("customers", { body: create("SYNTHETIC survivor") })
  ).customerId;
  const q = { sourceId, survivorId, mode };
  return { q, v: await f.ok("customer-history/merge-preview", { body: q }) };
}
const command = ({ q, v }, extra = {}) => ({
  ...q,
  fingerprint: v.fingerprint,
  fields,
  orderIds: [],
  reason: "SYNTHETIC explicit identity correction",
  confirmed: true,
  ...extra,
});
async function rawMerge(
  f,
  source,
  survivor,
  key = randomUUID(),
  fieldSources = fields,
) {
  return withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
    const id = randomUUID();
    await tx.execute(
      sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${f.a.shop}::uuid,${id}::uuid,'user',${f.a.user}::uuid,'customer.merge','customer',${source}::uuid,${randomUUID()}::uuid,${key}::uuid,'{"version":2}'::jsonb)`,
    );
    await tx.execute(
      sql`insert into customer_merge_event(shop_id,id,source_id,survivor_id,version,mode,field_sources,actor_id,command_key,request_hash,authority_hash) values(${f.a.shop}::uuid,${id}::uuid,${source}::uuid,${survivor}::uuid,2,'merge',${JSON.stringify(fieldSources)}::jsonb,${f.a.user}::uuid,${key}::uuid,${"a".repeat(64)},${"b".repeat(64)})`,
    );
  });
}
async function stored(f) {
  return (
    await f.admin.query(
      "select order_id,content,digest from order_acceptance_snapshot order by order_id",
    )
  ).rows;
}

test(
  "RH-07/08/12/13/14/15 merge preserves original bytes, selected service overlays, durable retry and reasoned restore",
  { timeout: 240000 },
  () =>
    withHistoryFixture(async (f) => {
      const service = await f.accept(),
        before = await stored(f),
        drafts = (
          await f.admin.query(
            "select id,payload from durable_draft order by id",
          )
        ).rows;
      const p = await prepare(f),
        selected = p.v.associations.find((o) => o.id === service.id);
      assert(selected?.eligible, JSON.stringify(p.v.associations));
      assert(p.v.associations.some((o) => o.exclusion === "wearer"));
      assert.deepEqual(p.v.blocked, []);
      const key = randomUUID(),
        body = command(p, {
          orderIds: [service.id],
          fields: { ...fields, phone: "source" },
        }),
        etag = `"v${p.v.version}"`;
      const original = await f.ok(`customers/${f.customerId}`, {
        method: "GET",
      });
      const sameKey = await Promise.all([
        request(f, "customer-history/merge", body, { key, etag }),
        request(f, "customer-history/merge", body, { key, etag }),
      ]);
      const response = await ok(sameKey[0]);
      assert.deepEqual(await ok(sameKey[1]), response);
      assert.deepEqual(
        await ok(
          await request(f, "customer-history/merge", body, { key, etag }),
        ),
        response,
      );
      assert.equal(
        (
          await request(
            f,
            "customer-history/merge",
            { ...body, reason: "changed" },
            { key, etag },
          )
        ).status,
        422,
      );
      assert.deepEqual(await stored(f), before);
      assert.deepEqual(
        (
          await f.admin.query(
            "select id,payload from durable_draft order by id",
          )
        ).rows,
        drafts,
      );
      const old = await f.ok(`customers/${f.customerId}`, { method: "GET" });
      assert.equal(old.id, original.id);
      assert.equal(old.personId, original.personId);
      assert.equal(old.code, original.code);
      assert.equal(old.mergedInto.id, p.q.survivorId);
      assert.equal(
        (await f.ok(`customers/${p.q.survivorId}`, { method: "GET" })).phone,
        original.phone,
      );
      const search = await f.ok("customers/search", {
        body: { query: original.code },
      });
      assert.equal(search.customers[0].mergedInto.id, p.q.survivorId);
      const history = await f.ok("customer-history", {
        body: { customerId: p.q.survivorId },
      });
      assert.equal(
        history.events.find((e) => e.id === response.id).source.version,
        original.version,
      );
      assert.equal(
        history.events.filter((e) => e.id === response.id).length,
        1,
      );
      assert(
        history.events.some(
          (e) =>
            e.source.id === service.id &&
            e.original.customerId === f.customerId,
        ),
      );
      const oldOrder = await f.ok(`small-services/orders/${service.id}`, {
        method: "GET",
      });
      assert.equal(oldOrder.intake.customerId, f.customerId);
      assert.equal(oldOrder.currentAttribution.customerId, p.q.survivorId);
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      );
      assert.deepEqual(
        await ok(
          await request(f, "customer-history/merge", body, { key, etag }),
        ),
        response,
      );
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      );
      await ok(
        await request(
          f,
          "customers",
          create("SYNTHETIC later active key use"),
          { key },
        ),
      );
      assert.equal(
        (await request(f, "customer-history/merge", body, { key, etag }))
          .status,
        422,
        "active cross-action binding cannot be masked by durable merge history",
      );
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, key],
      );
      const repeatSource = await f.ok(`service-repeats/${service.id}/source`, {
        body: {},
      });
      const candidate = repeatSource.candidates[0];
      await f.ok(`service-repeats/${service.id}/create`, {
        etag: `"v${repeatSource.version}"`,
        body: {
          draftId: serviceDraftId(),
          subjectId: randomUUID(),
          snapshotDigest: repeatSource.snapshotDigest,
          scopeDigest: repeatSource.scopeDigest,
          reuseInstructions: false,
          profile: service.intake.profile,
          selections: [
            {
              key: candidate.key,
              targetLineId: randomUUID(),
              targetKey: service.lines.find((l) => l.id === candidate.lineId)
                .key,
            },
          ],
        },
      });
      const restore = await prepare(f, f.customerId, p.q.survivorId, "restore");
      assert.deepEqual(restore.v.blocked, []);
      assert.equal(
        (
          await request(f, "customer-history/merge", command(restore), {
            etag: `"v${restore.v.version}"`,
          })
        ).status,
        422,
        "all overlays explicitly selected on restore",
      );
      const restored = await ok(
        await request(
          f,
          "customer-history/merge",
          command(restore, { orderIds: [service.id] }),
          { etag: `"v${restore.v.version}"` },
        ),
      );
      assert.equal(restored.version, 3);
      assert.equal(
        (await f.ok(`customers/${f.customerId}`, { method: "GET" })).mergedInto,
        undefined,
      );
      assert.deepEqual(await stored(f), before);
      assert.equal(
        (await request(f, "customer-history/merge", body, { key, etag }))
          .status,
        409,
        "an old merge must not replay after a restore",
      );
      const events = (
        await f.admin.query(
          "select mode from customer_merge_event order by version",
        )
      ).rows.map((r) => r.mode);
      assert.deepEqual(events, ["merge", "restore"]);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from customer_order_attribution",
          )
        ).rows[0].n,
        2,
      );
      await assertIsolationCatalog(f.runtime.db);
    }),
);

test(
  "RH-08/13 preconditions, wrong wearer/shop, alias-cycle and competing survivor correction fail closed",
  { timeout: 240000 },
  () =>
    withHistoryFixture(async (f) => {
      const p = await prepare(f),
        body = command(p),
        etag = `"v${p.v.version}"`;
      assert.equal(
        (await request(f, "customer-history/merge", body)).status,
        428,
      );
      assert.equal(
        (
          await request(
            f,
            "customer-history/merge",
            { ...body, reason: " " },
            { etag },
          )
        ).status,
        422,
      );
      assert.equal(
        (
          await request(
            f,
            "customer-history/merge",
            { ...body, confirmed: false },
            { etag },
          )
        ).status,
        422,
      );
      const wrong = p.v.associations.find((o) => o.exclusion === "wearer");
      assert(wrong);
      assert.equal(
        (
          await request(
            f,
            "customer-history/merge",
            { ...body, orderIds: [wrong.id] },
            { etag },
          )
        ).status,
        422,
      );
      assert.equal(
        (await request(f, "customer-history/merge-preview", p.q, { who: f.b }))
          .status,
        404,
      );
      const current = await f.ok(`customers/${p.q.survivorId}`, {
        method: "GET",
      });
      await f.ok(`customers/${current.id}`, {
        method: "PATCH",
        etag: `"v${current.version}"`,
        body: {
          displayName: "SYNTHETIC independently corrected",
          phone: current.phone,
          aliases: [],
          reason: "SYNTHETIC concurrent correction",
        },
      });
      assert.equal(
        (await request(f, "customer-history/merge", body, { etag })).status,
        412,
      );
      const fresh = await prepare(f, p.q.sourceId, p.q.survivorId);
      const concurrent = await Promise.all([
        request(f, "customer-history/merge", command(fresh), {
          etag: `"v${fresh.v.version}"`,
        }),
        request(f, "customer-history/merge", command(fresh), {
          etag: `"v${fresh.v.version}"`,
        }),
      ]);
      assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 412]);
      const reverse = await prepare(f, p.q.survivorId, p.q.sourceId);
      assert(reverse.v.blocked.includes("alias-conflict"));
      assert.equal(
        (
          await request(f, "customer-history/merge", command(reverse), {
            etag: `"v${reverse.v.version}"`,
          })
        ).status,
        409,
      );
      await assert.rejects(
        () => rawMerge(f, p.q.survivorId, p.q.sourceId),
        (e) => (e.cause?.code ?? e.code) === "23514",
        "SQL rejects alias cycles even if the core is bypassed",
      );
      const fourth = await f.ok("customers", {
          body: create("SYNTHETIC independent fourth"),
        }),
        fifth = await f.ok("customers", {
          body: create("SYNTHETIC independent fifth"),
        });
      await assert.rejects(
        () =>
          rawMerge(f, fourth.customerId, fifth.customerId, randomUUID(), {
            ...fields,
            phone: null,
          }),
        (e) => (e.cause?.code ?? e.code) === "23514",
        "SQL rejects missing field choices including JSON null",
      );
      const existingKey = (
        await f.admin.query(
          "select command_key from customer_merge_event limit 1",
        )
      ).rows[0].command_key;
      await assert.rejects(
        () => rawMerge(f, fourth.customerId, fifth.customerId, existingKey),
        (e) => (e.cause?.code ?? e.code) === "23505",
        "durable command uniqueness enforced by PostgreSQL",
      );
      const foreign = await ok(
        await request(f, "customers", create("SYNTHETIC foreign contact"), {
          who: f.b,
        }),
      );
      await assert.rejects(
        () => rawMerge(f, foreign.customerId, fourth.customerId),
        (e) => (e.cause?.code ?? e.code) === "23503",
        "typed same-shop FK rejects an otherwise valid cross-shop merge",
      );
      const third = await f.ok("customers", {
        body: create("SYNTHETIC third contact"),
      });
      const chain = await prepare(f, p.q.survivorId, third.customerId);
      assert(chain.v.blocked.includes("alias-conflict"));
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from customer_merge_event",
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "RH-08/14 populated upgrade, forced isolation, SQL invariants and actual-relink rollback/write-disable recovery",
  { timeout: 240000 },
  () =>
    withHistoryFixture(
      async (f) => {
        const before = await stored(f);
        await migrateDatabase(f.migrationConnectionString);
        await assertIsolationCatalog(f.runtime.db);
        assert.deepEqual(await stored(f), before);
        const service = await f.accept(),
          p = await prepare(f),
          body = command(p, {
            orderIds: [service.id],
            fields: { ...fields, phone: "source" },
          });
        const survivorBefore = await f.ok(`customers/${p.q.survivorId}`, {
          method: "GET",
        });
        await f.admin.query(
          "create function reject_merge_evidence_test() returns trigger language plpgsql as $$ begin if new.fields ? 'contactAlias' then raise exception 'injected after actual relink'; end if; return new; end $$; create trigger reject_merge_evidence_test before insert on identity_revision_evidence for each row execute function reject_merge_evidence_test()",
        );
        assert.equal(
          (
            await request(f, "customer-history/merge", body, {
              etag: `"v${p.v.version}"`,
            })
          ).status,
          503,
        );
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int as n from customer_merge_event",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int as n from customer_order_attribution",
            )
          ).rows[0].n,
          0,
        );
        assert.deepEqual(
          await f.ok(`customers/${p.q.survivorId}`, { method: "GET" }),
          survivorBefore,
          "survivor correction rolls back with the failed alias/relink transaction",
        );
        assert.equal(
          (
            await f.admin.query(
              "select count(*)::int as n from audit_event where action='customer.merge'",
            )
          ).rows[0].n,
          0,
        );
        await f.admin.query(
          "drop trigger reject_merge_evidence_test on identity_revision_evidence; drop function reject_merge_evidence_test(); revoke insert on customer_merge_event from app_user",
        );
        assert.equal(
          (
            await request(f, "customer-history/merge", body, {
              etag: `"v${p.v.version}"`,
            })
          ).status,
          503,
        );
        assert.equal(
          (await f.ok(`customers/${f.customerId}`, { method: "GET" }))
            .mergedInto,
          undefined,
        );
        await f.admin.query("grant insert on customer_merge_event to app_user");
        await ok(
          await request(f, "customer-history/merge", body, {
            etag: `"v${p.v.version}"`,
          }),
        );
        assert.deepEqual(
          (await f.runtime.pool.query("select id from customer_merge_event"))
            .rows,
          [],
        );
        await assert.rejects(() =>
          withShop(f.runtime.db, f.b.user, f.b.shop, (tx) =>
            tx.execute(
              sql`insert into customer_order_attribution(shop_id,event_id,order_id,version,original_customer_id,current_customer_id) values(${f.b.shop}::uuid,${randomUUID()}::uuid,${service.id}::uuid,1,${f.customerId}::uuid,${p.q.survivorId}::uuid)`,
            ),
          ),
        );
        await assert.rejects(() =>
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(sql`update customer_merge_event set mode='restore'`),
          ),
        );
        await assert.rejects(() =>
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`select redact_identity_reason(${f.a.shop}::uuid,${randomUUID()}::uuid,${randomUUID()}::uuid)`,
            ),
          ),
        );
      },
      { migrationThrough: "0040_identity_review.sql" },
    ),
);

test(
  "RH-07/08/13 merge-versus-repeat and acceptance locks, current authority replay and audited privacy redaction",
  { timeout: 240000 },
  () =>
    withHistoryFixture(async (f) => {
      const service = await f.accept(),
        p = await prepare(f);
      let release, entered;
      const gate = new Promise((r) => {
          release = r;
        }),
        ready = new Promise((r) => {
          entered = r;
        });
      let frozen;
      const holding = f.owner.withOwnerHistory(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        async (ctx) => {
          frozen = await previewContactMerge(ctx, p.q);
          entered();
          await gate;
        },
      );
      await ready;
      const repeat = f.ok(`service-repeats/${service.id}/source`, {
        body: {},
      });
      let waiting = false;
      try {
        for (let i = 0; i < 100 && !waiting; i++) {
          waiting = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and (query like '%pg_advisory_xact_lock%' or query like '%customer_person%')) as waiting",
            )
          ).rows[0].waiting;
          if (!waiting) await new Promise((r) => setTimeout(r, 20));
        }
        assert(
          waiting,
          "repeat source review must wait for the same accepted-order lock",
        );
      } finally {
        release();
        await holding;
      }
      await repeat;
      await f.accept();
      assert.equal(
        (
          await request(
            f,
            "customer-history/merge",
            command({ q: p.q, v: frozen }),
            { etag: `"v${frozen.version}"` },
          )
        ).status,
        412,
        "new accepted association invalidates review",
      );
      const fresh = await prepare(f, p.q.sourceId, p.q.survivorId),
        key = randomUUID(),
        body = command(fresh),
        etag = `"v${fresh.v.version}"`;
      const w = await f.ok(`customers/${f.customerId}/wearers/${f.wearerId}`, {
        method: "GET",
      });
      let allowCommit, merged;
      const commitGate = new Promise((r) => {
          allowCommit = r;
        }),
        inserted = new Promise((r) => {
          merged = r;
        });
      const committing = f.owner.withOwnerHistory(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        async (ctx) => {
          const result = await applyContactMerge(ctx, body, {
            key,
            ifMatch: etag,
            requestId: randomUUID(),
          });
          merged();
          await commitGate;
          return result;
        },
      );
      await inserted;
      const withdrawing = f.ok(
        `customers/${f.customerId}/wearers/${f.wearerId}/consent-events`,
        {
          etag: `"v${w.version}"`,
          body: {
            purpose: "service",
            decision: "withdrawal",
            noticeId: syntheticWearerPolicy.notice.id,
            noticeExplained: true,
            language: "en",
            giverPersonId: w.personId,
            source: "in-person",
            occurredAt: new Date().toISOString(),
          },
        },
      );
      let authorityWaiting = false;
      try {
        for (let i = 0; i < 100 && !authorityWaiting; i++) {
          authorityWaiting = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and (query like '%pg_advisory_xact_lock%' or query like '%customer_person%')) as waiting",
            )
          ).rows[0].waiting;
          if (!authorityWaiting) await new Promise((r) => setTimeout(r, 20));
        }
        assert(
          authorityWaiting,
          "permission withdrawal must serialize behind the merge authority locks",
        );
      } finally {
        allowCommit();
      }
      const saved = (await committing).data;
      await withdrawing;
      assert.equal(
        (await request(f, "customer-history/merge", body, { key, etag }))
          .status,
        409,
      );
      const withheld = await prepare(
        f,
        p.q.sourceId,
        p.q.survivorId,
        "restore",
      );
      assert(withheld.v.blocked.includes("wearer-conflict"));
      assert(
        withheld.v.associations.every((o) => o.wearerId !== f.wearerId),
        "no source code/digest for inaccessible wearer work reaches the preview",
      );
      const client = await f.admin.connect();
      try {
        await client.query("begin");
        await client.query("set local role app_privacy");
        await client.query(
          "select set_config('app.user_id',$1,true),set_config('app.shop_id',$2,true),set_config('app.actor_id',$1,true)",
          [f.a.user, f.a.shop],
        );
        await client.query("select redact_identity_reason($1,$2,$3)", [
          f.a.shop,
          saved.id,
          randomUUID(),
        ]);
        await client.query("commit");
      } finally {
        client.release();
      }
      const event = (
        await f.ok("customer-history", { body: { customerId: p.q.survivorId } })
      ).events.find((e) => e.id === saved.id);
      assert.equal(event.reason, null);
      assert.equal(event.redacted, true);
      assert.equal(event.original.customerId, p.q.sourceId);
      assert.equal(
        (
          await f.admin.query(
            "select field_sources::text like '%SYNTHETIC%' as leaked from customer_merge_event where id=$1",
            [saved.id],
          )
        ).rows[0].leaked,
        false,
      );
    }),
);
