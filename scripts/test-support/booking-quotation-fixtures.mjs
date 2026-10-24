import { randomUUID } from "node:crypto";
import { emptyQuotation } from "@aarili/contracts/booking-quotations";
import {
  emptyEstimate,
  emptyEstimateLine,
} from "@aarili/contracts/garment-estimates";
import { emptyPolicy } from "@aarili/contracts/shop-policies";
import { draftUuid } from "./quotation-rate-fixtures.mjs";
import { seedServiceAdditions } from "./service-additions.mjs";
export async function seedBookingQuotation(options) {
  const s = await seedServiceAdditions(options),
    { setup } = options;
  try {
    const group = s.groups.find((g) => g.basis === "package-proposal");
    const detail = await setup("orders/bookings/read", {
      body: { id: group.revisionId, revision: true },
    });
    const scope = await setup(`small-services/scope/${group.orderIds[0]}`, {
      method: "GET",
    });
    const change = {
      ...s.selection(),
      commercial: "outside-package",
      orderId: group.orderIds[0],
      version: scope.version,
      originalDigest: scope.originalDigest,
      scopeDigest: scope.scopeDigest,
      pieceId: null,
      review: null,
    };
    delete change.lineId;
    const cr = await setup("small-services/changes/review", { body: change });
    await s.config.publish("order.service-change", {
      ...change,
      review: {
        fingerprint: cr.fingerprint,
        acknowledged: true,
        exceptionReason: "SYNTHETIC reviewed capacity",
        waiveRush: false,
        waiverReason: "",
      },
    });
    const native = await setup(`service-repeats/${group.orderIds[0]}/source`, {
      body: {},
    });
    const addition = native.candidates.find((c) => c.kind === "addition");
    if (!addition) throw Error("Synthetic outside addition not found");
    const root = emptyEstimateLine(randomUUID()),
      extra = emptyEstimateLine(randomUUID());
    const incomplete = {
      ...emptyEstimate(randomUUID()),
      target: {
        orderId: group.orderIds[0],
        pieceId: null,
        customerId: s.seed.customer.customerId,
        wearerId: s.seed.wearer.wearerId,
      },
      pricingDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
      reason: "SYNTHETIC one outside service still unknown",
      lines: [
        {
          ...root,
          sourceKey: "garment",
          labelEn: "SYNTHETIC reference garment",
          labelTa: "செயற்கை குறிப்பு ஆடை",
          quantityText: "1",
          state: "charge",
          fixedText: "1000",
          reason: "SYNTHETIC reviewed fixed reference price",
        },
        {
          ...extra,
          sourceKey: addition.key,
          labelEn: addition.labelEn,
          labelTa: addition.labelTa,
          component: "alteration",
          quantityText: "1",
          state: "unknown",
        },
      ],
      privateCosts: [
        {
          lineId: root.id,
          amountText: "25.01",
          reason: "SYNTHETIC PRIVATE internal labour estimate",
        },
      ],
    };
    const er = await setup("estimates/review", { body: incomplete }),
      fresh = er.suggested,
      estimateReview = await setup("estimates/review", { body: fresh });
    const unknownEstimateId = await s.config.publish("pricing.estimate", {
      ...fresh,
      review: estimateReview.fingerprint,
    });
    const sourceId = draftUuid();
    await setup(`drafts/${sourceId}`, {
      method: "PUT",
      body: {
        workflow: "shop.policies",
        schemaVersion: 1,
        payload: {
          baseVersion: 0,
          baseRevisionId: null,
          policy: {
            ...emptyPolicy("discount"),
            state: "reviewed",
            maximumBps: 5000,
            approval: "owner",
            terms: {
              en: "SYNTHETIC owner review required for eligible lines, stacking and manual attribution; maximum 50%.",
              ta: "செயற்கை தள்ளுபடி: உரிமையாளர் மதிப்பாய்வு அவசியம்.",
            },
            authority: {
              kind: "owner-proposal",
              label: "SYNTHETIC reviewed owner proposal",
            },
          },
        },
      },
    });
    const policyId = await s.config.publish("pricing.policy-review", {
      kind: "discount",
      baseVersion: 0,
      baseRevisionId: null,
      sourceDraftId: sourceId,
      sourceDraftVersion: 1,
      reason: "SYNTHETIC quotation-only discount authority",
      acknowledged: true,
    });
    const value = {
      ...emptyQuotation(randomUUID()),
      bookingId: detail.booking.id,
      orderIds: group.orderIds,
      reason: "SYNTHETIC package, references and outside services",
      assumptions:
        "SYNTHETIC unissued alternative; accepted package remains unchanged",
    };
    return {
      ...s,
      group,
      detail,
      policyId,
      sourceId,
      value,
      unknownEstimateId,
    };
  } catch (e) {
    await s.close();
    throw e;
  }
}
