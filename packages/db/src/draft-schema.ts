import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { shop, shopMembership } from "./tenant-schema.js";
// Reviewed migration 0011 owns FORCE, grants and lifecycle/provenance trigger.
export const durableDraft = pgTable(
  "durable_draft",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shop.shopId),
    id: uuid("id").notNull(),
    workflow: text("workflow").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    creatorId: uuid("creator_id").notNull(),
    lifecycle: text("lifecycle").notNull(),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('milliseconds',clock_timestamp())`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('milliseconds',clock_timestamp())`),
    resultType: text("result_type"),
    resultId: uuid("result_id"),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    foreignKey({
      columns: [t.shopId, t.creatorId],
      foreignColumns: [shopMembership.shopId, shopMembership.userId],
    }),
    index("durable_draft_resume").on(t.shopId, t.lifecycle, t.createdAt, t.id),
    unique().on(t.shopId, t.resultType, t.resultId),
    check("durable_draft_version_check", sql`${t.version}>0`),
    check("durable_draft_schema_version_check", sql`${t.schemaVersion}>0`),
    check(
      "durable_draft_lifecycle_check",
      sql`${t.lifecycle} IN ('active','promoted','abandoned')`,
    ),
    check(
      "durable_draft_workflow_check",
      sql`${t.workflow} ~ '^[a-z][a-z0-9.-]{0,79}$'`,
    ),
    check(
      "durable_draft_payload_check",
      sql`jsonb_typeof(${t.payload})='object'`,
    ),
    check(
      "durable_draft_id_check",
      sql`substring(${t.id}::text from 15 for 1)='7'`,
    ),
    check(
      "durable_draft_result_check",
      sql`(${t.lifecycle}='promoted' AND ${t.resultType} IS NOT NULL AND ${t.resultId} IS NOT NULL) OR (${t.lifecycle}<>'promoted' AND ${t.resultType} IS NULL AND ${t.resultId} IS NULL)`,
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
