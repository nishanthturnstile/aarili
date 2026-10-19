import {
  type QuickOrderDraft,
  type QuickOrderPreview,
  quickOrderCommandSchema,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import { localDateValid } from "@aarili/contracts/shop-calendar";
import { parseRupees } from "@aarili/money";
import type { CustomerContext } from "./customers.js";
import { CustomerFailure, readCustomer } from "./customers.js";
import { DraftFailure, type DraftWorkflow } from "./drafts.js";
import {
  type GuardianContext,
  GuardianFailure,
  readGuardians,
} from "./guardians.js";
import {
  previewServiceRequirements,
  type ServiceTemplatesContext,
  serviceTemplatesReferencesEligible,
} from "./service-templates.js";
import { readWearer, type WearerContext, WearerFailure } from "./wearers.js";

export type QuickOrderContext = {
  customers: CustomerContext;
  wearers: WearerContext;
  guardians: GuardianContext;
  templates: ServiceTemplatesContext;
};
function fail(
  code: "REQUEST_CONFLICT" | "NOT_FOUND" | "VALIDATION_FAILED",
  status: 404 | 409 | 422 = 409,
): never {
  throw new DraftFailure(status, {
    error: { code, message: "Quick Order unavailable" },
  });
}
// Shared by preview, save, replay and read. No browser permission assertion.
async function readReferences(ctx: QuickOrderContext, v: QuickOrderDraft) {
  if (
    !ctx.customers.policy.enabled ||
    !ctx.customers.policy.synthetic ||
    !ctx.templates.synthetic
  )
    fail("REQUEST_CONFLICT");
  let customer: QuickOrderPreview["customer"] = null;
  let wearer: QuickOrderPreview["wearer"] = null;
  const issues: QuickOrderPreview["issues"] = [];
  if (v.customerId) {
    await ctx.wearers.repository.lockCustomer(v.customerId);
    const c = await readCustomer(ctx.customers, v.customerId);
    customer = { id: c.id, label: c.displayName, code: c.code };
  } else issues.push("customer");
  if (v.wearerId) {
    if (!v.customerId) fail("VALIDATION_FAILED", 422);
    await ctx.wearers.repository.lockWearer(v.wearerId);
    const w = await readWearer(ctx.wearers, v.customerId, v.wearerId);
    if (
      !w.relationship.authorised ||
      !w.relationship.informed ||
      w.relationship.authorisationDeclined ||
      w.relationship.informedDeclined
    )
      fail("NOT_FOUND", 404);
    const service = w.purposes.find((p) => p.purpose === "service");
    if (service && service.decision !== "grant") fail("NOT_FOUND", 404);
    wearer = { id: w.id, label: w.displayName, kind: w.relationship.kind };
    if (w.age === "minor") {
      const g = await readGuardians(ctx.guardians, v.customerId, w.id);
      if (!g.authorities.some((a) => a.verifiedCurrent))
        issues.push("guardian");
    } else if (!service?.eligible) issues.push("servicePermission");
  } else issues.push("wearer");
  if (
    v.presentationRevisionId &&
    !(await ctx.templates.repository.presentationRead(v.presentationRevisionId))
  )
    fail("NOT_FOUND", 404);
  if (v.manifest) {
    const r = await ctx.templates.repository.read(v.manifest.revisionId);
    if (
      !r ||
      r.entryId !== v.manifest.entryId ||
      r.definition.id !== v.manifest.definitionId
    )
      fail("NOT_FOUND", 404);
  }
  return { customer, wearer, issues };
}
async function references(ctx: QuickOrderContext, v: QuickOrderDraft) {
  try {
    return await readReferences(ctx, v);
  } catch (e) {
    if (
      e instanceof CustomerFailure ||
      e instanceof WearerFailure ||
      e instanceof GuardianFailure
    )
      fail(
        e.status === 404
          ? "NOT_FOUND"
          : e.status === 422
            ? "VALIDATION_FAILED"
            : "REQUEST_CONFLICT",
        e.status === 404 ? 404 : e.status === 422 ? 422 : 409,
      );
    throw e;
  }
}
export async function previewQuickOrder(
  ctx: QuickOrderContext,
  input: unknown,
): Promise<QuickOrderPreview> {
  const p = quickOrderDraftSchema.safeParse(input);
  if (!p.success) fail("VALIDATION_FAILED", 422);
  const v = p.data;
  const identity = await references(ctx, v);
  const result: QuickOrderPreview = {
    ...identity,
    sourceState: "not-selected",
    requirements: null,
    pricePaise: null,
    effects: "none",
    commitment: "unavailable",
  };
  if (v.manifest) {
    // Same lock order as publication. Exact historic content never becomes latest.
    await ctx.templates.catalogue.repository.lock();
    await ctx.templates.forms.repository.lock();
    await ctx.templates.repository.lock();
    const exact = await ctx.templates.repository.read(v.manifest.revisionId);
    if (!exact) fail("NOT_FOUND", 404);
    const current = await ctx.templates.repository.current(v.manifest.entryId);
    result.sourceState = !current?.available
      ? "unavailable"
      : current.id !== exact.id
        ? "changed"
        : (await serviceTemplatesReferencesEligible(ctx.templates, exact))
          ? "current"
          : "changed";
    result.requirements = await previewServiceRequirements(
      ctx.templates,
      exact.definition.content,
      exact.definition.id,
    );
  }
  if (result.sourceState !== "current") result.issues.push("service");
  if (!localDateValid(v.deliveryDate)) result.issues.push("deliveryDate");
  if (
    v.deliveryTime &&
    !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(v.deliveryTime)
  )
    result.issues.push("deliveryTime");
  for (const key of ["orderDate", "requestedDate", "eventDate"] as const)
    if (v[key] && !localDateValid(v[key])) result.issues.push(key);
  if (
    v.orderDate &&
    localDateValid(v.orderDate) &&
    v.deliveryDate &&
    v.deliveryDate < v.orderDate
  )
    result.issues.push("orderDate");
  if (v.priceState === "quoted") {
    try {
      result.pricePaise = parseRupees(v.priceText);
    } catch {
      result.issues.push("priceText");
    }
    if (result.pricePaise === null && !result.issues.includes("priceText"))
      result.issues.push("priceText");
  }
  return result;
}
export function quickOrderDraftWorkflow(ctx: QuickOrderContext): DraftWorkflow {
  return {
    schemaVersion: 1,
    draftSchema: quickOrderDraftSchema,
    commandSchema: quickOrderCommandSchema,
    async authorizeDraft(input) {
      const parsed = quickOrderDraftSchema.safeParse(input);
      if (!parsed.success) fail("VALIDATION_FAILED", 422);
      await references(ctx, parsed.data);
    },
    async authorizePublication() {
      fail("REQUEST_CONFLICT");
    },
    async revalidate() {
      fail("REQUEST_CONFLICT");
    },
    async promote() {
      fail("REQUEST_CONFLICT");
    },
    async verifyResult() {
      fail("REQUEST_CONFLICT");
    },
  };
}
