import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { customerHistory } from "@aarili/core/customer-history";
import { changeOrderPresentation } from "@aarili/core/orders";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { sql, withShop } from "@aarili/db";
import { customerHistoryRepository } from "@aarili/db/customer-history-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { searchKeysV1 } from "@aarili/i18n/search";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  completeHistoryLine,
  withHistoryFixture,
} from "../scripts/test-support/customer-history.mjs";
import { serviceDraftId } from "../scripts/test-support/small-services.mjs";

test(
  "RH-07/08/12 minor history needs current guardian authority; concurrent withdrawal serializes with history",
  { timeout: 180000 },
  () =>
    withHistoryFixture(async (f) => {
      const c = await f.ok(`customers/${f.customerId}`, { method: "GET" }),
        at = new Date().toISOString();
      const child = await f.ok(`customers/${c.id}/wearers`, {
        body: {
          mode: "new",
          displayName: "SYNTHETIC child",
          age: "minor",
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
            authorised: true,
            informed: true,
            source: "in-person",
            occurredAt: at,
            interaction: "SYNTHETIC separate guardian",
          },
        },
      });
      assert.equal(
        (
          await f.request("customer-history", {
            body: { customerId: c.id, wearerId: child.wearerId },
          })
        ).status,
        404,
      );
      const path = `customers/${c.id}/wearers/${child.wearerId}/guardians`;
      await f.ok(path, {
        etag: `"v${child.version}"`,
        body: {
          guardian: { mode: "new", displayName: "SYNTHETIC parent" },
          authority: "parent",
          scope: "measurement-and-private-photo",
          source: "in-person",
          occurredAt: at,
        },
      });
      const pending = await f.ok(path, { method: "GET" });
      assert.equal(
        (
          await f.request("customer-history", {
            body: { customerId: c.id, wearerId: child.wearerId },
          })
        ).status,
        404,
      );
      const verification = {
        authorityId: pending.authority.id,
        status: "confirmed",
        method: "synthetic-review-v1",
        evidenceRef: "SYNTHETIC no live authority",
        scope: pending.authority.scope,
        source: "in-person",
        occurredAt: at,
      };
      await f.ok(`${path}/verification-events`, {
        etag: `"v${pending.version}"`,
        body: verification,
      });
      const allowed = await f.history({ wearerId: child.wearerId, limit: 25 });
      assert(allowed.events.some((e) => e.action === "guardian.verify"));
      assert(
        allowed.events.some((e) =>
          e.facts.some(
            (fact) =>
              fact.field === "verification" && fact.value === "confirmed",
          ),
        ),
      );
      const verified = await f.ok(path, { method: "GET" });
      await f.ok(`${path}/verification-events`, {
        etag: `"v${verified.version}"`,
        body: { ...verification, status: "withdrawn" },
      });
      assert.equal(
        (
          await f.request("customer-history", {
            body: { customerId: c.id, wearerId: child.wearerId },
          })
        ).status,
        404,
      );
      let release, entered;
      const gate = new Promise((r) => (release = r)),
        reached = new Promise((r) => (entered = r));
      const reading = f.owner.withOwnerHistory(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        (ctx) =>
          customerHistory(
            {
              ...ctx,
              repository: {
                ...ctx.repository,
                page: async (...args) => {
                  const result = await ctx.repository.page(...args);
                  entered();
                  await gate;
                  return result;
                },
              },
            },
            { customerId: c.id, wearerId: f.wearerId, limit: 1 },
          ),
      );
      await reached;
      const w = await f.ok(`customers/${c.id}/wearers/${f.wearerId}`, {
        method: "GET",
      });
      const withdrawing = f.request(
        `customers/${c.id}/wearers/${w.id}/consent-events`,
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
            occurredAt: at,
          },
        },
      );
      try {
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          waiting = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where usename='app_user' and datname=current_database() and wait_event='advisory') waiting",
            )
          ).rows[0].waiting;
          if (waiting) break;
          await new Promise((r) => setTimeout(r, 20));
        }
        assert(waiting, "withdrawal reaches the held current-authority lock");
      } finally {
        release();
      }
      const earlier = await reading;
      assert(earlier.data.next);
      assert.equal((await withdrawing).status, 200);
      assert.equal(
        (
          await f.request("customer-history", {
            body: {
              customerId: c.id,
              wearerId: w.id,
              limit: 1,
              cursor: earlier.data.next,
            },
          })
        ).status,
        404,
      );
    }),
);

test(
  "RH-08/12/14 populated upgrade, canonical cross-domain history, exact links, search recall and bounded query measurement",
  { timeout: 180000 },
  () =>
    withHistoryFixture(
      async (f) => {
        const before = (
          await f.admin.query(
            "select order_id,digest,content from order_acceptance_snapshot order by order_id",
          )
        ).rows;
        await migrateDatabase(f.migrationConnectionString);
        await assertIsolationCatalog(f.runtime.db);
        assert.deepEqual(
          (
            await f.admin.query(
              "select order_id,digest,content from order_acceptance_snapshot order by order_id",
            )
          ).rows,
          before,
        );
        const a = await f.accept();
        await completeHistoryLine(f, a.id);
        const change = f.services.change;
        const review = await f.ok("small-services/changes/review", {
          body: change,
        });
        await f.services.config.publish("order.service-change", {
          ...change,
          review: {
            fingerprint: review.fingerprint,
            acknowledged: true,
            exceptionReason: "SYNTHETIC history addition",
            waiveRush: false,
            waiverReason: "",
          },
        });
        const serviceSource = await f.ok(`service-repeats/${a.id}/source`, {
            body: {},
          }),
          candidate = serviceSource.candidates[0];
        const serviceRepeat = await f.ok(`service-repeats/${a.id}/create`, {
          etag: `"v${serviceSource.version}"`,
          body: {
            draftId: serviceDraftId(),
            subjectId: randomUUID(),
            snapshotDigest: serviceSource.snapshotDigest,
            scopeDigest: serviceSource.scopeDigest,
            reuseInstructions: false,
            profile: a.intake.profile,
            selections: [
              {
                key: candidate.key,
                targetLineId: randomUUID(),
                targetKey: a.lines.find((l) => l.id === candidate.lineId).key,
              },
            ],
          },
        });
        const value = {
          ...serviceRepeat.draft.payload,
          deliveryDate: a.intake.deliveryDate,
          lines: serviceRepeat.draft.payload.lines.map((l) => ({
            ...l,
            priceState: "quoted",
            priceText: "0",
          })),
        };
        const serviceReview = await f.ok("service-repeats/review", {
          body: value,
        });
        assert.deepEqual(serviceReview.issues, []);
        const serviceSaved = await f.ok(`drafts/${serviceRepeat.draft.id}`, {
          method: "PUT",
          etag: `"v${serviceRepeat.draft.version}"`,
          body: {
            workflow: "order.repeat-service",
            schemaVersion: 1,
            payload: {
              ...value,
              commitmentReview: {
                fingerprint: serviceReview.fingerprint,
                acknowledged: true,
                exceptionReason: "SYNTHETIC history service lineage",
                waiveRush: false,
                waiverReason: "",
              },
            },
          },
        });
        const serviceTarget = await f.ok(
          `drafts/${serviceSaved.draft.id}/promote`,
          { etag: `"v${serviceSaved.draft.version}"`, body: {} },
        );
        // An accepted repeat supplies both immutable source and target references.
        const source = await f.ok(
          `orders/${f.services.customId}/repeat/source`,
          { body: {} },
        );
        const created = await f.ok(
          `orders/${f.services.customId}/repeat/create`,
          {
            etag: `"v${source.order.version}"`,
            body: {
              draftId: serviceDraftId(),
              snapshotDigest: source.order.snapshotDigest,
              scopeDigest: source.scopeDigest,
              reuseInstructions: false,
            },
          },
        );
        const draft = {
          ...created.draft.payload,
          deliveryDate: f.services.base.deliveryDate,
        };
        const repeatReview = await f.ok("orders/repeat/review", {
          body: draft,
        });
        const saved = await f.ok(`drafts/${created.draft.id}`, {
          method: "PUT",
          etag: `"v${created.draft.version}"`,
          body: {
            workflow: "order.repeat",
            schemaVersion: 1,
            payload: {
              ...draft,
              commitmentReview: {
                fingerprint: repeatReview.fingerprint,
                acknowledged: true,
                exceptionReason: "SYNTHETIC history repeat",
                waiveRush: false,
                waiverReason: "",
              },
            },
          },
        });
        await f.ok(`drafts/${saved.draft.id}/promote`, {
          etag: `"v${saved.draft.version}"`,
          body: {},
        });
        let result = await f.history({ limit: 25 }),
          events = [...result.events];
        while (result.next) {
          result = await f.history({ limit: 25, cursor: result.next });
          events.push(...result.events);
        }
        assert.equal(new Set(events.map((e) => e.id)).size, events.length);
        for (const action of [
          "customer.create",
          "wearer.create",
          "wearer.purpose",
          "order.accept",
          "booking.revise",
          "booking.commercial.propose",
          "order.service-change",
          "service.line.complete",
        ])
          assert(
            events.some((e) => e.action === action),
            action,
          );
        const accepted = events.filter((e) => e.action === "order.accept");
        assert.equal(
          accepted.length,
          (await f.admin.query("select count(*)::int n from garment_order"))
            .rows[0].n,
        );
        assert(accepted.some((e) => e.pieceIds.length > 0));
        assert(
          accepted.some((e) =>
            e.related.some((r) => r.id === f.services.customId),
          ),
        );
        assert(
          events.every(
            (e) =>
              e.original.customerId === null ||
              e.original.customerId === f.customerId,
          ),
        );
        const serviceEvent = accepted.find(
          (e) => e.source.id === serviceTarget.draft.result.id,
        );
        assert.deepEqual(serviceEvent.related, [
          { kind: "service", id: a.id, version: serviceSource.version },
        ]);
        assert.equal(serviceEvent.lineIds.length, 1);
        const progress = events.find(
          (e) => e.action === "service.line.complete",
        );
        assert.equal(progress.source.version, 1);
        assert(
          progress.facts.some(
            (fact) => fact.field === "lineVersion" && fact.value === "2",
          ),
        );
        assert.equal(result.attribution, "original-identifiers-current-labels");
        assert.equal(result.unavailable.length, 8);
        for (const query of [
          "Meena",
          "மீனா",
          "meenaa",
          accepted[0].code,
          accepted[0].source.id,
        ]) {
          const page = await f.history({ query, limit: 25 });
          assert(
            page.events.some((e) => e.action === "order.accept"),
            `recall ${query}`,
          );
        }
        assert.equal(
          (await f.history({ query: "SYNTHETIC no match zzzz" })).events.length,
          0,
        );
        // Measured corpus uses actual presentation commands, no fabricated audit rows.
        const order = await f.ok(`orders/${f.services.customId}/read`, {
          body: {},
        });
        let version = order.version;
        for (let i = 0; i < 120; i++) {
          const updated = await f.ok(`orders/${order.id}/presentation`, {
            body: { mode: i % 2 ? "simple" : "detailed" },
            etag: `"v${version}"`,
          });
          version = updated.version;
        }
        const metrics = await withShop(
          f.runtime.db,
          f.a.user,
          f.a.shop,
          async (tx) => {
            const repo = customerHistoryRepository(tx, f.a.shop),
              window = await repo.window();
            let plan;
            const measured = customerHistoryRepository(
              {
                execute: async (statement) => {
                  plan = (
                    await tx.execute(
                      sql`explain (analyze,buffers,format json) ${statement}`,
                    )
                  ).rows[0]["QUERY PLAN"];
                  return tx.execute(statement);
                },
              },
              f.a.shop,
            );
            const start = performance.now();
            const page = await measured.page(
              {
                customerId: f.customerId,
                wearerId: null,
                query: "",
                limit: 25,
              },
              [f.wearerId],
              window,
              searchKeysV1(""),
            );
            return {
              elapsedMs: performance.now() - start,
              returned: page.events.length,
              plan,
            };
          },
        );
        const count = (
          await f.admin.query("select count(*)::int n from audit_event")
        ).rows[0].n;
        await mkdir(".scratch/customer-history", { recursive: true });
        await writeFile(
          ".scratch/customer-history/query-plan.json",
          JSON.stringify(
            {
              auditRows: count,
              orders: accepted.length,
              platform: process.platform,
              node: process.version,
              ...metrics,
            },
            null,
            2,
          ),
        );
        console.info(
          `RH-12 corpus ${count} audit rows, ${accepted.length} orders; measured page + EXPLAIN ${metrics.elapsedMs.toFixed(2)}ms`,
        );
        // Rollback is disabling the reader. Old accepted readers still work without
        // any reference to the new indexes or a materialised personal history table.
        assert.equal(
          (await f.ok(`small-services/orders/${a.id}`, { method: "GET" })).id,
          a.id,
        );
      },
      { migrationThrough: "0038_repeat_service_intake.sql" },
    ),
);

test(
  "RH-07/08/12 stable microsecond cursors, late commit, insertion, correction, tenant and missing-context denial",
  { timeout: 180000 },
  () =>
    withHistoryFixture(async (f) => {
      await f.accept();
      const first = await f.history({ limit: 2 });
      assert(first.next);
      assert.equal(
        (
          await f.request("customer-history", {
            who: f.b,
            body: { customerId: f.customerId },
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await f.request("customer-history", {
            cookie: f.b.cookie,
            body: { customerId: f.customerId },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await f.request("customer-history", {
            cookie: "",
            body: { customerId: f.customerId },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await f.request("customer-history", {
            origin: "https://other.invalid",
            body: { customerId: f.customerId },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await f.request("customer-history?query=secret", {
            body: { customerId: f.customerId },
          })
        ).status,
        422,
      );
      for (const extra of [
        { query: "changed" },
        { wearerId: f.wearerId },
        { limit: 3 },
      ])
        assert.equal(
          (
            await f.request("customer-history", {
              body: {
                customerId: f.customerId,
                limit: 2,
                cursor: first.next,
                ...extra,
              },
            })
          ).status,
          409,
        );
      assert.equal(
        (
          await f.request("customer-history", {
            body: {
              customerId: f.customerId,
              cursor: `${first.next.slice(0, -4)}aaaa`,
            },
          })
        ).status,
        422,
      );
      const noContext = await f.runtime.db.transaction((tx) =>
        customerHistoryRepository(tx, f.a.shop).page(
          { customerId: f.customerId, wearerId: null, query: "", limit: 25 },
          [f.wearerId],
          { watermark: "4294967295" },
          searchKeysV1(""),
        ),
      );
      assert.equal(noContext.events.length, 0);
      const seen = [...first.events];
      let page = first;
      await f.accept();
      while (page.next) {
        page = await f.history({ limit: 2, cursor: page.next });
        seen.push(...page.events);
      }
      assert.equal(new Set(seen.map((e) => e.id)).size, seen.length);
      const fresh = await f.history({ limit: 25 });
      assert.equal(
        fresh.events.filter((e) => e.action === "order.accept").length,
        seen.filter((e) => e.action === "order.accept").length + 1,
      );
      // Hold a genuine mutation before commit. Boundary excludes it even though
      // its recorded_at precedes the next page; later refresh includes it.
      let release, entered;
      const gate = new Promise((r) => (release = r)),
        reached = new Promise((r) => (entered = r));
      const writing = f.owner.withOwnerQuickOrder(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        async (ctx) => {
          const current = await ctx.acceptance.repository.read(
            f.services.customId,
          );
          await changeOrderPresentation(
            ctx,
            f.services.customId,
            { mode: "detailed" },
            {
              key: randomUUID(),
              requestId: randomUUID(),
              ifMatch: `"v${current.version}"`,
            },
          );
          entered();
          await gate;
        },
      );
      await reached;
      const window = await withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        customerHistoryRepository(tx, f.a.shop).window(),
      );
      release();
      await writing;
      const late = await withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
        customerHistoryRepository(tx, f.a.shop).page(
          { customerId: f.customerId, wearerId: null, query: "", limit: 25 },
          [f.wearerId],
          window,
          searchKeysV1(""),
        ),
      );
      assert(!late.events.some((e) => e.action === "order.presentation"));
      assert(
        (await f.history({ limit: 25 })).events.some(
          (e) => e.action === "order.presentation",
        ),
      );
      const c = await f.ok(`customers/${f.customerId}`, { method: "GET" });
      await f.ok(`customers/${c.id}`, {
        method: "PATCH",
        etag: `"v${c.version}"`,
        body: {
          displayName: "SYNTHETIC Corrected",
          reason: "SYNTHETIC correction",
          phone: c.phone,
          email: c.email,
          aliases: c.aliases,
          notes: c.notes,
        },
      });
      assert.equal(
        (
          await f.request("customer-history", {
            body: { customerId: f.customerId, limit: 2, cursor: first.next },
          })
        ).status,
        409,
      );
      const corrected = await f.history({ limit: 25 });
      assert(corrected.events.some((e) => e.action === "customer.correct"));
      assert(
        corrected.events.every(
          (e) => e.currentCustomer === "SYNTHETIC Corrected",
        ),
      );
    }),
);

test(
  "RH-07/08/12/15 redacted evidence, distinct same-phone wearers and revoked access between pages",
  { timeout: 180000 },
  () =>
    withHistoryFixture(async (f) => {
      const contact = await f.ok(`customers/${f.customerId}`, {
        method: "GET",
      });
      await f.ok(`customers/${contact.id}`, {
        method: "PATCH",
        etag: `"v${contact.version}"`,
        body: {
          displayName: contact.displayName,
          reason: "SYNTHETIC shared phone",
          phone: "9000000707",
          email: contact.email,
          aliases: contact.aliases,
          notes: contact.notes,
        },
      });
      const a = await f.accept(f.services.kurti.intake),
        completion = await completeHistoryLine(f, a.id);
      const initial = await f.history({ wearerId: f.wearerId, limit: 2 });
      assert(initial.next);
      const client = await f.admin.connect();
      try {
        await client.query("begin");
        await client.query("set local role app_privacy");
        await client.query(
          "select set_config('app.user_id',$1,true),set_config('app.shop_id',$2,true),set_config('app.actor_id',$1,true)",
          [f.a.user, f.a.shop],
        );
        await client.query("select redact_service_line_note($1,$2,$3)", [
          f.a.shop,
          completion.transitionId,
          randomUUID(),
        ]);
        await client.query("commit");
      } finally {
        client.release();
      }
      assert.equal(
        (
          await f.request("customer-history", {
            body: {
              customerId: f.customerId,
              wearerId: f.wearerId,
              limit: 2,
              cursor: initial.next,
            },
          })
        ).status,
        409,
        "redaction invalidates previously displayed personal evidence",
      );
      const redacted = await f.history({ limit: 25 });
      const event = redacted.events.find(
        (e) => e.action === "service.line.complete",
      );
      assert(event.redacted);
      assert.equal(event.reason, null);
      assert(!JSON.stringify(redacted).includes("private completion note"));
      const c = await f.ok(`customers/${f.customerId}`, { method: "GET" });
      const second = await f.ok(`customers/${c.id}/wearers`, {
        body: {
          mode: "new",
          displayName: "SYNTHETIC Kavya காவ்யா",
          age: "adult",
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
            authorised: true,
            informed: true,
            source: "in-person",
            occurredAt: new Date().toISOString(),
            interaction: "SYNTHETIC shared contact",
          },
        },
      });
      const w2 = await f.ok(`customers/${c.id}/wearers/${second.wearerId}`, {
        method: "GET",
      });
      await f.ok(`customers/${c.id}/wearers/${w2.id}/consent-events`, {
        etag: `"v${w2.version}"`,
        body: {
          purpose: "service",
          decision: "grant",
          noticeId: syntheticWearerPolicy.notice.id,
          noticeExplained: true,
          language: "en",
          giverPersonId: w2.personId,
          source: "in-person",
          occurredAt: new Date().toISOString(),
        },
      });
      const bound = await f.accept({
        ...f.services.kurti.intake,
        wearerId: w2.id,
      });
      const sharedPhone = await f.history({ query: "0707", limit: 25 });
      assert(sharedPhone.events.some((e) => e.source.id === a.id));
      assert(sharedPhone.events.some((e) => e.source.id === bound.id));
      const nameOnly = await f.history({ query: "kavya", limit: 25 });
      assert(nameOnly.events.some((e) => e.source.id === bound.id));
      assert(!nameOnly.events.some((e) => e.source.id === a.id));
      const scoped = await f.history({ wearerId: w2.id, limit: 25 });
      assert(scoped.events.some((e) => e.source.id === bound.id));
      assert(!scoped.events.some((e) => e.source.id === a.id));
      const first = await f.history({ wearerId: f.wearerId, limit: 2 });
      const w = await f.ok(`customers/${c.id}/wearers/${f.wearerId}`, {
        method: "GET",
      });
      await f.ok(`customers/${c.id}/wearers/${w.id}/consent-events`, {
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
      });
      assert.equal(
        (
          await f.request("customer-history", {
            body: {
              customerId: c.id,
              wearerId: w.id,
              limit: 2,
              cursor: first.next,
            },
          })
        ).status,
        404,
      );
      const remaining = await f.history({ limit: 25 });
      assert(!JSON.stringify(remaining).includes(a.id));
      assert(remaining.events.some((e) => e.source.id === bound.id));
      // A failed/revoked query cannot return even a total, cursor or label snippet.
      const denied = await f.request("customer-history", {
        body: { customerId: c.id, wearerId: w.id },
      });
      assert.deepEqual(Object.keys(await denied.json()), ["error"]);
    }),
);
