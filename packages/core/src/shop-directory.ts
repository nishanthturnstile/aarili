import {
  directoryCommandSchema,
  directoryDraftSchema,
  directoryHistoryQuerySchema,
  directoryQuerySchema,
  summarizeDirectory,
} from "@aarili/contracts/shop-directory";
import type { ShopDirectoryRepository } from "@aarili/db/repositories/shop-directory";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
export type ShopDirectoryContext = {
  shopId: string;
  actorId: string;
  repository: ShopDirectoryRepository;
  requireRecent: () => Promise<void>;
};
function fail(
  status: 404 | 409 | 412 | 422,
  code:
    | "NOT_FOUND"
    | "REQUEST_CONFLICT"
    | "VERSION_STALE"
    | "VALIDATION_FAILED",
): never {
  throw new DraftFailure(status, {
    error: { code, message: "Directory request rejected" },
  });
}
export async function readShopDirectory(
  ctx: ShopDirectoryContext,
  input: unknown,
) {
  const q = directoryQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const rows = await ctx.repository.list(q.data.before);
  const config = await ctx.repository.configuration();
  return {
    entries: rows.slice(0, 25).map(summarizeDirectory),
    next: rows.length > 25 ? (rows[24]?.entryId ?? null) : null,
    readiness: !config.enabled.length
      ? ("missingMethods" as const)
      : config.enabled.some(
            (m) =>
              m === "cash" ||
              config.accounts.some((a) => a.active && a.method === m),
          )
        ? ("configured" as const)
        : ("missingReceivingAccount" as const),
    paymentRecording: "notImplemented" as const,
  };
}
export async function readDirectoryEntry(
  ctx: ShopDirectoryContext,
  id: string,
) {
  return { revision: (await ctx.repository.current(id)) ?? null };
}
export async function readDirectoryRevision(
  ctx: ShopDirectoryContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readDirectoryHistory(
  ctx: ShopDirectoryContext,
  input: unknown,
) {
  const q = directoryHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const rows = await ctx.repository.history(
    q.data.entryId,
    q.data.beforeVersion,
  );
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
// For later consumers: old references remain readable but new selections require
// the current active revision, an enabled receiving method and exact tenant match.
export async function selectDirectoryEntry(
  ctx: ShopDirectoryContext,
  id: string,
  kind: "account" | "vendor",
) {
  await ctx.repository.lock();
  const r = await ctx.repository.current(id);
  if (!r || r.content.kind !== kind || !r.content.active)
    fail(409, "REQUEST_CONFLICT");
  if (
    r.content.kind === "account" &&
    !(await ctx.repository.configuration()).enabled.includes(r.content.method)
  )
    fail(409, "REQUEST_CONFLICT");
  return r;
}
export function shopDirectoryDraftWorkflow(
  ctx: ShopDirectoryContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: directoryDraftSchema,
    commandSchema: directoryCommandSchema,
    async authorizePublication(command) {
      const c = directoryCommandSchema.parse(command);
      if (c.content.kind !== "vendor") await ctx.requireRecent();
    },
    async revalidate(command) {
      const c = directoryCommandSchema.parse(command);
      await ctx.repository.lock();
      const current = await ctx.repository.current(c.entryId);
      if (
        (current?.version ?? 0) !== c.baseVersion ||
        (current?.id ?? null) !== c.baseRevisionId
      )
        fail(412, "VERSION_STALE");
      if (c.content.kind === "methods") {
        const config = await ctx.repository.configuration();
        if (config.methodsId && config.methodsId !== c.entryId)
          fail(409, "REQUEST_CONFLICT");
      }
      if (current && current.content.kind !== c.content.kind)
        fail(409, "REQUEST_CONFLICT");
    },
    async promote(command, _actionId, draftId, request) {
      const c = directoryCommandSchema.parse(command);
      const r = await ctx.repository.append({
        ...c,
        version: c.baseVersion + 1,
        previousId: c.baseRevisionId,
        actorId: ctx.actorId,
        originDraftId: draftId,
        key: request.key,
        requestId: request.requestId,
      });
      if (!(await ctx.repository.advance(r, c.baseVersion)))
        fail(412, "VERSION_STALE");
      return { type: "shop.directory.revision", id: r.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "shop.directory.revision" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
