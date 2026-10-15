import {
  type CommandError,
  commandErrorSchema,
  etagSchema,
  idempotencyHeaderSchema,
  syntheticChangeSchema,
  syntheticCreateSchema,
  syntheticRecordSchema,
  syntheticSuccessSchema,
} from "@aarili/contracts/command";
import { hc } from "hono/client";
import type { z } from "zod";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createCommandRoutes } from "./commands.js";

// Explicit verification client; never exported by the normal browser entry.
export function createCommandClient(baseUrl = "/api") {
  return hc<ReturnType<typeof createCommandRoutes>>(baseUrl);
}
export class CommandRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: CommandError,
  ) {
    super(body.error.code);
  }
}
async function commandResult(response: Response, generation: number) {
  const data: unknown = await response.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!response.ok) {
    if (response.status === 401) clearOwnerState();
    throw new CommandRequestError(
      response.status,
      commandErrorSchema.parse(data),
    );
  }
  // Header is also an untrusted part of the wire contract.
  etagSchema.parse(response.headers.get("ETag"));
  return data;
}
export async function readSyntheticRecord(shopId: string, id: string) {
  return syntheticRecordSchema.parse(
    await authenticatedResult(
      (signal) =>
        createCommandClient().dev.shops[":shopId"].records[":id"].$get(
          { param: { shopId, id } },
          { init: { cache: "no-store", signal } },
        ),
      commandResult,
    ),
  );
}
export async function createSyntheticRecord(
  shopId: string,
  input: z.infer<typeof syntheticCreateSchema>,
  key: string,
) {
  return syntheticSuccessSchema.parse(
    await authenticatedResult(
      (signal) =>
        createCommandClient().dev.shops[":shopId"].records.$post(
          {
            param: { shopId },
            json: syntheticCreateSchema.parse(input),
            header: { "idempotency-key": idempotencyHeaderSchema.parse(key) },
          },
          { init: { cache: "no-store", signal } },
        ),
      commandResult,
    ),
  );
}
export async function changeSyntheticRecord(
  shopId: string,
  id: string,
  input: z.infer<typeof syntheticChangeSchema>,
  key: string,
  ifMatch: string,
) {
  return syntheticSuccessSchema.parse(
    await authenticatedResult(
      (signal) =>
        createCommandClient().dev.shops[":shopId"].records[":id"].$patch(
          {
            param: { shopId, id },
            json: syntheticChangeSchema.parse(input),
            header: {
              "idempotency-key": idempotencyHeaderSchema.parse(key),
              "if-match": etagSchema.parse(ifMatch),
            },
          },
          { init: { cache: "no-store", signal } },
        ),
      commandResult,
    ),
  );
}
