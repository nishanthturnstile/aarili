import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyMeasurementFormContent } from "@aarili/contracts/measurement-forms";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { emptyCalendarDefinition } from "@aarili/contracts/shop-calendar";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { measurementFormsDraftWorkflow } from "@aarili/core/measurement-forms";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { measurementFormsRepository } from "@aarili/db/measurement-forms-repository";
import { mediaRepository } from "@aarili/db/media-repository";
import { serviceCatalogueRepository } from "@aarili/db/service-catalogue-repository";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const id = () => {
  const v = randomUUID();
  return `${v.slice(0, 14)}7${v.slice(15)}`;
};
const value = (kind = "category", code = "blouse", extra = {}) => ({
  entryId: randomUUID(),
  baseVersion: 0,
  baseRevisionId: null,
  operation: "definition",
  available: true,
  reason: "SYNTHETIC owner review",
  content: {
    ...emptyCatalogueContent(kind),
    code,
    labelEn: `SYNTHETIC ${code}`,
    labelTa: "செயற்கை ரவிக்கை",
    aliases: ["ravikkai"],
    ...extra,
  },
});
function request(
  f,
  path,
  {
    method = "GET",
    body,
    who = f.a,
    shop = who.shop,
    key = randomUUID(),
    etag,
    origin = f.owner.origin,
  } = {},
) {
  return f.api.fetch(
    new Request(`${f.owner.origin}/api/shops/${shop}/${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...(etag ? { "If-Match": etag } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function ok(r) {
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
async function save(f, v, who = f.a) {
  const draftId = id();
  const { draft } = await ok(
    await request(f, `drafts/${draftId}`, {
      who,
      method: "PUT",
      body: { workflow: "service.catalogue", schemaVersion: 1, payload: v },
    }),
  );
  return { draftId, draft };
}
const promote = (f, d, key = randomUUID(), extra = {}) =>
  request(f, `drafts/${d.draftId}/promote`, {
    method: "POST",
    body: {},
    key,
    etag: `"v${d.draft.version}"`,
    ...extra,
  });
const current = async (f, entryId, who = f.a) =>
  (await ok(await request(f, `settings/catalogue/entries/${entryId}`, { who })))
    .revision;
async function publish(f, v, who = f.a) {
  const d = await save(f, v, who);
  await ok(await promote(f, d, undefined, { who }));
  return current(f, v.entryId, who);
}
const ref = (r) => ({ entryId: r.entryId, revisionId: r.definition.id });
const revised = (r, extra = {}) => ({
  entryId: r.entryId,
  baseVersion: r.version,
  baseRevisionId: r.id,
  operation: "definition",
  available: r.available,
  reason: "SYNTHETIC revision review",
  content: r.definition.content,
  ...extra,
});

const form = (service, piece = null, code = "body") => ({
  entryId: randomUUID(),
  baseVersion: 0,
  baseRevisionId: null,
  operation: "definition",
  available: true,
  reason: "SYNTHETIC explicit form review",
  content: {
    ...emptyMeasurementFormContent(),
    code,
    labelEn: `SYNTHETIC ${code}`,
    labelTa: "செயற்கை அளவுகள்",
    service: ref(service),
    piece: piece ? ref(piece) : null,
    decision: "required",
    groups: [
      {
        id: randomUUID(),
        labelEn: "Body",
        labelTa: "உடல்",
        fields: [
          {
            id: randomUUID(),
            key: "length",
            meaning: "Body length from shoulder",
            kind: "base-length",
            illustration: null,
            labelEn: "Length",
            labelTa: "நீளம்",
            hintEn: "Reviewed method",
            hintTa: "மதிப்பாய்வு முறை",
            units: ["in", "cm"],
            defaultUnit: "in",
            required: true,
            precision: {
              unit: "in",
              increment: "0.25",
              review: "SYNTHETIC owner precision review",
            },
          },
        ],
      },
    ],
  },
});
async function setup(f) {
  const category = await publish(f, value()),
    top = await publish(f, value("piece", "top")),
    bottom = await publish(f, value("piece", "bottom"));
  const service = await publish(
    f,
    value("service", "salwar", {
      parent: ref(category),
      pieces: [
        { ...ref(top), optional: false },
        { ...ref(bottom), optional: true },
      ],
    }),
  );
  return { category, top, bottom, service };
}
async function saveForm(f, v, who = f.a) {
  const draftId = id();
  const { draft } = await ok(
    await request(f, `drafts/${draftId}`, {
      who,
      method: "PUT",
      body: { workflow: "measurement.forms", schemaVersion: 1, payload: v },
    }),
  );
  return { draftId, draft };
}
const currentForm = async (f, entryId, who = f.a) =>
  (
    await ok(
      await request(f, `settings/measurement-forms/entries/${entryId}`, {
        who,
      }),
    )
  ).revision;
async function publishForm(f, v) {
  const d = await saveForm(f, v);
  await ok(await promote(f, d));
  return currentForm(f, v.entryId);
}
test("ST-02/07/10/12 independent forms, exact ordered history, semantic identity, explicit no-measurements and tenant isolation", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(
    async (f) => {
      const { service, top, bottom, category } = await setup(f);
      const a = await publishForm(f, form(service, top, "top-body")),
        b = await publishForm(f, form(service, bottom, "bottom-body"));
      const blouse = await publish(
        f,
        value("service", "blouse", { parent: ref(category) }),
      );
      await publishForm(f, form(blouse, null, "blouse-body"));
      assert.notEqual(a.entryId, b.entryId);
      const c = structuredClone(a.definition.content);
      c.groups[0].fields.push({
        ...c.groups[0].fields[0],
        id: randomUUID(),
        key: "waist",
        meaning: "Waist circumference",
      });
      c.groups[0].fields.reverse();
      c.groups[0].labelTa = "புதிய குழு";
      c.groups[0].fields[1].labelEn = "Renamed length";
      const r = await publishForm(f, revised(a, { content: c }));
      assert.equal(r.version, 2);
      assert.equal(
        r.definition.content.groups[0].fields[1].id,
        a.definition.content.groups[0].fields[0].id,
      );
      assert.deepEqual(
        await ok(
          await request(f, `settings/measurement-forms/revisions/${a.id}`),
        ),
        a,
      );
      const history = await ok(
        await request(f, "settings/measurement-forms/history", {
          method: "POST",
          body: { entryId: a.entryId },
        }),
      );
      assert.deepEqual(
        history.revisions.map((x) => x.version),
        [2, 1],
      );
      const changed = structuredClone(c);
      changed.groups[0].fields[1].meaning = "Different body concept";
      assert.equal(
        (await promote(f, await saveForm(f, revised(r, { content: changed }))))
          .status,
        409,
      );
      // Removing a field does not let a later revision reassign its stable identity/key.
      const removed = structuredClone(c);
      removed.groups[0].fields.splice(1, 1);
      const r3 = await publishForm(f, revised(r, { content: removed }));
      assert.equal(
        (await promote(f, await saveForm(f, revised(r3, { content: changed }))))
          .status,
        409,
      );
      const small = await publish(
        f,
        value("service", "fall", {
          parent: ref(category),
          serviceKind: "small-service",
        }),
      );
      const none = form(small, null, "no-measurements");
      none.content.decision = "not-required";
      none.content.decisionReason = "SYNTHETIC reviewed standalone service";
      none.content.groups = [];
      await publishForm(f, none);
      assert.equal(await currentForm(f, a.entryId, f.b), null);
      assert.equal(
        (
          await request(f, `settings/measurement-forms/revisions/${a.id}`, {
            who: f.b,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await request(f, "settings/measurement-forms/list", {
            who: f.b,
            method: "POST",
            body: { query: "" },
          })
        ).status,
        200,
      );
      const list = await ok(
        await request(f, "settings/measurement-forms/list", {
          who: f.b,
          method: "POST",
          body: { query: "" },
        }),
      );
      assert.equal(list.entries.length, 0);
      await f.runtime.db.transaction(async (tx) =>
        assert.equal(
          (await tx.execute(sql`select * from measurement_form_revision`))
            .rowCount,
          0,
        ),
      );
      assert(
        (await assertIsolationCatalog(f.runtime.db)).includes(
          "public.measurement_form_reference",
        ),
      );
      const disabled = await publish(
        f,
        revised(top, { operation: "availability", available: false }),
      );
      assert.equal(disabled.available, false);
      const listA = await ok(
        await request(f, "settings/measurement-forms/list", {
          method: "POST",
          body: { query: "" },
        }),
      );
      assert.equal(
        listA.entries.find((x) => x.entryId === a.entryId)
          .configurationEligible,
        false,
      );
      assert.deepEqual(
        await ok(
          await request(f, `settings/measurement-forms/revisions/${a.id}`),
        ),
        a,
      );
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
});
test("ST-02/10 invalid, missing, foreign, disabled or incompatible references and unresolved decisions fail closed", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const { service, top, category } = await setup(f);
    const v = form(service, top);
    const foreign = await publish(f, value("piece", "foreign"), f.b);
    for (const mutate of [
      (c) => (c.service = ref(category)),
      (c) => (c.piece = ref(foreign)),
      (c) => (c.service = { entryId: randomUUID(), revisionId: randomUUID() }),
    ]) {
      const x = structuredClone(v);
      x.entryId = randomUUID();
      mutate(x.content);
      assert.equal((await promote(f, await saveForm(f, x))).status, 409);
    }
    for (const mutate of [
      (c) => (c.service = null),
      (c) => (c.groups[0].fields[0].precision = null),
      (c) => (c.groups[0].fields[0].required = null),
      (c) => (c.groups[0].fields[0].units = []),
      (c) => (c.groups[0].fields[0].labelTa = ""),
      (c) => c.groups[0].fields.push(c.groups[0].fields[0]),
      (c) => (c.decision = "unresolved"),
    ]) {
      const x = structuredClone(v);
      mutate(x.content);
      assert.equal((await promote(f, await saveForm(f, x))).status, 422);
    }
    const invalid = structuredClone(v);
    invalid.content.groups[0].fields[0].kind = "decoration-question";
    assert.equal(
      (
        await request(f, `drafts/${id()}`, {
          method: "PUT",
          body: {
            workflow: "measurement.forms",
            schemaVersion: 1,
            payload: invalid,
          },
        })
      ).status,
      422,
    );
    await publish(
      f,
      revised(top, { operation: "availability", available: false }),
    );
    assert.equal((await promote(f, await saveForm(f, v))).status, 409);
  });
});
test("ST-07/10/12 real concurrent publication, exact replay, request binding, CAS and rollback after each actual write", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const { service, top } = await setup(f);
    const v = form(service, top),
      d = await saveForm(f, v),
      key = randomUUID();
    assert.equal((await promote(f, d, undefined, { etag: null })).status, 428);
    const [a, b] = await Promise.all([promote(f, d, key), promote(f, d, key)]);
    assert.deepEqual(await ok(a), await ok(b));
    assert.equal((await promote(f, d, key, { etag: '"v9"' })).status, 422);
    assert.equal(
      (await promote(f, d, key, { who: f.b, shop: f.a.shop })).status,
      403,
    );
    const r = await currentForm(f, v.entryId),
      one = await saveForm(f, revised(r)),
      two = await saveForm(f, revised(r, { reason: "Second review" }));
    assert.deepEqual(
      (await Promise.all([promote(f, one), promote(f, two)]))
        .map((x) => x.status)
        .sort(),
      [200, 412],
    );
    const first = form(service, top, "first-race"),
      da = await saveForm(f, first),
      db = await saveForm(f, first);
    assert.deepEqual(
      (await Promise.all([promote(f, da), promote(f, db)]))
        .map((x) => x.status)
        .sort(),
      [200, 412],
    );
    const count = async () =>
      (
        await f.admin.query(
          "select (select count(*)::int from measurement_form_revision) definitions,(select count(*)::int from measurement_form_reference) refs,(select count(*)::int from measurement_form_availability) changes,(select count(*)::int from measurement_form_entry) pointers,(select count(*)::int from audit_event) audits,(select count(*)::int from idempotency_key) keys,(select count(*)::int from durable_draft where lifecycle='promoted') promoted",
        )
      ).rows[0];
    for (const point of ["append", "advance", "update", "audit", "persist"]) {
      const v = form(service, top, `rollback-${point}`),
        d = await saveForm(f, v),
        before = await count();
      await assert.rejects(
        () =>
          withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
            const raw = measurementFormsRepository(tx, f.a.shop),
              dr = draftRepository(tx, f.a.shop),
              repository = { ...raw },
              drafts = { ...dr };
            const target = ["append", "advance"].includes(point)
                ? repository
                : drafts,
              original = ["append", "advance"].includes(point) ? raw : dr;
            target[point] = async (...args) => {
              await original[point](...args);
              throw Error("injected form rollback");
            };
            return mutateDraft(
              {
                shopId: f.a.shop,
                actor: { type: "user", id: f.a.user },
                repository: drafts,
                workflows: new Map([
                  [
                    "measurement.forms",
                    measurementFormsDraftWorkflow({
                      shopId: f.a.shop,
                      actorId: f.a.user,
                      repository,
                      synthetic: true,
                      catalogue: {
                        shopId: f.a.shop,
                        actorId: f.a.user,
                        repository: serviceCatalogueRepository(tx, f.a.shop),
                        synthetic: true,
                      },
                    }),
                  ],
                ]),
              },
              d.draftId,
              "promote",
              {},
              {
                key: randomUUID(),
                requestId: randomUUID(),
                ifMatch: `"v${d.draft.version}"`,
              },
            );
          }),
        /injected form rollback/,
      );
      assert.deepEqual(await count(), before);
      assert.equal(await currentForm(f, v.entryId), null);
    }
  });
});

test("ST-02/10 optional method illustrations pin private ready versions and deny missing, foreign, minor, fitting, stale and unauthorized rows", {
  timeout: 180000,
}, async () => {
  const allowed = new Set(),
    policyMinor = new Set();
  let grants = 0;
  await withTenantFixture(
    async (f) => {
      const { service } = await setup(f);
      async function asset(who = f.a, extra = {}) {
        return withShop(f.runtime.db, who.user, who.shop, async (tx) => {
          const repo = mediaRepository(tx, who.shop),
            assetId = randomUUID(),
            attemptId = randomUUID(),
            fence = randomUUID();
          const epoch = (
            await tx.execute(
              sql`select restore_epoch from system_state where singleton`,
            )
          ).rows[0].restore_epoch;
          let a = await repo.insert({
            id: assetId,
            creatorId: who.user,
            subjectId: randomUUID(),
            purpose: "manual-pattern",
            contentType: "image/png",
            minor: false,
            size: 20,
            stagingKey: `shops/${who.shop}/staging/${assetId}`,
            expiresAt: new Date(Date.now() + 300000).toISOString(),
            ...extra,
          });
          allowed.add(a.subjectId);
          a = await repo.start(a, {
            id: attemptId,
            assetId,
            epoch,
            state: "queued",
            fence: null,
            leaseUntil: null,
            initiatorId: who.user,
          });
          await repo.claim(
            attemptId,
            fence,
            new Date(Date.now() + 300000).toISOString(),
          );
          return repo.accept(
            assetId,
            attemptId,
            fence,
            `shops/${who.shop}/private/${assetId}/accepted`,
            "a".repeat(64),
            20,
          );
        });
      }
      const a = await asset(),
        foreign = await asset(f.b),
        minor = await asset(f.a, { minor: true }),
        fitting = await asset(f.a, { purpose: "private-fitting" }),
        denied = await asset();
      allowed.delete(denied.subjectId);
      const nowMinor = await asset();
      policyMinor.add(nowMinor.subjectId);
      const v = form(service, null, "illustrated"),
        field = v.content.groups[0].fields[0];
      field.illustration = { assetId: a.id, version: a.version };
      const published = await publishForm(f, v);
      assert.deepEqual(
        published.definition.content.groups[0].fields[0].illustration,
        field.illustration,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from measurement_form_illustration",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await f.admin.query(
            "select count(*)::int as n from media_reference where asset_id=$1",
            [a.id],
          )
        ).rows[0].n,
        1,
      );
      for (const illustration of [
        { assetId: randomUUID(), version: 3 },
        { assetId: foreign.id, version: foreign.version },
        { assetId: minor.id, version: minor.version },
        { assetId: fitting.id, version: fitting.version },
        { assetId: denied.id, version: denied.version },
        { assetId: a.id, version: a.version - 1 },
        { assetId: nowMinor.id, version: nowMinor.version },
      ]) {
        const x = form(service, null, `invalid-${randomUUID().slice(0, 8)}`);
        x.content.groups[0].fields[0].illustration = illustration;
        assert.equal((await promote(f, await saveForm(f, x))).status, 409);
      }
      assert.equal(
        (await request(f, `files/${a.id}/access`, { who: f.b })).status,
        404,
      );
      assert.equal(grants, 0);
      assert.equal((await request(f, `files/${a.id}/access`)).status, 200);
      assert.equal(grants, 1);
    },
    {
      mediaAdapters: () => ({
        policy: {
          authorize: async (input) =>
            allowed.has(input.subjectId)
              ? {
                  minor: policyMinor.has(input.subjectId),
                  guardianConsent: true,
                }
              : null,
        },
        storage: {
          signGet: async () => {
            grants++;
            return "https://private.example.test/synthetic";
          },
        },
      }),
    },
  );
});

test("ST-07/10 additive upgrade preserves populated customer, wearer, settings and catalogue history", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(
    async (f) => {
      const at = new Date(Date.now() - 60000).toISOString();
      const added = await ok(
        await request(f, "customers", {
          method: "POST",
          body: {
            displayName: "SYNTHETIC preserved payer",
            aliases: [],
            serviceEvidence: {
              noticeId: syntheticCustomerPolicy.notice.id,
              language: "en",
              decision: "grant",
              giver: "self",
              noticeExplained: true,
              source: "in-person",
              occurredAt: at,
            },
          },
        }),
      );
      const customer = await ok(
        await request(f, `customers/${added.customerId}`),
      );
      for (const age of ["adult", "minor"]) {
        const person = {
          mode: "new",
          displayName: `SYNTHETIC ${age} wearer`,
          age,
          preferences: {},
          relationship: {
            kind: "family",
            statementByPersonId: customer.personId,
            authorised: true,
            informed: true,
            source: "in-person",
            occurredAt: at,
            interaction: "SYNTHETIC existing family registration",
          },
        };
        await ok(
          await request(f, `customers/${customer.id}/wearers`, {
            method: "POST",
            body: person,
          }),
        );
      }
      const draftId = id();
      await ok(
        await request(f, `drafts/${draftId}`, {
          method: "PUT",
          body: {
            workflow: "shop.calendar",
            schemaVersion: 1,
            payload: {
              domain: "customer",
              baseVersion: 0,
              baseRevisionId: null,
              definition: emptyCalendarDefinition(),
            },
          },
        }),
      );
      await ok(
        await request(f, `drafts/${draftId}/promote`, {
          method: "POST",
          body: {},
          etag: '"v1"',
        }),
      );
      const calendar = await ok(await request(f, "settings/calendar"));
      const wearers = await ok(
        await request(f, `customers/${customer.id}/wearers`),
      );

      const { service, top } = await setup(f);
      const snapshot = async () => {
        const result = {};
        for (const table of [
          "customer_person",
          "customer",
          "wearer",
          "wearer_preferences",
          "customer_wearer_relationship",
          "wearer_relationship_event",
          "wearer_preference_event",
          "wearer_age_event",
          "wearer_purpose_event",
          "consent_record",
          "shop_calendar",
          "shop_calendar_revision",
          "service_catalogue_revision",
          "service_catalogue_availability",
          "service_catalogue_reference",
          "service_catalogue_entry",
        ]) {
          result[table] = (
            await f.admin.query(
              `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) content from ${table} t`,
            )
          ).rows[0].content;
        }
        return result;
      };
      const before = await snapshot();
      assert.equal(
        (
          await f.admin.query(
            "select to_regclass('measurement_form_revision') name",
          )
        ).rows[0].name,
        null,
      );
      await migrateDatabase(f.migrationConnectionString);
      await migrateDatabase(f.migrationConnectionString);
      assert.deepEqual(await snapshot(), before);
      await publishForm(f, form(service, top, "upgraded-body"));
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual(
        await ok(await request(f, `customers/${customer.id}`)),
        customer,
      );
      assert.deepEqual(
        await ok(await request(f, `customers/${customer.id}/wearers`)),
        wearers,
      );
      assert.deepEqual(
        await ok(await request(f, "settings/calendar")),
        calendar,
      );
    },
    {
      migrationThrough: "0025_service_catalogue.sql",
      customerPolicy: syntheticCustomerPolicy,
    },
  );
});
