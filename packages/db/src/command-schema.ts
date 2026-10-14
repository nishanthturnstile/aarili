import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  uuid,
} from "drizzle-orm/pg-core";
import { shop } from "./tenant-schema.js";

// Migration 0004 owns FORCE, grants and triggers. These declarations describe
// infrastructure only; the exemplar schema remains in dev/test fixture SQL.
function provenance() {
  return {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shop.shopId),
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id").notNull(),
    action: text("action").notNull(),
  };
}
function policies(shopId: AnyPgColumn) {
  const context = sql`shop_context_allows(${shopId})`;
  return [
    pgPolicy("tenant_context", {
      as: "restrictive",
      for: "all",
      to: "app_user",
      using: context,
      withCheck: context,
    }),
    pgPolicy("tenant_access", {
      for: "all",
      to: "app_user",
      using: context,
      withCheck: context,
    }),
  ];
}
export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    ...provenance(),
    key: uuid("key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: integer("status").notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.key] }),
    index("idempotency_key_cutoff").on(t.shopId, t.createdAt, t.key),
    check(
      "idempotency_key_actor_type_check",
      sql`${t.actorType} IN ('user','system','import','support')`,
    ),
    check(
      "idempotency_key_action_check",
      sql`length(${t.action}) BETWEEN 1 AND 120`,
    ),
    check(
      "idempotency_key_request_hash_check",
      sql`${t.requestHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check("idempotency_key_status_check", sql`${t.status} BETWEEN 200 AND 299`),
    ...policies(t.shopId),
  ],
);
export const auditEvent = pgTable(
  "audit_event",
  {
    ...provenance(),
    id: uuid("id").notNull().default(sql`uuidv7()`),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    requestId: uuid("request_id").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    reason: text("reason"),
    changes: jsonb("changes").notNull(),
    sourceEventId: uuid("source_event_id"),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    index("audit_event_entity").on(
      t.shopId,
      t.entityType,
      t.entityId,
      t.occurredAt,
    ),
    foreignKey({
      columns: [t.shopId, t.sourceEventId],
      foreignColumns: [t.shopId, t.id],
    }),
    check(
      "audit_event_actor_type_check",
      sql`${t.actorType} IN ('user','system','import','support')`,
    ),
    check(
      "audit_event_action_check",
      sql`length(${t.action}) BETWEEN 1 AND 120`,
    ),
    ...policies(t.shopId),
  ],
);
