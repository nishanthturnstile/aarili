import { healthResponseSchema } from "@aarili/contracts";
import { hc } from "hono/client";
import type { HealthRoutes } from "./index.js";

export function createHealthClient(baseUrl: string) {
  return hc<HealthRoutes>(baseUrl);
}
export async function readHealth(baseUrl: string) {
  const response = await createHealthClient(baseUrl).api.healthz.$get();
  if (!response.ok) throw new Error("Health check failed");
  return healthResponseSchema.parse(await response.json());
}
