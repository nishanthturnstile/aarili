import {
  apiErrorSchema,
  healthResponseSchema,
  healthUnavailableSchema,
  ownerActionSchema,
  ownerShopSchema,
  resendCommandSchema,
  setupCommandSchema,
} from "@aarili/contracts";
import { hc } from "hono/client";
import type { z } from "zod";
import type { HealthRoutes } from "./index.js";
import type { createOwnerRoutes } from "./owner.js";

export function createOwnerClient() {
  return hc<ReturnType<typeof createOwnerRoutes>>("/api");
}
export class OwnerRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
async function ownerResult(response: Response) {
  const data: unknown = await response.json();
  if (!response.ok)
    throw new OwnerRequestError(
      apiErrorSchema.safeParse(data).success
        ? apiErrorSchema.parse(data).error.code
        : "REQUEST_FAILED",
    );
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
    await ownerResult(
      await createOwnerClient().owner.shop.$get(
        {},
        { init: { cache: "no-store" } },
      ),
    ),
  );
}
export async function completeOwnerShop() {
  return ownerActionSchema.parse(
    await ownerResult(await createOwnerClient().owner.complete.$post()),
  );
}
export async function ownerSession(
  action: "sign-in/email" | "sign-out",
  input?: { email: string; password: string },
) {
  await ownerResult(
    await fetch(`/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    }),
  );
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
