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
export async function seedServiceTemplates(
  runtime,
  shopId,
  { outfit = false } = {},
) {
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
          labelTa:
            {
              top: "செயற்கை மேல் பகுதி",
              bottom: "செயற்கை கீழ் பகுதி",
              dupatta: "செயற்கை துப்பட்டா",
            }[code] ?? "செயற்கை ஆடை",
          ...extra,
        },
      });
    const category = await catalogue("category", outfit ? "salwar" : "blouse"),
      piece = await catalogue("piece", outfit ? "top" : "body");
    const pieces = [piece];
    if (outfit)
      for (const code of ["bottom", "dupatta"])
        pieces.push(await catalogue("piece", code));
    const service = await catalogue(
      "service",
      outfit ? "salwar-stitching" : "blouse-stitching",
      {
        parent: definitionRef(category),
        serviceKind: "stitching",
        pieces: pieces.map((p) => ({ ...definitionRef(p), optional: false })),
      },
    );
    const makeForm = (p) =>
      command("measurement.forms", {
        entryId: randomUUID(),
        baseVersion: 0,
        baseRevisionId: null,
        operation: "definition",
        available: true,
        reason: "SYNTHETIC explicit precision",
        content: {
          ...emptyMeasurementFormContent(),
          code: outfit ? `form-${p.definition.content.code}` : "blouse-body",
          labelEn: outfit
            ? `SYNTHETIC ${p.definition.content.code} form`
            : "SYNTHETIC blouse form",
          labelTa: outfit
            ? `${p.definition.content.labelTa} அளவுகள்`
            : "செயற்கை ரவிக்கை அளவுகள்",
          service: definitionRef(service),
          piece: definitionRef(p),
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
    const form = await makeForm(piece),
      forms = [form];
    for (const p of pieces.slice(1)) forms.push(await makeForm(p));
    const manifest = (code, sequence) => {
      const p = syntheticManifest(service, pieces, forms, code, sequence);
      if (outfit) {
        p.content.materials[0].scope.pieceKey = "bottom";
        p.content.tasks.find((t) => t.key === "stitch").scope.pieceKey =
          "bottom";
        p.content.instructions[0].scope.pieceKey = "top";
      }
      return p;
    };
    const before = await command(
      "service.templates",
      manifest("before-craft", "before"),
    );
    const after = await command(
      "service.templates",
      manifest("after-craft", "after"),
    );
    const draft = await command(
      "service.templates",
      manifest("owner-draft", "before"),
      false,
    );
    return {
      actor,
      service,
      piece,
      form,
      pieces,
      forms,
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
