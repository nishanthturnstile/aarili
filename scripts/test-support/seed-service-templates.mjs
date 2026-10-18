import { randomUUID } from "node:crypto";
import { emptyMeasurementFormContent } from "@aarili/contracts/measurement-forms";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { mutateDraft } from "@aarili/core/drafts";
import { measurementFormsDraftWorkflow } from "@aarili/core/measurement-forms";
import { serviceCatalogueDraftWorkflow } from "@aarili/core/service-catalogue";
import { serviceTemplatesDraftWorkflow } from "@aarili/core/service-templates";
import { createDatabase, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { measurementFormsRepository } from "@aarili/db/measurement-forms-repository";
import { serviceCatalogueRepository } from "@aarili/db/service-catalogue-repository";
import { serviceTemplatesRepository } from "@aarili/db/service-templates-repository";
import {
  definitionRef,
  syntheticManifest,
} from "./service-template-fixtures.mjs";

// Setup bypasses only HTTP admission; every write uses the real owner transaction,
// durable draft, strict command, request binding, audit and publication guards.
export async function seedServiceTemplates(runtime, shopId) {
  const actor = (
    await runtime.query("select user_id from owner_bootstrap where singleton")
  ).rows[0].user_id;
  const db = createDatabase(runtime.options.connectionString, 1);
  const change = (run) =>
    withShop(db.db, actor, shopId, async (tx) => {
      const catalogue = {
        shopId,
        actorId: actor,
        synthetic: true,
        repository: serviceCatalogueRepository(tx, shopId),
      };
      const forms = {
        ...catalogue,
        catalogue,
        repository: measurementFormsRepository(tx, shopId),
      };
      const templates = {
        ...catalogue,
        catalogue,
        forms,
        repository: serviceTemplatesRepository(tx, shopId),
      };
      const ctx = {
        shopId,
        actor: { type: "user", id: actor },
        repository: draftRepository(tx, shopId),
        workflows: new Map([
          ["service.catalogue", serviceCatalogueDraftWorkflow(catalogue)],
          ["measurement.forms", measurementFormsDraftWorkflow(forms)],
          ["service.templates", serviceTemplatesDraftWorkflow(templates)],
        ]),
      };
      return run({ tx, ctx, templates });
    });
  const command = (workflow, payload, publish = true) =>
    change(async ({ ctx, templates, tx }) => {
      const u = randomUUID(),
        id = `${u.slice(0, 14)}7${u.slice(15)}`;
      const saved = await mutateDraft(
        ctx,
        id,
        "save",
        { workflow, schemaVersion: 1, payload },
        { key: randomUUID(), requestId: randomUUID() },
      );
      if (!publish) return saved.draft;
      await mutateDraft(
        ctx,
        id,
        "promote",
        {},
        { key: randomUUID(), requestId: randomUUID(), ifMatch: '"v1"' },
      );
      const repo =
        workflow === "service.catalogue"
          ? serviceCatalogueRepository(tx, shopId)
          : workflow === "measurement.forms"
            ? measurementFormsRepository(tx, shopId)
            : templates.repository;
      return repo.current(payload.entryId);
    });
  try {
    const catalogue = (kind, code, extra = {}) =>
      command("service.catalogue", {
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        operation: "definition",
        available: true,
        reason: "SYNTHETIC fixture review",
        content: {
          ...emptyCatalogueContent(kind),
          code,
          labelEn: `SYNTHETIC ${code}`,
          labelTa: "செயற்கை ஆடை",
          ...extra,
        },
      });
    const category = await catalogue("category", "blouse"),
      piece = await catalogue("piece", "body");
    const service = await catalogue("service", "blouse-stitching", {
      parent: definitionRef(category),
      serviceKind: "stitching",
      pieces: [{ ...definitionRef(piece), optional: false }],
    });
    const form = await command("measurement.forms", {
      entryId: randomUUID(),
      baseVersion: 0,
      baseRevisionId: null,
      operation: "definition",
      available: true,
      reason: "SYNTHETIC explicit precision",
      content: {
        ...emptyMeasurementFormContent(),
        code: "blouse-body",
        labelEn: "SYNTHETIC blouse form",
        labelTa: "செயற்கை ரவிக்கை அளவுகள்",
        service: definitionRef(service),
        piece: definitionRef(piece),
        decision: "required",
        groups: [
          {
            id: randomUUID(),
            labelEn: "Body",
            labelTa: "உடல்",
            fields: [
              {
                id: randomUUID(),
                key: "length",
                meaning: "SYNTHETIC shoulder to hem length",
                kind: "base-length",
                labelEn: "Body length",
                labelTa: "உடல் நீளம்",
                hintEn: "Reviewed method",
                hintTa: "மதிப்பாய்வு செய்த முறை",
                units: ["in", "cm"],
                defaultUnit: "in",
                required: true,
                precision: {
                  unit: "in",
                  increment: "0.25",
                  review: "SYNTHETIC precision decision",
                },
              },
            ],
          },
        ],
      },
    });
    const before = await command(
      "service.templates",
      syntheticManifest(service, [piece], [form], "before-craft", "before"),
    );
    const after = await command(
      "service.templates",
      syntheticManifest(service, [piece], [form], "after-craft", "after"),
    );
    const draft = await command(
      "service.templates",
      syntheticManifest(service, [piece], [form], "owner-draft", "before"),
      false,
    );
    return {
      actor,
      service,
      piece,
      form,
      before,
      after,
      draft,
      command,
      close: () => db.pool.end(),
    };
  } catch (e) {
    await db.pool.end();
    throw e;
  }
}
