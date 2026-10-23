import {
  designOk,
  designRef,
  designRequest,
  promoteDesign,
  publishDesign,
  revisedDesign,
  saveDesign,
} from "./design-choices-fixtures.mjs";
import { specificationSources } from "./design-specification-fixtures.mjs";

export async function measurementSources(f, identity) {
  const base = await specificationSources(f, identity),
    forms = [];
  for (const original of base.forms) {
    const draft = revisedDesign(original),
      field = draft.content.groups[0].fields[0];
    field.units = ["in", "cm"];
    draft.content.groups[0].fields.push({
      ...field,
      id: crypto.randomUUID(),
      key: "optional-width",
      meaning: "SYNTHETIC optional width",
      labelEn: "SYNTHETIC optional width",
      labelTa: "செயற்கை விருப்ப அகலம்",
      required: false,
    });
    forms.push(
      await publishDesign(f, draft, "measurement.forms", "measurement-forms"),
    );
  }
  const next = revisedDesign(base.manifest);
  next.content.forms = next.content.forms.map((binding) => ({
    ...binding,
    ...designRef(forms.find((form) => form.entryId === binding.entryId)),
  }));
  const manifest = await publishDesign(
    f,
    next,
    "service.templates",
    "service-templates",
  );
  return {
    ...base,
    forms,
    manifest,
    accept: (targetIdentity = identity) =>
      base.accept(manifest, targetIdentity),
  };
}
const unknownMeasurementSource = () => ({
  kind: "unknown",
  date: "",
  measurer: "",
  method: "",
});
const measurementApprovalDraft = (form) => ({
  form: designRef(form),
  baseId: null,
  operation: "approve",
  reviewed: true,
  reason: "SYNTHETIC measurement-use review only",
  policy: {
    grammar: "ascii-exact-v1",
    display: "exact",
    fields: form.definition.content.groups
      .flatMap((g) => g.fields)
      .map((f) => ({ fieldId: f.id, allowZero: false })),
    validation: {
      mode: "not-configured",
      review:
        "SYNTHETIC: no plausibility thresholds configured; exact precision and required fields reviewed",
    },
  },
});
export async function approveMeasurementForm(f, form) {
  await designOk(
    await promoteDesign(
      f,
      await saveDesign(f, measurementApprovalDraft(form), "measurement.use"),
    ),
  );
  return (
    await designRequest(f, "measurements/use", {
      method: "POST",
      body: { form: designRef(form) },
    }).then(designOk)
  ).approval;
}
export function measurementDraft(identity, form, approval) {
  return {
    operation: "save",
    ...identity,
    form: designRef(form),
    approvalId: approval.id,
    source: {
      kind: "body",
      date: "2026-10-22",
      measurer: "SYNTHETIC measurer",
      method: "SYNTHETIC direct observation",
    },
    values: form.definition.content.groups
      .flatMap((g) => g.fields)
      .map((field) => ({
        fieldId: field.id,
        rawText: "12 1/4",
        unit: "in",
        source: null,
        warningReason: "",
      })),
    fitNotes: "SYNTHETIC private fit note",
    reason: "SYNTHETIC reviewed observation",
    selectedId: null,
    target: null,
    baseVersion: 0,
    reviewed: true,
    erased: false,
  };
}
export const measurementSelectionDraft = (version, target) => ({
  operation: "select",
  customerId: version.customerId,
  wearerId: version.wearerId,
  form: null,
  approvalId: null,
  source: unknownMeasurementSource(),
  values: [],
  fitNotes: "",
  selectedId: version.id,
  target,
  baseVersion: 0,
  reviewed: true,
  reason: "SYNTHETIC reviewed suitability for this exact garment",
  erased: false,
});
export async function publishMeasurement(f, v) {
  const saved = await saveDesign(f, v, "measurement.session");
  const result = await designOk(await promoteDesign(f, saved));
  return { ...saved, result };
}
