import assert from "node:assert/strict";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { test } from "vitest";
import {
  designOk,
  designRef,
  designRequest,
  designScenarios,
  promoteDesign,
  publishDesign,
  revisedDesign,
  saveDesign,
} from "../scripts/test-support/design-choices-fixtures.mjs";
import {
  publishSpecification,
  specificationDraft,
  specificationSources,
} from "../scripts/test-support/design-specification-fixtures.mjs";
import { seedQuickOrder } from "../scripts/test-support/seed-quick-order.mjs";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

test(
  "DS-A2-01/02 exact salwar piece profiles preserve unknown, reviewed not-applicable and explicit none separately",
  { timeout: 240000 },
  () =>
    withTenantFixture(
      async (f) => {
        f.api = createApi(async () => true, {
          ...f.owner,
          commandLimit: async () => 0,
        });
        const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
        try {
          const s = await specificationSources(f, {
            customerId: seed.customer.customerId,
            wearerId: seed.wearer.wearerId,
          });
          const [salwar] = await designScenarios(f, s);
          await s.acceptance.publish("service.commitment-bindings", {
            categoryId: salwar.category.entryId,
            categoryRevisionId: salwar.category.definition.id,
            availabilityId: salwar.category.id,
            ruleRevisionId: s.acceptance.ruleId,
            baseVersion: 0,
            baseRevisionId: null,
            review: "reviewed",
            reason: "SYNTHETIC salwar applicability",
          });
          const { order, pieces } = await s.accept(salwar.manifest);
          const state = (pieceId) =>
            designRequest(f, "design-specifications/list", {
              method: "POST",
              body: { orderId: order.id, pieceId },
            }).then(designOk);
          for (const profile of salwar.profiles.slice(1)) {
            const pieceId = pieces.identities.find(
              (p) => p.key === profile.definition.content.pieceKey,
            ).id;
            await publishSpecification(
              f,
              specificationDraft(order.id, pieceId, profile),
            );
            const saved = (await state(pieceId)).versions[0];
            assert.equal(saved.profile.content.decision, "not-applicable");
            assert(saved.profile.content.decisionReason);
            assert.deepEqual(saved.answers, []);
          }
          const profile = salwar.profiles[0],
            pieceId = pieces.identities.find(
              (p) => p.key === profile.definition.content.pieceKey,
            ).id;
          const value = specificationDraft(order.id, pieceId, profile);
          value.answers = value.answers.map((a) => ({
            ...a,
            state: "unknown",
            text: "",
            unit: null,
            choice: null,
            intent: "unresolved",
          }));
          await publishSpecification(f, value);
          const original = (await state(pieceId)).versions[0];
          assert.equal(original.answers[0].state, "unknown");
          const reviewed = structuredClone(profile.definition.content);
          reviewed.questions[0].applicability = "not-applicable";
          reviewed.questions[0].reason =
            "SYNTHETIC reviewed finishing exclusion";
          const next = await publishDesign(
            f,
            revisedDesign(profile, { content: reviewed }),
          );
          const before = await state(pieceId);
          await publishSpecification(f, {
            ...value,
            baseVersion: before.version,
            baseSavedId: before.latestSavedId,
            profile: designRef(next),
            answers: value.answers.map((a) => ({
              ...a,
              state: "not-applicable",
            })),
            reason: "SYNTHETIC applicability review",
            use: false,
          });
          const result = await state(pieceId);
          assert.equal(result.versions[0].answers[0].state, "not-applicable");
          assert.equal(
            result.versions[0].profile.content.questions[0].reason,
            reviewed.questions[0].reason,
          );
          assert.deepEqual(result.versions[1], original);
          assert.equal(result.currentId, original.id);
          const wrong = await saveDesign(
            f,
            {
              ...value,
              pieceId: pieces.identities.find(
                (p) => p.key === salwar.profiles[1].definition.content.pieceKey,
              ).id,
            },
            "design.specification",
          );
          assert([409, 412].includes((await promoteDesign(f, wrong)).status));
          const blouse = await s.accept(),
            blousePiece = blouse.pieces.identities.find(
              (p) => p.key === s.top.definition.content.code,
            ).id;
          await publishSpecification(
            f,
            specificationDraft(blouse.order.id, blousePiece, s.profile),
          );
          const exact = await designRequest(f, "design-specifications/list", {
            method: "POST",
            body: { orderId: blouse.order.id, pieceId: blousePiece },
          }).then(designOk);
          assert(
            exact.versions[0].choices.some(
              (c) =>
                c.content.kind === "choice" &&
                c.content.dimension === "sleeve-design" &&
                c.content.none,
            ),
          );
          assert.equal(exact.versions[0].answers[3].state, "selected");
        } finally {
          await seed.close();
        }
      },
      { customerPolicy: syntheticCustomerPolicy },
    ),
);
