import { sql } from "drizzle-orm";
import {
  foreignKey,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { durableDraft } from "./draft-schema.js";
import { shop, shopMembership } from "./tenant-schema.js";
// Reviewed 0021 owns FORCE/grants, audit/predecessor FKs and immutable/origin
// guards. JSON content is validated independently in contracts/core.
export const shopCalendarRevision = pgTable(
  "shop_calendar_revision",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shop.shopId),
    id: uuid("id").notNull(),
    version: integer("version").notNull(),
    previousId: uuid("previous_id"),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    calendar: jsonb("calendar").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('milliseconds',clock_timestamp())`),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.version),
    unique().on(t.shopId, t.originDraftId),
    foreignKey({
      columns: [t.shopId, t.actorId],
      foreignColumns: [shopMembership.shopId, shopMembership.userId],
    }),
    foreignKey({
      columns: [t.shopId, t.originDraftId],
      foreignColumns: [durableDraft.shopId, durableDraft.id],
    }),
    ...(["restrictive", "permissive"] as const).map((as) =>
      pgPolicy(as === "restrictive" ? "tenant_context" : "tenant_access", {
        as,
        for: "all",
        to: "app_user",
        using: sql`shop_context_allows(${t.shopId})`,
        withCheck: sql`shop_context_allows(${t.shopId})`,
      }),
    ),
  ],
);
export const shopCalendar = pgTable(
  "shop_calendar",
  {
    shopId: uuid("shop_id")
      .primaryKey()
      .references(() => shop.shopId),
    currentRevisionId: uuid("current_revision_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.shopId, t.currentRevisionId],
      foreignColumns: [shopCalendarRevision.shopId, shopCalendarRevision.id],
    }),
    ...(["restrictive", "permissive"] as const).map((as) =>
      pgPolicy(as === "restrictive" ? "tenant_context" : "tenant_access", {
        as,
        for: "all",
        to: "app_user",
        using: sql`shop_context_allows(${t.shopId})`,
        withCheck: sql`shop_context_allows(${t.shopId})`,
      }),
    ),
  ],
);
