import { sql } from "drizzle-orm";
import {
  foreignKey,
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
import { durableDraft } from "./draft-schema.js";
import { shop, shopMembership } from "./tenant-schema.js";

// 0028 owns source-composite FKs, FORCE RLS, immutable provenance and deferred
// draft/pointer commit guards. These additive descriptors never alter 0024.
const bindingPolicies = () =>
  (["restrictive", "permissive"] as const).map((as) =>
    pgPolicy(as === "restrictive" ? "tenant_context" : "tenant_access", {
      as,
      for: "all",
      to: "app_user",
      using: sql`shop_context_allows(shop_id)`,
      withCheck: sql`shop_context_allows(shop_id)`,
    }),
  );
export const serviceCommitmentBindingRevision = pgTable(
  "service_commitment_binding_revision",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    categoryId: uuid("category_id").notNull(),
    categoryRevisionId: uuid("category_revision_id").notNull(),
    availabilityId: uuid("availability_id").notNull(),
    ruleRevisionId: uuid("rule_revision_id").notNull(),
    baseVersion: integer("base_version").notNull(),
    version: integer("version").notNull(),
    previousId: uuid("previous_id"),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    review: text("review").notNull(),
    reason: text("reason").notNull(),
    authority: text("authority").notNull(),
    digest: text("digest").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('milliseconds',clock_timestamp())`),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.categoryId, t.id),
    unique().on(t.shopId, t.categoryId, t.version),
    unique().on(t.shopId, t.originDraftId),
    ...bindingPolicies(),
  ],
);
export const serviceCommitmentBinding = pgTable(
  "service_commitment_binding",
  {
    shopId: uuid("shop_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    currentRevisionId: uuid("current_revision_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.categoryId] }),
    ...bindingPolicies(),
  ],
);
// Reviewed 0024 owns FORCE/grants, audit/predecessor FKs and immutable/origin
// guards. JSON content is validated independently in contracts/core.
export const shopCommitmentsRevision = pgTable(
  "shop_commitments_revision",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shop.shopId),
    id: uuid("id").notNull(),
    version: integer("version").notNull(),
    previousId: uuid("previous_id"),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    authorityScope: text("authority_scope")
      .notNull()
      .default("unbound-preview"),
    configuration: jsonb("configuration").notNull(),
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
export const shopCommitments = pgTable(
  "shop_commitments",
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
      foreignColumns: [
        shopCommitmentsRevision.shopId,
        shopCommitmentsRevision.id,
      ],
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
