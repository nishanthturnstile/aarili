import {
  emptyServiceOrder,
  serviceFormValue,
  serviceOrderDraftSchema,
  serviceRepeatDraftSchema,
  serviceRepeatIntake,
} from "@aarili/contracts/small-services";
import fc from "fast-check";
import { expect, test } from "vitest";

const id = "019a02e0-0000-7000-8000-000000000001";
const repeat = {
  sourceId: id,
  sourceVersion: 1,
  snapshotDigest: "a".repeat(64),
  scopeDigest: "b".repeat(64),
  subjectId: id,
  reuseInstructions: false,
  selections: [
    {
      key: `standalone:${id}`,
      kind: "standalone" as const,
      sourceId: id,
      sourceDigest: "c".repeat(64),
      lineId: id,
      addonKey: null,
      pieceId: null,
      lineVersion: 1,
      catalogueEntryId: id,
      catalogueRevisionId: id,
      targetLineId: id,
    },
  ],
};
test("RH-02/06/14 service editor retains exact repeat metadata and unknown versus explicit zero across projection", () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.integer({ min: 0, max: 1000000 }),
      (quoted, price) => {
        const value = {
          ...emptyServiceOrder(id),
          repeat,
          lines: [
            {
              id,
              key: "work",
              requestedWork: "SYNTHETIC",
              priceState: quoted
                ? ("quoted" as const)
                : ("to-be-quoted" as const),
              priceText: quoted ? String(price) : "",
              notRequired: false,
              notRequiredReason: "",
            },
          ],
        };
        expect(serviceFormValue(value)).toEqual(value);
        expect(
          serviceRepeatDraftSchema.parse(serviceFormValue(value)).repeat,
        ).toEqual(repeat);
        expect(serviceRepeatIntake(value)).toEqual({
          ...value,
          repeat: undefined,
        });
        expect(serviceOrderDraftSchema.safeParse(value).success).toBe(false);
      },
    ),
  );
});
test("RH-06/14 service repeat rejects forged extra effects, missing provenance and empty selection", () => {
  const value = { ...emptyServiceOrder(id), repeat };
  for (const input of [
    { ...value, paymentPaise: 0 },
    { ...value, repeat: undefined },
    { ...value, repeat: { ...repeat, selections: [] } },
    { ...value, repeat: { ...repeat, sourceVersion: 0 } },
    { ...value, repeat: { ...repeat, received: true } },
  ])
    expect(serviceRepeatDraftSchema.safeParse(input).success).toBe(false);
});
