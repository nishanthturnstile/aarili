import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { seedServiceAdditions } from "../scripts/test-support/service-additions.mjs";
import {
  seedSmallServices,
  serviceDraftId,
} from "../scripts/test-support/small-services.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

test(
  "RH-11/14 task-only mapping stays blocked and write-disable recovery keeps A1/service readers",
  { timeout: 180000 },
  () =>
    fixture(
      async (f) => {
        const a = await f.accept(f.services.kurti.intake);
        const s = await f.ok(`service-repeats/${a.order.id}/source`);
        const d = await makeRepeat(f, s, {
          profile: f.services.kurti.intake.profile,
        });
        const value = {
          ...d.draft.payload,
          deliveryDate: f.services.kurti.intake.deliveryDate,
        };
        const review = await f.ok("service-repeats/review", { body: value });
        assert(review.issues.includes("repeatMapping"));
        await f.admin.query(
          "revoke insert on service_repeat_origin,service_repeat_selection,service_repeat_target from app_user",
        );
        const body = {
          ...d.body,
          draftId: serviceDraftId(),
          subjectId: randomUUID(),
          selections: d.body.selections.map((x) => ({
            ...x,
            targetLineId: randomUUID(),
          })),
        };
        const key = randomUUID();
        const request = () =>
          f.request(`service-repeats/${a.order.id}/create`, {
            body,
            key,
            etag: `"v${s.version}"`,
          });
        assert.equal((await request()).status, 503);
        assert.equal(
          (await f.request(`drafts/${body.draftId}`, { method: "GET" })).status,
          404,
        );
        assert.deepEqual(
          await f.ok(`small-services/orders/${a.order.id}`, { method: "GET" }),
          a.order,
        );
        assert.deepEqual(await f.ok(`service-repeats/${a.order.id}/source`), s);
        assert.equal(
          (await f.ok(`drafts/${d.draft.id}`, { method: "GET" })).lifecycle,
          "active",
        );
        await f.admin.query(
          "grant insert on service_repeat_origin,service_repeat_selection,service_repeat_target to app_user",
        );
        assert.equal((await request()).status, 200);
      },
      { taskLinked: true },
    ),
);

function requests(f) {
  f.request = (
    path,
    {
      method = "POST",
      body,
      etag,
      key = randomUUID(),
      who = f.a,
      origin = f.owner.origin,
      cookie = who.cookie,
    } = {},
  ) =>
    f.api.fetch(
      new Request(`${f.owner.origin}/api/shops/${who.shop}/${path}`, {
        method,
        headers: {
          ...(origin ? { Origin: origin } : {}),
          Cookie: cookie,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
          ...(etag ? { "If-Match": etag } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  f.ok = async (path, options) => {
    const response = await f.request(path, options);
    assert.equal(
      response.status,
      200,
      `${path}: ${await response.clone().text()}`,
    );
    return response.json();
  };
  f.save = async (
    value,
    { id = serviceDraftId(), etag, workflow = "order.service", key } = {},
  ) => ({
    id,
    ...(await f.ok(`drafts/${id}`, {
      method: "PUT",
      body: { workflow, schemaVersion: 1, payload: value },
      etag,
      key,
    })),
  });
  f.promote = (draft, options = {}) =>
    f.request(`drafts/${draft.id}/promote`, {
      body: {},
      etag: `"v${draft.draft.version}"`,
      ...options,
    });
  f.review = (value) => f.ok("small-services/orders/review", { body: value });
  f.reviewed = async (value) => {
    const review = await f.review(value);
    assert.deepEqual(review.issues, [], JSON.stringify(review));
    assert(review.commitment);
    assert.deepEqual(review.commitment.unknowns, []);
    return {
      ...value,
      commitmentReview: {
        fingerprint: review.fingerprint,
        acknowledged: true,
        exceptionReason: review.commitment.evaluation.warnings.length
          ? "SYNTHETIC explicit capacity exception"
          : "",
        waiveRush: false,
        waiverReason: "",
      },
    };
  };
  f.accept = async (value) => {
    const draft = await f.save(await f.reviewed(value));
    const key = randomUUID();
    const response = await f.promote(draft, { key });
    if (response.status === 503) {
      // Surface the synthetic-only database reason without changing the public
      // API's deliberately private error or generating a different request key.
      try {
        await f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie, Origin: f.owner.origin }),
          f.a.shop,
          (ctx) =>
            mutateDraft(
              ctx,
              draft.id,
              "promote",
              {},
              {
                key,
                requestId: randomUUID(),
                ifMatch: `"v${draft.draft.version}"`,
              },
            ),
        );
      } catch (error) {
        let cause = error;
        while (cause.cause) cause = cause.cause;
        assert.fail(
          `Synthetic acceptance: ${cause.code ?? ""} ${cause.message} ${cause.where ?? ""}`,
        );
      }
    }
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.draft.result.type, "service-order.accepted");
    return {
      draft,
      result,
      order: await f.ok(`small-services/orders/${result.draft.result.id}`, {
        method: "GET",
      }),
    };
  };
}
async function fixture(work, options = {}) {
  return withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      requests(f);
      f.services = await seedSmallServices({
        setup: f.ok,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
        taskLinked: options.taskLinked ?? false,
      });
      try {
        await work(f);
      } finally {
        await f.services.close();
      }
    },
    { customerPolicy: syntheticCustomerPolicy, ...options },
  );
}
async function makeRepeat(f, source, overrides = {}) {
  const profile = f.services.saree.profile;
  const body = {
    draftId: serviceDraftId(),
    subjectId: randomUUID(),
    snapshotDigest: source.snapshotDigest,
    scopeDigest: source.scopeDigest,
    reuseInstructions: false,
    profile: { entryId: profile.entryId, revisionId: profile.id },
    selections: source.candidates.slice(0, 1).map((c) => ({
      key: c.key,
      targetLineId: randomUUID(),
      targetKey: "",
    })),
    ...overrides,
  };
  // Match the authoritative source profile key, never a label-derived runtime rule.
  if (!overrides.selections) {
    const original = source.candidates[0];
    const accepted = await f.ok(`small-services/orders/${source.id}`, {
      method: "GET",
    });
    body.selections[0].targetKey = accepted.lines.find(
      (l) => l.id === original.lineId,
    ).key;
  }
  return {
    body,
    ...(await f.ok(`service-repeats/${source.id}/create`, {
      body,
      etag: `"v${source.version}"`,
    })),
  };
}
async function readyRepeat(f, draft, changes = {}) {
  const value = {
    ...draft.draft.payload,
    deliveryDate: f.services.saree.intake.deliveryDate,
    ...changes,
  };
  const r = await f.ok("service-repeats/review", { body: value });
  assert.deepEqual(r.issues, [], JSON.stringify(r));
  return f.save(
    {
      ...value,
      commitmentReview: {
        fingerprint: r.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC fresh repeat capacity review",
        waiveRush: false,
        waiverReason: "",
      },
    },
    {
      workflow: "order.repeat-service",
      id: draft.draft.id,
      etag: `"v${draft.draft.version}"`,
    },
  );
}
async function complete(f, id, lineId) {
  const p = await f.ok(`small-services/progress/${id}`, { method: "GET" }),
    line = p.lines.find((l) => l.line.id === lineId) ?? p.lines[0];
  return f.ok(`small-services/progress/${id}/lines/${line.line.id}`, {
    etag: `"v${line.version}"`,
    body: {
      commandId: randomUUID(),
      action: "complete",
      orderVersion: p.orderVersion,
      scopeDigest: p.scopeDigest,
      sourceId: line.sourceId,
      sourceDigest: line.sourceDigest,
      attested: true,
      note: "SYNTHETIC completed source work",
    },
  });
}
test(
  "RH-02/06/07/11 completed source requires explicit scope refresh and yields new pending zero-price work",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const a = await f.accept(f.services.saree.intake),
        s = await f.ok(`service-repeats/${a.order.id}/source`),
        d = await makeRepeat(f, s);
      await complete(f, a.order.id, s.candidates[0].lineId);
      const stale = await f.request("service-repeats/review", {
        body: d.draft.payload,
      });
      assert.ok([409, 412].includes(stale.status));
      const current = await f.ok(`service-repeats/${a.order.id}/source`);
      assert.equal(
        current.candidates.find((c) => c.key === s.candidates[0].key).state,
        "completed",
      );
      const p = d.draft.payload,
        changed = {
          ...p,
          repeat: {
            ...p.repeat,
            sourceVersion: current.version,
            scopeDigest: current.scopeDigest,
            selections: p.repeat.selections.map((x) => ({
              ...x,
              lineVersion: current.candidates.find((c) => c.key === x.key)
                .lineVersion,
            })),
          },
        };
      const updated = await f.save(changed, {
        workflow: "order.repeat-service",
        id: d.draft.id,
        etag: '"v1"',
      });
      const lines = changed.lines.map((l) => ({
        ...l,
        priceState: "quoted",
        priceText: "0",
      }));
      const ready = await readyRepeat(f, updated, { lines });
      const r = await f.promote(ready);
      assert.equal(r.status, 200, await r.clone().text());
      const target = await f.ok(
        `small-services/orders/${(await r.json()).draft.result.id}`,
        { method: "GET" },
      );
      assert.equal(target.totalPaise, 0);
      assert.equal(target.lines[0].state, "pending");
      assert.equal(
        (await f.ok(`small-services/progress/${a.order.id}`, { method: "GET" }))
          .summary.completed,
        1,
      );
    }),
);
test(
  "RH-02/06/11 incompatible and retired mappings preserve drafts without inferring capacity or dropping selections",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const a = await f.accept(f.services.saree.intake),
        s = await f.ok(`service-repeats/${a.order.id}/source`),
        d = await makeRepeat(f, s, { profile: null });
      const unknown = await f.ok("service-repeats/review", {
        body: {
          ...d.draft.payload,
          deliveryDate: f.services.saree.intake.deliveryDate,
        },
      });
      assert.ok(unknown.issues.includes("repeatMapping"));
      assert.equal((await f.promote(d)).status, 422);
      const wrong = await f.ok("service-repeats/review", {
        body: {
          ...d.draft.payload,
          profile: f.services.kurti.intake.profile,
          lines: d.draft.payload.lines.map((l) => ({
            ...l,
            key: f.services.kurti.intake.lines[0].key,
          })),
          deliveryDate: f.services.saree.intake.deliveryDate,
        },
      });
      assert.ok(wrong.issues.includes("repeatMapping"));
      const p = f.services.saree.profile;
      await f.services.publishProfile({
        entryId: p.entryId,
        baseVersion: p.version,
        baseRevisionId: p.id,
        content: p.content,
        available: false,
        reason: "SYNTHETIC repeat profile retirement",
      });
      const retired = await f.ok("service-repeats/review", {
        body: {
          ...d.draft.payload,
          profile: { entryId: p.entryId, revisionId: p.id },
        },
      });
      assert.equal(retired.sourceState, "unavailable");
      assert.equal(
        (await f.ok(`drafts/${d.draft.id}`, { method: "GET" })).lifecycle,
        "active",
      );
    }),
);
test(
  "RH-01/04/08/11 original add-ons, selected supplemental lines and native piece scope keep exact distinct provenance",
  { timeout: 240000 },
  () =>
    fixture(async (f) => {
      const setup = await seedServiceAdditions({
        setup: f.ok,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
        services: f.services,
      });
      const native = await f.ok(`service-repeats/${setup.customId}/source`);
      assert(native.pieces.length > 0);
      setup.change.pieceId = native.pieces[0].id;
      const changeReview = await f.ok("small-services/changes/review", {
        body: setup.change,
      });
      const change = await f.save(
        {
          ...setup.change,
          review: {
            fingerprint: changeReview.fingerprint,
            acknowledged: true,
            exceptionReason: "SYNTHETIC",
            waiveRush: false,
            waiverReason: "",
          },
        },
        {
          workflow: "order.service-change",
          id: setup.changeDraftId,
          etag: '"v1"',
        },
      );
      assert.equal((await f.promote(change)).status, 200);
      const before = (
        await f.admin.query(
          "select to_jsonb(o) v from garment_order o order by id",
        )
      ).rows;
      const source = await f.ok(`service-repeats/${setup.customId}/source`);
      const addition = source.candidates.find((c) => c.kind === "addition"),
        original = source.candidates.find((c) => c.kind === "original-addon");
      assert(addition);
      assert(original);
      const scope = await f.ok(`small-services/scope/${setup.customId}`, {
        method: "GET",
      });
      const key = scope.changes
        .flatMap((c) => c.content.lines)
        .find((l) => l.id === addition.lineId).key;
      const d = await makeRepeat(f, source, {
        selections: [
          { key: addition.key, targetLineId: randomUUID(), targetKey: key },
        ],
      });
      const r = await f.promote(await readyRepeat(f, d));
      assert.equal(r.status, 200, await r.clone().text());
      const target = await f.ok(
        `small-services/orders/${(await r.json()).draft.result.id}`,
        { method: "GET" },
      );
      assert.equal(target.lines.length, 1);
      assert.equal(
        target.snapshot.repeatService.selections[0].sourceId,
        addition.sourceId,
      );
      const originalKey = f.services.saree.profile.content.lines.find(
        (l) => l.addonKey === original.addonKey,
      )?.key;
      assert(originalKey);
      const originalDraft = await makeRepeat(f, source, {
        selections: [
          {
            key: original.key,
            targetLineId: randomUUID(),
            targetKey: originalKey,
          },
        ],
      });
      assert.equal(
        (await f.promote(await readyRepeat(f, originalDraft))).status,
        200,
      );
      const after = (
        await f.admin.query(
          "select to_jsonb(o) v from garment_order o where id=any($1::uuid[]) order by id",
          [before.map((x) => x.v.id)],
        )
      ).rows;
      assert.deepEqual(after, before);
      const pieces = source.pieces;
      assert(pieces.length > 0);
      const candidate = source.candidates.find((c) => c.pieceId);
      assert(candidate, "native piece-scoped accepted addition is selectable");
      {
        const pieceDraft = await makeRepeat(f, source, {
          selections: [
            {
              key: candidate.key,
              targetLineId: randomUUID(),
              targetKey: key,
            },
          ],
        });
        assert.equal(pieceDraft.draft.payload.sourcePieceId, candidate.pieceId);
      }
      assert.equal(
        (
          await f.request(`service-repeats/${setup.customId}/create`, {
            body: {
              ...d.body,
              draftId: serviceDraftId(),
              selections: [
                {
                  key: `original:${original.addonKey}:${randomUUID()}`,
                  targetLineId: randomUUID(),
                  targetKey: originalKey,
                },
              ],
            },
            etag: `"v${source.version}"`,
          })
        ).status,
        404,
      );
    }),
);
test(
  "RH-06/07/08/09 exact creation, wrong identity, RLS, immutable lineage and transactional acceptance failure",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const a = await f.accept(f.services.kurti.intake),
        s = await f.ok(`service-repeats/${a.order.id}/source`);
      const profile = f.services.kurti.intake.profile,
        selection = {
          key: s.candidates[0].key,
          targetLineId: randomUUID(),
          targetKey: a.order.lines.find((l) => l.id === s.candidates[0].lineId)
            .key,
        };
      const body = {
          draftId: serviceDraftId(),
          subjectId: randomUUID(),
          snapshotDigest: s.snapshotDigest,
          scopeDigest: s.scopeDigest,
          reuseInstructions: true,
          profile,
          selections: [selection],
        },
        path = `service-repeats/${s.id}/create`,
        key = randomUUID();
      assert.equal((await f.request(path, { body })).status, 428);
      const upper = {
        ...body,
        draftId: body.draftId.toUpperCase(),
        subjectId: body.subjectId.toUpperCase(),
        profile: {
          entryId: body.profile.entryId.toUpperCase(),
          revisionId: body.profile.revisionId.toUpperCase(),
        },
        selections: body.selections.map((s) => ({
          ...s,
          targetLineId: s.targetLineId.toUpperCase(),
        })),
      };
      const d = await f.ok(
        path
          .toUpperCase()
          .replace("SERVICE-REPEATS", "service-repeats")
          .replace("CREATE", "create"),
        { body: upper, key: key.toUpperCase(), etag: '"v1"' },
      );
      assert.deepEqual(await f.ok(path, { body, key, etag: '"v1"' }), d);
      assert.equal(
        (
          await f.request(path, {
            body: { ...body, reuseInstructions: false },
            key,
            etag: '"v1"',
          })
        ).status,
        422,
      );
      assert.equal(
        (await f.request(path, { body, who: f.b, etag: '"v1"' })).status,
        404,
      );
      assert.equal(
        (
          await f.request(`drafts/${d.draft.id}`, {
            method: "PUT",
            etag: '"v1"',
            body: {
              workflow: "order.repeat-service",
              schemaVersion: 1,
              payload: { ...d.draft.payload, wearerId: null },
            },
          })
        ).status,
        404,
      );
      await assertIsolationCatalog(f.runtime.db);
      assert.equal(
        (
          await f.runtime.pool.query(
            "select count(*)::int n from service_repeat_origin",
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(sql`delete from service_repeat_origin`),
        ),
        (e) => e.cause?.code === "42501",
      );
      const ready = await readyRepeat(f, d),
        before = (
          await f.admin.query("select count(*)::int n from garment_order")
        ).rows[0].n;
      await f.admin.query(
        "create function service_repeat_fail_test() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC target failure';end$$;create trigger service_repeat_fail_test after insert on service_repeat_target for each row execute function service_repeat_fail_test()",
      );
      assert.equal((await f.promote(ready)).status, 503);
      assert.equal(
        (await f.admin.query("select count(*)::int n from garment_order"))
          .rows[0].n,
        before,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from service_repeat_target",
          )
        ).rows[0].n,
        0,
      );
    }),
);
test(
  "RH-14 populated A1/service upgrade keeps original snapshots, drafts and progress intact",
  { timeout: 180000 },
  () =>
    fixture(
      async (f) => {
        const a = await f.accept(f.services.saree.intake);
        await complete(f, a.order.id);
        const custom = await seedServiceAdditions({
          setup: f.ok,
          runtime: f.runtime.pool,
          shopId: f.a.shop,
          services: f.services,
        });
        const oldSource = await f.ok(`orders/${custom.customId}/repeat/source`);
        const oldDraft = await f.ok(`orders/${custom.customId}/repeat/create`, {
          body: {
            draftId: serviceDraftId(),
            snapshotDigest: oldSource.order.snapshotDigest,
            scopeDigest: oldSource.scopeDigest,
            reuseInstructions: true,
          },
          etag: `"v${oldSource.order.version}"`,
        });
        assert.equal(oldDraft.draft.workflow, "order.repeat");
        const tables = [
          "garment_order",
          "order_acceptance_snapshot",
          "order_capacity_demand",
          "service_property_subject",
          "service_order_line",
          "service_line_current",
          "service_line_transition",
          "durable_draft",
          "order_repeat_origin",
          "order_repeat_target",
          "audit_event",
        ];
        const capture = () =>
          Promise.all(
            tables.map(
              async (table) =>
                (
                  await f.admin.query(
                    `select to_jsonb(t) v from ${table} t order by to_jsonb(t)::text`,
                  )
                ).rows,
            ),
          );
        const before = await capture();
        await migrateDatabase(f.migrationConnectionString);
        assert.deepEqual(await capture(), before);
        const s = await f.ok(`service-repeats/${a.order.id}/source`);
        assert.equal(
          s.candidates.filter((c) => c.state === "completed").length,
          1,
        );
        const d = await makeRepeat(f, s);
        assert.equal(d.draft.lifecycle, "active");
      },
      { migrationThrough: "0037_repeat_custom_orders.sql" },
    ),
);
test(
  "RH-01/02/03/04/05/06/08/09/11 selected standalone subset resets money, property and completion; accepts once",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const first = await f.accept(f.services.saree.intake),
        id = first.order.id;
      const s = await f.ok(`service-repeats/${id}/source`);
      assert.equal(s.candidates.length, 2);
      const d = await makeRepeat(f, s);
      assert.equal(d.draft.payload.lines.length, 1);
      assert.equal(d.draft.payload.lines[0].priceText, "");
      assert.equal(d.draft.payload.propertyReference, "");
      assert.equal(d.draft.payload.deliveryDate, "");
      assert.notEqual(d.draft.payload.subjectId, first.order.intake.subjectId);
      assert.equal(
        (
          await f.runtime.pool.query(
            "select count(*)::int n from order_capacity_demand",
          )
        ).rows[0].n,
        0,
      ); // no transaction context
      const ready = await readyRepeat(f, d),
        key = randomUUID(),
        response = await f.promote(ready, { key });
      if (response.status === 503)
        await f.owner.withOwnerDraft(
          new Headers({ Cookie: f.a.cookie }),
          f.a.shop,
          (ctx) =>
            mutateDraft(
              ctx,
              ready.id,
              "promote",
              {},
              {
                key,
                requestId: randomUUID(),
                ifMatch: `"v${ready.draft.version}"`,
              },
            ),
        );
      assert.equal(response.status, 200, await response.clone().text());
      const accepted = await response.json();
      assert.deepEqual(
        await (await f.promote(ready, { key })).json(),
        accepted,
      );
      const target = await f.ok(
        `small-services/orders/${accepted.draft.result.id}`,
        { method: "GET" },
      );
      assert.equal(target.lines.length, 1);
      assert.equal(target.totalPaise, null);
      assert.equal(target.lines[0].state, "pending");
      assert.deepEqual(
        await f.ok(`small-services/orders/${id}`, { method: "GET" }),
        first.order,
      );
      assert.equal(
        (await f.ok(`service-repeats/${id}/links`, { body: {} })).children
          .length,
        1,
      );
    }),
);

async function bookingMinor(f) {
  const c = await f.ok(`customers/${f.value.customerId}`, {
      method: "GET",
    }),
    at = new Date().toISOString();
  const w = await f.ok(`customers/${c.id}/wearers`, {
    body: {
      mode: "new",
      displayName: "SYNTHETIC piece child",
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
        interaction: "SYNTHETIC guarded outfit",
      },
    },
  });
  const path = `customers/${c.id}/wearers/${w.wearerId}/guardians`;
  await f.ok(path, {
    etag: `"v${w.version}"`,
    body: {
      guardian: { mode: "new", displayName: "SYNTHETIC guardian" },
      authority: "parent",
      scope: "measurement",
      source: "in-person",
      occurredAt: at,
    },
  });
  const g = await f.ok(path, { method: "GET" });
  const verification = {
    authorityId: g.authority.id,
    status: "confirmed",
    method: "synthetic-review-v1",
    evidenceRef: "SYNTHETIC",
    scope: "measurement",
    source: "in-person",
    occurredAt: at,
  };
  await f.ok(`${path}/verification-events`, {
    etag: `"v${g.version}"`,
    body: verification,
  });

  return { c, w, path, verification };
}
test(
  "RH-07/08/11 guardian revocation denies repeat source, saved draft, lineage and exact command replay",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      f.value = { customerId: f.services.seed.customer.customerId };
      const minor = await bookingMinor(f);
      const a = await f.accept({
        ...f.services.kurti.intake,
        wearerId: minor.w.wearerId,
      });
      const source = await f.ok(`service-repeats/${a.order.id}/source`);
      const d = await makeRepeat(f, source, {
        profile: f.services.kurti.intake.profile,
        selections: [
          {
            key: source.candidates[0].key,
            targetLineId: randomUUID(),
            targetKey: a.order.lines.find(
              (l) => l.id === source.candidates[0].lineId,
            ).key,
          },
        ],
      });
      const ready = await readyRepeat(f, d),
        key = randomUUID(),
        r = await f.promote(ready, { key });
      assert.equal(r.status, 200, await r.clone().text());
      const g = await f.ok(minor.path, { method: "GET" });
      await f.ok(`${minor.path}/verification-events`, {
        etag: `"v${g.version}"`,
        body: { ...minor.verification, status: "withdrawn" },
      });
      assert.equal((await f.promote(ready, { key })).status, 404);
      for (const path of [
        `service-repeats/${source.id}/source`,
        `service-repeats/${source.id}/links`,
        `drafts/${d.draft.id}`,
      ])
        assert.equal(
          (
            await f.request(path, {
              method: path.startsWith("drafts") ? "GET" : "POST",
              body: path.endsWith("links") ? {} : undefined,
            })
          ).status,
          404,
        );
    }),
);
test(
  "RH-03/08/09/11 source completion waits for repeat acceptance; source completes while target remains pending",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const a = await f.accept(f.services.saree.intake),
        s = await f.ok(`service-repeats/${a.order.id}/source`),
        d = await readyRepeat(f, await makeRepeat(f, s));
      let entered, release;
      const reached = new Promise((r) => {
          entered = r;
        }),
        gate = new Promise((r) => {
          release = r;
        });
      const accepting = f.owner.withOwnerDraft(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        async (ctx) => {
          const original = ctx.workflows.get("order.repeat-service"),
            workflows = new Map(ctx.workflows);
          workflows.set("order.repeat-service", {
            ...original,
            async promote(...args) {
              const result = await original.promote(...args);
              entered();
              await gate;
              return result;
            },
          });
          return mutateDraft(
            { ...ctx, workflows },
            d.id,
            "promote",
            {},
            {
              key: randomUUID(),
              requestId: randomUUID(),
              ifMatch: `"v${d.draft.version}"`,
            },
          );
        },
      );
      await Promise.race([
        reached,
        accepting.then(() => assert.fail("Missing repeat acceptance barrier")),
      ]);
      const completion = complete(f, a.order.id, s.candidates[0].lineId);
      try {
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          waiting = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where datname=current_database() and usename='app_user' and wait_event='advisory') waiting",
            )
          ).rows[0].waiting;
          if (waiting) break;
          await new Promise((r) => setTimeout(r, 20));
        }
        assert.equal(waiting, true);
      } finally {
        release();
      }
      const target = (await accepting).data.draft.result.id;
      await completion;
      assert.equal(
        (await f.ok(`small-services/progress/${a.order.id}`, { method: "GET" }))
          .summary.completed,
        1,
      );
      assert.equal(
        (await f.ok(`small-services/progress/${target}`, { method: "GET" }))
          .summary.completed,
        0,
      );
    }),
);
test(
  "RH-03/06/09 two independent repeats serialize fresh capacity reviews; simultaneous exact key replay creates once",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const a = await f.accept(f.services.saree.intake),
        s = await f.ok(`service-repeats/${a.order.id}/source`),
        one = await readyRepeat(f, await makeRepeat(f, s)),
        two = await readyRepeat(f, await makeRepeat(f, s));
      const first = await f.promote(one);
      assert.equal(first.status, 200, await first.clone().text());
      assert.equal((await f.promote(two)).status, 409);
      const refreshed = await readyRepeat(f, two),
        key = randomUUID(),
        results = await Promise.all([
          f.promote(refreshed, { key }),
          f.promote(refreshed, { key }),
        ]);
      for (const r of results)
        assert.equal(r.status, 200, await r.clone().text());
      assert.deepEqual(await results[0].json(), await results[1].json());
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from service_repeat_target",
          )
        ).rows[0].n,
        2,
      );
    }),
);

test(
  "RH-03/08 current service mapping publication serializes with repeat acceptance and rejects mixed authority",
  { timeout: 180000 },
  () =>
    fixture(async (f) => {
      const a = await f.accept(f.services.saree.intake),
        s = await f.ok(`service-repeats/${a.order.id}/source`),
        d = await readyRepeat(f, await makeRepeat(f, s)),
        t = f.services.saree.manifest,
        pub = serviceDraftId();
      await f.ok(`drafts/${pub}`, {
        method: "PUT",
        body: {
          workflow: "service.templates",
          schemaVersion: 1,
          payload: {
            entryId: t.entryId,
            baseVersion: t.version,
            baseRevisionId: t.id,
            operation: "availability",
            available: false,
            reason: "SYNTHETIC repeat publication race",
            content: t.definition.content,
          },
        },
      });
      let entered, release;
      const reached = new Promise((r) => {
          entered = r;
        }),
        gate = new Promise((r) => {
          release = r;
        });
      const publisher = f.owner.withOwnerDraft(
        new Headers({ Cookie: f.a.cookie }),
        f.a.shop,
        async (ctx) => {
          const adapter = ctx.workflows.get("service.templates"),
            workflows = new Map(ctx.workflows);
          workflows.set("service.templates", {
            ...adapter,
            async promote(...args) {
              const result = await adapter.promote(...args);
              entered();
              await gate;
              return result;
            },
          });
          return mutateDraft(
            { ...ctx, workflows },
            pub,
            "promote",
            {},
            { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
          );
        },
      );
      await Promise.race([
        reached,
        publisher.then(() => assert.fail("Missing publisher barrier")),
      ]);
      const accepting = f.promote(d);
      try {
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          blocked = (
            await f.admin.query(
              "select exists(select 1 from pg_stat_activity where datname=current_database() and usename='app_user' and wait_event='advisory') waiting",
            )
          ).rows[0].waiting;
          if (blocked) break;
          await new Promise((r) => setTimeout(r, 20));
        }
        assert.equal(blocked, true);
      } finally {
        release();
      }
      await publisher;
      assert.equal((await accepting).status, 409);
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int n from service_repeat_target",
          )
        ).rows[0].n,
        0,
      );
    }),
);
