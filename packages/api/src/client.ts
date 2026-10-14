import {
  apiErrorSchema,
  googleConnectionSchema,
  googleRedirectSchema,
  healthResponseSchema,
  healthUnavailableSchema,
  ownerActionSchema,
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
export async function readGoogleConnection() {
  return googleConnectionSchema.parse(
    await authenticatedResult((signal) =>
      createOwnerClient().owner.google.$get(
        {},
        { init: { cache: "no-store", signal } },
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
const pendingOwnerRequests = new Set<AbortController>();
const invalidationListeners = new Set<() => void>();
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
async function authenticatedResult(
  run: (signal: AbortSignal) => Promise<Response>,
) {
  const generation = ownerGeneration;
  const request = new AbortController();
  pendingOwnerRequests.add(request);
  try {
    const response = await run(request.signal);
    if (generation !== ownerGeneration)
      throw new OwnerRequestError("UNAUTHENTICATED");
    const data = await ownerResult(response, generation);
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
    if (response.status === 401) clearOwnerState();
    throw new OwnerRequestError(
      apiErrorSchema.safeParse(data).success
        ? apiErrorSchema.parse(data).error.code
        : "REQUEST_FAILED",
    );
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
export async function readOwnerShop() {
  return ownerShopSchema.parse(
    await authenticatedResult((signal) =>
      createOwnerClient().owner.shop.$get(
        {},
        { init: { cache: "no-store", signal } },
      ),
    ),
  );
}
export async function completeOwnerShop() {
  return ownerActionSchema.parse(
    await authenticatedResult((signal) =>
      createOwnerClient().owner.complete.$post({}, { init: { signal } }),
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
    return ownerActionSchema.parse(
      await ownerResult(
        await createOwnerClient().owner.recovery.reset.$post({
          json: parsed.data,
        }),
      ),
    );
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
  return ownerActionSchema.parse(result);
}
export async function probeRecentOwner() {
  return ownerActionSchema.parse(
    await authenticatedResult((signal) =>
      createOwnerClient().owner["sensitive-probe"].$post(
        {},
        { init: { signal } },
      ),
    ),
  );
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
