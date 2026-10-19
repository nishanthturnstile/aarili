// Synthetic-only definitions for isolated verification/review. Never production seeds.
import { randomUUID } from "node:crypto";
import {
  emptyServiceTemplateContent,
  templateSections,
} from "@aarili/contracts/service-templates";
export const definitionRef = (r) => ({
  entryId: r.entryId,
  revisionId: r.definition.id,
});
const templateItem = (key, extra = {}) => ({
  key,
  labelEn: `SYNTHETIC ${key}`,
  labelTa: `செயற்கை ${key}`,
  required: true,
  applicability: "applicable",
  applicabilityReason: "",
  scope: { pieceKey: null, addonKey: null },
  instructionEn: "Reviewed synthetic wording",
  instructionTa: "மதிப்பாய்வு செய்த செயற்கை வாசகம்",
  ...extra,
});
export function syntheticManifest(
  service,
  pieces = [],
  forms = [],
  code = "before-craft",
  sequence = "before",
) {
  const c = {
    ...emptyServiceTemplateContent(),
    code,
    labelEn: `SYNTHETIC ${code}`,
    labelTa: "செயற்கை சேவை வரையறை",
    service: definitionRef(service),
    pieces: pieces.map((p) => ({
      ...definitionRef(p),
      key: p.definition.content.code,
      applicability: "applicable",
      reason: "SYNTHETIC selected piece",
    })),
    addons: service.definition.content.addons.map((a, i) => ({
      entryId: a.entryId,
      revisionId: a.revisionId,
      key: `addon-${i}`,
      applicability: "not-applicable",
      reason: "SYNTHETIC not selected work",
    })),
    forms: forms.map((f) => ({
      ...definitionRef(f),
      pieceKey:
        pieces.find((p) => p.entryId === f.definition.content.piece?.entryId)
          ?.definition.content.code ?? null,
    })),
  };
  for (const name of templateSections)
    c.sections[name] = { decision: "applicable", reason: "" };
  c.materials = [
    templateItem("main-fabric", { kind: "main-fabric", source: "unresolved" }),
  ];
  const task = (key, predecessors = [], milestone = "work") =>
    templateItem(key, {
      milestone,
      assignee: "owner",
      predecessors,
      prerequisites: ["design", "measurement", "manual-method", "material"],
    });
  c.tasks =
    sequence === "before"
      ? [
          task("craft"),
          task("cut", ["craft"], "cutting"),
          task("parallel-trim"),
          task("stitch", ["cut", "parallel-trim"]),
        ]
      : [
          task("cut", [], "cutting"),
          task("craft", ["cut"]),
          task("parallel-trim"),
          task("stitch", ["craft", "parallel-trim"]),
        ];
  c.quality = [
    templateItem("finish-check", { kind: "finishing", taskKeys: ["stitch"] }),
  ];
  c.instructions = [
    templateItem("owner-note", {
      audience: "internal",
      labelEn: "SYNTHETIC private artisan note",
      labelTa: "செயற்கை தனிப்பட்ட கைவினைக் குறிப்பு",
      instructionEn: "Keep the artisan margin confidential",
      instructionTa: "கைவினைஞர் லாப விவரம் தனிப்பட்டது",
    }),
  ];
  c.confirmation = [
    templateItem("price-question", {
      topic: "price-basis",
      instructionEn: "Price basis {{price_basis}}; ready {{ready_date}}",
      instructionTa: "விலை அடிப்படை {{price_basis}}; தயார் தேதி {{ready_date}}",
    }),
  ];
  c.construction = [templateItem("neck-type")];
  c.decoration = [
    templateItem("neck-decoration", {
      required: false,
      applicability: "unresolved",
    }),
  ];
  c.method = [templateItem("manual-method")];
  return {
    entryId: randomUUID(),
    baseVersion: 0,
    baseRevisionId: null,
    operation: "definition",
    available: true,
    reason: "SYNTHETIC owner review; no production authority",
    content: c,
  };
}
