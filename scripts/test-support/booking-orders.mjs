import { randomUUID } from "node:crypto";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { seedOrderAcceptance } from "./order-acceptance.mjs";
import { seedServiceTemplates } from "./seed-service-templates.mjs";

// Disposable synthetic setup through existing real commands; no runtime imports.
export async function seedBookingOrders({
  setup,
  runtime,
  shopId,
  seed,
  acceptOrders = true,
}) {
  const config = await seedOrderAcceptance(setup, seed.sources);
  const blouse = await seedServiceTemplates(runtime, shopId, {
    templatePrefix: "booking-blouse-",
  });
  try {
    const category = (
      await setup(
        `settings/catalogue/entries/${blouse.service.definition.content.parent.entryId}`,
        { method: "GET" },
      )
    ).revision;
    await config.publish("service.commitment-bindings", {
      categoryId: category.entryId,
      categoryRevisionId: category.definition.id,
      availabilityId: category.id,
      ruleRevisionId: config.ruleId,
      baseVersion: 0,
      baseRevisionId: null,
      review: "reviewed",
      reason: "SYNTHETIC second category",
    });
    const c = await setup(`customers/${seed.customer.customerId}`, {
        method: "GET",
      }),
      at = new Date().toISOString();
    const second = await setup(`customers/${c.id}/wearers`, {
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
          occurredAt: at,
          interaction: "SYNTHETIC authorised second adult",
        },
      },
    });
    const wearer = await setup(`customers/${c.id}/wearers/${second.wearerId}`, {
      method: "GET",
    });
    await setup(`customers/${c.id}/wearers/${second.wearerId}/consent-events`, {
      etag: `"v${second.version}"`,
      body: {
        purpose: "service",
        decision: "grant",
        noticeId: syntheticWearerPolicy.notice.id,
        noticeExplained: true,
        language: "en",
        giverPersonId: wearer.personId,
        source: "in-person",
        occurredAt: at,
      },
    });
    const intakes = [];
    const accept = async (s, wearerId, offset, priceText) => {
      const value = {
        ...emptyQuickOrder(),
        customerId: c.id,
        wearerId,
        manifest: {
          entryId: s.before.entryId,
          revisionId: s.before.id,
          definitionId: s.before.definition.id,
        },
        deliveryDate: new Date(Date.now() + offset * 86400000)
          .toISOString()
          .slice(0, 10),
        priceState: priceText === null ? "to-be-quoted" : "quoted",
        priceText: priceText ?? "",
        instructions: `SYNTHETIC ${priceText === null ? "salwar — bottom unresolved" : "blouse — separate promise"}`,
      };
      intakes.push(value);
      if (!acceptOrders) return undefined;
      const review = await setup("orders/review", { body: value });
      if (review.unknowns.length)
        throw Error(
          `Synthetic group commitment unresolved: ${review.unknowns.join(",")}`,
        );
      const id = randomUUID().replace(/^(........-....-)./, "$17");
      await setup(`drafts/${id}`, {
        method: "PUT",
        body: {
          workflow: "order.quick",
          schemaVersion: 1,
          payload: {
            ...value,
            commitmentReview: {
              fingerprint: review.fingerprint,
              acknowledged: true,
              exceptionReason: review.evaluation.warnings.length
                ? "SYNTHETIC only"
                : "",
              waiveRush: false,
              waiverReason: "",
            },
          },
        },
      });
      const p = await setup(`drafts/${id}/promote`, { body: {}, etag: '"v1"' });
      return setup(`orders/${p.draft.result.id}/read`);
    };
    const orders = [
      await accept(blouse, seed.wearer.wearerId, 30, "1200"),
      await accept(seed.sources, second.wearerId, 32, null),
    ];
    return {
      orders: orders.filter(Boolean),
      intakes,
      close: () => blouse.close(),
    };
  } catch (e) {
    await blouse.close();
    throw e;
  }
}
