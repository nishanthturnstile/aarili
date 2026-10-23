import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import {
  syntheticGuardianPolicy,
  syntheticWearerPolicy,
} from "@aarili/core/wearer-policy";
import {
  designOk,
  designRequest,
  promoteDesign,
  saveDesign,
} from "./design-choices-fixtures.mjs";
import {
  approveMeasurementForm,
  measurementDraft,
  measurementSources,
  publishMeasurement,
} from "./measurement-session-fixtures.mjs";
import { withMediaProcessing } from "./media-processing.mjs";
import { seedQuickOrder } from "./seed-quick-order.mjs";

export async function withMeasurementFit(run, options = {}) {
  return withMediaProcessing(
    async (f) => {
      const owner = { ...f.owner, commandLimit: async () => 0 };
      for (const name of ["withOwnerDraft", "withOwnerMeasurementFit"])
        owner[name] = async (...args) => {
          try {
            return await f.owner[name](...args);
          } catch (e) {
            console.info("Synthetic fitting request failed", {
              name: e?.name,
              pgCode: e?.cause?.code,
              pgMessage: e?.cause?.message,
            });
            throw e;
          }
        };
      f.api = createApi(async () => true, owner);
      const seed = await seedQuickOrder(f.runtime.pool, f.a.shop);
      try {
        const identity = {
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
        };
        const sources = await measurementSources(f, identity),
          approval = await approveMeasurementForm(f, sources.forms[0]);
        const saved = await publishMeasurement(
          f,
          measurementDraft(identity, sources.forms[0], approval),
        );
        const version = await designRequest(
          f,
          `measurements/versions/${saved.result.draft.result.id}`,
        ).then(designOk);
        if (options.photo !== false) {
          const path = `customers/${identity.customerId}/wearers/${identity.wearerId}`,
            w = await designRequest(f, path).then(designOk);
          await designRequest(f, `${path}/consent-events`, {
            method: "POST",
            etag: `"v${w.version}"`,
            body: {
              purpose: "private-media",
              decision: "grant",
              noticeId: syntheticWearerPolicy.notice.id,
              noticeExplained: true,
              language: "en",
              giverPersonId: w.personId,
              source: "in-person",
              occurredAt: new Date().toISOString(),
            },
          }).then(designOk);
        }
        await run({ ...f, identity, sources, approval, seed, version });
      } finally {
        await seed.close();
      }
    },
    {
      customerPolicy: syntheticCustomerPolicy,
      wearerPolicy: syntheticWearerPolicy,
      guardianPolicy: syntheticGuardianPolicy,
      ...options,
    },
  );
}
export const fitIdentity = (f) => ({
  ...f.identity,
  measurementVersionId: f.version.id,
  erased: false,
});
export async function fitPhotoConsent(f, decision, purpose = "private-media") {
  const path = `customers/${f.identity.customerId}/wearers/${f.identity.wearerId}`,
    w = await designRequest(f, path).then(designOk);
  return designRequest(f, `${path}/consent-events`, {
    method: "POST",
    etag: `"v${w.version}"`,
    body: {
      purpose,
      decision,
      noticeId: syntheticWearerPolicy.notice.id,
      noticeExplained: true,
      language: "en",
      giverPersonId: w.personId,
      source: "in-person",
      occurredAt: new Date().toISOString(),
    },
  }).then(designOk);
}
export async function publishFitSubject(f) {
  const d = await saveDesign(f, fitIdentity(f), "measurement.fit-subject");
  await promoteDesign(f, d).then(designOk);
  return (await fitState(f)).subject;
}
export function fitState(f, before) {
  return designRequest(f, "measurements/fit/list", {
    method: "POST",
    body: { measurementVersionId: f.version.id, ...(before ? { before } : {}) },
  }).then(designOk);
}
export async function admitFitImage(f, subject, bytes) {
  const grant = await designRequest(f, "files/uploads", {
    method: "POST",
    body: {
      subjectId: subject.id,
      purpose: "private-fitting",
      contentType: "image/jpeg",
      size: bytes.length,
    },
  }).then(designOk);
  const r = await fetch(grant.upload.url, {
    method: "PUT",
    headers: grant.upload.headers,
    body: bytes,
  });
  if (!r.ok) throw Error("Synthetic fitting upload failed");
  return grant;
}
export function fitReferenceDraft(f, assetId, previous = null) {
  return {
    ...fitIdentity(f),
    assetId,
    previousId: previous?.id ?? null,
    baseVersion: previous?.version ?? 0,
    caption: "SYNTHETIC non-body private research fixture",
    reason: "SYNTHETIC reviewed fitting reference",
  };
}
export async function publishFitReference(f, value) {
  const d = await saveDesign(f, value, "measurement.fit-reference");
  return { ...d, result: await promoteDesign(f, d).then(designOk) };
}
export async function additionalFitWearer(f, age = "adult") {
  const customer = await designRequest(
      f,
      `customers/${f.identity.customerId}`,
    ).then(designOk),
    at = new Date().toISOString();
  const w = await designRequest(
    f,
    `customers/${f.identity.customerId}/wearers`,
    {
      method: "POST",
      body: {
        mode: "new",
        displayName: `SYNTHETIC separate ${age} fitting wearer`,
        age,
        preferences: {
          language: "",
          channel: "",
          fit: "",
          style: "",
          delivery: "",
          source: "",
        },
        relationship: {
          kind: "family",
          statementByPersonId: customer.personId,
          authorised: true,
          informed: true,
          source: "in-person",
          occurredAt: at,
          interaction: "SYNTHETIC shared payer is not photo authority",
        },
      },
    },
  ).then(designOk);
  const result = {
    ...f,
    identity: { customerId: f.identity.customerId, wearerId: w.wearerId },
  };
  const path = `customers/${result.identity.customerId}/wearers/${result.identity.wearerId}/guardians`;
  async function consent(purpose, decision) {
    const g = await designRequest(f, path).then(designOk);
    return designRequest(f, `${path}/consent-events`, {
      method: "POST",
      etag: `"v${g.version}"`,
      body: {
        authorityId: g.authority.id,
        purpose,
        decision,
        noticeId: syntheticGuardianPolicy.notice.id,
        noticeExplained: true,
        language: "en",
        giverPersonId: g.authority.personId,
        source: "in-person",
        occurredAt: new Date().toISOString(),
      },
    }).then(designOk);
  }
  if (age === "adult") await fitPhotoConsent(result, "grant", "service");
  else {
    await designRequest(f, path, {
      method: "POST",
      etag: `"v${w.version}"`,
      body: {
        guardian: { mode: "new", displayName: "SYNTHETIC fitting guardian" },
        authority: "parent",
        scope: "measurement-and-private-photo",
        source: "in-person",
        occurredAt: at,
      },
    }).then(designOk);
    const g = await designRequest(f, path).then(designOk);
    await designRequest(f, `${path}/verification-events`, {
      method: "POST",
      etag: `"v${g.version}"`,
      body: {
        authorityId: g.authority.id,
        status: "confirmed",
        method: "synthetic-review-v1",
        evidenceRef: "SYNTHETIC private fitting test",
        scope: "measurement-and-private-photo",
        source: "in-person",
        occurredAt: at,
      },
    }).then(designOk);
    await consent("measurement", "grant");
  }
  const saved = await publishMeasurement(
    f,
    measurementDraft(result.identity, f.sources.forms[0], f.approval),
  );
  result.version = await designRequest(
    f,
    `measurements/versions/${saved.result.draft.result.id}`,
  ).then(designOk);
  result.photoConsent = (decision) =>
    age === "adult"
      ? fitPhotoConsent(result, decision)
      : consent("private-photo", decision);
  return result;
}

export async function eraseMeasurementFit(f, requestId = randomUUID()) {
  const c = await f.admin.connect();
  try {
    await c.query("begin");
    await c.query("set local role app_privacy");
    await c.query(
      "select set_config('app.user_id',$1,true),set_config('app.actor_id',$1,true),set_config('app.shop_id',$2,true)",
      [f.a.user, f.a.shop],
    );
    await c.query("select redact_measurements($1,$2,$3)", [
      f.a.shop,
      f.identity.wearerId,
      requestId,
    ]);
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
