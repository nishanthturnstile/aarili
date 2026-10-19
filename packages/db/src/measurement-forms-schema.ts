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

// 0025 owns composite FKs (including deferred first-publication links), FORCE RLS,
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
export const measurementFormsRevision = pgTable(
  "measurement_form_revision",
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
export const measurementFormsAvailability = pgTable(
  "measurement_form_availability",
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
export const measurementFormsEntry = pgTable(
  "measurement_form_entry",
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
export const measurementFormsReference = pgTable(
  "measurement_form_reference",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    role: text("role").notNull(),
    position: integer("position").notNull(),
    targetEntryId: uuid("target_entry_id").notNull(),
    targetRevisionId: uuid("target_revision_id").notNull(),
    optional: boolean("optional").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.definitionId, t.role, t.position] }),
    unique().on(t.shopId, t.definitionId, t.targetEntryId),
    ...tenantPolicies(),
  ],
);

export const measurementFormsIllustration = pgTable(
  "measurement_form_illustration",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    fieldId: uuid("field_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    assetVersion: integer("asset_version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.definitionId, t.fieldId] }),
    ...tenantPolicies(),
  ],
);
