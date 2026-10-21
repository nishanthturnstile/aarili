import { measurementFormsDefinitionSchema } from "@aarili/contracts/measurement-forms";
import {
  type AcceptedOrder,
  type OrderPieceStructure,
  orderPieceStructureSchema,
} from "@aarili/contracts/orders";
import { catalogueDefinitionSchema } from "@aarili/contracts/service-catalogue";
import { templateSections } from "@aarili/contracts/service-templates";

// Only the immutable accepted snapshot is input. No current-catalogue lookup.
export function projectOrderPieces(
  order: Pick<AcceptedOrder, "requirements" | "snapshot">,
): OrderPieceStructure | null {
  try {
    const c = order.requirements.definition;
    if (
      !Array.isArray(order.snapshot.catalogue) ||
      !Array.isArray(order.snapshot.forms)
    )
      return null;
    const catalogue = order.snapshot.catalogue.map((v) =>
      catalogueDefinitionSchema.parse(v),
    );
    const forms = order.snapshot.forms.map((v) =>
      measurementFormsDefinitionSchema.parse(v),
    );
    const pieces = c.pieces.map((p) => {
      const matches = catalogue.filter(
        (d) =>
          d.id === p.revisionId &&
          d.entryId === p.entryId &&
          d.content.kind === "piece",
      );
      if (matches.length !== 1) throw Error("Historic piece unavailable");
      const exact = matches[0];
      if (!exact) throw Error("Historic piece unavailable");
      const refs = c.forms.filter((f) => f.pieceKey === p.key);
      if (refs.length > 1) throw Error("Ambiguous historic form");
      const ref = refs[0];
      const form = ref
        ? forms.find(
            (f) => f.id === ref.revisionId && f.entryId === ref.entryId,
          )
        : null;
      if (ref && !form) throw Error("Historic form unavailable");
      return {
        ...p,
        labelEn: exact.content.labelEn,
        labelTa: exact.content.labelTa,
        form: form
          ? {
              entryId: form.entryId,
              revisionId: form.id,
              labelEn: form.content.labelEn,
              labelTa: form.content.labelTa,
            }
          : null,
      };
    });
    if (new Set(pieces.map((p) => p.key)).size !== pieces.length) return null;
    const requirements = order.requirements.items.map((item, position) => {
      let pieceKey: string | null,
        addonKey: string | null = null;
      if (item.section === "measurement") {
        const refs = c.forms.filter(
          (f) =>
            item.key === f.revisionId ||
            item.key.startsWith(`${f.revisionId}:`),
        );
        if (refs.length !== 1) throw Error("Ambiguous measurement scope");
        const ref = refs[0];
        const form = ref
          ? forms.find(
              (f) => f.id === ref.revisionId && f.entryId === ref.entryId,
            )
          : undefined;
        if (!form) throw Error("Missing historical measurement form");
        if (item.key === form.id) {
          if (form.content.decision !== "not-required")
            throw Error("Unsupported measurement requirement");
        } else if (
          form.content.groups
            .flatMap((g) => g.fields)
            .filter((f) => `${form.id}:${f.key}` === item.key).length !== 1
        ) {
          throw Error("Missing historical measurement field");
        }
        pieceKey = ref?.pieceKey ?? null;
      } else {
        const section = templateSections.find((s) => s === item.section);
        if (!section) throw Error("Unknown historic section");
        const matches = c[section].filter((i) => i.key === item.key);
        if (matches.length !== 1) throw Error("Ambiguous historic requirement");
        pieceKey = matches[0]?.scope.pieceKey ?? null;
        addonKey = matches[0]?.scope.addonKey ?? null;
      }
      if (pieceKey !== null && !pieces.some((p) => p.key === pieceKey))
        throw Error("Missing piece");
      if (addonKey !== null && !c.addons.some((a) => a.key === addonKey))
        throw Error("Missing addon");
      return { position, pieceKey, addonKey };
    });
    return orderPieceStructureSchema.parse({
      schemaVersion: 1,
      pieces,
      requirements,
    });
  } catch {
    return null;
  }
}

// Future fact projection only; no command in this slice can advance these states.
export function summarizePieceProgress(
  facts: {
    progress:
      | "booked"
      | "preparation"
      | "production"
      | "trial"
      | "quality-review"
      | "ready"
      | "cancelled";
    unresolved: boolean;
  }[],
) {
  const ranks = [
    "booked",
    "preparation",
    "production",
    "trial",
    "quality-review",
    "ready",
  ] as const;
  const active = facts.filter((f) => f.progress !== "cancelled");
  if (!active.length)
    return {
      progress: facts.length ? "cancelled" : "unresolved",
      partiallyReady: false,
    };
  const states = active.map((f) =>
    f.progress === "ready" && f.unresolved ? "quality-review" : f.progress,
  );
  return {
    progress: ranks.find((p) => states.includes(p)) ?? "unresolved",
    partiallyReady:
      states.includes("ready") && states.some((p) => p !== "ready"),
  };
}
