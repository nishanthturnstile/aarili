import { sql } from "drizzle-orm";
import {
  boolean,
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

// 0027 owns composite FKs (including deferred first-publication links), FORCE RLS,
// exact grants and all immutable/provenance/commit guards. These describe storage.
const tenantPolicies = () =>
  (["restrictive", "permissive"] as const).map((as) =>
    pgPolicy(as === "restrictive" ? "tenant_context" : "tenant_access", {
      as,
      for: "all",
      to: "app_user",
      using: sql`shop_context_allows(shop_id)`,
      withCheck: sql`shop_context_allows(shop_id)`,
    }),
  );
// 0029 owns tenant-composite FKs, FORCE RLS and immutable promotion guards.
export const shopPresentationRevision = pgTable(
  "shop_presentation_revision",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    version: integer("version").notNull(),
    previousId: uuid("previous_id"),
    mode: text("mode").notNull(),
    reason: text("reason").notNull(),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.version),
    unique().on(t.shopId, t.originDraftId),
    ...tenantPolicies(),
  ],
);
export const shopPresentation = pgTable(
  "shop_presentation",
  {
    shopId: uuid("shop_id").notNull(),
    currentId: uuid("current_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.shopId] }), ...tenantPolicies()],
);
export const serviceTemplatesRevision = pgTable(
  "service_template_revision",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    entryId: uuid("entry_id").notNull(),
    content: jsonb("content").notNull(),
    authority: text("authority").notNull(),
    contentHash: text("content_hash").notNull(),
    searchKeys: text("search_keys").array().notNull(),
    actorId: uuid("actor_id").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.entryId, t.id),
    unique().on(t.shopId, t.originDraftId),
    ...tenantPolicies(),
  ],
);
export const serviceTemplatesAvailability = pgTable(
  "service_template_availability",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    entryId: uuid("entry_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    version: integer("version").notNull(),
    previousId: uuid("previous_id"),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    operation: text("operation").notNull(),
    available: boolean("available").notNull(),
    reason: text("reason").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('milliseconds',clock_timestamp())`),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.entryId, t.id),
    unique().on(t.shopId, t.entryId, t.version),
    unique().on(t.shopId, t.originDraftId),
    ...tenantPolicies(),
  ],
);
export const serviceTemplatesEntry = pgTable(
  "service_template_entry",
  {
    shopId: uuid("shop_id").notNull(),
    entryId: uuid("entry_id").notNull(),
    kind: text("kind").notNull(),
    code: text("code").notNull(),
    currentChangeId: uuid("current_change_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.entryId] }),
    unique().on(t.shopId, t.kind, t.code),
    ...tenantPolicies(),
  ],
);
export const serviceTemplatesReference = pgTable(
  "service_template_reference",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    role: text("role").notNull(),
    position: integer("position").notNull(),
    targetEntryId: uuid("target_entry_id").notNull(),
    targetRevisionId: uuid("target_revision_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.definitionId, t.role, t.position] }),
    unique().on(t.shopId, t.definitionId, t.targetEntryId),
    ...tenantPolicies(),
  ],
);

export const serviceTemplatesForm = pgTable(
  "service_template_form",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    position: integer("position").notNull(),
    pieceKey: text("piece_key"),
    formEntryId: uuid("form_entry_id").notNull(),
    formRevisionId: uuid("form_revision_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.definitionId, t.position] }),
    ...tenantPolicies(),
  ],
);
export const serviceTemplatesItem = pgTable(
  "service_template_item",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    section: text("section").notNull(),
    itemKey: text("item_key").notNull(),
    position: integer("position").notNull(),
    content: jsonb("content").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.definitionId, t.itemKey] }),
    unique().on(t.shopId, t.definitionId, t.section, t.position),
    ...tenantPolicies(),
  ],
);
export const serviceTemplatesEdge = pgTable(
  "service_template_edge",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    taskKey: text("task_key").notNull(),
    predecessorKey: text("predecessor_key").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.shopId, t.definitionId, t.taskKey, t.predecessorKey],
    }),
    ...tenantPolicies(),
  ],
);
export const serviceTemplatesQualityTask = pgTable(
  "service_template_quality_task",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    qualityKey: text("quality_key").notNull(),
    taskKey: text("task_key").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.shopId, t.definitionId, t.qualityKey, t.taskKey],
    }),
    ...tenantPolicies(),
  ],
);
