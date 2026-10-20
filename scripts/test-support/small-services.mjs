import { randomUUID } from "node:crypto";
import { emptyMeasurementFormContent } from "@aarili/contracts/measurement-forms";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import {
  emptyServiceTemplateContent,
  templateSections,
} from "@aarili/contracts/service-templates";
import { emptyServiceOrder } from "@aarili/contracts/small-services";
import { seedOrderAcceptance } from "./order-acceptance.mjs";
import { seedQuickOrder } from "./seed-quick-order.mjs";
import { definitionRef } from "./service-template-fixtures.mjs";

export const serviceDraftId = () =>
  randomUUID().replace(/^(........-....-)./, "$17");

// Disposable synthetic setup only. Catalogue, form, manifest, profile and binding
// writes all use their real durable-draft publication paths. In particular these
// are genuine alteration/small-service definitions, never relabelled custom work.
// setup(path,{method,body,etag,key}) must return a successful parsed API response.
export async function seedSmallServices({
  setup,
  runtime,
  shopId,
  seed: existingSeed,
  configuration,
}) {
  const seed = existingSeed ?? (await seedQuickOrder(runtime, shopId));
  try {
    const config =
      configuration ?? (await seedOrderAcceptance(setup, seed.sources));
    const command = seed.sources.command;
    async function catalogue(kind, code, labelEn, labelTa, extra = {}) {
      return command("service.catalogue", {
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        operation: "definition",
        available: true,
        reason: "SYNTHETIC small-service review; no production authority",
        content: {
          ...emptyCatalogueContent(kind),
          code,
          labelEn: `SYNTHETIC ${labelEn}`,
          labelTa,
          ...extra,
        },
      });
    }
    async function publishProfile(payload) {
      const id = await config.publish("service.intake-profile", payload);
      return setup(`small-services/profiles/${id}`, { method: "GET" });
    }
    async function make({
      kind,
      code,
      labelEn,
      labelTa,
      wearerRequirement,
      addons,
    }) {
      const category = await catalogue("category", code, labelEn, labelTa);
      const piece = await catalogue(
        "piece",
        `${code}-garment`,
        labelEn,
        labelTa,
      );
      const extra = [];
      for (const [key, en, ta] of addons)
        extra.push(await catalogue("addon", `${code}-${key}`, en, ta));
      const service = await catalogue(
        "service",
        `${code}-service`,
        labelEn,
        labelTa,
        {
          parent: definitionRef(category),
          serviceKind: kind,
          pieces: [{ ...definitionRef(piece), optional: false }],
          addons: extra.map((a) => ({ ...definitionRef(a), optional: true })),
        },
      );
      const form = await command("measurement.forms", {
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        operation: "definition",
        available: true,
        reason: "SYNTHETIC minimal intake, no measurement values",
        content: {
          ...emptyMeasurementFormContent(),
          code: `${code}-no-body-form`,
          labelEn: `SYNTHETIC ${labelEn} — no measurements`,
          labelTa: `${labelTa} — உடல் அளவுகள் தேவையில்லை`,
          service: definitionRef(service),
          piece: definitionRef(piece),
          decision: "not-required",
          decisionReason:
            "SYNTHETIC intake records requested garment work only; no body facts or photos",
        },
      });
      const content = {
        ...emptyServiceTemplateContent(),
        code: `${code}-taskless-intake`,
        labelEn: `SYNTHETIC ${labelEn}`,
        labelTa,
        service: definitionRef(service),
        pieces: [
          {
            ...definitionRef(piece),
            key: "garment",
            applicability: "applicable",
            reason: "One identified customer-owned garment",
          },
        ],
        addons: extra.map((a, i) => ({
          ...definitionRef(a),
          key: addons[i][0],
          applicability: "applicable",
          reason: "SYNTHETIC independently selected finishing",
        })),
        forms: [{ ...definitionRef(form), pieceKey: "garment" }],
      };
      for (const section of templateSections)
        content.sections[section] = {
          decision: "not-applicable",
          reason:
            "SYNTHETIC intake only: execution, material receipt, quality and body capture remain later slices",
        };
      const manifest = await command("service.templates", {
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        operation: "definition",
        available: true,
        reason: "SYNTHETIC reviewed taskless service intake",
        content,
      });
      const bindingId = await config.publish("service.commitment-bindings", {
        categoryId: category.entryId,
        categoryRevisionId: category.definition.id,
        availabilityId: category.id,
        ruleRevisionId: config.ruleId,
        baseVersion: 0,
        baseRevisionId: null,
        review: "reviewed",
        reason: "SYNTHETIC reviewed service capacity; not production policy",
      });
      const keys = extra.length ? addons.map(([key]) => key) : ["alteration"];
      const profile = await publishProfile({
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        available: true,
        reason: "SYNTHETIC reviewed intake applicability and shared coverage",
        content: {
          labelEn: `SYNTHETIC ${labelEn}`,
          labelTa,
          manifest: {
            entryId: manifest.entryId,
            revisionId: manifest.id,
            definitionId: manifest.definition.id,
          },
          wearerRequirement,
          wearerReason:
            wearerRequirement === "required"
              ? "SYNTHETIC fit alteration requires authorised wearer"
              : "SYNTHETIC saree finishing collects no wearer-specific facts",
          capacityUnit: "garments",
          lines: keys.map((key) => ({
            key,
            addonKey: extra.length ? key : null,
            optional: extra.length > 0,
            taskKey: null,
            coverageKey: "one-physical-garment",
            quantity: 1,
          })),
        },
      });
      const intake = {
        ...emptyServiceOrder(randomUUID()),
        customerId: seed.customer.customerId,
        wearerId:
          wearerRequirement === "required" ? seed.wearer.wearerId : null,
        profile: { entryId: profile.entryId, revisionId: profile.id },
        subjectDescription: extra.length
          ? "SYNTHETIC blue checked saree, gold border"
          : "SYNTHETIC green cotton kurti, wooden buttons",
        propertyReference: extra.length
          ? "SYNTHETIC SAREE-1"
          : "SYNTHETIC KURTI-1",
        intakeContext:
          "SYNTHETIC walk-in request. Physical receipt has not been recorded.",
        lines: keys.map((key, i) => ({
          id: randomUUID(),
          key,
          requestedWork: `SYNTHETIC ${key}: ${extra.length ? "finish existing saree edge" : "adjust existing garment side seam"}`,
          priceState: i === 1 ? "to-be-quoted" : "quoted",
          priceText: i === 1 ? "" : "0",
          notRequired: false,
          notRequiredReason: "",
        })),
        deliveryDate: new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
        instructions: "SYNTHETIC தனித்தனி சேவை வரிகள் — receipt not recorded",
      };
      return {
        category,
        piece,
        service,
        form,
        addons: extra,
        manifest,
        profile,
        bindingId,
        intake,
      };
    }
    const kurti = await make({
      kind: "alteration",
      code: "synthetic-kurti-alteration",
      labelEn: "Kurti alteration",
      labelTa: "செயற்கை குர்த்தி திருத்தம்",
      wearerRequirement: "required",
      addons: [],
    });
    const saree = await make({
      kind: "small-service",
      code: "synthetic-saree-finishing",
      labelEn: "Saree fall and pico",
      labelTa: "செயற்கை புடவை ஃபால் மற்றும் பிக்கோ",
      wearerRequirement: "not-required",
      addons: [
        ["fall", "Fall", "செயற்கை ஃபால்"],
        ["pico", "Pico", "செயற்கை பிக்கோ"],
        ["pre-pleating", "Pre-pleating", "செயற்கை முன்மடிப்பு"],
      ],
    });
    // Default saree has exactly two selected, separately priced lines; the third
    // is available for explicit selection instead of being silently completed.
    saree.intake.lines = saree.intake.lines.slice(0, 2);
    const unknownProfile = await publishProfile({
      entryId: randomUUID(),
      baseVersion: 0,
      baseRevisionId: null,
      available: true,
      reason: "SYNTHETIC intentionally unknown mapping for fail-closed review",
      content: {
        ...saree.profile.content,
        labelEn: "SYNTHETIC unknown capacity",
        labelTa: "செயற்கை திறன் தீர்மானிக்கப்படவில்லை",
        lines: saree.profile.content.lines.map((l) => ({
          ...l,
          quantity: null,
        })),
      },
    });
    const unknown = {
      profile: unknownProfile,
      intake: {
        ...structuredClone(saree.intake),
        subjectId: randomUUID(),
        lines: saree.intake.lines.map((l) => ({ ...l, id: randomUUID() })),
        profile: {
          entryId: unknownProfile.entryId,
          revisionId: unknownProfile.id,
        },
      },
    };
    return {
      seed,
      config,
      kurti,
      saree,
      unknown,
      publishProfile,
      profiles: [kurti.profile, saree.profile, unknownProfile],
      intakes: [kurti.intake, saree.intake, unknown.intake],
      close: async () => {
        if (!existingSeed) await seed.close();
      },
    };
  } catch (error) {
    if (!existingSeed) await seed.close();
    throw error;
  }
}
