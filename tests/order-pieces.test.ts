import { emptyMeasurementFormContent } from "@aarili/contracts/measurement-forms";
import type { AcceptedOrder } from "@aarili/contracts/orders";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { emptyServiceTemplateContent } from "@aarili/contracts/service-templates";
import {
  projectOrderPieces,
  summarizePieceProgress,
} from "@aarili/core/orders";
import fc from "fast-check";
import { expect, test } from "vitest";

function snapshot() {
  const definition = emptyServiceTemplateContent(),
    catalogue = ["top", "bottom", "dupatta"].map((key) => ({
      id: crypto.randomUUID(),
      entryId: crypto.randomUUID(),
      authority: "synthetic-fixture",
      contentHash: "0".repeat(64),
      content: {
        ...emptyCatalogueContent("piece"),
        code: key,
        labelEn: key,
        labelTa: key,
      },
    }));
  definition.pieces = catalogue.map((d) => ({
    entryId: d.entryId,
    revisionId: d.id,
    key: d.content.code,
    applicability: "applicable",
    reason: "synthetic",
  }));
  definition.materials = [
    {
      key: "lining",
      labelEn: "Lining",
      labelTa: "உள்ளுறை",
      required: true,
      applicability: "applicable",
      applicabilityReason: "",
      scope: { pieceKey: "bottom", addonKey: null },
      instructionEn: "",
      instructionTa: "",
      kind: "lining",
      source: "unresolved",
    },
  ];
  return {
    requirements: {
      definition,
      items: [{ section: "materials", key: "lining", state: "unresolved" }],
    },
    snapshot: { catalogue, forms: [] },
  } as unknown as AcceptedOrder;
}
test("GB-02/08 exact piece scope is pinned; duplicate/missing/foreign keys fail closed instead of label matching", () => {
  const order = snapshot(),
    result = projectOrderPieces(order);
  expect(result?.pieces.map((p) => p.key)).toEqual([
    "top",
    "bottom",
    "dupatta",
  ]);
  expect(result?.requirements).toEqual([
    { position: 0, pieceKey: "bottom", addonKey: null },
  ]);
  const missing = structuredClone(order);
  missing.snapshot.catalogue = [];
  expect(projectOrderPieces(missing)).toBeNull();
  const wrong = structuredClone(order);
  const wrongItem = wrong.requirements.definition.materials[0];
  if (!wrongItem) throw Error("fixture missing");
  wrongItem.scope.pieceKey = "foreign";
  expect(projectOrderPieces(wrong)).toBeNull();
  const duplicate = structuredClone(order);
  const duplicateItem = duplicate.requirements.definition.materials[0];
  if (!duplicateItem) throw Error("fixture missing");
  duplicate.requirements.definition.materials.push(duplicateItem);
  expect(projectOrderPieces(duplicate)).toBeNull();
  const measurement = structuredClone(order);
  const measurementItem = measurement.requirements.items[0];
  if (!measurementItem) throw Error("fixture missing");
  measurementItem.section = "measurement";
  expect(projectOrderPieces(measurement)).toBeNull();
  const form = {
    id: crypto.randomUUID(),
    entryId: crypto.randomUUID(),
    authority: "synthetic-fixture",
    contentHash: "0".repeat(64),
    content: { ...emptyMeasurementFormContent(), decision: "required" },
  };
  measurement.snapshot.forms = [form];
  measurement.requirements.definition.forms = [
    { entryId: form.entryId, revisionId: form.id, pieceKey: "bottom" },
  ];
  measurementItem.key = `${form.id}:nonexistent-field`;
  expect(projectOrderPieces(measurement)).toBeNull();
});
test("GB-08 canonical piece identities/scopes remain lossless across repeated presentation and language projections", () => {
  fc.assert(
    fc.property(fc.array(fc.boolean(), { maxLength: 30 }), (toggles) => {
      const o = snapshot(),
        initial = projectOrderPieces(o);
      for (const detailed of toggles) {
        o.presentation = detailed ? "detailed" : "simple";
        expect(projectOrderPieces(o)).toEqual(initial);
      }
    }),
    { numRuns: 50, seed: 122101 },
  );
});
test("GB-02/10 future readiness projection retains the least advanced unresolved piece; no execution is performed", () => {
  expect(
    summarizePieceProgress([
      { progress: "ready", unresolved: false },
      { progress: "trial", unresolved: true },
    ]),
  ).toEqual({ progress: "trial", partiallyReady: true });
  expect(
    summarizePieceProgress([{ progress: "ready", unresolved: true }]).progress,
  ).toBe("quality-review");
  expect(summarizePieceProgress([]).progress).toBe("unresolved");
  expect(
    summarizePieceProgress([{ progress: "cancelled", unresolved: false }])
      .progress,
  ).toBe("cancelled");
  expect(
    summarizePieceProgress([
      { progress: "ready", unresolved: false },
      { progress: "booked", unresolved: true },
    ]).progress,
  ).toBe("booked");
});
