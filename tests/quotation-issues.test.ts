import {
  issuedQuotationModelSchema,
  quoteResponseCommandSchema,
} from "@aarili/contracts/quotation-issues";
import fc from "fast-check";
import { expect, test } from "vitest";

const id = "019a5e59-1111-7000-8000-000000000001";
function model(gross: number, discount: number) {
  return {
    kind: "quotation.v1",
    language: "ta",
    number: "QT-000001",
    docId: id,
    revision: 1,
    proposalId: id,
    previousRevision: null,
    issuedAt: "2026-10-24T10:00:00.000Z",
    issueDate: "2026-10-24",
    expiryDate: "2026-10-31",
    pricingDates: [],
    profileId: id,
    validityPolicyId: id,
    shop: {
      name: "SYNTHETIC ஸ்ரீ தையலகம்",
      address: "SYNTHETIC",
      phone: "",
      email: "",
    },
    customerLabel: "SYNTHETIC",
    scope: [{ orderId: id, code: "SYN-176" }],
    terms: [{ en: "SYNTHETIC", ta: "மாதிரி" }],
    estimates: [],
    proposal: {
      kind: "quotation-proposal-not-issued",
      familyId: id,
      lines: [
        {
          key: "q-0",
          sequence: 0,
          orderId: id,
          pieceId: null,
          labelEn: "SYNTHETIC",
          labelTa: "மாதிரி",
          role: "charge",
          parentKey: null,
          grossPaise: gross,
          acceptedPaise: gross,
          estimateRevisionId: null,
          serviceLineId: null,
          additionLineId: null,
          sourceId: null,
          reason: "",
          lineDiscountPaise: discount,
          bookingDiscountPaise: 0,
          netPaise: gross - discount,
        },
      ],
      grossPaise: gross,
      discountPaise: discount,
      knownSubtotalPaise: gross - discount,
      unknownCount: 0,
      complete: true,
      totalPaise: gross - discount,
      assumptions: "",
      agreementApplication: "unavailable",
      attribution: [],
      unattributedSellingPaise: gross - discount,
    },
  };
}
test("C-01/06 strict issued model reconciles exact complete money; unknown and altered totals cannot render", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 100000000 }),
      fc.integer({ min: 0, max: 10000 }),
      (gross, bps) => {
        const m = model(gross, Math.floor((gross * bps) / 10000));
        expect(issuedQuotationModelSchema.safeParse(m).success).toBe(true);
        m.proposal.totalPaise++;
        expect(issuedQuotationModelSchema.safeParse(m).success).toBe(false);
      },
    ),
    { seed: 176001, numRuns: 200 },
  );
  for (const field of [
    "privateCosts",
    "actualCost",
    "margin",
    "measurements",
    "fittingMedia",
    "productionNotes",
    "paymentLink",
    "GSTIN",
  ]) {
    const m = model(10001, 1);
    expect(
      issuedQuotationModelSchema.safeParse({ ...m, [field]: "PRIVATE-176" })
        .success,
    ).toBe(false);
    expect(
      issuedQuotationModelSchema.safeParse({
        ...m,
        proposal: { ...m.proposal, [field]: "PRIVATE-176" },
      }).success,
    ).toBe(false);
  }
  const included = model(10000, 0);
  const parsed = issuedQuotationModelSchema.parse(included);
  parsed.proposal.lines.push({
    ...parsed.proposal.lines[0]!,
    key: "ref",
    sequence: 1,
    role: "reference",
    parentKey: "q-0",
    netPaise: null,
  });
  expect(issuedQuotationModelSchema.safeParse(parsed).success).toBe(true);
  const unknown = model(10000, 0);
  unknown.proposal.complete = false;
  unknown.proposal.unknownCount = 1;
  expect(issuedQuotationModelSchema.safeParse(unknown).success).toBe(false);
});
test("C-05 response binds exact model/revision and explicit attestation; no signature or agreement fields", () => {
  const v = {
    docId: id,
    revision: 1,
    modelHash: "a".repeat(64),
    previousId: null,
    acknowledged: true,
    value: {
      kind: "rejected",
      respondentCustomerId: id,
      reportedAt: "2026-10-24T10:00:00.000Z",
      channel: "verbal",
      evidence: "SYNTHETIC",
      reason: "SYNTHETIC",
    },
  };
  expect(quoteResponseCommandSchema.safeParse(v).success).toBe(true);
  expect(
    quoteResponseCommandSchema.safeParse({ ...v, acknowledged: false }).success,
  ).toBe(false);
  expect(
    quoteResponseCommandSchema.safeParse({ ...v, confirmAgreement: true })
      .success,
  ).toBe(false);
  expect(
    quoteResponseCommandSchema.safeParse({
      ...v,
      value: { ...v.value, signature: "invented" },
    }).success,
  ).toBe(false);
});
