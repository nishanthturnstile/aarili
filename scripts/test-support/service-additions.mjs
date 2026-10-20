import { randomUUID } from "node:crypto";
import { emptyGroupIntake, emptyQuickOrder } from "@aarili/contracts/orders";
import { seedSmallServices, serviceDraftId } from "./small-services.mjs";
// Synthetic-only review/browser setup through real registered commands.
export async function seedServiceAdditions(options) {
  const { setup } = options,
    services = await seedSmallServices(options),
    { saree, seed } = services;
  try {
    const base = {
      ...emptyQuickOrder(),
      customerId: seed.customer.customerId,
      wearerId: seed.wearer.wearerId,
      manifest: saree.profile.content.manifest,
      deliveryDate: saree.intake.deliveryDate,
      deliveryTime: saree.intake.deliveryTime,
      presentationRevisionId: saree.intake.presentationRevisionId,
      priceState: "quoted",
      priceText: "1000",
      instructions:
        "SYNTHETIC original custom garment; preserve this exact scope",
    };
    const decision = (fingerprint) => ({
      fingerprint,
      acknowledged: true,
      exceptionReason: "SYNTHETIC explicit capacity review",
      waiveRush: false,
      waiverReason: "",
    });
    const qr = await setup("orders/review", { body: base });
    const customId = await services.config.publish("order.quick", {
      ...base,
      commitmentReview: decision(qr.fingerprint),
    });
    const groups = [];
    for (const basis of ["garment-prices", "package-proposal"]) {
      const value = {
        ...emptyGroupIntake(),
        reason: "SYNTHETIC two garments under one contact",
        lines: [
          {
            id: serviceDraftId(),
            intake: { ...base, instructions: "SYNTHETIC garment one" },
          },
          {
            id: serviceDraftId(),
            intake: { ...base, instructions: "SYNTHETIC garment two" },
          },
        ],
        commercial: {
          basis,
          packagePriceState:
            basis === "package-proposal" ? "quoted" : "to-be-quoted",
          packagePriceText: basis === "package-proposal" ? "1800" : "",
        },
      };
      const r = await setup("orders/bookings/intake-review", { body: value });
      const revisionId = await services.config.publish("order.group", {
        ...value,
        review: decision(r.fingerprint),
      });
      const detail = await setup("orders/bookings/read", {
        body: { id: revisionId, revision: true },
      });
      groups.push({
        basis,
        revisionId,
        orderIds: detail.orders.map((o) => o.id),
      });
    }
    const sourceDraftId = serviceDraftId();
    await setup(`drafts/${sourceDraftId}`, {
      method: "PUT",
      body: {
        workflow: "order.quick",
        schemaVersion: 1,
        payload: { ...base, commitmentReview: null },
      },
    });
    const selection = (profile = saree.intake.profile) => ({
      lineId: null,
      profile,
      lines: saree.intake.lines.map((l, i) => ({
        ...l,
        id: randomUUID(),
        priceState: "quoted",
        priceText: i ? "50" : "100",
      })),
      capacity: {
        basis: "incremental",
        coveredBy: null,
        reason: "SYNTHETIC one additional mapped garment demand",
      },
      commercial: "additional-charge",
      reason: "SYNTHETIC requested after acceptance",
      agreement:
        "SYNTHETIC new agreement for these two lines and prices; unchanged promise",
    });
    const scope = await setup(`small-services/scope/${customId}`, {
      method: "GET",
    });
    const value = {
      ...selection(),
      orderId: customId,
      version: scope.version,
      originalDigest: scope.originalDigest,
      scopeDigest: scope.scopeDigest,
      pieceId: null,
      review: null,
    };
    delete value.lineId;
    const draftId = serviceDraftId();
    await setup(`drafts/${draftId}`, {
      method: "PUT",
      body: {
        workflow: "order.service-change",
        schemaVersion: 1,
        payload: value,
      },
    });
    return {
      ...services,
      base,
      customId,
      groups,
      sourceDraftId,
      changeDraftId: draftId,
      change: value,
      selection,
    };
  } catch (e) {
    await services.close();
    throw e;
  }
}
