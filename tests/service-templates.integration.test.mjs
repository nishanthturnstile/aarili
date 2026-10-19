import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyMeasurementFormContent } from "@aarili/contracts/measurement-forms";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { emptyCalendarDefinition } from "@aarili/contracts/shop-calendar";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { measurementFormsRepository } from "@aarili/db/measurement-forms-repository";
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

import { serviceTemplatesDraftWorkflow } from "@aarili/core/service-templates";
import { serviceTemplatesRepository } from "@aarili/db/service-templates-repository";
import { syntheticManifest } from "../scripts/test-support/service-template-fixtures.mjs";

async function saveTemplate(f, v, who = f.a) {
  const draftId = id();
  const { draft } = await ok(
    await request(f, `drafts/${draftId}`, {
      who,
      method: "PUT",
      body: { workflow: "service.templates", schemaVersion: 1, payload: v },
    }),
  );
  return { draftId, draft };
}
const currentTemplate = async (f, entryId, who = f.a) =>
  (
    await ok(
      await request(f, `settings/service-templates/entries/${entryId}`, {
        who,
      }),
    )
  ).revision;
async function publishTemplate(f, v) {
  await ok(await promote(f, await saveTemplate(f, v)));
  return currentTemplate(f, v.entryId);
}
async function prepared(f) {
  const sources = await setup(f);
  const forms = [
    await publishForm(f, form(sources.service, sources.top, "top")),
    await publishForm(f, form(sources.service, sources.bottom, "bottom")),
  ];
  return {
    ...sources,
    forms,
    manifest: (code = "before-craft", sequence = "before") =>
      syntheticManifest(
        sources.service,
        [sources.top, sources.bottom],
        forms,
        code,
        sequence,
      ),
  };
}

test("ST-03/04/07/10/12 complete exact manifests, independent craft sequences, parallel work and honest generated requirements", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(
    async (f) => {
      const { manifest, top } = await prepared(f);
      const before = await publishTemplate(f, manifest()),
        after = await publishTemplate(f, manifest("after-craft", "after"));
      assert.deepEqual(
        before.definition.content.tasks.find((t) => t.key === "cut")
          .predecessors,
        ["craft"],
      );
      assert.deepEqual(
        after.definition.content.tasks.find((t) => t.key === "craft")
          .predecessors,
        ["cut"],
      );
      assert.deepEqual(
        after.definition.content.tasks.find((t) => t.key === "parallel-trim")
          .predecessors,
        [],
      );
      const c = structuredClone(before.definition.content);
      c.tasks[0].labelTa = "திருத்திய கைவினை";
      c.sections.decoration = {
        decision: "not-applicable",
        reason: "SYNTHETIC no decoration in this revision",
      };
      c.decoration = [];
      const r = await publishTemplate(f, revised(before, { content: c }));
      assert.equal(r.version, 2);
      assert.equal(
        r.definition.content.tasks[0].key,
        before.definition.content.tasks[0].key,
      );
      assert.deepEqual(
        await ok(
          await request(f, `settings/service-templates/revisions/${before.id}`),
        ),
        before,
      );
      const history = await ok(
        await request(f, "settings/service-templates/history", {
          method: "POST",
          body: { entryId: before.entryId },
        }),
      );
      assert.deepEqual(
        history.revisions.map((x) => x.version),
        [2, 1],
      );
      const preview = await ok(
        await request(f, "settings/service-templates/preview", {
          method: "POST",
          body: {
            content: before.definition.content,
            templateRevisionId: before.definition.id,
          },
        }),
      );
      assert.equal(preview.effects, "none");
      assert(preview.sources.includes(`template:${before.definition.id}`));
      assert.equal(
        (
          await request(f, "settings/service-templates/preview", {
            method: "POST",
            body: {
              content: {
                ...before.definition.content,
                labelEn: "Changed draft pretending to be historical",
              },
              templateRevisionId: before.definition.id,
            },
          })
        ).status,
        409,
      );
      assert.equal(preview.activation, "unavailable");
      assert(preview.items.every((x) => x.state === "unresolved"));
      assert.equal(
        preview.items.filter((x) => x.section === "measurement").length,
        2,
      );
      assert.deepEqual(
        preview.items
          .find((x) => x.key === "price-question")
          .unresolvedTokens.sort(),
        ["price_basis", "ready_date"],
      );
      assert(
        preview.items
          .filter((x) => x.section === "tasks")
          .every((x) => x.assigneeId === f.a.user),
      );
      assert.equal(
        preview.items.find((x) => x.key === "neck-decoration").required,
        false,
      );
      assert.equal(
        preview.items.find((x) => x.key === "neck-decoration").state,
        "unresolved",
      );
      const changed = structuredClone(c);
      changed.materials[0].required = false;
      const p2 = await ok(
        await request(f, "settings/service-templates/preview", {
          method: "POST",
          body: { content: changed, templateRevisionId: null },
        }),
      );
      assert.notEqual(p2.fingerprint, preview.fingerprint);
      await publish(
        f,
        revised(top, { operation: "availability", available: false }),
      );
      const list = await ok(
        await request(f, "settings/service-templates/list", {
          method: "POST",
          body: { query: "" },
        }),
      );
      assert(list.entries.every((x) => !x.configurationEligible));
      assert.deepEqual(
        await ok(
          await request(f, `settings/service-templates/revisions/${before.id}`),
        ),
        before,
      );
      assert.equal(
        (await promote(f, await saveTemplate(f, revised(r)))).status,
        409,
      );
      // Disable remains possible when a referenced source becomes unavailable.
      await publishTemplate(
        f,
        revised(r, { operation: "availability", available: false }),
      );
      assert.equal(await currentTemplate(f, before.entryId, f.b), null);
      assert.equal(
        (
          await request(
            f,
            `settings/service-templates/revisions/${before.id}`,
            { who: f.b },
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await ok(
            await request(f, "settings/service-templates/list", {
              method: "POST",
              body: { query: "" },
              who: f.b,
            }),
          )
        ).entries.length,
        0,
      );
      const expectedTables = [
        "revision",
        "availability",
        "entry",
        "reference",
        "form",
        "item",
        "edge",
        "quality_task",
      ].map((x) => `public.service_template_${x}`);
      const catalog = await assertIsolationCatalog(f.runtime.db);
      for (const table of expectedTables) assert(catalog.includes(table));
      for (const table of expectedTables)
        await f.runtime.db.transaction(async (tx) =>
          assert.equal(
            (await tx.execute(sql.raw(`select * from ${table}`))).rowCount,
            0,
          ),
        );
      const events = (
        await f.admin.query(
          "select count(*)::int n from audit_event where action like 'service-templates.%'",
        )
      ).rows[0].n;
      assert.equal(events, 4);
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
});

test("ST-03/04/10 reject unresolved sections, cycles, optional bypass, scripts, private wording, duplicate keys and missing/foreign exact sources", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const { manifest, forms } = await prepared(f);
    const foreign = await publish(f, value("piece", "foreign"), f.b);
    for (const mutate of [
      (c) => {
        c.sections.materials.decision = "unresolved";
      },
      (c) => {
        c.sections.quality.decision = "not-applicable";
        c.sections.quality.reason = "";
      },
      (c) => {
        c.sections.tasks.decision = "applicable";
        c.tasks = [];
      },
      (c) => {
        c.tasks[0].predecessors = ["cut"];
      },
      (c) => {
        c.tasks[0].predecessors = ["craft"];
      },
      (c) => {
        c.tasks[0].predecessors = ["absent"];
      },
      (c) => {
        c.tasks[0].required = false;
      },
      (c) => {
        c.tasks[0].applicability = "not-applicable";
        c.tasks[0].applicabilityReason = "Not selected";
      },
      (c) => {
        c.tasks[1].key = c.tasks[0].key;
      },
      (c) => {
        c.confirmation[0].instructionEn = "{{profit}}";
      },
      (c) => {
        c.confirmation[0].instructionEn = "<script>alert(1)</script>";
      },
      (c) => {
        c.confirmation[0].instructionEn = c.instructions[0].instructionEn;
      },
      (c) => {
        c.confirmation[0].instructionTa = c.instructions[0].instructionTa;
      },
      (c) => {
        c.confirmation[0].instructionEn = "{{price_basis.constructor}}";
      },
      (c) => {
        c.quality[0].taskKeys = ["missing"];
      },
      (c) => {
        c.tasks[0].scope.pieceKey = "foreign-piece";
      },
      (c) => {
        c.pieces[0].key = c.pieces[1].key;
      },
    ]) {
      const v = manifest();
      mutate(v.content);
      assert.equal((await promote(f, await saveTemplate(f, v))).status, 422);
    }
    for (const mutate of [
      (c) => {
        c.pieces[0] = { ...c.pieces[0], ...ref(foreign) };
      },
      (c) => {
        c.service = { entryId: randomUUID(), revisionId: randomUUID() };
      },
      (c) => {
        c.forms[0].revisionId = randomUUID();
      },
      (c) => {
        c.forms[0] = { ...c.forms[0], ...ref(forms[1]) };
      },
      (c) => {
        c.forms = [];
      },
      (c) => {
        c.pieces = [];
      },
    ]) {
      const v = manifest();
      mutate(v.content);
      assert.equal((await promote(f, await saveTemplate(f, v))).status, 409);
    }
    const wrongKind = manifest();
    wrongKind.content.tasks[0].script = "execute";
    assert.equal(
      (
        await request(f, `drafts/${id()}`, {
          method: "PUT",
          body: {
            workflow: "service.templates",
            schemaVersion: 1,
            payload: wrongKind,
          },
        })
      ).status,
      422,
    );
    await assert.rejects(() =>
      withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
        tx.execute(
          sql`insert into service_template_reference(shop_id,definition_id,role,position,target_entry_id,target_revision_id) values(${f.a.shop}::uuid,${randomUUID()}::uuid,'piece',0,${foreign.entryId}::uuid,${foreign.definition.id}::uuid)`,
        ),
      ),
    );
  });
});

test("ST-07/10 exact-key concurrent replay, changed payload/actor/action, 428/412 and rollback after actual revision/pointer/draft/audit/result writes", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const { manifest } = await prepared(f);
    const v = manifest(),
      d = await saveTemplate(f, v),
      key = randomUUID();
    assert.equal((await promote(f, d, undefined, { etag: null })).status, 428);
    const [a, b] = await Promise.all([promote(f, d, key), promote(f, d, key)]);
    assert.deepEqual(await ok(a), await ok(b));
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    assert.equal(
      (await promote(f, d, key, { who: f.b, shop: f.a.shop })).status,
      422,
    );
    await f.admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [f.a.shop, f.b.user],
    );
    const changedId = id(),
      changedKey = randomUUID(),
      saveBody = {
        workflow: "service.templates",
        schemaVersion: 1,
        payload: manifest("hash-binding"),
      };
    await ok(
      await request(f, `drafts/${changedId}`, {
        method: "PUT",
        key: changedKey,
        body: saveBody,
      }),
    );
    assert.equal(
      (
        await request(f, `drafts/${changedId}`, {
          method: "PUT",
          key: changedKey,
          body: {
            ...saveBody,
            payload: {
              ...saveBody.payload,
              reason: "Changed reviewed payload",
            },
          },
        })
      ).status,
      422,
    );
    assert.equal((await promote(f, d, key, { etag: '"v9"' })).status, 422);
    assert.equal(
      (await promote(f, d, key, { who: f.b, shop: f.a.shop })).status,
      403,
    );
    const actionReuse = await request(f, `drafts/${d.draftId}`, {
      method: "PUT",
      key,
      etag: '"v1"',
      body: { workflow: "service.templates", schemaVersion: 1, payload: v },
    });
    assert.equal(actionReuse.status, 422);
    const r = await currentTemplate(f, v.entryId),
      one = await saveTemplate(f, revised(r)),
      two = await saveTemplate(
        f,
        revised(r, { reason: "Other reviewed change" }),
      );
    assert.deepEqual(
      (await Promise.all([promote(f, one), promote(f, two)]))
        .map((r) => r.status)
        .sort(),
      [200, 412],
    );
    const first = manifest("first-race"),
      da = await saveTemplate(f, first),
      db = await saveTemplate(f, first);
    assert.deepEqual(
      (await Promise.all([promote(f, da), promote(f, db)]))
        .map((r) => r.status)
        .sort(),
      [200, 412],
    );
    const count = async () =>
      (
        await f.admin.query(
          "select (select count(*) from service_template_revision) definitions,(select count(*) from service_template_reference) refs,(select count(*) from service_template_item) items,(select count(*) from service_template_edge) edges,(select count(*) from service_template_form) forms,(select count(*) from service_template_quality_task) quality,(select count(*) from service_template_availability) changes,(select count(*) from service_template_entry) pointers,(select count(*) from audit_event) audits,(select count(*) from idempotency_key) keys,(select count(*) from durable_draft where lifecycle='promoted') promoted",
        )
      ).rows[0];
    for (const point of ["append", "advance", "update", "audit", "persist"]) {
      const v = manifest(`rollback-${point}`),
        d = await saveTemplate(f, v),
        before = await count();
      await assert.rejects(
        () =>
          withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
            const raw = serviceTemplatesRepository(tx, f.a.shop),
              dr = draftRepository(tx, f.a.shop),
              repository = { ...raw },
              drafts = { ...dr };
            const target = ["append", "advance"].includes(point)
                ? repository
                : drafts,
              original = ["append", "advance"].includes(point) ? raw : dr;
            target[point] = async (...args) => {
              await original[point](...args);
              throw Error("injected template rollback");
            };
            const catalogue = {
              shopId: f.a.shop,
              actorId: f.a.user,
              repository: serviceCatalogueRepository(tx, f.a.shop),
              synthetic: true,
            };
            return mutateDraft(
              {
                shopId: f.a.shop,
                actor: { type: "user", id: f.a.user },
                repository: drafts,
                workflows: new Map([
                  [
                    "service.templates",
                    serviceTemplatesDraftWorkflow({
                      shopId: f.a.shop,
                      actorId: f.a.user,
                      repository,
                      catalogue,
                      forms: {
                        ...catalogue,
                        catalogue,
                        repository: measurementFormsRepository(tx, f.a.shop),
                      },
                      synthetic: true,
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
        /injected template rollback/,
      );
      assert.deepEqual(await count(), before);
      assert.equal(await currentTemplate(f, v.entryId), null);
    }
  });
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

      const { service, top, bottom } = await setup(f);
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
      const oldForm = await publishForm(f, form(service, top, "upgraded-body"));
      const otherForm = await publishForm(
        f,
        form(service, bottom, "upgraded-bottom"),
      );
      const oldFormExact = structuredClone(oldForm);
      const before = await snapshot();
      assert.equal(
        (
          await f.admin.query(
            "select to_regclass('service_template_revision') name",
          )
        ).rows[0].name,
        null,
      );
      await migrateDatabase(f.migrationConnectionString);
      await migrateDatabase(f.migrationConnectionString);
      assert.deepEqual(await snapshot(), before);
      await publishTemplate(
        f,
        syntheticManifest(service, [top, bottom], [oldForm, otherForm]),
      );
      assert.deepEqual(await currentForm(f, oldForm.entryId), oldFormExact);
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
      migrationThrough: "0026_measurement_forms.sql",
      customerPolicy: syntheticCustomerPolicy,
    },
  );
});
