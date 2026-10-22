import {
  type ContactMergePreview,
  type ContactMergeQuery,
  contactMergeCommandSchema,
  contactMergePreviewSchema,
  contactMergeQuerySchema,
} from "@aarili/contracts/customer-history";
import { customerContactSchema } from "@aarili/contracts/customers";
import { idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  type CustomerHistoryContext,
  HistoryFailure,
  previewCustomerPair,
} from "./customer-history.js";
import { mutateCustomer, readCustomer } from "./customers.js";
import { requestHash } from "./request-binding.js";
import { parseExpectedVersion } from "./request-version.js";

function contactValues(c: {
  displayName: string;
  phone?: string | undefined;
  email?: string | undefined;
  notes?: string | undefined;
  aliases: string[];
}) {
  return customerContactSchema.parse({
    displayName: c.displayName,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    aliases: c.aliases,
  });
}

async function prepare(ctx: CustomerHistoryContext, q: ContactMergeQuery) {
  const repo = ctx.repository.merges;
  // This class is used only by merge/restore, before every existing aggregate class.
  await repo.lock();
  const discovered = await repo.inventory(q.sourceId, q.survivorId);
  for (const o of discovered) await repo.lockOrder(o.id);
  for (const id of [q.sourceId, q.survivorId].sort())
    await ctx.identities.customers.repository.lockCustomer(id);
  const pair = await previewCustomerPair(ctx, {
    firstId: q.sourceId,
    secondId: q.survivorId,
  });
  const associations = (await repo.inventory(q.sourceId, q.survivorId)).map(
    (o) =>
      q.mode === "restore" &&
      o.originalCustomerId === q.sourceId &&
      o.currentCustomerId === q.survivorId
        ? { ...o, eligible: true, exclusion: null }
        : o,
  );
  // Acceptance may have finished between discovery and contact locking. Never
  // discover and acquire an earlier aggregate lock after identity locks.
  if (
    discovered.map((o) => o.id).join() !== associations.map((o) => o.id).join()
  )
    throw new HistoryFailure(412, "PAIR_CHANGED");
  const state = await repo.state(q.sourceId, q.survivorId);
  const blocked: ContactMergePreview["blocked"] = [];
  if (associations.length > 100) blocked.push("too-many-records");
  const active = state.aliases.find((a) => a.sourceId === q.sourceId);
  if (q.mode === "restore") {
    if (active?.survivorId !== q.survivorId) blocked.push("not-merged");
  } else if (state.aliases.length) blocked.push("alias-conflict");
  const [a, b] = pair.contacts;
  const canShowAssociation = (o: ContactMergePreview["associations"][number]) =>
    !o.wearerId ||
    pair.contacts
      .find((c) => c.customer.id === o.originalCustomerId)
      ?.wearers.some((w) => w.id === o.wearerId && w.eligible) === true;
  if (associations.some((o) => !canShowAssociation(o)))
    blocked.push("wearer-conflict");
  for (const w of a?.wearers ?? []) {
    const other = b?.wearers.find((x) => x.id === w.id);
    if (
      other &&
      (other.relationship !== w.relationship ||
        other.eligible !== w.eligible ||
        other.guardianVerified !== w.guardianVerified)
    )
      blocked.push("wearer-conflict");
  }
  const source = contactValues(
    await readCustomer(ctx.identities.customers, q.sourceId),
  );
  const survivor = contactValues(
    await readCustomer(ctx.identities.customers, q.survivorId),
  );
  const privacy = await ctx.repository.privacyVersion();
  const fingerprint = await requestHash({
    q,
    pair: pair.fingerprint,
    pairVersion: pair.version,
    associations,
    state,
    privacy,
  });
  const authority = await requestHash({
    shop: ctx.identities.customers.shopId,
    actor: ctx.identities.customers.actor,
    privacy,
    wearers: pair.contacts.map((c) => [
      c.customer.id,
      c.wearers.map((w) => [
        w.id,
        w.version,
        w.eligible,
        w.guardianVerified,
        w.relationship,
      ]),
    ]),
  });
  return {
    preview: contactMergePreviewSchema.parse({
      pair,
      source,
      survivor,
      version: state.version,
      fingerprint,
      associations: associations.filter(canShowAssociation),
      blocked: [...new Set(blocked)],
      unavailable: [
        "measurements",
        "private-media",
        "issued-finance",
        "bookings",
        "wearer-authority",
        "drafts",
      ],
      events: state.events,
    }),
    authority,
    state,
  };
}
function query(input: unknown) {
  const p = contactMergeQuerySchema.safeParse(input);
  if (
    !p.success ||
    p.data.sourceId.toLowerCase() === p.data.survivorId.toLowerCase()
  )
    throw new HistoryFailure(422, "VALIDATION_FAILED");
  return {
    ...p.data,
    sourceId: p.data.sourceId.toLowerCase(),
    survivorId: p.data.survivorId.toLowerCase(),
  };
}
export async function previewContactMerge(
  ctx: CustomerHistoryContext,
  input: unknown,
) {
  return (await prepare(ctx, query(input))).preview;
}
export async function applyContactMerge(
  ctx: CustomerHistoryContext,
  input: unknown,
  headers: {
    key?: string | undefined;
    ifMatch?: string | undefined;
    requestId: string;
  },
) {
  const p = contactMergeCommandSchema.safeParse(input),
    actor = ctx.identities.customers.actor;
  if (
    !p.success ||
    actor.type !== "user" ||
    ![headers.key, headers.requestId].every(
      (x) => idempotencyHeaderSchema.safeParse(x).success,
    )
  )
    throw new HistoryFailure(422, "VALIDATION_FAILED");
  const q = query({
    sourceId: p.data.sourceId,
    survivorId: p.data.survivorId,
    mode: p.data.mode,
  });
  const command = {
    ...p.data,
    ...q,
    orderIds: p.data.orderIds.map((x) => x.toLowerCase()).sort(),
  };
  if (new Set(command.orderIds).size !== command.orderIds.length)
    throw new HistoryFailure(422, "VALIDATION_FAILED");
  const expected = parseExpectedVersion(headers.ifMatch);
  if (!expected.ok) throw new HistoryFailure(expected.status, expected.code);
  const policy = ctx.identities.customers.policy;
  if (!policy.enabled || !policy.synthetic || !policy.notice)
    throw new HistoryFailure(409, "CUSTOMER_POLICY_PENDING");
  const key = (headers.key as string).toLowerCase(),
    repo = ctx.repository.merges;
  const hash = await requestHash({
    shop: ctx.identities.customers.shopId,
    actor,
    command,
    expected: expected.version,
  });
  await repo.lockKey(key);
  const { preview: v, authority, state } = await prepare(ctx, q);
  const prior = await repo.replay(key);
  if (
    prior &&
    (prior.actor.id !== actor.id ||
      prior.actor.type !== actor.type ||
      prior.action !== `customer.${q.mode}` ||
      prior.hash !== hash)
  )
    throw new HistoryFailure(422, "IDEMPOTENCY_MISMATCH");
  const replay = await repo.replayMerge(key);
  if (replay) {
    if (replay.actorId !== actor.id || replay.hash !== hash)
      throw new HistoryFailure(422, "IDEMPOTENCY_MISMATCH");
    if (
      replay.authority !== authority ||
      state.version !== replay.result.version
    )
      throw new HistoryFailure(409, "PAIR_CHANGED");
    return replay.result;
  }
  if (prior) throw new HistoryFailure(422, "IDEMPOTENCY_MISMATCH");
  if (v.version !== expected.version || v.fingerprint !== command.fingerprint)
    throw new HistoryFailure(412, "PAIR_CHANGED");
  if (v.blocked.length) throw new HistoryFailure(409, "REQUEST_CONFLICT");
  if (v.version === 2147483647)
    throw new HistoryFailure(409, "VERSION_EXHAUSTED");
  const selected = v.associations.filter((o) =>
    command.orderIds.includes(o.id),
  );
  if (
    selected.length !== command.orderIds.length ||
    selected.some(
      (o) =>
        !o.eligible ||
        o.originalCustomerId !== q.sourceId ||
        o.currentCustomerId !==
          (q.mode === "merge" ? q.sourceId : q.survivorId),
    )
  )
    throw new HistoryFailure(422, "VALIDATION_FAILED");
  if (
    q.mode === "restore" &&
    v.associations.some(
      (o) =>
        o.originalCustomerId === q.sourceId &&
        o.currentCustomerId === q.survivorId &&
        !command.orderIds.includes(o.id),
    )
  )
    throw new HistoryFailure(422, "VALIDATION_FAILED");
  // Restore never silently reverses the survivor's later legitimate corrections.
  if (
    q.mode === "restore" &&
    Object.values(command.fields).some((x) => x !== "survivor")
  )
    throw new HistoryFailure(422, "VALIDATION_FAILED");
  if (q.mode === "merge") {
    const values = {
      displayName: v[command.fields.displayName].displayName,
      phone: v[command.fields.phone].phone,
      email: v[command.fields.email].email,
      aliases: v[command.fields.aliases].aliases,
      notes: v[command.fields.notes].notes,
    };
    if (
      JSON.stringify(values) !==
      JSON.stringify({
        displayName: v.survivor.displayName,
        phone: v.survivor.phone,
        email: v.survivor.email,
        aliases: v.survivor.aliases,
        notes: v.survivor.notes,
      })
    ) {
      const contact = v.pair.contacts.find(
        (c) => c.customer.id === q.survivorId,
      );
      await mutateCustomer(
        ctx.identities.customers,
        "correct",
        q.survivorId,
        { ...values, reason: command.reason },
        {
          key: crypto.randomUUID(),
          ifMatch: `"v${contact?.customer.version}"`,
          requestId: headers.requestId,
        },
      );
    }
  }
  const result = await repo.append({
    command,
    sourceVersion: v.pair.contacts.find((c) => c.customer.id === q.sourceId)
      ?.customer.version as number,
    survivorVersion: v.pair.contacts.find((c) => c.customer.id === q.survivorId)
      ?.customer.version as number,
    version: v.version + 1,
    actorId: actor.id,
    key,
    hash,
    requestId: headers.requestId,
    authority,
    orders: selected,
  });
  await repo.persist(
    key,
    { actor, action: `customer.${q.mode}`, hash },
    result,
  );
  return result;
}
