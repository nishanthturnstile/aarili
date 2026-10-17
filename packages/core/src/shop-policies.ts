import {
  type PolicyKind,
  type PolicyReadiness,
  policyActions,
  type ShopPoliciesRevision,
  shopPoliciesCommandSchema,
  shopPoliciesDraftSchema,
  shopPoliciesHistoryQuerySchema,
} from "@aarili/contracts/shop-policies";
import type { ShopPoliciesRepository } from "@aarili/db/repositories/shop-policies";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";

export type ShopPoliciesContext = {
  shopId: string;
  actorId: string;
  repository: ShopPoliciesRepository;
  receivingReadiness?: () => Promise<
    "missingMethods" | "missingReceivingAccount" | "configured"
  >;
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
    error: { code, message: "Policy request rejected" },
  });
}
export async function readShopPolicies(ctx: ShopPoliciesContext) {
  const revision = await ctx.repository.current();
  return { version: revision?.version ?? 0, revision: revision ?? null };
}
export async function readShopPoliciesRevision(
  ctx: ShopPoliciesContext,
  id: string,
) {
  const r = await ctx.repository.read(id);
  if (!r) fail(404, "NOT_FOUND");
  return r;
}
export async function readShopPoliciesHistory(
  ctx: ShopPoliciesContext,
  input: unknown,
) {
  const q = shopPoliciesHistoryQuerySchema.safeParse(input);
  if (!q.success) fail(422, "VALIDATION_FAILED");
  const rows = await ctx.repository.history(q.data.beforeVersion);
  return {
    revisions: rows.slice(0, 25),
    next: rows.length > 25 ? (rows[24]?.version ?? null) : null,
  };
}
export function shopPoliciesDraftWorkflow(
  ctx: ShopPoliciesContext,
): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: shopPoliciesDraftSchema,
    commandSchema: shopPoliciesCommandSchema,
    async revalidate(command) {
      const c = shopPoliciesCommandSchema.parse(command);
      await ctx.repository.lock();
      const current = await readShopPolicies(ctx);
      if (
        current.version !== c.baseVersion ||
        (current.revision?.id ?? null) !== c.baseRevisionId
      )
        fail(412, "VERSION_STALE");
    },
    async promote(command, _actionId, draftId, request) {
      const c = shopPoliciesCommandSchema.parse(command),
        current = await readShopPolicies(ctx);
      if (
        current.version !== c.baseVersion ||
        (current.revision?.id ?? null) !== c.baseRevisionId
      )
        fail(412, "VERSION_STALE");
      const policies = [
        ...(current.revision?.policies ?? []).filter(
          (p) => p.kind !== c.policy.kind,
        ),
        c.policy,
      ];
      const revision = await ctx.repository.append({
        policies,
        version: current.version + 1,
        previousId: current.revision?.id ?? null,
        actorId: ctx.actorId,
        originDraftId: draftId,
        key: request.key,
        requestId: request.requestId,
        kind: c.policy.kind,
      });
      if (!(await ctx.repository.advance(revision, current.version)))
        fail(412, "VERSION_STALE");
      return { type: "shop.policies.revision", id: revision.id };
    },
    async verifyResult(result, draftId) {
      if (
        result.type !== "shop.policies.revision" ||
        !(await ctx.repository.origin(result.id, draftId))
      )
        fail(409, "REQUEST_CONFLICT");
    },
  };
}
const prerequisites: Partial<
  Record<(typeof policyActions)[number], PolicyKind[]>
> = {
  bindingQuote: [
    "advance",
    "quoteValidity",
    "discount",
    "cancellation",
    "changeCharges",
  ],
  paymentRecording: ["advance"],
  cancellation: ["cancellation", "refund"],
  changeCharge: ["changeCharges", "discount"],
  trialRework: ["trialRework"],
  creditHandover: ["creditHandover"],
  refund: ["refund"],
};
// Configuration facts only. Future consumers must resolve explicit pinned revisions
// and their own action inputs; this never authorises issuance or money movement.
export function policyReadiness(
  revision: ShopPoliciesRevision | null,
  pendingKinds: readonly PolicyKind[] = [],
  receiving:
    | "missingMethods"
    | "missingReceivingAccount"
    | "configured"
    | "notIntegrated" = "notIntegrated",
): PolicyReadiness {
  return {
    actions: policyActions.map((action) => {
      if (
        [
          "profileSave",
          "customerRegistration",
          "wearerRegistration",
          "calendarSave",
        ].includes(action)
      )
        return { action, state: "available", reasons: [] };
      if (action === "retailReturn")
        return {
          action,
          state: "release-ineligible",
          reasons: [{ code: "retailIneligible" }],
        };
      const reasons: PolicyReadiness["actions"][number]["reasons"] = [
        { code: "actionNotImplemented" },
      ];
      for (const kind of prerequisites[action] ?? []) {
        const p = revision?.policies.find((p) => p.kind === kind);
        reasons.push({
          code: !p
            ? pendingKinds.includes(kind)
              ? "policyDraft"
              : "policyMissing"
            : p.state === "draft"
              ? "policyDraft"
              : p.state === "not-applicable"
                ? "policyNotApplicable"
                : "syntheticOnly",
          policy: kind,
        });
      }
      if (prerequisites[action]?.length)
        reasons.push({ code: "productionAuthorityPending" });
      if (action === "paymentRecording" && receiving !== "configured")
        reasons.push({
          code:
            receiving === "notIntegrated"
              ? "receivingAccountsNotIntegrated"
              : receiving === "missingMethods"
                ? "receivingMethodsMissing"
                : "receivingAccountMissing",
        });
      if (action === "billIssue")
        reasons.push({ code: "billFormatNotImplemented" });
      return { action, state: "not-yet-implemented", reasons };
    }),
  };
}
export async function readShopPoliciesReadiness(ctx: ShopPoliciesContext) {
  return policyReadiness(
    (await ctx.repository.current()) ?? null,
    await ctx.repository.pendingKinds(),
    ctx.receivingReadiness ? await ctx.receivingReadiness() : "notIntegrated",
  );
}
