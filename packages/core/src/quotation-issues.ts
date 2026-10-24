import {
  type IssuedQuotationModel,
  issuedQuotationModelSchema,
  quoteIssueCommandSchema,
  quoteIssueReadSchema,
  quoteIssueReviewInputSchema,
  quoteIssueReviewSchema,
  quoteResponseCommandSchema,
} from "@aarili/contracts/quotation-issues";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import type { QuotationIssuesRepository } from "@aarili/db/repositories/quotation-issues";
import {
  type BookingQuotationsContext,
  readQuotation,
} from "./booking-quotations.js";
import {
  type DocumentContext,
  DocumentFailure,
  documentStatus,
  issueDocument,
} from "./documents.js";
import { readEstimate } from "./garment-estimates.js";
import { shopDate } from "./quotation-rates.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

export type QuotationIssuesContext = {
  documents: DocumentContext;
  proposals: BookingQuotationsContext;
  repository: QuotationIssuesRepository;
};
function fail(status: DocumentFailure["status"], code: string): never {
  throw new DocumentFailure(status, code);
}
function keyValue(key: string) {
  if (!idempotencyHeaderSchema.safeParse(key).success)
    fail(422, "VALIDATION_FAILED");
  return key.toLowerCase();
}
// This wrapper is used by web AND worker composition. It retains the canonical
// outer document/privacy barrier before source, policy, number and document locks.
export function quotationDocumentContext(
  base: DocumentContext,
  repository: QuotationIssuesRepository,
  proposals: BookingQuotationsContext,
): DocumentContext {
  return {
    ...base,
    prepare: async () => {
      await base.prepare?.();
      await repository.lock();
    },
    storageBarrier: (d) =>
      d.template === "quotation" || !!base.storageBarrier?.(d),
    renderAssets: (d) =>
      d.template === "quotation"
        ? Promise.resolve([])
        : (base.renderAssets?.(d) ?? Promise.resolve([])),
    policy: {
      async authorize(d, action) {
        if (d.template !== "quotation") return base.policy.authorize(d, action);
        const b = await repository.binding(d.docId, d.revision),
          m = issuedQuotationModelSchema.safeParse(d.model);
        if (
          !b ||
          b.revoked ||
          !m.success ||
          d.paper !== "A4" ||
          d.templateRevision !== 1 ||
          m.data.docId !== d.docId ||
          m.data.revision !== d.revision ||
          m.data.language !== d.language ||
          m.data.proposalId !== b.proposalId ||
          m.data.number !== b.number ||
          (await requestHash(m.data)) !== b.modelHash
        )
          return false;
        try {
          await readQuotation(proposals, b.proposalId);
          return true;
        } catch {
          return false;
        }
      },
    },
  };
}
async function prepare(ctx: QuotationIssuesContext) {
  await ctx.documents.prepare?.();
  await ctx.repository.lock();
}
async function reviewed(ctx: QuotationIssuesContext, input: unknown) {
  const parsed = quoteIssueReviewInputSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  await prepare(ctx);
  const v = parsed.data,
    p = await readQuotation(ctx.proposals, v.proposalId),
    rates = ctx.proposals.estimates.rates;
  await rates.profile.lock();
  await rates.repository.lock();
  const profile = await rates.profile.current(),
    policy = await rates.repository.policyCurrent("quoteValidity"),
    now = await ctx.documents.repository.now(),
    today = shopDate(now),
    blockers: string[] = [];
  if (
    p.sourceChanged ||
    !p.version.customer.complete ||
    p.version.customer.totalPaise === null ||
    p.version.source.estimateStale
  )
    blockers.push("proposal-source-changed-or-incomplete");
  if (!p.selected) blockers.push("proposal-not-current");
  if (await ctx.repository.proposal(v.proposalId))
    blockers.push("proposal-already-issued");
  if (
    profile?.profile.billingRegime !== "unregistered-non-tax" ||
    !profile.profile.address.trim() ||
    !(profile.profile.phone.trim() || profile.profile.email.trim())
  )
    blockers.push("shop-profile-incomplete");
  const validPolicy =
    policy?.sourceCurrent &&
    (policy.authority === "owner-reviewed" || rates.synthetic) &&
    policy.policy.kind === "quoteValidity" &&
    policy.policy.state === "reviewed" &&
    policy.policy.terms.en.trim() &&
    policy.policy.terms.ta.trim();
  let expiry: string | null = v.expiryDate || null;
  if (!validPolicy) blockers.push("validity-policy-unreviewed");
  if (!expiry && validPolicy && policy?.policy.kind === "quoteValidity") {
    const days = policy.policy.calendarDays;
    if (days && Number.isInteger(days) && days > 0 && days <= 36500) {
      const date = new Date(`${today}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      expiry = date.toISOString().slice(0, 10);
    }
  }
  if (!expiry || expiry < today) blockers.push("validity-date-invalid");
  const history = await ctx.repository.history(p.version.familyId),
    version = (history[0]?.revision ?? 0) + 1;
  const digest = await requestHash({
    input: v,
    proposal: p.version.contentHash,
    sourceChanged: p.sourceChanged,
    selected: p.selected,
    profile,
    policy,
    today,
    expiry,
    history,
  });
  return {
    v,
    p,
    profile,
    policy,
    history,
    version,
    today,
    expiry,
    blockers,
    digest,
  };
}
export async function reviewQuoteIssue(
  ctx: QuotationIssuesContext,
  input: unknown,
) {
  const r = await reviewed(ctx, input);
  return quoteIssueReviewSchema.parse({
    version: r.version,
    digest: r.digest,
    issueDate: r.today,
    expiryDate: r.expiry,
    validityTerms: r.policy?.policy.terms ?? null,
    blockers: r.blockers,
    history: r.history,
  });
}
export async function issueQuotation(
  ctx: QuotationIssuesContext,
  input: unknown,
  key: string,
  ifMatch: string | null,
) {
  key = keyValue(key);
  const parsed = quoteIssueCommandSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  const v = parsed.data;
  await prepare(ctx);
  const commandHash = await requestHash({
    actor: ctx.documents.actor,
    command: v,
    ifMatch,
  });
  await ctx.documents.repository.lockKey(key);
  const prior = await ctx.repository.proposal(v.proposalId),
    used = await ctx.documents.repository.issuedByKey(key);
  if (prior) {
    if (prior.key !== key) fail(409, "QUOTATION_ALREADY_ISSUED");
    if (
      prior.commandHash !== commandHash ||
      prior.actorId !== ctx.documents.actor.id
    )
      fail(422, "IDEMPOTENCY_MISMATCH");
    const doc = await ctx.documents.repository.read(
      prior.docId,
      prior.revision,
    );
    if (!doc) fail(404, "NOT_FOUND");
    return {
      entry: {
        docId: prior.docId,
        revision: prior.revision,
        proposalId: prior.proposalId,
        number: prior.number,
        modelHash: prior.modelHash,
        revoked: prior.revoked,
      },
      status: await issueDocument(
        ctx.documents,
        {
          docId: doc.docId,
          revision: doc.revision,
          template: doc.template,
          templateRevision: doc.templateRevision,
          language: doc.language,
          paper: doc.paper,
          model: doc.model,
        },
        key,
      ),
    };
  }
  if (
    used ||
    (await ctx.documents.repository.replay(key)) ||
    (await ctx.repository.eventByKey(key))
  )
    fail(422, "IDEMPOTENCY_MISMATCH");
  const expected = parseExpectedVersion(ifMatch ?? undefined);
  if (!expected.ok) fail(expected.status, expected.code);
  const r = await reviewed(ctx, {
    proposalId: v.proposalId,
    language: v.language,
    expiryDate: v.expiryDate,
    customerLabel: v.customerLabel,
  });
  if (expected.version !== r.version || v.digest !== r.digest)
    fail(412, "QUOTATION_SOURCE_CHANGED");
  if (r.blockers.length || !r.profile || !r.policy || !r.expiry)
    fail(409, "QUOTATION_SOURCE_BLOCKED");
  if (v.previousRevision !== (r.history[0]?.revision ?? null))
    fail(409, "QUOTATION_PREDECESSOR_CHANGED");
  const estimates = [];
  for (const selected of r.p.version.input.estimates)
    estimates.push(
      (await readEstimate(ctx.proposals.estimates, selected.revisionId)).version
        .customer,
    );
  const number = await ctx.repository.allocate(),
    profile = r.profile.profile;
  const model = issuedQuotationModelSchema.parse({
    kind: "quotation.v1",
    language: v.language,
    number,
    docId: r.p.version.familyId,
    revision: r.version,
    proposalId: v.proposalId,
    previousRevision: v.previousRevision,
    issuedAt: (await ctx.documents.repository.now()).toISOString(),
    issueDate: r.today,
    expiryDate: r.expiry,
    pricingDates: [...new Set(estimates.map((e) => e.pricingDate))],
    profileId: r.profile.id,
    validityPolicyId: r.policy.id,
    shop: {
      name: profile.legalName || profile.displayName,
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
    },
    customerLabel: v.customerLabel,
    scope: r.p.version.source.orders.map((o) => ({
      orderId: o.orderId,
      code: o.code ?? "",
    })),
    proposal: r.p.version.customer,
    estimates,
    terms: [
      r.policy.policy.terms,
      ...(r.p.version.source.policy
        ? [r.p.version.source.policy.policy.terms]
        : []),
    ],
  });
  const entry = {
    docId: model.docId,
    revision: model.revision,
    proposalId: v.proposalId,
    number,
    modelHash: await requestHash(model),
    revoked: false,
  };
  await ctx.repository.bind({
    ...entry,
    commandHash,
    reason: v.reason,
    profileId: r.profile.id,
    validityPolicyId: r.policy.id,
    actorId: ctx.documents.actor.id,
    key,
    proposalFamilyId: r.p.version.familyId,
  });
  const status = await issueDocument(
    ctx.documents,
    {
      docId: entry.docId,
      revision: entry.revision,
      template: "quotation",
      templateRevision: 1,
      language: v.language,
      paper: "A4",
      model,
    },
    key,
  );
  return { entry, status };
}
export async function readIssuedQuotation(
  ctx: QuotationIssuesContext,
  docId: string,
  revision: number,
) {
  await prepare(ctx);
  const entry = await ctx.repository.binding(docId, revision);
  if (!entry || entry.revoked) fail(404, "NOT_FOUND");
  const p = await readQuotation(ctx.proposals, entry.proposalId),
    status = await documentStatus(ctx.documents, docId, revision),
    document = await ctx.documents.repository.read(docId, revision);
  const model: IssuedQuotationModel = issuedQuotationModelSchema.parse(
      document?.model,
    ),
    events = await ctx.repository.events(docId, revision),
    history = await ctx.repository.history(docId);
  const withdrawn = events.some((e) => e.value?.kind === "issue-withdrawn"),
    expired = shopDate(await ctx.documents.repository.now()) > model.expiryDate;
  return quoteIssueReadSchema.parse({
    entry: {
      docId: entry.docId,
      revision: entry.revision,
      proposalId: entry.proposalId,
      number: entry.number,
      modelHash: entry.modelHash,
      revoked: entry.revoked,
    },
    model,
    status,
    events,
    responseVersion: events.length + 1,
    historical: history[0]?.revision !== revision || !p.selected,
    expired,
    withdrawn,
    agreementApplication: "unavailable",
    respondentCustomerIds: [
      ...new Set(
        p.version.source.orders.map((o) => o.customerId).filter(Boolean),
      ),
    ],
  });
}
export async function recordQuoteResponse(
  ctx: QuotationIssuesContext,
  input: unknown,
  key: string,
  ifMatch: string | null,
) {
  key = keyValue(key);
  const parsed = quoteResponseCommandSchema.safeParse(input);
  if (!parsed.success) fail(422, "VALIDATION_FAILED");
  const v = parsed.data;
  await prepare(ctx);
  await ctx.documents.repository.lockKey(key);
  const read = await readIssuedQuotation(ctx, v.docId, v.revision),
    commandHash = await requestHash({
      actor: ctx.documents.actor,
      input: v,
      ifMatch,
    }),
    old = await ctx.repository.eventByKey(key);
  if (old) {
    if (
      old.commandHash !== commandHash ||
      old.actorId !== ctx.documents.actor.id
    )
      fail(422, "IDEMPOTENCY_MISMATCH");
    return {
      event: {
        id: old.id,
        docId: old.docId,
        revision: old.revision,
        modelHash: old.modelHash,
        previousId: old.previousId,
        actorId: old.actorId,
        recordedAt: old.recordedAt,
        value: old.value,
      },
      responseVersion: read.events.findIndex((e) => e.id === old.id) + 2,
    };
  }
  if (
    (await ctx.documents.repository.replay(key)) ||
    (await ctx.documents.repository.issuedByKey(key)) ||
    (await ctx.documents.repository.shareByKey(key))
  )
    fail(422, "IDEMPOTENCY_MISMATCH");
  const expected = parseExpectedVersion(ifMatch ?? undefined);
  if (!expected.ok) fail(expected.status, expected.code);
  if (
    expected.version !== read.responseVersion ||
    v.previousId !== (read.events.at(-1)?.id ?? null)
  )
    fail(412, "VERSION_STALE");
  if (
    v.modelHash !== read.entry.modelHash ||
    read.events.length >= 100 ||
    (v.value.respondentCustomerId &&
      !read.respondentCustomerIds.includes(v.value.respondentCustomerId)) ||
    (["approved", "rejected"].includes(v.value.kind) &&
      !v.value.respondentCustomerId) ||
    new Date(v.value.reportedAt).getTime() >
      (await ctx.documents.repository.now()).getTime()
  )
    fail(422, "VALIDATION_FAILED");
  const event = await ctx.repository.respond(
    v,
    key,
    commandHash,
    ctx.documents.actor.id,
  );
  // A minimal generic binding prevents cross-action key reuse without caching
  // personal response evidence outside the audited privacy-redactable row.
  await ctx.documents.repository.persist(
    key,
    {
      actor: ctx.documents.actor,
      action: "quotation.response",
      hash: commandHash,
    },
    { eventId: event.id },
  );
  return { event, responseVersion: read.responseVersion + 1 };
}
