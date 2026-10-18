import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  calendarPreviewSchema,
  type ShopCalendarDraft,
  shopCalendarHistorySchema,
  shopCalendarRevisionSchema,
  shopCalendarStateSchema,
} from "@aarili/contracts/shop-calendar";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createShopCalendarRoutes } from "./shop-calendar.js";

const client = () => hc<ReturnType<typeof createShopCalendarRoutes>>("/api");
export async function previewShopCalendar(
  shopId: string,
  draft: ShopCalendarDraft,
  date: string,
) {
  return calendarPreviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.calendar.preview.$post(
          { param: { shopId }, json: { draft, date } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const e = draftErrorSchema.safeParse(data);
    const code = e.success ? e.data.error.code : "REQUEST_FAILED";
    if (r.status === 401 || (r.status === 403 && code === "SHOP_ACCESS_DENIED"))
      clearOwnerState();
    throw new OwnerRequestError(code);
  }
  const state = shopCalendarStateSchema.safeParse(data);
  if (state.success && r.headers.get("ETag") !== `"v${state.data.version}"`)
    throw new OwnerRequestError("INVALID_RESPONSE");
  return data;
}
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function readShopCalendar(shopId: string) {
  return shopCalendarStateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.calendar.$get(
          { param: { shopId } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readShopCalendarHistory(
  shopId: string,
  beforeVersion?: number,
) {
  return shopCalendarHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.calendar.history.$post(
          {
            param: { shopId },
            json: beforeVersion === undefined ? {} : { beforeVersion },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}

export async function readShopCalendarRevision(shopId: string, id: string) {
  return shopCalendarRevisionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.calendar.revisions[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
