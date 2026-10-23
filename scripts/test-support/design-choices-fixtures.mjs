import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyDesignChoicesContent } from "@aarili/contracts/design-choices";
import { emptyMeasurementFormContent } from "@aarili/contracts/measurement-forms";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import {
  definitionRef,
  syntheticManifest,
} from "./service-template-fixtures.mjs";
export const designRef = definitionRef;
export const newDesignDraft = (content) => ({
  entryId: randomUUID(),
  baseVersion: 0,
  baseRevisionId: null,
  operation: "definition",
  available: true,
  reason: "SYNTHETIC review only",
  content,
});
export const revisedDesign = (r, extra = {}) => ({
  entryId: r.entryId,
  baseVersion: r.version,
  baseRevisionId: r.id,
  operation: "definition",
  available: r.available,
  reason: "SYNTHETIC reasoned revision",
  content: structuredClone(r.definition.content),
  ...extra,
});
export function designRequest(
  f,
  path,
  {
    method = "GET",
    body,
    who = f.a,
    shop = who.shop,
    key = randomUUID(),
    etag,
    origin = f.owner.origin,
  } = {},
) {
  return f.api.fetch(
    new Request(`${f.owner.origin}/api/shops/${shop}/${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...(etag ? { "If-Match": etag } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
export async function designOk(r) {
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
export async function saveDesign(
  f,
  v,
  workflow = "design.choices",
  who = f.a,
  schemaVersion = 1,
) {
  const raw = randomUUID();
  const draftId = `${raw.slice(0, 14)}7${raw.slice(15)}`;
  const { draft } = await designOk(
    await designRequest(f, `drafts/${draftId}`, {
      method: "PUT",
      body: { workflow, schemaVersion, payload: v },
      who,
    }),
  );
  return { draftId, draft };
}
export const promoteDesign = (f, d, key = randomUUID(), extra = {}) =>
  designRequest(f, `drafts/${d.draftId}/promote`, {
    method: "POST",
    body: {},
    key,
    etag: `"v${d.draft.version}"`,
    ...extra,
  });
export async function publishDesign(
  f,
  v,
  workflow = "design.choices",
  route = "design-choices",
  who = f.a,
) {
  await designOk(
    await promoteDesign(f, await saveDesign(f, v, workflow, who), undefined, {
      who,
    }),
  );
  return (
    await designOk(
      await designRequest(f, `settings/${route}/entries/${v.entryId}`, { who }),
    )
  ).revision;
}
const designQuestion = (choice, key) => ({
  id: randomUUID(),
  key,
  meaning: `SYNTHETIC ${key}`,
  labelEn: `SYNTHETIC ${key}`,
  labelTa: `செயற்கை ${key}`,
  kind: "choice",
  applicability: "applicable",
  reason: "",
  required: true,
  choices: [definitionRef(choice)],
  when: [],
  units: [],
  precision: null,
});
export async function designSources(f) {
  const catalogue = async (kind, code, extra = {}) =>
    publishDesign(
      f,
      newDesignDraft({
        ...emptyCatalogueContent(kind),
        code,
        labelEn: `SYNTHETIC ${code}`,
        labelTa: "செயற்கை ரவிக்கை",
        ...extra,
      }),
      "service.catalogue",
      "catalogue",
    );
  const category = await catalogue("category", "design-blouse"),
    top = await catalogue("piece", "design-top"),
    bottom = await catalogue("piece", "design-bottom");
  const service = await catalogue("service", "design-service", {
    parent: definitionRef(category),
    serviceKind: "stitching",
    pieces: [
      { ...definitionRef(top), optional: false },
      { ...definitionRef(bottom), optional: true },
    ],
  });
  const forms = [];
  for (const piece of [top, bottom])
    forms.push(
      await publishDesign(
        f,
        newDesignDraft({
          ...emptyMeasurementFormContent(),
          code: `design-${piece.definition.content.code}`,
          labelEn: "SYNTHETIC body form",
          labelTa: "செயற்கை அளவு",
          service: definitionRef(service),
          piece: definitionRef(piece),
          decision: "required",
          decisionReason: "",
          groups: [
            {
              id: randomUUID(),
              labelEn: "Body",
              labelTa: "உடல்",
              fields: [
                {
                  id: randomUUID(),
                  key: "length",
                  meaning: "Synthetic body length",
                  kind: "base-length",
                  labelEn: "Length",
                  labelTa: "நீளம்",
                  hintEn: "",
                  hintTa: "",
                  units: ["in"],
                  defaultUnit: "in",
                  required: true,
                  precision: {
                    unit: "in",
                    increment: "0.25",
                    review: "Synthetic fixture",
                  },
                },
              ],
            },
          ],
        }),
        "measurement.forms",
        "measurement-forms",
      ),
    );
  const manifest = await publishDesign(
    f,
    syntheticManifest(service, [top, bottom], forms, "design-manifest"),
    "service.templates",
    "service-templates",
  );
  const choices = [];
  for (const dimension of [
    "neck-type",
    "neck-design",
    "sleeve-type",
    "sleeve-design",
  ])
    choices.push(
      await publishDesign(
        f,
        newDesignDraft({
          ...emptyDesignChoicesContent("choice"),
          code: `choice-${dimension}`,
          labelEn: `SYNTHETIC ${dimension}`,
          labelTa: `செயற்கை ${dimension}`,
          category: definitionRef(category),
          dimension,
          meaning: `SYNTHETIC ${dimension}`,
          none: dimension === "sleeve-design",
        }),
      ),
    );
  const profile = newDesignDraft({
    ...emptyDesignChoicesContent("profile"),
    code: "design-profile",
    labelEn: "SYNTHETIC blouse questions",
    labelTa: "செயற்கை ரவிக்கைக் கேள்விகள்",
    category: definitionRef(category),
    manifest: definitionRef(manifest),
    pieceKey: top.definition.content.code,
    decision: "applicable",
    questions: choices.map((choice) =>
      designQuestion(choice, choice.definition.content.dimension),
    ),
  });
  return { category, service, top, bottom, forms, manifest, choices, profile };
}

// Explicit synthetic scenario decisions, never defaults or production catalogue seeds.
export async function designScenarios(f, base) {
  const result = [];
  for (const [code, serviceKind, pieceNames] of [
    ["salwar", "stitching", ["top", "bottom", "dupatta"]],
    ["alteration", "alteration", []],
    ["fall-pico", "small-service", []],
  ]) {
    const catalogue = (kind, suffix, extra = {}) =>
      publishDesign(
        f,
        newDesignDraft({
          ...emptyCatalogueContent(kind),
          code: `${code}-${suffix}`,
          labelEn: `SYNTHETIC ${code} ${suffix}`,
          labelTa: `செயற்கை ${code} ${suffix}`,
          ...extra,
        }),
        "service.catalogue",
        "catalogue",
      );
    const category = await catalogue("category", "category");
    const pieces = [];
    for (const name of pieceNames) pieces.push(await catalogue("piece", name));
    const service = await catalogue("service", "service", {
      parent: designRef(category),
      serviceKind,
      pieces: pieces.map((p) => ({ ...designRef(p), optional: false })),
    });
    const forms = [];
    for (const piece of pieces.length ? pieces : [null]) {
      const noBody = code === "fall-pico";
      forms.push(
        await publishDesign(
          f,
          newDesignDraft({
            ...structuredClone(base.forms[0].definition.content),
            code: `${code}-form-${piece?.definition.content.code ?? "whole"}`,
            service: designRef(service),
            piece: piece ? designRef(piece) : null,
            ...(noBody
              ? {
                  decision: "not-required",
                  decisionReason: "SYNTHETIC reviewed no-body scenario",
                  groups: [],
                }
              : {}),
          }),
          "measurement.forms",
          "measurement-forms",
        ),
      );
    }
    const value = syntheticManifest(service, pieces, forms, `${code}-manifest`);
    for (const item of [
      ...value.content.construction,
      ...value.content.decoration,
    ])
      item.scope.pieceKey = pieces[0]?.definition.content.code ?? null;
    const manifest = await publishDesign(
      f,
      value,
      "service.templates",
      "service-templates",
    );
    const profiles = [];
    for (const [i, piece] of (pieces.length ? pieces : [null]).entries()) {
      const notApplicable = code === "fall-pico" || i > 0;
      profiles.push(
        await publishDesign(
          f,
          newDesignDraft({
            ...emptyDesignChoicesContent("profile"),
            code: `${code}-questions-${piece?.definition.content.code ?? "whole"}`,
            labelEn: `SYNTHETIC ${code} ${piece?.definition.content.code ?? "whole"} questions`,
            labelTa: `செயற்கை ${code} ${piece?.definition.content.code ?? "whole"} கேள்விகள்`,
            category: designRef(category),
            manifest: designRef(manifest),
            pieceKey: piece?.definition.content.code ?? null,
            decision: notApplicable ? "not-applicable" : "applicable",
            decisionReason: notApplicable
              ? "SYNTHETIC explicitly reviewed no design questions for this scope"
              : "",
            questions: notApplicable
              ? []
              : [
                  {
                    ...designQuestion(base.choices[0], "finishing"),
                    kind: "text",
                    choices: [],
                    meaning: `SYNTHETIC ${code} finishing instruction`,
                  },
                ],
            templateKeys: notApplicable
              ? []
              : ["neck-type", "owner-note"].filter((k) =>
                  [
                    ...value.content.construction,
                    ...value.content.instructions,
                  ].some(
                    (item) =>
                      item.key === k &&
                      item.scope.pieceKey ===
                        (piece?.definition.content.code ?? null),
                  ),
                ),
          }),
        ),
      );
    }
    result.push({ code, category, service, pieces, forms, manifest, profiles });
  }
  return result;
}
