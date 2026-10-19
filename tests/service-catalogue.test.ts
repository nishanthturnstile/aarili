import { randomUUID } from "node:crypto";
import {
  catalogueCommandSchema,
  catalogueDraftSchema,
  emptyCatalogueContent,
} from "@aarili/contracts/service-catalogue";
import { requestHash } from "@aarili/core/request-binding";
import fc from "fast-check";
import { expect, test } from "vitest";

const command = () => ({
  entryId: randomUUID(),
  baseVersion: 0,
  baseRevisionId: null,
  operation: "definition" as const,
  content: {
    ...emptyCatalogueContent("category"),
    code: "blouse",
    labelEn: "Synthetic blouse",
    labelTa: "செயற்கை ரவிக்கை",
  },
  available: true,
  reason: "Synthetic review",
});
test("ST-01/07 category drafts remain incomplete; publication rejects unsupported content and authority", () => {
  const v = command();
  expect(catalogueCommandSchema.safeParse(v).success).toBe(true);
  expect(
    catalogueDraftSchema.safeParse({
      ...v,
      content: emptyCatalogueContent("category"),
      reason: "",
    }).success,
  ).toBe(true);
  for (const content of [
    { ...v.content, code: "bridal" },
    { ...v.content, labelEn: "Bridal package" },
    { ...v.content, kind: "retail" },
    { ...v.content, labelTa: "" },
    { ...v.content, parent: { entryId: v.entryId, revisionId: randomUUID() } },
    {
      ...v.content,
      pieces: [
        { entryId: randomUUID(), revisionId: randomUUID(), optional: false },
      ],
    },
  ])
    expect(catalogueCommandSchema.safeParse({ ...v, content }).success).toBe(
      false,
    );
  expect(
    catalogueCommandSchema.safeParse({ ...v, authority: "approved" }).success,
  ).toBe(false);
});
test("ST-01/07 warning null is preserved and bounded integer windows round-trip", () => {
  const v = command();
  expect(catalogueCommandSchema.parse(v).content.warningDays).toBeNull();
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3660 }), (warningDays) => {
      expect(
        catalogueCommandSchema.parse({
          ...v,
          content: { ...v.content, warningDays },
        }).content.warningDays,
      ).toBe(warningDays);
    }),
  );
  for (const warningDays of [-1, 0.5, 3661, Infinity])
    expect(
      catalogueCommandSchema.safeParse({
        ...v,
        content: { ...v.content, warningDays },
      }).success,
    ).toBe(false);
});
test("ST-01/07 composition is ordered; duplicate/self references cannot publish", async () => {
  const v = command(),
    parent = { entryId: randomUUID(), revisionId: randomUUID() },
    a = { entryId: randomUUID(), revisionId: randomUUID(), optional: false },
    b = { entryId: randomUUID(), revisionId: randomUUID(), optional: true };
  const content = {
    ...v.content,
    kind: "service" as const,
    parent,
    serviceKind: "stitching" as const,
    pieces: [a, b],
  };
  expect(catalogueCommandSchema.safeParse({ ...v, content }).success).toBe(
    true,
  );
  expect(
    catalogueCommandSchema.safeParse({
      ...v,
      content: { ...content, pieces: [a, a] },
    }).success,
  ).toBe(false);
  expect(await requestHash(content)).not.toBe(
    await requestHash({ ...content, pieces: [b, a] }),
  );
  expect(
    catalogueCommandSchema.safeParse({ ...v, operation: "availability" })
      .success,
  ).toBe(false);
});
