import {
  healthResponseSchema,
  healthUnavailableSchema,
} from "@aarili/contracts";
import { hc } from "hono/client";
import type { HealthRoutes } from "./index.js";

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
