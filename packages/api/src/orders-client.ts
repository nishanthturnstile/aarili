import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  type QuickOrderDraft,
  quickOrderPreviewSchema,
} from "@aarili/contracts/orders";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createOrderRoutes } from "./orders.js";

const client = () => hc<ReturnType<typeof createOrderRoutes>>("/api");
export async function previewQuickOrder(
  shopId: string,
  input: QuickOrderDraft,
  external?: AbortSignal,
) {
  return quickOrderPreviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].orders["intake-preview"].$post(
          { param: { shopId }, json: input },
          {
            init: {
              cache: "no-store",
              signal: external ? AbortSignal.any([s, external]) : s,
            },
          },
        ),
      async (r, generation) => {
        const data: unknown = await r.json();
        if (!isOwnerGeneration(generation))
          throw new OwnerRequestError("UNAUTHENTICATED");
        if (!r.ok) {
          const e = draftErrorSchema.safeParse(data);
          const code = e.success ? e.data.error.code : "REQUEST_FAILED";
          if (
            r.status === 401 ||
            (r.status === 403 && code === "SHOP_ACCESS_DENIED")
          )
            clearOwnerState();
          throw new OwnerRequestError(code);
        }
        return data;
      },
    ),
  );
}
