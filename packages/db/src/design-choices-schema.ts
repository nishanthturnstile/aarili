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

// 0042 owns composite FKs (including deferred first-publication links), FORCE RLS,
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
export const designChoicesRevision = pgTable(
  "design_config_revision",
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
export const designChoicesAvailability = pgTable(
  "design_config_availability",
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
export const designChoicesEntry = pgTable(
  "design_config_entry",
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
export const designChoicesReference = pgTable(
  "design_config_reference",
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
export const designManifestReference = pgTable(
  "design_manifest_reference",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    entryId: uuid("entry_id").notNull(),
    revisionId: uuid("revision_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.definitionId] }),
    unique().on(t.shopId, t.definitionId, t.revisionId),
    ...tenantPolicies(),
  ],
);
export const designQuestion = pgTable(
  "design_question",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    id: uuid("id").notNull(),
    position: integer("position").notNull(),
    content: jsonb("content").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.definitionId, t.id] }),
    unique().on(t.shopId, t.definitionId, t.position),
    ...tenantPolicies(),
  ],
);
export const designChoiceLink = pgTable(
  "design_choice_link",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    questionId: uuid("question_id").notNull(),
    position: integer("position").notNull(),
    entryId: uuid("entry_id").notNull(),
    revisionId: uuid("revision_id").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.shopId, t.definitionId, t.questionId, t.position],
    }),
    unique().on(
      t.shopId,
      t.definitionId,
      t.questionId,
      t.entryId,
      t.revisionId,
    ),
    ...tenantPolicies(),
  ],
);
export const designQuestionDependency = pgTable(
  "design_question_dependency",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    questionId: uuid("question_id").notNull(),
    position: integer("position").notNull(),
    parentId: uuid("parent_id").notNull(),
    entryId: uuid("entry_id").notNull(),
    revisionId: uuid("revision_id").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.shopId, t.definitionId, t.questionId, t.position],
    }),
    ...tenantPolicies(),
  ],
);
export const designTemplateLink = pgTable(
  "design_template_link",
  {
    shopId: uuid("shop_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    position: integer("position").notNull(),
    manifestId: uuid("manifest_id").notNull(),
    itemKey: text("item_key").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.definitionId, t.position] }),
    unique().on(t.shopId, t.definitionId, t.itemKey),
    ...tenantPolicies(),
  ],
);
