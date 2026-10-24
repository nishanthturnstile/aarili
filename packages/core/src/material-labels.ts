import {
  type MaterialLabelModel,
  type MaterialLabelSelection,
  materialLabelCandidatesQuerySchema,
  materialLabelCandidatesSchema,
  materialLabelIssueSchema,
  materialLabelModelSchema,
  materialLabelReviewCommandSchema,
  materialLabelReviewSchema,
} from "@aarili/contracts/material-labels";
import { emptyQuickOrder } from "@aarili/contracts/orders";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import type {
  MaterialLabelSource,
  MaterialLabelsRepository,
} from "@aarili/db/repositories/material-labels";
import {
  type DocumentContext,
  DocumentFailure,
  issueDocument,
} from "./documents.js";
import { DraftFailure } from "./drafts.js";
import { orderReferences, type QuickOrderContext } from "./orders.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";
export type MaterialLabelsContext = {
  documents: DocumentContext;
  repository: MaterialLabelsRepository;
  identities: QuickOrderContext;
};
function fail(status: DocumentFailure["status"], code: string): never {
  throw new DocumentFailure(status, code);
}
async function authorizedSources(
  ctx: Pick<MaterialLabelsContext, "repository" | "identities">,
  selections: Pick<MaterialLabelSelection, "orderId" | "pieceId">[],
) {
  const sources: MaterialLabelSource[] = [],
    authority: MaterialLabelSource[] = [];
  await ctx.repository.lockOrders(selections.map((s) => s.orderId));
  for (const selection of selections) {
    const source = await ctx.repository.source(
      selection.orderId,
      selection.pieceId,
    );
    if (!source) fail(404, "MATERIAL_LABEL_SOURCE_UNAVAILABLE");
    sources.push(source);
    authority.push(source);
  }
  // Service provenance grants no access to its source: authorize that source too.
  for (let i = 0; i < authority.length; i++) {
    const s = authority[i];
    if (!s) continue;
    if (s.sourceOrderId) {
      if (
        authority.some(
          (v) => v.orderId === s.sourceOrderId && v.pieceId === s.sourcePieceId,
        )
      )
        continue;
      if (authority.length >= 64)
        fail(404, "MATERIAL_LABEL_SOURCE_UNAVAILABLE");
      await ctx.repository.lockOrders([s.sourceOrderId]);
      const parent = await ctx.repository.source(
        s.sourceOrderId,
        s.sourcePieceId,
      );
      if (!parent) fail(404, "MATERIAL_LABEL_SOURCE_UNAVAILABLE");
      authority.push(parent);
    }
  }
  for (const id of [...new Set(authority.map((s) => s.customerId))].sort())
    await ctx.identities.wearers.repository.lockCustomer(id);
  for (const id of [
    ...new Set(authority.flatMap((s) => (s.wearerId ? [s.wearerId] : []))),
  ].sort())
    await ctx.identities.wearers.repository.lockWearer(id);
  for (const source of authority) {
    const refs = await orderReferences(ctx.identities, {
      ...emptyQuickOrder(),
      customerId: source.customerId,
      wearerId: source.wearerId,
    });
    if (
      refs.issues.some(
        (v) =>
          v === "guardian" ||
          v === "servicePermission" ||
          v === "customer" ||
          (v === "wearer" && source.kind === "custom"),
      )
    )
      fail(404, "MATERIAL_LABEL_SOURCE_UNAVAILABLE");
  }
  return sources;
}
export function materialLabelDocumentContext(
  base: DocumentContext,
  repository: MaterialLabelsRepository,
  identities: QuickOrderContext,
): DocumentContext {
  return {
    ...base,
    prepare: async () => {
      await base.prepare?.();
      await repository.lock();
    },
    storageBarrier: (d) =>
      d.template === "material-labels" || !!base.storageBarrier?.(d),
    renderAssets: (d) =>
      d.template === "material-labels"
        ? Promise.resolve([])
        : (base.renderAssets?.(d) ?? Promise.resolve([])),
    policy: {
      async authorize(d, action) {
        if (d.template !== "material-labels")
          return base.policy.authorize(d, action);
        const binding = await repository.binding(d.docId, d.revision),
          m = materialLabelModelSchema.safeParse(d.model);
        if (
          !binding ||
          binding.revoked ||
          !m.success ||
          m.data.issued?.docId !== d.docId ||
          m.data.issued.revision !== d.revision ||
          d.templateRevision !== 1 ||
          d.paper !== "A4" ||
          m.data.language !== d.language ||
          (await requestHash(m.data)) !== binding.modelHash
        )
          return false;
        const members = await repository.members(d.docId, d.revision),
          scopes = [
            ...new Map(
              m.data.labels.map((v) => [
                `${v.orderId}/${v.pieceId}`,
                { orderId: v.orderId, pieceId: v.pieceId },
              ]),
            ).values(),
          ];
        if (
          members.length !== scopes.length ||
          members.some(
            (v, i) =>
              v.orderId !== scopes[i]?.orderId ||
              v.pieceId !== scopes[i]?.pieceId,
          )
        )
          return false;
        try {
          await authorizedSources({ repository, identities }, members);
          return true;
        } catch {
          return false;
        }
      },
    },
  };
}
export async function reviewMaterialLabels(
  ctx: MaterialLabelsContext,
  input: unknown,
) {
  const p = materialLabelReviewCommandSchema.safeParse(input);
  if (!p.success) fail(422, "VALIDATION_FAILED");
  await ctx.repository.lock();
  const sources = await authorizedSources(ctx, p.data.selections),
    selectionHash = await requestHash(p.data.selections),
    history = await ctx.repository.history(selectionHash),
    head = history[0]?.revision ?? 0;
  const labels: MaterialLabelModel["labels"] = [];
  for (const [i, s] of sources.entries()) {
    const copies = p.data.selections[i]?.copies ?? 0;
    for (let copy = 1; copy <= copies; copy++)
      labels.push({
        orderId: s.orderId,
        orderCode: s.orderCode,
        pieceId: s.pieceId,
        pieceName: s.pieceName,
        garment: s.garment,
        quantity: s.pieceId ? 1 : null,
        copy,
        copies,
      });
  }
  const model = materialLabelModelSchema.safeParse({
    kind: "material-labels.v1",
    audience: "minimal-label",
    language: "en",
    issued: null,
    labels,
  });
  if (!model.success) fail(409, "MATERIAL_LABEL_FIELD_UNAVAILABLE");
  const version = sources.reduce((n, s) => n + s.version, 1) + head;
  return materialLabelReviewSchema.parse({
    model: model.data,
    version,
    sourceDigest: await requestHash({
      model: model.data,
      provenance: sources.map((s) => ({
        digest: s.digest,
        version: s.version,
      })),
      head,
    }),
    history,
  });
}
export async function issueMaterialLabels(
  ctx: MaterialLabelsContext,
  input: unknown,
  key: string,
  ifMatch: string | null,
) {
  const p = materialLabelIssueSchema.safeParse(input);
  if (!p.success || !idempotencyHeaderSchema.safeParse(key).success)
    fail(422, "VALIDATION_FAILED");
  const command = p.data;
  key = key.toLowerCase();
  await ctx.repository.lock();
  const commandHash = await requestHash({ command, ifMatch });
  const replay = await ctx.documents.repository.issuedByKey(key);
  if (replay) {
    const binding = await ctx.repository.binding(replay.docId, replay.revision);
    if (
      !binding ||
      binding.commandHash !== commandHash ||
      replay.creatorId !== ctx.documents.actor.id
    )
      fail(422, "IDEMPOTENCY_MISMATCH");
    return {
      status: await issueDocument(
        ctx.documents,
        {
          docId: replay.docId,
          revision: replay.revision,
          template: replay.template,
          templateRevision: replay.templateRevision,
          language: replay.language,
          paper: replay.paper,
          model: replay.model,
        },
        key,
      ),
      sourceDigest: binding.sourceDigest,
    };
  }
  const expected = parseExpectedVersion(ifMatch ?? undefined);
  if (!expected.ok) fail(expected.status, expected.code);
  const review = await reviewMaterialLabels(ctx, {
    selections: command.selections,
  });
  if (
    expected.version !== review.version ||
    command.sourceDigest !== review.sourceDigest
  )
    fail(412, "MATERIAL_LABEL_SOURCE_CHANGED");
  const head = review.history[0];
  if (
    (head && head.docId !== command.docId) ||
    command.revision !== (head?.revision ?? 0) + 1 ||
    (await ctx.documents.repository.read(command.docId, command.revision))
  )
    fail(409, "DOCUMENT_REVISION_EXISTS");
  const model = materialLabelModelSchema.parse({
      ...review.model,
      language: command.language,
      issued: {
        docId: command.docId,
        revision: command.revision,
        at: (await ctx.documents.repository.now()).toISOString(),
      },
    }),
    sources = await authorizedSources(ctx, command.selections);
  await ctx.repository.bind(
    {
      docId: command.docId,
      revision: command.revision,
      selectionHash: await requestHash(command.selections),
      sourceDigest: review.sourceDigest,
      commandHash,
      modelHash: await requestHash(model),
      revoked: false,
    },
    command.selections,
    sources,
  );
  const status = await issueDocument(
    ctx.documents,
    {
      docId: command.docId,
      revision: command.revision,
      template: "material-labels",
      templateRevision: 1,
      language: command.language,
      paper: "A4",
      model,
    },
    key,
  );
  return { status, sourceDigest: review.sourceDigest };
}

export async function listMaterialLabelCandidates(
  ctx: MaterialLabelsContext,
  input: unknown,
) {
  const p = materialLabelCandidatesQuerySchema.safeParse(input);
  if (!p.success) fail(422, "VALIDATION_FAILED");
  await ctx.repository.lock();
  const ids = await ctx.repository.candidateOrderIds(p.data.before),
    orders = [];
  await ctx.repository.lockOrders(ids);
  for (const orderId of ids.slice(0, 20)) {
    try {
      const [source] = await authorizedSources(ctx, [
        { orderId, pieceId: null },
      ]);
      if (!source) continue;
      const pieces = [];
      for (const pieceId of await ctx.repository.pieceIds(orderId)) {
        const piece = await ctx.repository.source(orderId, pieceId);
        if (piece?.pieceName) pieces.push({ pieceId, name: piece.pieceName });
      }
      const candidate =
        materialLabelCandidatesSchema.shape.orders.element.safeParse({
          orderId,
          orderCode: source.orderCode,
          garment: source.garment,
          pieces,
        });
      if (candidate.success) orders.push(candidate.data);
    } catch (error) {
      if (error instanceof DocumentFailure || error instanceof DraftFailure)
        continue;
      throw error;
    }
  }
  return materialLabelCandidatesSchema.parse({
    orders,
    next: ids.length > 20 ? ids[19] : null,
  });
}
