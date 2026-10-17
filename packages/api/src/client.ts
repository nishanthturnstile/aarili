import {
  apiErrorSchema,
  createOwnerShopSchema,
  googleConnectionSchema,
  googleRedirectSchema,
  healthResponseSchema,
  healthUnavailableSchema,
  ownerActionSchema,
  ownerEntrySchema,
  ownerShopSchema,
  reauthenticationSchema,
  recoveryRequestSchema,
  recoveryResetSchema,
  resendCommandSchema,
  setupCommandSchema,
  shopRecordSchema,
} from "@aarili/contracts";
import { hc } from "hono/client";
import type { z } from "zod";
import type { HealthRoutes } from "./index.js";
import type { createOwnerRoutes } from "./owner.js";

export {
  createDocumentClient,
  DocumentRequestError,
  requestDocumentAccess,
  requestDocumentFile,
  requestDocumentHistory,
  requestDocumentIssue,
  requestDocumentRetry,
  requestDocumentShare,
  requestDocumentStatus,
} from "./document-client.js";

export function createOwnerClient() {
  return hc<ReturnType<typeof createOwnerRoutes>>("/api");
}
export async function readAuthorizedShop(shopId: string) {
  return shopRecordSchema.parse(
    await authenticatedResult((signal) =>
      createOwnerClient().shops[":shopId"].$get(
        { param: { shopId } },
        { init: { cache: "no-store", signal } },
      ),
    ),
  );
}
export async function readGoogleConnection(signal?: AbortSignal) {
  return googleConnectionSchema.parse(
    await authenticatedResult((requestSignal) =>
      createOwnerClient().owner.google.$get(
        {},
        {
          init: {
            cache: "no-store",
            signal: signal
              ? AbortSignal.any([signal, requestSignal])
              : requestSignal,
          },
        },
      ),
    ),
  );
}
export async function disconnectOwnerGoogle() {
  const result = ownerActionSchema.parse(
    await authenticatedResult((signal) =>
      createOwnerClient().owner.google.disconnect.$post(
        {},
        { init: { signal } },
      ),
    ),
  );
  clearOwnerState();
  publishSessionChange();
  return result;
}
export async function startOwnerGoogle(link: boolean) {
  const response = await fetch(
    `/api/auth/${link ? "link-social" : "sign-in/social"}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google" }),
      cache: "no-store",
    },
  );
  const data = googleRedirectSchema.parse(await ownerResult(response));
  const destination = new URL(data.url);
  if (
    destination.origin !== "https://accounts.google.com" ||
    destination.pathname !== "/o/oauth2/v2/auth"
  )
    throw new OwnerRequestError("GOOGLE_DENIED");
  clearOwnerState();
  return data.url;
}
export class OwnerRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
let ownerGeneration = 0;
export function isOwnerGeneration(generation: number) {
  return generation === ownerGeneration;
}
const pendingOwnerRequests = new Set<AbortController>();
const invalidationListeners = new Set<() => void>();
let sessionChannel: BroadcastChannel | undefined;
export function connectOwnerSessionChanges(onRemoteChange: () => void) {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined")
    return () => {};
  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel("aarili-owner-entry");
  } catch {
    return () => {};
  }
  sessionChannel = channel;
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (event.data === "changed") onRemoteChange();
  };
  return () => {
    if (sessionChannel === channel) sessionChannel = undefined;
    channel.close();
  };
}
function publishSessionChange() {
  // No identity, shop details or credentials cross the channel. Re-read the
  // authoritative server state. The sending channel never receives itself.
  sessionChannel?.postMessage("changed");
}
export function clearOwnerState() {
  ownerGeneration++;
  for (const request of pendingOwnerRequests) request.abort();
  pendingOwnerRequests.clear();
  for (const listener of invalidationListeners) listener();
}
export function onOwnerInvalidation(listener: () => void) {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}
export async function authenticatedResult(
  run: (signal: AbortSignal) => Promise<Response>,
  parseResult: (
    response: Response,
    generation: number,
  ) => Promise<unknown> = ownerResult,
) {
  const generation = ownerGeneration;
  const request = new AbortController();
  pendingOwnerRequests.add(request);
  try {
    const response = await run(request.signal);
    if (generation !== ownerGeneration)
      throw new OwnerRequestError("UNAUTHENTICATED");
    const data = await parseResult(response, generation);
    // Abort is best effort. A late response from an old identity must be ignored
    // even if its transport delivered successfully while cancellation raced.
    if (generation !== ownerGeneration)
      throw new OwnerRequestError("UNAUTHENTICATED");
    return data;
  } finally {
    pendingOwnerRequests.delete(request);
  }
}
async function ownerResult(response: Response, generation = ownerGeneration) {
  const data: unknown = await response.json();
  // Body parsing can finish after an auth transition even when headers arrived
  // earlier. Reject the old identity before applying any invalidation effects.
  if (generation !== ownerGeneration)
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    const code = parsed.success ? parsed.data.error.code : "REQUEST_FAILED";
    if (
      response.status === 401 ||
      (response.status === 403 && code === "SHOP_ACCESS_DENIED")
    )
      clearOwnerState();
    throw new OwnerRequestError(code);
  }
  return data;
}
export async function setupOwner(
  input: z.infer<typeof setupCommandSchema>,
  token: string,
  key: string,
) {
  const parsed = setupCommandSchema.safeParse(input);
  if (!parsed.success) throw new OwnerRequestError("VALIDATION_FAILED");
  const response = await createOwnerClient().owner.setup.$post(
    { json: parsed.data },
    { headers: { "X-Setup-Token": token, "Idempotency-Key": key } },
  );
  return ownerActionSchema.parse(await ownerResult(response));
}
export async function resendOwnerVerification(
  input: z.infer<typeof resendCommandSchema>,
  token: string,
) {
  const parsed = resendCommandSchema.safeParse(input);
  if (!parsed.success) throw new OwnerRequestError("VALIDATION_FAILED");
  const response = await createOwnerClient().owner.resend.$post(
    { json: parsed.data },
    { headers: { "X-Setup-Token": token } },
  );
  return ownerActionSchema.parse(await ownerResult(response));
}
export async function verifyOwner(code: string) {
  return ownerActionSchema.parse(
    await ownerResult(
      await createOwnerClient().owner.verify.$post({ json: { code } }),
    ),
  );
}
export async function readOwnerEntry(signal?: AbortSignal) {
  return ownerEntrySchema.parse(
    await authenticatedResult((requestSignal) =>
      createOwnerClient().owner.entry.$get(
        {},
        {
          init: {
            cache: "no-store",
            signal: signal
              ? AbortSignal.any([signal, requestSignal])
              : requestSignal,
          },
        },
      ),
    ),
  );
}
export async function readOwnerShop(signal?: AbortSignal) {
  return ownerShopSchema.parse(
    await authenticatedResult((requestSignal) =>
      createOwnerClient().owner.shop.$get(
        {},
        {
          init: {
            cache: "no-store",
            signal: signal
              ? AbortSignal.any([signal, requestSignal])
              : requestSignal,
          },
        },
      ),
    ),
  );
}
export async function completeOwnerShop(
  input: { shopName: string },
  key: string,
) {
  const parsed = createOwnerShopSchema.safeParse(input);
  if (!parsed.success) throw new OwnerRequestError("VALIDATION_FAILED");
  return ownerActionSchema.parse(
    await authenticatedResult((signal) =>
      createOwnerClient().owner.complete.$post(
        { json: parsed.data },
        { headers: { "Idempotency-Key": key }, init: { signal } },
      ),
    ),
  );
}
export async function requestOwnerRecovery(email: string) {
  const parsed = recoveryRequestSchema.safeParse({ email });
  if (!parsed.success) throw new OwnerRequestError("VALIDATION_FAILED");
  return ownerActionSchema.parse(
    await ownerResult(
      await createOwnerClient().owner.recovery.request.$post({
        json: parsed.data,
      }),
    ),
  );
}
export async function resetOwnerPassword(
  input: z.infer<typeof recoveryResetSchema>,
) {
  const parsed = recoveryResetSchema.safeParse(input);
  if (!parsed.success) throw new OwnerRequestError("VALIDATION_FAILED");
  clearOwnerState();
  try {
    const result = ownerActionSchema.parse(
      await ownerResult(
        await createOwnerClient().owner.recovery.reset.$post({
          json: parsed.data,
        }),
      ),
    );
    publishSessionChange();
    return result;
  } finally {
    clearOwnerState();
  }
}
export async function reauthenticateOwner(password: string) {
  const parsed = reauthenticationSchema.safeParse({ password });
  if (!parsed.success) throw new OwnerRequestError("VALIDATION_FAILED");
  const result = await ownerResult(
    await createOwnerClient().owner.reauthenticate.$post({ json: parsed.data }),
  );
  clearOwnerState();
  publishSessionChange();
  return ownerActionSchema.parse(result);
}
export async function ownerSession(
  action: "sign-in/email" | "sign-out",
  input?: { email: string; password: string },
) {
  clearOwnerState();
  try {
    await ownerResult(
      await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input ?? {}),
      }),
    );
    publishSessionChange();
  } finally {
    // Also discard reads started while the auth transition was in flight.
    clearOwnerState();
  }
}

export function createHealthClient(baseUrl: string) {
  return hc<HealthRoutes>(baseUrl);
}
export async function readHealth(
  baseUrl: string,
  options?: Parameters<
    ReturnType<typeof createHealthClient>["api"]["healthz"]["$get"]
  >[1],
) {
  const response = await createHealthClient(baseUrl).api.healthz.$get(
    {},
    { ...options, init: { ...options?.init, cache: "no-store" } },
  );
  // External JSON is untrusted even though the RPC declarations are schema-derived.
  if (response.status === 200)
    return healthResponseSchema.parse(await response.json());
  if (response.status === 503)
    return healthUnavailableSchema.parse(await response.json());
  throw new Error("Health request failed");
}

export {
  abandonDraft,
  createDraftClient,
  DraftRequestError,
  getDraft,
  getDrafts,
  promoteDraft,
  putDraft,
} from "./draft-client.js";

export {
  completeMediaUpload,
  createMediaClient,
  MediaRequestError,
  requestMediaRead,
  requestMediaStatus,
  requestMediaUpload,
  requestMediaVariant,
} from "./media-client.js";
