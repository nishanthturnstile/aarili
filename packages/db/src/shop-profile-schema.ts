import { sql } from "drizzle-orm";
import {
  boolean,
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
import { mediaAsset } from "./media-schema.js";
import { shop, shopMembership } from "./tenant-schema.js";
// Reviewed 0020 owns FORCE/grants, audit/predecessor FKs and immutable/canonical
// guards. JSON content is validated independently in contracts/core.
export const shopProfileRevision = pgTable(
  "shop_profile_revision",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shop.shopId),
    id: uuid("id").notNull(),
    version: integer("version").notNull(),
    previousId: uuid("previous_id"),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    baseline: boolean("baseline").notNull(),
    profile: jsonb("profile").notNull(),
    logoAssetId: uuid("logo_asset_id"),
    effectiveAt: timestamp("effective_at", { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('milliseconds',clock_timestamp())`),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.version),
    foreignKey({
      columns: [t.shopId, t.actorId],
      foreignColumns: [shopMembership.shopId, shopMembership.userId],
    }),
    foreignKey({
      columns: [t.shopId, t.logoAssetId],
      foreignColumns: [mediaAsset.shopId, mediaAsset.id],
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
export const shopProfile = pgTable(
  "shop_profile",
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
      foreignColumns: [shopProfileRevision.shopId, shopProfileRevision.id],
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
