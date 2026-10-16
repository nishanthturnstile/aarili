import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { shop, shopMembership } from "./tenant-schema.js";
// Reviewed 0012 owns FORCE/grants, lifecycle checks, circular attempt FK and
// immutable-history triggers. Declarations describe the concrete tenant columns.
export const mediaAsset = pgTable(
  "media_asset",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shop.shopId),
    id: uuid("id").notNull(),
    creatorId: uuid("creator_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    purpose: text("purpose").notNull(),
    minor: boolean("minor").notNull(),
    visibility: text("visibility").notNull().default("private"),
    contentType: text("content_type").notNull(),
    declaredBytes: integer("declared_bytes").notNull(),
    status: text("status").notNull().default("pending_upload"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('milliseconds',clock_timestamp())`),
    stagingExpiresAt: timestamp("staging_expires_at", {
      withTimezone: true,
    }).notNull(),
    stagingKey: text("staging_key").notNull(),
    acceptedKey: text("accepted_key"),
    sha256: text("sha256"),
    acceptedBytes: integer("accepted_bytes"),
    attemptId: uuid("attempt_id"),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    foreignKey({
      columns: [t.shopId, t.creatorId],
      foreignColumns: [shopMembership.shopId, shopMembership.userId],
    }),
    unique().on(t.shopId, t.stagingKey),
    unique().on(t.shopId, t.acceptedKey),
    index("media_asset_staging_expiry").on(
      t.shopId,
      t.status,
      t.stagingExpiresAt,
      t.id,
    ),
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
export const mediaAttempt = pgTable(
  "media_attempt",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    assetId: uuid("asset_id").notNull(),
    initiatorId: uuid("initiator_id").notNull(),
    restoreEpoch: uuid("restore_epoch").notNull(),
    state: text("state").notNull(),
    fence: uuid("fence"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.assetId),
    unique().on(t.shopId, t.id, t.assetId),
    foreignKey({
      columns: [t.shopId, t.assetId],
      foreignColumns: [mediaAsset.shopId, mediaAsset.id],
    }),
    foreignKey({
      columns: [t.shopId, t.initiatorId],
      foreignColumns: [shopMembership.shopId, shopMembership.userId],
    }),
    index("media_attempt_work").on(t.shopId, t.state, t.leaseUntil, t.id),
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
export const mediaReference = pgTable(
  "media_reference",
  {
    shopId: uuid("shop_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    referenceId: uuid("reference_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.assetId, t.referenceId] }),
    foreignKey({
      columns: [t.shopId, t.assetId],
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
// 0013 additionally seals inserts to the exact accepting transaction and
// denies later updates/deletes, including privileged accidental rewrites.
export const mediaDerivative = pgTable(
  "media_derivative",
  {
    shopId: uuid("shop_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    variant: text("variant").notNull(),
    objectKey: text("object_key").notNull(),
    sha256: text("sha256").notNull(),
    acceptedBytes: integer("accepted_bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    contentType: text("content_type").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.assetId, t.variant] }),
    unique().on(t.shopId, t.objectKey),
    foreignKey({
      columns: [t.shopId, t.assetId],
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
export const mediaCleanupIntent = pgTable(
  "media_cleanup_intent",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    assetId: uuid("asset_id").notNull(),
    objectKey: text("object_key").notNull(),
    claimFence: uuid("claim_fence").notNull(),
    restoreEpoch: uuid("restore_epoch").notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completionActionId: uuid("completion_action_id"),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.assetId, t.objectKey, t.restoreEpoch),
    foreignKey({
      columns: [t.shopId, t.assetId],
      foreignColumns: [mediaAsset.shopId, mediaAsset.id],
    }),
    foreignKey({
      columns: [t.shopId, t.actorId],
      foreignColumns: [shopMembership.shopId, shopMembership.userId],
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
