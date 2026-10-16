import { sql } from "drizzle-orm";
import {
  bigint,
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { auditEvent } from "./command-schema.js";
import { shop } from "./tenant-schema.js";
// Reviewed 0010 owns field checks, FORCE RLS, grants and immutable provenance.
export const productEvent = pgTable(
  "product_event",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shop.shopId),
    actionId: uuid("action_id").notNull(),
    name: text("name").notNull(),
    subjectId: uuid("subject_id").notNull(),
    schemaVersion: integer("schema_version"),
    bytes: bigint("bytes", { mode: "bigint" }),
    category: text("category"),
    durationSeconds: integer("duration_seconds"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.actionId] }),
    foreignKey({
      columns: [t.shopId, t.actionId],
      foreignColumns: [auditEvent.shopId, auditEvent.id],
    }),
    index("product_event_period").on(t.shopId, t.occurredAt, t.actionId),
    index("product_event_subject").on(
      t.shopId,
      t.name,
      t.subjectId,
      t.occurredAt,
    ),
    pgPolicy("tenant_context", {
      as: "restrictive",
      for: "all",
      to: "app_user",
      using: sql`shop_context_allows(${t.shopId})`,
      withCheck: sql`shop_context_allows(${t.shopId})`,
    }),
    pgPolicy("tenant_access", {
      for: "all",
      to: "app_user",
      using: sql`shop_context_allows(${t.shopId})`,
      withCheck: sql`shop_context_allows(${t.shopId})`,
    }),
  ],
);
