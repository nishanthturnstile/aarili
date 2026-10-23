import { randomUUID } from "node:crypto";
import {
  designOk,
  designRequest,
  promoteDesign,
  saveDesign,
} from "./design-choices-fixtures.mjs";
import {
  patternPage,
  physicalPattern,
  publishPatternCapability,
  withPatterns,
} from "./manual-pattern-fixtures.mjs";
import { fitPhotoConsent } from "./measurement-fit-fixtures.mjs";
import { blankPdf } from "./media-formats.mjs";
export const samplePatternPdf = () =>
  blankPdf("BT /F1 18 Tf 40 760 Td (SAMPLE / SCALE UNVERIFIED) Tj ET", {
    2: "<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>",
  });

const outputAssets = (f) =>
  designRequest(f, "manual-patterns/assets", {
    method: "POST",
    body: f.scope,
  }).then(designOk);
export async function publishPatternSubject(f) {
  const d = await saveDesign(
    f,
    { ...f.scope, ...f.identity, erased: false },
    "pattern.subject",
  );
  await promoteDesign(f, d).then(designOk);
  return (await outputAssets(f)).subject;
}
export async function withPatternOutputs(run, options = {}) {
  return withPatterns(
    async (f) => {
      if (options.photo !== false) await fitPhotoConsent(f, "grant");
      await publishPatternCapability(f);
      await run(f);
    },
    { ...options, media: true },
  );
}
export async function outputDraft(f, assetId = null, extra = {}) {
  const v = await physicalPattern(f);
  v.content.locator = "";
  v.content.rights = "private-fulfilment";
  v.content.declaredScale = "SAMPLE / SCALE UNVERIFIED — supplier claims 1:1";
  v.content.assumptions = "SYNTHETIC supplier formula assumptions unverified";
  return { ...v, assetId, reuse: null, ...extra };
}
export async function saveOutput(f, payload) {
  const draftId = randomUUID().replace(/^(........-....-)./, "$17");
  const saveKey = randomUUID();
  const { draft } = await designRequest(f, `drafts/${draftId}`, {
    method: "PUT",
    key: saveKey,
    body: { workflow: "pattern.reference", schemaVersion: 2, payload },
  }).then(designOk);
  return { draftId, draft, saveKey };
}
export async function publishOutput(f, payload) {
  const d = await saveOutput(f, payload);
  const key = randomUUID();
  return { ...d, key, result: await promoteDesign(f, d, key).then(designOk) };
}
export async function admitPatternOutput(
  f,
  subject,
  bytes,
  contentType = "image/jpeg",
) {
  const grant = await designRequest(f, "files/uploads", {
    method: "POST",
    body: {
      subjectId: subject.id,
      purpose: "manual-pattern",
      contentType,
      size: bytes.length,
    },
  }).then(designOk);
  const r = await fetch(grant.upload.url, {
    method: "PUT",
    headers: grant.upload.headers,
    body: bytes,
  });
  if (!r.ok) throw Error("Synthetic pattern PUT failed");
  return grant;
}
export const outputRead = (f, referenceId, extra = {}) =>
  designRequest(f, "manual-patterns/read", {
    method: "POST",
    body: { ...f.scope, referenceId, variant: "display" },
    ...extra,
  });
export async function targetPattern(f, identity = f.identity) {
  const accepted = await f.sources.accept(f.sources.manifest, identity);
  const piece = accepted.pieces.identities.find(
    (p) => p.key === f.sources.top.definition.content.code,
  );
  const target = {
    ...f,
    identity,
    accepted,
    scope: { orderId: accepted.order.id, pieceId: piece.id },
  };
  await publishPatternCapability(target);
  return target;
}
export const latestOutput = async (f) =>
  (await patternPage(f)).state.versions[0];
