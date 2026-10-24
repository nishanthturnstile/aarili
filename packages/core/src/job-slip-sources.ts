import type {
  JobSlipModel,
  JobSlipReview,
  JobSlipScope,
} from "@aarili/contracts/job-slips";
import { jobSlipModelSchema } from "@aarili/contracts/job-slips";
import type { JobSlipBinding } from "@aarili/db/repositories/job-slips";
import {
  type DesignReferencesContext,
  readDesignReferenceBytes,
} from "./design-references.js";
import {
  readDesignSpecification,
  readDesignSpecifications,
} from "./design-specifications.js";
import { DocumentFailure, type DocumentRenderAsset } from "./documents.js";
import { DraftFailure } from "./drafts.js";
import type { JobSlipSources } from "./job-slips.js";
import {
  type ManualPatternsContext,
  readPatternBytes,
  readPatterns,
} from "./manual-patterns.js";
import {
  authorizeMeasurementWearer,
  readMeasurement,
  readMeasurementTarget,
} from "./measurement-sessions.js";
import type { MediaContext } from "./media.js";
import { readAcceptedOrder, readOrderPieces } from "./orders.js";
import {
  readServiceLineProgress,
  readServiceOrder,
  type SmallServiceContext,
} from "./small-services.js";

const bilingual = (en: string, ta: string) => ({ en, ta });
function unavailable(): never {
  throw new DocumentFailure(404, "JOB_SLIP_SOURCE_UNAVAILABLE");
}
// Reuse the source modules' current identity/guardian/media authority; do not
// hydrate a payer profile, fitting notes, money or unrelated garment history.
export function jobSlipSources(
  patterns: ManualPatternsContext,
  services: SmallServiceContext,
  references: DesignReferencesContext,
  media: MediaContext,
): JobSlipSources {
  const specs = patterns.specifications,
    measurements = patterns.measurements;
  async function review(input: JobSlipScope, omissions: string[]) {
    const q = { orderId: input.orderId, pieceId: input.pieceId };
    const kind = await specs.repository.orderKind(q.orderId);
    if (!kind) unavailable();
    const model: JobSlipModel = {
      orderId: q.orderId,
      pieceId: q.pieceId,
      kind: "job-slip.v1",
      audience: "private-production",
      language: "en",
      issued: null,
      orderCode: "",
      pieceLabel: null,
      garment: bilingual("", ""),
      instructions: [],
      sources: [],
      measurements: [],
      warnings: [],
      assets: [],
      omittedAssetIds: [...omissions].sort(),
    };
    const blockers: JobSlipReview["blockers"] = [];
    const optionalAssets: JobSlipReview["optionalAssets"] = [];
    const subject = {
      customerId: "",
      wearerId: null as string | null,
      designId: null as string | null,
      measurementId: null as string | null,
      patternId: null as string | null,
    };
    let version = 1;
    const progress = await readServiceLineProgress(services, q.orderId);
    version +=
      progress.orderVersion + progress.lines.reduce((n, l) => n + l.version, 0);
    for (const l of progress.lines.filter(
      (l) => l.pieceId === q.pieceId && l.state !== "not-required",
    ))
      model.instructions.push(
        `${l.line.labelEn} / ${l.line.labelTa}: ${l.line.requestedWork} [${l.state}]`,
      );
    if (kind === "service") {
      if (q.pieceId) unavailable();
      const order = await readServiceOrder(services, q.orderId);
      subject.customerId = order.intake.customerId ?? "";
      subject.wearerId = order.intake.wearerId;
      model.orderCode = order.code;
      model.instructions.unshift(
        order.intake.subjectDescription,
        order.intake.instructions,
      );
      model.garment = bilingual(
        order.profile.content.labelEn,
        order.profile.content.labelTa,
      );
      // Approved lightweight applicability is already frozen in this profile.
      model.warnings.push(
        bilingual(
          "Service work: measurement and pattern sections do not apply.",
          "சேவை வேலை: அளவுகள் மற்றும் மாதிரிப் பகுதிகள் தேவையில்லை.",
        ),
      );
      if (omissions.length) blockers.push("optional-omission-unreviewed");
      return {
        model: jobSlipModelSchema.parse(model),
        version,
        blockers,
        subject,
      };
    }
    const order = await readAcceptedOrder(services.orders, q.orderId);
    const pieces = await readOrderPieces(services.orders, q.orderId);
    subject.customerId = order.intake.customerId ?? "";
    subject.wearerId = order.intake.wearerId;
    if (!subject.customerId || !subject.wearerId) unavailable();
    model.orderCode = order.code;
    const definition = order.requirements.definition;
    model.garment = bilingual(definition.labelEn, definition.labelTa);
    const identity = q.pieceId
      ? pieces.identities.find((p) => p.id === q.pieceId)
      : null;
    const piece = identity
      ? pieces.structure?.pieces.find((p) => p.key === identity.key)
      : null;
    if (q.pieceId && piece?.applicability !== "applicable") unavailable();
    if (piece) model.pieceLabel = bilingual(piece.labelEn, piece.labelTa);
    if (pieces.state === "unsupported") blockers.push("scope-unsupported");
    if (order.intake.instructions)
      model.instructions.unshift(order.intake.instructions);
    const prerequisites = new Set(
      definition.tasks
        .filter(
          (t) =>
            t.applicability === "applicable" &&
            t.scope.pieceKey === (piece?.key ?? null),
        )
        .flatMap((t) => t.prerequisites),
    );
    const design = await readDesignSpecifications(specs, q);
    version += design.version;
    const optional = new Set<string>();
    if (design.currentId) {
      const d = await readDesignSpecification(specs, design.currentId);
      if (d.redacted) unavailable();
      subject.designId = d.id;
      model.sources.push({
        kind: "design",
        id: d.id,
        version: d.version,
        description:
          "Exact selected design specification / தேர்ந்தெடுத்த வடிவமைப்பு",
      });
      for (const a of d.answers.filter(
        (a) => a.state === "selected" && a.intent === "instruction",
      )) {
        const choice = a.choice
          ? d.choices.find((c) => c.id === a.choice?.revisionId)?.content
          : null;
        model.instructions.push(
          choice
            ? `${choice.labelEn} / ${choice.labelTa}`
            : `${a.text}${a.unit ? ` ${a.unit}` : ""}`,
        );
      }
      for (const r of d.referenceItems) {
        const isOptional =
          r.intent === "inspiration" && r.annotations.length === 0;
        if (isOptional) {
          optional.add(r.assetId);
          optionalAssets.push({
            assetId: r.assetId,
            referenceId: r.id,
            unavailable:
              r.redacted ||
              r.subject.redacted ||
              !r.display ||
              !r.contentType.startsWith("image/"),
          });
        }
        if (omissions.includes(r.assetId)) {
          if (!isOptional) blockers.push("critical-asset-unavailable");
          else
            model.warnings.push(
              bilingual(
                `Optional reference omitted: ${r.id}`,
                `விருப்பக் குறிப்பு சேர்க்கப்படவில்லை: ${r.id}`,
              ),
            );
          continue;
        }
        if (r.purpose === "private-fitting" || r.purpose === "voice-note") {
          blockers.push("critical-asset-unavailable");
          continue;
        }
        if (
          r.redacted ||
          r.subject.redacted ||
          !r.display ||
          !r.contentType.startsWith("image/")
        ) {
          blockers.push("critical-asset-unavailable");
          continue;
        }
        model.assets.push({
          referenceId: r.id,
          assetId: r.assetId,
          subjectId: r.subject.id,
          kind: "design",
          purpose: r.purpose,
          originalSha256: r.sha256,
          displaySha256: r.display.sha256,
          width: r.display.width,
          height: r.display.height,
          caption: r.caption,
          annotations: r.annotations,
        });
      }
    } else if (prerequisites.has("design")) blockers.push("design-missing");
    else
      model.warnings.push(
        bilingual(
          "Design selection: not recorded; no cutting approval implied.",
          "வடிவமைப்புத் தேர்வு பதிவு இல்லை; வெட்டுவதற்கான அனுமதி அல்ல.",
        ),
      );
    try {
      const target = await readMeasurementTarget(measurements, q);
      version += target.version;
      if (target.selectedId) {
        const m = await readMeasurement(measurements, target.selectedId, {
          customerId: subject.customerId,
          wearerId: subject.wearerId,
        });
        if (m.redacted) unavailable();
        subject.measurementId = m.id;
        model.sources.push({
          kind: "measurement",
          id: m.id,
          version: m.version,
          description: `${m.source.kind}; ${m.source.method}; ${m.source.date || "unknown date"}; session ${m.sessionId}`,
        });
        model.sources.push({
          kind: "form",
          id: m.form.id,
          version: null,
          description: `${m.form.content.labelEn} / ${m.form.content.labelTa}`,
        });
        const fields = m.form.content.groups.flatMap((g) => g.fields);
        model.measurements = m.values.map((v) => {
          const f = fields.find((f) => f.id === v.fieldId);
          if (!f) unavailable();
          const source = v.source ?? m.source;
          return {
            fieldId: v.fieldId,
            label: bilingual(f.labelEn, f.labelTa),
            value: v.rawText || "Unknown / தெரியவில்லை",
            unit: v.unit,
            source: `${source.kind}; ${source.method}; ${source.date || "unknown date"}`,
          };
        });
      } else if (prerequisites.has("measurement"))
        blockers.push("measurement-missing");
      else
        model.warnings.push(
          bilingual(
            "No measurement version selected.",
            "அளவுப் பதிப்பு தேர்ந்தெடுக்கப்படவில்லை.",
          ),
        );
    } catch (error) {
      if (error instanceof DraftFailure && error.status === 409)
        blockers.push("scope-unsupported");
      else throw error;
    }
    const pattern = await readPatterns(patterns, { ...q, readerVersion: 2 });
    version += pattern.state.version;
    if (pattern.selected?.content && !pattern.selected.redacted) {
      const p = pattern.selected;
      const content = pattern.selected.content;
      subject.patternId = p.id;
      model.sources.push({
        kind: "pattern",
        id: p.id,
        version: p.version,
        description: `${p.method}; ${p.content?.sourceKind}; ${p.content?.source}; ${p.content?.sourceVersion}`,
      });
      model.instructions.push(content.locator, content.notes);
      model.warnings.push(
        bilingual(
          `Reference only; not permission to cut. Scale/formula assumptions unverified. ${content.declaredScale}; ${content.assumptions}. Inputs: design ${content.design.state}; measurement ${content.measurement.state}. Review: ${pattern.comparisons.find((c) => c.referenceId === p.id)?.reviewState ?? "unreviewed"}.`,
          `குறிப்பு மட்டும்; வெட்டுவதற்கான அனுமதி அல்ல. அச்சு அளவுத்திட்டம் மற்றும் கணக்கீட்டு விதிகள் சரிபார்க்கப்படவில்லை. ${content.declaredScale}; ${content.assumptions}`,
        ),
      );
      if (p.output) {
        if (p.output.contentType === "application/pdf")
          model.warnings.push(
            bilingual(
              `Separate pattern PDF ${p.output.assetId} is not embedded; review its exact version privately.`,
              `தனி மாதிரி PDF ${p.output.assetId} சேர்க்கப்படவில்லை; அதன் சரியான பதிப்பைத் தனிப்பட்ட முறையில் பார்க்கவும்.`,
            ),
          );
        else if (p.output.display)
          model.assets.push({
            referenceId: p.id,
            assetId: p.output.assetId,
            subjectId: p.output.subjectId,
            kind: "pattern",
            purpose: "manual-pattern",
            originalSha256: p.output.originalSha256,
            displaySha256: p.output.display.sha256,
            width: p.output.display.width,
            height: p.output.display.height,
            caption:
              "Manual/external pattern reference; not to scale / மாதிரிக் குறிப்பு; உண்மையான அளவு அல்ல",
            annotations: [],
          });
        else blockers.push("critical-asset-unavailable");
      }
    } else if (prerequisites.has("manual-method"))
      blockers.push("pattern-missing");
    else
      model.warnings.push(
        bilingual(
          "No pattern reference selected.",
          "மாதிரிக் குறிப்பு தேர்ந்தெடுக்கப்படவில்லை.",
        ),
      );
    if (omissions.some((id) => !optional.has(id)))
      blockers.push("optional-omission-unreviewed");
    if (model.assets.length) {
      try {
        await assets(model);
      } catch {
        blockers.push("critical-asset-unavailable");
        for (const option of optionalAssets) option.unavailable = true;
      }
    }
    return {
      model: jobSlipModelSchema.parse(model),
      version,
      blockers: [...new Set(blockers)],
      subject,
      optionalAssets,
    };
  }
  async function authorize(b: JobSlipBinding) {
    if (b.revoked) return false;
    try {
      if ((await specs.repository.orderKind(b.orderId)) === "service") {
        const o = await readServiceOrder(services, b.orderId);
        return (
          o.intake.customerId === b.customerId &&
          o.intake.wearerId === b.wearerId &&
          !b.pieceId &&
          !b.designId &&
          !b.measurementId &&
          !b.patternId
        );
      }
      const o = await readAcceptedOrder(services.orders, b.orderId);
      if (
        o.intake.customerId !== b.customerId ||
        o.intake.wearerId !== b.wearerId
      )
        return false;
      if (!b.wearerId) return false;
      await authorizeMeasurementWearer(measurements, {
        customerId: b.customerId,
        wearerId: b.wearerId,
      });
      if (
        b.designId &&
        (await readDesignSpecification(specs, b.designId)).redacted
      )
        return false;
      if (
        b.measurementId &&
        (
          await readMeasurement(measurements, b.measurementId, {
            customerId: b.customerId,
            wearerId: b.wearerId ?? "",
          })
        ).redacted
      )
        return false;
      if (b.patternId) {
        const p = await patterns.repository.read(b.patternId);
        if (
          !p ||
          p.redacted ||
          !p.content ||
          p.orderId !== b.orderId ||
          p.pieceId !== b.pieceId
        )
          return false;
        // Includes the lineage and current measurement/photo authority barriers.
        if (p.output)
          await readPatternBytes(patterns, media, {
            orderId: b.orderId,
            pieceId: b.pieceId,
            referenceId: p.id,
            variant: "display",
          });
      }
      return true;
    } catch (error) {
      if (
        error instanceof DraftFailure &&
        [403, 404, 409].includes(error.status)
      )
        return false;
      throw error;
    }
  }
  async function assets(model: JobSlipModel): Promise<DocumentRenderAsset[]> {
    const result: DocumentRenderAsset[] = [];
    let total = 0;
    for (const asset of model.assets) {
      const designId = model.sources.find((s) => s.kind === "design")?.id;
      if (asset.kind === "design") {
        if (!designId) unavailable();
        await readDesignReferenceBytes(
          references,
          media,
          designId,
          asset.referenceId,
          "display",
        );
      } else
        await readPatternBytes(patterns, media, {
          orderId: model.orderId,
          pieceId: model.pieceId,
          referenceId: asset.referenceId,
          variant: "display",
        });
      const record = await media.repository.read(asset.assetId);
      const display = (await media.repository.derivatives(asset.assetId)).find(
        (d) => d.variant === "display",
      );
      if (
        record?.status !== "ready" ||
        record.subjectId !== asset.subjectId ||
        record.sha256 !== asset.originalSha256 ||
        !display ||
        display.sha256 !== asset.displaySha256 ||
        display.width !== asset.width ||
        display.height !== asset.height ||
        display.contentType !== "image/webp"
      )
        unavailable();
      if (!media.storage.snapshotPrivate) unavailable();
      const bytes = await media.storage.snapshotPrivate(
        display.key,
        8 * 1024 * 1024,
      );
      total += bytes.length;
      if (
        total > 20 * 1024 * 1024 ||
        (await requestHashBytes(bytes)) !== asset.displaySha256
      )
        unavailable();
      result.push({
        id: asset.referenceId,
        bytes,
        sha256: asset.displaySha256,
        contentType: "image/webp",
      });
    }
    return result;
  }
  return { review, authorize, assets };
}
async function requestHashBytes(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
