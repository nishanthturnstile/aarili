import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { emptyDesignChoicesContent } from "@aarili/contracts/design-choices";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { designChoicesDraftWorkflow } from "@aarili/core/design-choices";
import { mutateDraft } from "@aarili/core/drafts";
import { sql, withShop } from "@aarili/db";
import { designChoicesRepository } from "@aarili/db/design-choices-repository";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { measurementFormsRepository } from "@aarili/db/measurement-forms-repository";
import { serviceCatalogueRepository } from "@aarili/db/service-catalogue-repository";
import { serviceTemplatesRepository } from "@aarili/db/service-templates-repository";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  designRef,
  designScenarios,
  designSources,
  newDesignDraft,
  designOk as ok,
  promoteDesign,
  publishDesign,
  designRequest as request,
  revisedDesign,
  saveDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import { seedOrderAcceptance } from "../scripts/test-support/order-acceptance.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

test(
  "DS-A1-01/03 exact salwar top/bottom/dupatta, alteration and no-body fall/pico previews differ",
  { timeout: 240000 },
  async () =>
    withTenantFixture(
      async (f) => {
        const base = await designSources(f);
        const scenarios = await designScenarios(f, base);
        for (const scenario of scenarios)
          for (const profile of scenario.profiles) {
            const result = await request(f, "settings/design-choices/preview", {
              method: "POST",
              body: { content: profile.definition.content, selections: [] },
            }).then(ok);
            assert.equal(result.effects, "none");
            assert.equal(
              result.questions.length,
              profile.definition.content.questions.length,
            );
            if (scenario.code === "fall-pico")
              assert.equal(
                scenario.forms[0].definition.content.decision,
                "not-required",
              );
          }
        assert.equal(scenarios[0].profiles.length, 3);
        assert.equal(
          scenarios[0].profiles[0].definition.content.questions[0].kind,
          "text",
        );
        assert(
          scenarios[0].profiles
            .slice(1)
            .every((p) => p.definition.content.decision === "not-applicable"),
        );
        assert.equal(
          scenarios[1].profiles[0].definition.content.pieceKey,
          null,
        );
      },
      { customerPolicy: syntheticCustomerPolicy },
    ),
);

test(
  "DS-A1-01/02/03/04/05 exact piece/form/manifest choices, preview states, bilingual search, inactive history and forced RLS",
  { timeout: 240000 },
  async () =>
    withTenantFixture(
      async (f) => {
        const sources = await designSources(f),
          { profile, choices, manifest } = sources;
        profile.content.questions[1].when = [
          {
            questionId: profile.content.questions[0].id,
            choice: designRef(choices[0]),
          },
        ];
        const published = await publishDesign(f, profile);
        assert.equal(published.definition.authority, "synthetic-fixture");
        assert.equal(
          published.definition.content.pieceKey,
          sources.top.definition.content.code,
        );
        assert.equal(
          published.definition.content.manifest.revisionId,
          manifest.definition.id,
        );
        const tables = await assertIsolationCatalog(f.runtime.db);
        for (const table of [
          "design_config_revision",
          "design_config_availability",
          "design_config_reference",
          "design_manifest_reference",
          "design_question",
          "design_choice_link",
          "design_question_dependency",
          "design_template_link",
        ])
          assert(tables.includes(`public.${table}`));
        for (const query of ["blouse", "ரவிக்கை"]) {
          const rows = await ok(
            await request(f, "settings/design-choices/list", {
              method: "POST",
              body: { query },
            }),
          );
          assert(rows.entries.some((r) => r.entryId === profile.entryId));
        }
        const preview = (selections) =>
          request(f, "settings/design-choices/preview", {
            method: "POST",
            body: { content: profile.content, selections },
          }).then(ok);
        let result = await preview([
          {
            questionId: profile.content.questions[1].id,
            state: "selected",
            choice: designRef(choices[1]),
          },
        ]);
        assert.equal(result.questions[0].state, "unknown");
        assert.equal(result.questions[1].state, "dependency-unresolved");
        assert(result.incompatible.includes(profile.content.questions[1].id));
        assert.equal(result.effects, "none");
        assert.equal(result.pattern, "manual-external");
        result = await preview(
          choices.map((choice, i) => ({
            questionId: profile.content.questions[i].id,
            state: "selected",
            choice: designRef(choice),
          })),
        );
        assert(result.questions.every((q) => q.state === "selected"));
        const bottom = revisedDesign(published, {
          entryId: randomUUID(),
          baseVersion: 0,
          baseRevisionId: null,
        });
        bottom.content = {
          ...bottom.content,
          code: "bottom-no-design",
          pieceKey: sources.bottom.definition.content.code,
          decision: "not-applicable",
          decisionReason: "SYNTHETIC no design decisions on this piece",
          questions: [],
        };
        const lower = await publishDesign(f, bottom);
        assert.equal(lower.definition.content.questions.length, 0);
        const invalid = revisedDesign(published);
        invalid.content.pieceKey = "not-a-piece";
        assert.equal(
          (await promoteDesign(f, await saveDesign(f, invalid))).status,
          409,
        );
        assert.equal(
          (
            await request(
              f,
              `settings/design-choices/revisions/${published.id}`,
              { who: f.b },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(
              f,
              `settings/design-choices/definitions/${published.definition.id}`,
              { who: f.b },
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await request(f, "settings/design-choices/list", {
              who: f.b,
              method: "POST",
              body: { query: "blouse" },
            }).then(ok)
          ).entries.length,
          0,
        );
        assert.equal(
          (
            await request(f, "settings/design-choices/list?private=1", {
              method: "POST",
              body: { query: "" },
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request(f, "settings/design-choices/preview", {
              method: "POST",
              origin: "https://wrong.example",
              body: { content: profile.content, selections: [] },
            })
          ).status,
          403,
        );
        const disabled = await publishDesign(
          f,
          revisedDesign(choices[0], {
            operation: "availability",
            available: false,
          }),
        );
        const list = await ok(
          await request(f, "settings/design-choices/list", {
            method: "POST",
            body: { query: "" },
          }),
        );
        assert.equal(
          list.entries.find((r) => r.entryId === profile.entryId)
            .configurationEligible,
          false,
        );
        assert.deepEqual(
          await request(
            f,
            `settings/design-choices/revisions/${published.id}`,
          ).then(ok),
          published,
        );
        assert.equal(
          (
            await promoteDesign(
              f,
              await saveDesign(f, revisedDesign(published)),
            )
          ).status,
          409,
        );
        await publishDesign(
          f,
          revisedDesign(disabled, {
            operation: "availability",
            available: true,
          }),
        );
        const altered = revisedDesign(choices[1]);
        altered.content.meaning = "Changed semantic meaning";
        assert.equal(
          (await promoteDesign(f, await saveDesign(f, altered))).status,
          409,
        );
        const copied = structuredClone(profile.content);
        copied.questions[0].meaning = "Changed question meaning";
        const changed = revisedDesign(published, { content: copied });
        assert.equal(
          (await promoteDesign(f, await saveDesign(f, changed))).status,
          409,
        );
        const prior = await f.admin.query(
          "select content from design_question where shop_id=$1 and definition_id=$2 order by position",
          [f.a.shop, published.definition.id],
        );
        await assert.rejects(() =>
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`update design_question set content='{}'::jsonb where shop_id=${f.a.shop}::uuid`,
            ),
          ),
        );
        await assert.rejects(() =>
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`insert into design_question(shop_id,definition_id,id,position,content) values(${f.a.shop}::uuid,${published.definition.id}::uuid,${randomUUID()}::uuid,5,'{}'::jsonb)`,
            ),
          ),
        );
        await assert.rejects(() =>
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`delete from design_config_revision where shop_id=${f.a.shop}::uuid`,
            ),
          ),
        );
        await assert.rejects(() =>
          withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
            tx.execute(
              sql`insert into design_manifest_reference(shop_id,definition_id,entry_id,revision_id) values(${f.a.shop}::uuid,${randomUUID()}::uuid,${manifest.entryId}::uuid,${manifest.definition.id}::uuid)`,
            ),
          ),
        );
        assert.deepEqual(
          (
            await f.admin.query(
              "select content from design_question where shop_id=$1 and definition_id=$2 order by position",
              [f.a.shop, published.definition.id],
            )
          ).rows,
          prior.rows,
        );
        assert.equal(
          (
            await f.runtime.db.execute(
              sql`select count(*)::int as n from design_config_revision`,
            )
          ).rows[0].n,
          0,
        );
        const renamed = revisedDesign(choices[0]);
        renamed.baseVersion = 3;
        renamed.baseRevisionId = (
          await request(
            f,
            `settings/design-choices/entries/${choices[0].entryId}`,
          ).then(ok)
        ).revision.id;
        renamed.content.labelEn = "SYNTHETIC renamed shape";
        await publishDesign(f, renamed);
        assert.equal(
          (
            await request(
              f,
              `settings/design-choices/definitions/${choices[0].definition.id}`,
            ).then(ok)
          ).content.labelEn,
          choices[0].definition.content.labelEn,
        );
        const wrongKind = revisedDesign(published);
        wrongKind.content.questions[1].choices = [designRef(choices[2])];
        assert.equal(
          (await promoteDesign(f, await saveDesign(f, wrongKind))).status,
          409,
        );
        const foreign = await designSources({ ...f, a: f.b });
        const crossShop = revisedDesign(choices[3]);
        crossShop.content.category = designRef(foreign.category);
        assert.equal(
          (await promoteDesign(f, await saveDesign(f, crossShop))).status,
          409,
        );
        const categoryRename = await publishDesign(
          f,
          {
            ...revisedDesign(sources.category),
            content: {
              ...sources.category.definition.content,
              labelEn: "SYNTHETIC renamed category",
            },
          },
          "service.catalogue",
          "catalogue",
        );
        const refreshedChoice = await publishDesign(f, {
          ...revisedDesign(choices[3]),
          content: {
            ...choices[3].definition.content,
            category: designRef(categoryRename),
          },
        });
        assert.equal(refreshedChoice.entryId, choices[3].entryId);
        assert.equal(refreshedChoice.version, 2);
        assert.deepEqual(
          (
            await request(
              f,
              `settings/design-choices/definitions/${choices[3].definition.id}`,
            ).then(ok)
          ).content.category,
          designRef(sources.category),
        );
      },
      { customerPolicy: syntheticCustomerPolicy },
    ),
);

test(
  "DS-A1-04/05 concurrent CAS, request replay, If-Match and rollback after real child/pointer/draft/audit/result writes",
  { timeout: 240000 },
  async () =>
    withTenantFixture(
      async (f) => {
        const sources = await designSources(f),
          draft = await saveDesign(f, sources.profile),
          key = randomUUID();
        const responses = await Promise.all([
          promoteDesign(f, draft, key),
          promoteDesign(f, draft, key),
        ]);
        assert.deepEqual(await ok(responses[0]), await ok(responses[1]));
        assert.equal(
          (await promoteDesign(f, draft, key, { etag: '"v99"' })).status,
          422,
        );
        const published = (
          await request(
            f,
            `settings/design-choices/entries/${sources.profile.entryId}`,
          ).then(ok)
        ).revision;
        const a = await saveDesign(f, revisedDesign(published)),
          b = await saveDesign(
            f,
            revisedDesign(published, { reason: "Other review" }),
          );
        assert.deepEqual(
          (await Promise.all([promoteDesign(f, a), promoteDesign(f, b)]))
            .map((r) => r.status)
            .sort(),
          [200, 412],
        );
        const choice = newDesignDraft({
          ...emptyDesignChoicesContent("choice"),
          code: "race-choice",
          labelEn: "Synthetic race",
          labelTa: "செயற்கை",
          category: designRef(sources.category),
          meaning: "Race identity",
          dimension: "lining",
        });
        const one = await saveDesign(f, choice),
          two = await saveDesign(f, choice);
        assert.deepEqual(
          (await Promise.all([promoteDesign(f, one), promoteDesign(f, two)]))
            .map((r) => r.status)
            .sort(),
          [200, 412],
        );
        const missing = await saveDesign(f, {
          ...choice,
          entryId: randomUUID(),
          content: { ...choice.content, code: "missing-header" },
        });
        assert.equal(
          (await promoteDesign(f, missing, undefined, { etag: null })).status,
          428,
        );
        const count = async () =>
          (
            await f.admin.query(
              "select (select count(*) from design_config_revision) definitions,(select count(*) from design_question) questions,(select count(*) from design_choice_link) links,(select count(*) from audit_event where action='design-choices.publish') audits,(select count(*) from idempotency_key where action='draft.promote') keys",
            )
          ).rows[0];
        for (const point of [
          "append",
          "advance",
          "update",
          "audit",
          "persist",
        ]) {
          const v = structuredClone(sources.profile);
          v.entryId = randomUUID();
          v.content.code = `rollback-${point}`;
          const d = await saveDesign(f, v),
            before = await count();
          await assert.rejects(
            () =>
              withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
                const raw = designChoicesRepository(tx, f.a.shop),
                  dr = draftRepository(tx, f.a.shop),
                  repository = { ...raw },
                  drafts = { ...dr };
                const target = ["append", "advance"].includes(point)
                    ? repository
                    : drafts,
                  original = ["append", "advance"].includes(point) ? raw : dr;
                target[point] = async (...args) => {
                  await original[point](...args);
                  throw Error("injected design rollback");
                };
                const catalogue = {
                    shopId: f.a.shop,
                    actorId: f.a.user,
                    synthetic: true,
                    repository: serviceCatalogueRepository(tx, f.a.shop),
                  },
                  forms = {
                    ...catalogue,
                    catalogue,
                    repository: measurementFormsRepository(tx, f.a.shop),
                  },
                  templates = {
                    ...catalogue,
                    catalogue,
                    forms,
                    repository: serviceTemplatesRepository(tx, f.a.shop),
                  };
                return mutateDraft(
                  {
                    shopId: f.a.shop,
                    actor: { type: "user", id: f.a.user },
                    repository: drafts,
                    workflows: new Map([
                      [
                        "design.choices",
                        designChoicesDraftWorkflow({
                          ...catalogue,
                          catalogue,
                          templates,
                          repository,
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
            /injected design rollback/,
          );
          assert.deepEqual(await count(), before);
        }
        const currentProfile = (
          await request(
            f,
            `settings/design-choices/entries/${published.entryId}`,
          ).then(ok)
        ).revision;
        const profileRace = await saveDesign(f, revisedDesign(currentProfile));
        const disableRace = await saveDesign(
          f,
          revisedDesign(sources.choices[0], {
            operation: "availability",
            available: false,
          }),
        );
        const [profileResult, disabledResult] = await Promise.all([
          promoteDesign(f, profileRace),
          promoteDesign(f, disableRace),
        ]);
        assert.equal(disabledResult.status, 200);
        assert([200, 409].includes(profileResult.status));
        const eligible = await request(f, "settings/design-choices/list", {
          method: "POST",
          body: { query: "blouse" },
        }).then(ok);
        assert.equal(
          eligible.entries.find((r) => r.entryId === published.entryId)
            .configurationEligible,
          false,
        );
        const availability = await saveDesign(
          f,
          revisedDesign(sources.choices[2], {
            operation: "availability",
            available: false,
          }),
        );
        const definition = await saveDesign(
          f,
          revisedDesign(sources.choices[2], {
            content: {
              ...sources.choices[2].definition.content,
              labelEn: "SYNTHETIC concurrent reviewed label",
            },
          }),
        );
        assert.deepEqual(
          (
            await Promise.all([
              promoteDesign(f, availability),
              promoteDesign(f, definition),
            ])
          )
            .map((r) => r.status)
            .sort(),
          [200, 412],
        );
      },
      { customerPolicy: syntheticCustomerPolicy },
    ),
);

test(
  "DS-A1-01/05 additive upgrade preserves populated catalogue and creates no approved design seeds",
  { timeout: 180000 },
  async () =>
    withTenantFixture(
      async (f) => {
        f.api = createApi(async () => true, {
          ...f.owner,
          commandLimit: async () => 0,
        });
        const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
        try {
          const setup = (path, options = {}) =>
            request(f, path, { method: "POST", ...options }).then(ok);
          await seedOrderAcceptance(setup, seed.sources);
          const intake = {
            ...emptyQuickOrder(),
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
            manifest: {
              entryId: seed.sources.before.entryId,
              revisionId: seed.sources.before.id,
              definitionId: seed.sources.before.definition.id,
            },
            deliveryDate: new Date(Date.now() + 30 * 86400000)
              .toISOString()
              .slice(0, 10),
            priceState: "quoted",
            priceText: "0",
          };
          const review = await setup("orders/review", { body: intake });
          assert.deepEqual(review.unknowns, []);
          intake.commitmentReview = {
            fingerprint: review.fingerprint,
            acknowledged: true,
            exceptionReason: review.evaluation.warnings.length
              ? "SYNTHETIC reviewed exception"
              : "",
            waiveRush: false,
            waiverReason: "",
          };
          const d = await saveDesign(f, intake, "order.quick");
          await ok(await promoteDesign(f, d));
          const snapshot = async () => {
            const rows = {};
            for (const table of [
              "service_catalogue_revision",
              "measurement_form_revision",
              "service_template_revision",
              "garment_order",
              "order_acceptance_snapshot",
              "durable_draft",
            ])
              rows[table] = (
                await f.admin.query(
                  `select to_jsonb(t) as value from ${table} t order by to_jsonb(t)::text`,
                )
              ).rows;
            return rows;
          };
          const before = await snapshot();
          assert(before.garment_order.length > 0);
          assert(before.measurement_form_revision.length > 0);
          await migrateDatabase(f.migrationConnectionString);
          await migrateDatabase(f.migrationConnectionString);
          assert.deepEqual(await snapshot(), before);
          assert.equal(
            (
              await f.admin.query(
                "select count(*)::int n from design_config_revision",
              )
            ).rows[0].n,
            0,
          );
        } finally {
          await seed.close();
        }
      },
      {
        migrationThrough: "0041_contact_merge.sql",
        customerPolicy: syntheticCustomerPolicy,
      },
    ),
);
