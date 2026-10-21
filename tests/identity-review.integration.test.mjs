import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { previewCustomerPair } from "@aarili/core/customer-history";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withHistoryFixture } from "../scripts/test-support/customer-history.mjs";

const contact = (name, phone) => ({
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

test(
  "RH-08/13 pair contact locks serialize new relationships and tenant pair FKs fail closed",
  { timeout: 240000 },
  () =>
    withHistoryFixture(async (f) => {
      const c = await f.ok(`customers/${f.customerId}`, { method: "GET" }),
        other = await f.ok("customers", {
          body: contact(c.displayName, c.phone),
        });
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
          frozen = await previewCustomerPair(ctx, {
            firstId: c.id,
            secondId: other.customerId,
          });
          entered();
          await gate;
        },
      );
      await ready;
      const registration = f.ok(`customers/${c.id}/wearers`, {
        body: {
          mode: "new",
          displayName: "SYNTHETIC concurrently linked",
          age: "unknown",
          preferences: {
            language: "",
            channel: "",
            fit: "",
            style: "",
            delivery: "",
            source: "",
          },
          relationship: {
            kind: "family",
            statementByPersonId: c.personId,
            authorised: false,
            informed: false,
            source: "in-person",
            occurredAt: new Date().toISOString(),
            interaction: "SYNTHETIC concurrent registration",
          },
        },
      });
      try {
        let waiting = false;
        for (let i = 0; i < 100 && !waiting; i++) {
          waiting = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%customer_person%' and query ilike '%for share%') as waiting",
            )
          ).rows[0].waiting;
          if (!waiting) await new Promise((r) => setTimeout(r, 20));
        }
        assert(waiting, "registration must wait on the pair contact lock");
      } finally {
        release();
        await holding;
      }
      await registration;
      assert.equal(
        (
          await request(f, "customer-history/decision", decision(frozen), {
            etag: `"v${frozen.version}"`,
          })
        ).status,
        412,
      );
      const foreign = await ok(
        await request(
          f,
          "customers",
          contact("SYNTHETIC foreign contact", ""),
          { who: f.b },
        ),
      );
      const [first, second] = [c.id, foreign.customerId].sort(),
        id = randomUUID(),
        key = randomUUID();
      await assert.rejects(
        () =>
          withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
            await tx.execute(
              sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${f.a.shop}::uuid,${id}::uuid,'user',${f.a.user}::uuid,'customer.pair-review','customer',${first}::uuid,${randomUUID()}::uuid,${key}::uuid,'{"version":2}'::jsonb)`,
            );
            await tx.execute(
              sql`insert into customer_pair_review(shop_id,id,first_id,second_id,first_version,second_version,version,decision,actor_id,command_key,request_hash) values(${f.a.shop}::uuid,${id}::uuid,${first}::uuid,${second}::uuid,1,1,2,'dismiss',${f.a.user}::uuid,${key}::uuid,${"a".repeat(64)})`,
            );
          }),
        (e) => (e.cause?.code ?? e.code) === "23503",
      );
      const noContext = await f.runtime.pool.query(
        "select id from customer_pair_review",
      );
      assert.deepEqual(noContext.rows, []);
    }),
);

test(
  "RH-07/08/13/14 populated upgrade, wearer name correction, withdrawal and write-disable recovery",
  { timeout: 240000 },
  () =>
    withHistoryFixture(
      async (f) => {
        const before = (
          await f.admin.query(
            "select order_id,content,digest from order_acceptance_snapshot order by order_id",
          )
        ).rows;
        const drafts = (
          await f.admin.query(
            "select id,payload from durable_draft order by id",
          )
        ).rows;
        await migrateDatabase(f.migrationConnectionString);
        await assertIsolationCatalog(f.runtime.db);
        assert.deepEqual(
          (
            await f.admin.query(
              "select order_id,content,digest from order_acceptance_snapshot order by order_id",
            )
          ).rows,
          before,
        );
        assert.deepEqual(
          (
            await f.admin.query(
              "select id,payload from durable_draft order by id",
            )
          ).rows,
          drafts,
        );
        const c = await f.ok(`customers/${f.customerId}`, { method: "GET" }),
          second = await f.ok("customers", {
            body: contact(c.displayName, c.phone),
          });
        const preferences = {
          language: "",
          channel: "",
          fit: "",
          style: "",
          delivery: "",
          source: "",
        };
        const relationship = {
          kind: "family",
          statementByPersonId: c.personId,
          authorised: true,
          informed: true,
          source: "in-person",
          occurredAt: new Date().toISOString(),
          interaction: "SYNTHETIC distinct wearer authority",
        };
        const created = await f.ok(`customers/${c.id}/wearers`, {
          body: {
            mode: "new",
            displayName: "SYNTHETIC original wearer",
            age: "adult",
            preferences,
            relationship,
          },
        });
        const path = `customers/${c.id}/wearers/${created.wearerId}`;
        let w = await f.ok(path, { method: "GET" });
        const purpose = {
          purpose: "service",
          decision: "grant",
          noticeId: syntheticWearerPolicy.notice.id,
          noticeExplained: true,
          language: "en",
          giverPersonId: w.personId,
          source: "in-person",
          occurredAt: new Date().toISOString(),
        };
        await f.ok(`${path}/consent-events`, {
          body: purpose,
          etag: `"v${w.version}"`,
        });
        w = await f.ok(path, { method: "GET" });
        const edit = {
          age: w.age,
          preferences,
          relationship: {
            ...relationship,
            authorisationDeclined: false,
            informedDeclined: false,
          },
          displayName: "SYNTHETIC corrected wearer",
          reason: "SYNTHETIC name spelling correction",
        };
        await f.ok(path, {
          method: "PATCH",
          body: edit,
          etag: `"v${w.version}"`,
        });
        const renamed = await pair(f, c.id, second.customerId);
        assert(
          renamed.contacts
            .flatMap((x) => x.wearers)
            .some((x) => x.displayName === edit.displayName),
        );
        const evidence = (await f.history({ limit: 25 })).events.find(
          (e) => e.action === "wearer.update" && e.source.id === w.id,
        );
        assert.deepEqual(evidence.fields, ["displayName"]);
        w = await f.ok(path, { method: "GET" });
        await f.ok(`${path}/consent-events`, {
          body: { ...purpose, decision: "withdrawal" },
          etag: `"v${w.version}"`,
        });
        let denied = await pair(f, c.id, second.customerId);
        const hidden = denied.contacts
          .flatMap((x) => x.wearers)
          .find((x) => x.id === w.id);
        assert.equal(hidden.displayName, null);
        assert.equal(hidden.eligible, false);
        assert.equal(
          (
            await request(f, "customer-history/decision", decision(renamed), {
              etag: `"v${renamed.version}"`,
            })
          ).status,
          412,
        );
        // Revocation does not merge people or convey consent to the other contact.
        w = await f.ok(path, { method: "GET" });
        await f.ok(path, {
          method: "PATCH",
          etag: `"v${w.version}"`,
          body: {
            ...edit,
            age: "minor",
            reason: "SYNTHETIC age correction requires guardian review",
          },
        });
        denied = await pair(f, c.id, second.customerId);
        const minor = denied.contacts
          .flatMap((x) => x.wearers)
          .find((x) => x.id === w.id);
        assert.equal(minor.age, "minor");
        assert.equal(minor.guardianVerified, false);
        assert.equal(minor.eligible, false);
        assert.equal(minor.displayName, null);
        const response = await ok(
          await request(f, "customer-history/decision", decision(denied), {
            etag: `"v${denied.version}"`,
          }),
        );
        await f.admin.query(
          "revoke insert on customer_pair_review from app_user",
        );
        const auditCount = (
          await f.admin.query("select count(*)::int as n from audit_event")
        ).rows[0].n;
        const read = await pair(f, c.id, second.customerId);
        assert.equal(read.decisions[0].id, response.id);
        assert.equal(
          (
            await request(f, "customer-history/decision", decision(read), {
              etag: `"v${read.version}"`,
            })
          ).status,
          503,
        );
        assert.equal(
          (await pair(f, c.id, second.customerId)).decisions.length,
          1,
        );
        assert.equal(
          (await f.admin.query("select count(*)::int as n from audit_event"))
            .rows[0].n,
          auditCount,
        );
        assert.deepEqual(
          (
            await f.admin.query(
              "select order_id,content,digest from order_acceptance_snapshot order by order_id",
            )
          ).rows,
          before,
        );
      },
      { migrationThrough: "0039_customer_history_indexes.sql" },
    ),
);
function request(
  f,
  path,
  body,
  { key = randomUUID(), etag, who = f.a, origin = f.owner.origin } = {},
) {
  return f.api.fetch(
    new Request(`${f.owner.origin}/api/shops/${who.shop}/${path}`, {
      method: "POST",
      headers: {
        Origin: origin,
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
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
const pair = (f, a, b) =>
  f.ok("customer-history/pair", { body: { firstId: a, secondId: b } });
const decision = (p, reason = "SYNTHETIC distinct people") => ({
  firstId: p.contacts[0].customer.id,
  secondId: p.contacts[1].customer.id,
  fingerprint: p.fingerprint,
  decision: "keep-separate",
  reason,
});

test(
  "RH-07/08/12/13/14/15 shared-phone manual decisions, durable replay, races, isolation and retained originals",
  { timeout: 240000 },
  () =>
    withHistoryFixture(async (f) => {
      await assertIsolationCatalog(f.runtime.db);
      const c = await f.ok(`customers/${f.customerId}`, { method: "GET" });
      const second = await f.ok("customers", {
        body: contact("SYNTHETIC another person", c.phone || "9000000789"),
      });
      if (!c.phone)
        await f.ok(`customers/${c.id}`, {
          method: "PATCH",
          etag: `"v${c.version}"`,
          body: {
            displayName: c.displayName,
            phone: "9000000789",
            aliases: c.aliases,
            reason: "SYNTHETIC shared household phone",
          },
        });
      const candidates = await f.ok("customer-history/candidates", {
        body: { customerId: c.id },
      });
      assert(
        candidates.candidates
          .find((x) => x.customer.id === second.customerId)
          .reasons.includes("phone"),
      );
      const original = (
        await f.admin.query(
          "select order_id,content,digest from order_acceptance_snapshot order by order_id",
        )
      ).rows;
      const p = await pair(f, c.id, second.customerId);
      assert.notEqual(p.contacts[0].customer.code, p.contacts[1].customer.code);
      const key = randomUUID(),
        body = decision(p),
        headers = { key, etag: `"v${p.version}"` };
      assert.equal(
        (await request(f, "customer-history/decision", body, { key })).status,
        428,
      );
      assert.equal(
        (
          await request(
            f,
            "customer-history/decision",
            { ...body, reason: "" },
            headers,
          )
        ).status,
        422,
      );
      const races = await Promise.all([
        request(f, "customer-history/decision", body, headers),
        request(f, "customer-history/decision", body, {
          key: randomUUID(),
          etag: headers.etag,
        }),
      ]);
      assert.deepEqual(races.map((r) => r.status).sort(), [200, 412]);
      const successful = await ok(races.find((r) => r.status === 200));
      const stored = (
        await f.admin.query(
          "select command_key from customer_pair_review where id=$1",
          [successful.id],
        )
      ).rows[0].command_key;
      const exact = { key: stored, etag: headers.etag };
      assert.deepEqual(
        await ok(await request(f, "customer-history/decision", body, exact)),
        successful,
      );
      assert.equal(
        (
          await request(
            f,
            "customer-history/decision",
            { ...body, decision: "dismiss" },
            exact,
          )
        ).status,
        422,
      );
      await f.admin.query(
        "delete from idempotency_key where shop_id=$1 and key=$2",
        [f.a.shop, stored],
      );
      assert.deepEqual(
        await ok(await request(f, "customer-history/decision", body, exact)),
        successful,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from customer_pair_review",
          )
        ).rows[0].n,
        1,
      );
      const reviewed = await pair(f, c.id, second.customerId);
      assert.equal(reviewed.decisions[0].reason, body.reason);
      assert.equal(reviewed.decisions[0].actorId, f.a.user);
      const dismissed = await ok(
        await request(
          f,
          "customer-history/decision",
          { ...decision(reviewed), decision: "dismiss" },
          { etag: `"v${reviewed.version}"` },
        ),
      );
      assert.equal(dismissed.version, 3);
      const reappears = await f.ok("customer-history/candidates", {
        body: { customerId: c.id },
      });
      assert.equal(
        reappears.candidates.find((x) => x.customer.id === second.customerId)
          .decision,
        "dismiss",
      );
      assert.equal(
        (
          await request(
            f,
            "customer-history/pair",
            { firstId: c.id, secondId: second.customerId },
            { who: f.b },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(f, "customer-history/pair", {
            firstId: c.id,
            secondId: c.id,
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await request(
            f,
            "customer-history/candidates",
            { customerId: c.id },
            { origin: "https://foreign.example" },
          )
        ).status,
        403,
      );
      assert.deepEqual(
        (
          await f.admin.query(
            "select order_id,content,digest from order_acceptance_snapshot order by order_id",
          )
        ).rows,
        original,
      );
      assert.equal(
        (await f.history({ limit: 25 })).events.filter(
          (e) => e.action === "customer.pair-review",
        ).length,
        2,
      );
      const latestReview = (await f.history({ limit: 25 })).events.find(
        (e) => e.action === "customer.pair-review",
      );
      assert.equal(latestReview.source.id, p.contacts[0].customer.id);
      assert.equal(latestReview.source.version, p.contacts[0].customer.version);
      assert.equal(latestReview.original.customerId, p.contacts[0].customer.id);
      assert(
        latestReview.facts.some(
          (x) => x.field === "pairVersion" && x.value === "3",
        ),
      );
      assert(
        latestReview.facts.some(
          (x) => x.field === "decision" && x.value === "dismiss",
        ),
      );
      const other = await f.ok("customer-history", {
        body: { customerId: second.customerId, limit: 25 },
      });
      assert.equal(
        other.events.filter((e) => e.action === "customer.pair-review").length,
        2,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from idempotency_key where response::text like '%distinct people%'",
          )
        ).rows[0].n,
        0,
      );
      // A retained review operation must not mask a currently bound key
      // belonging to another command after the original key row expired.
      await ok(
        await request(
          f,
          "customers",
          contact("SYNTHETIC reused expired key", ""),
          { key: stored },
        ),
      );
      assert.equal(
        (await request(f, "customer-history/decision", body, exact)).status,
        422,
      );
    }),
);

test(
  "RH-07/08/12/13/15 reasoned corrections, stale preview, material fields, rollback and audited redaction",
  { timeout: 240000 },
  () =>
    withHistoryFixture(async (f) => {
      const c = await f.ok(`customers/${f.customerId}`, { method: "GET" }),
        second = await f.ok("customers", {
          body: contact(c.displayName, c.phone),
        });
      const p = await pair(f, c.id, second.customerId);
      assert(
        (
          await f.ok("customer-history/candidates", {
            body: { customerId: c.id },
          })
        ).candidates
          .find((x) => x.customer.id === second.customerId)
          .reasons.includes("name"),
      );
      const snapshots = (
        await f.admin.query(
          "select content,digest from order_acceptance_snapshot order by order_id",
        )
      ).rows;
      const update = {
        displayName: c.displayName,
        phone: c.phone,
        email: c.email,
        aliases: c.aliases,
        notes: "SYNTHETIC corrected note",
        reason: "SYNTHETIC explained note correction",
      };
      assert.equal(
        (
          await f.request(`customers/${c.id}`, {
            method: "PATCH",
            etag: `"v${c.version}"`,
            body: { ...update, reason: "" },
          })
        ).status,
        422,
      );
      await f.ok(`customers/${c.id}`, {
        method: "PATCH",
        etag: `"v${c.version}"`,
        body: update,
      });
      assert.equal(
        (
          await request(f, "customer-history/decision", decision(p), {
            etag: `"v${p.version}"`,
          })
        ).status,
        412,
      );
      const event = (await f.history({ limit: 25 })).events.find(
        (e) => e.action === "customer.correct",
      );
      assert.deepEqual(event.fields, ["notes"]);
      assert.equal(event.reason, update.reason);
      assert.equal(event.source.version, c.version + 1);
      assert(
        event.facts.some(
          (x) => x.field === "previousVersion" && x.value === String(c.version),
        ),
      );
      assert.deepEqual(
        (
          await f.admin.query(
            "select content,digest from order_acceptance_snapshot order by order_id",
          )
        ).rows,
        snapshots,
      );
      const w = await f.ok(`customers/${c.id}/wearers/${f.wearerId}`, {
        method: "GET",
      });
      const { id: _i, customerId: _c, ...relationship } = w.relationship;
      const correction = {
        age: w.age,
        preferences: {
          ...w.preferences,
          style: "SYNTHETIC corrected style",
          source: "SYNTHETIC owner report",
        },
        relationship,
        reason: "SYNTHETIC preference correction",
      };
      const responses = await Promise.all(
        [1, 2].map(() =>
          f.request(`customers/${c.id}/wearers/${w.id}`, {
            method: "PATCH",
            etag: `"v${w.version}"`,
            body: correction,
          }),
        ),
      );
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 412]);
      const we = (await f.history({ limit: 25 })).events.find(
        (e) => e.action === "wearer.update",
      );
      assert.deepEqual(we.fields, ["preferences"]);
      assert.equal(we.reason, correction.reason);
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
          event.id,
          randomUUID(),
        ]);
        await client.query("commit");
      } finally {
        client.release();
      }
      const redacted = (await f.history({ limit: 25 })).events.find(
        (e) => e.id === event.id,
      );
      assert.equal(redacted.reason, null);
      assert.equal(redacted.redacted, true);
      await assert.rejects(
        () =>
          f.runtime.pool.query("select redact_identity_reason($1,$2,$3)", [
            f.a.shop,
            event.id,
            randomUUID(),
          ]),
        (e) => e.code === "42501",
      );
      const before = (
        await f.admin.query(
          "select count(*)::int as n from identity_revision_evidence",
        )
      ).rows[0].n;
      await f.admin.query(
        "create function reject_identity_test() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC rollback';end $$; create trigger reject_identity_test before insert on identity_revision_evidence for each row execute function reject_identity_test()",
      );
      const current = await f.ok(`customers/${c.id}`, { method: "GET" });
      assert.equal(
        (
          await f.request(`customers/${c.id}`, {
            method: "PATCH",
            etag: `"v${current.version}"`,
            body: { ...update, notes: "SYNTHETIC must rollback" },
          })
        ).status,
        503,
      );
      assert.equal(
        (await f.ok(`customers/${c.id}`, { method: "GET" })).version,
        current.version,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from identity_revision_evidence",
          )
        ).rows[0].n,
        before,
      );
    }),
);
