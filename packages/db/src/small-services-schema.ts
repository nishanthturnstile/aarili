import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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

// Reviewed 0034 owns composite tenant/source FKs, FORCE RLS, exact grants,
// conditional custom/service constraints and immutable atomic provenance guards.
const policies = () =>
  (["restrictive", "permissive"] as const).map((as) =>
    pgPolicy(as === "restrictive" ? "tenant_context" : "tenant_access", {
      as,
      for: "all",
      to: "app_user",
      using: sql`shop_context_allows(shop_id)`,
      withCheck: sql`shop_context_allows(shop_id)`,
    }),
  );
export const serviceIntakeProfileRevision = pgTable(
  "service_intake_profile_revision",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    entryId: uuid("entry_id").notNull(),
    version: integer("version").notNull(),
    previousId: uuid("previous_id"),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    content: jsonb("content").notNull(),
    available: boolean("available").notNull(),
    reason: text("reason").notNull(),
    authority: text("authority").notNull(),
    digest: text("digest").notNull(),
    manifestId: uuid("manifest_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.entryId, t.id),
    unique().on(t.shopId, t.entryId, t.version),
    unique().on(t.shopId, t.originDraftId),
    index("service_intake_profile_manifest").on(t.shopId, t.manifestId, t.id),
    ...policies(),
  ],
);
export const serviceIntakeProfile = pgTable(
  "service_intake_profile",
  {
    shopId: uuid("shop_id").notNull(),
    entryId: uuid("entry_id").notNull(),
    currentId: uuid("current_id").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.entryId] }), ...policies()],
);
export const servicePropertySubject = pgTable(
  "service_property_subject",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    orderId: uuid("order_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    wearerId: uuid("wearer_id"),
    description: text("description").notNull(),
    propertyReference: text("property_reference").notNull(),
    intakeContext: text("intake_context").notNull(),
    sourceOrderId: uuid("source_order_id"),
    sourcePieceId: uuid("source_piece_id"),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.orderId),
    unique().on(t.shopId, t.orderId, t.id),
    index("service_subject_source").on(
      t.shopId,
      t.sourceOrderId,
      t.sourcePieceId,
    ),
    ...policies(),
  ],
);
export const serviceOrderLine = pgTable(
  "service_order_line",
  {
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    id: uuid("id").notNull(),
    position: integer("position").notNull(),
    profileRevisionId: uuid("profile_revision_id").notNull(),
    sourceKey: text("source_key").notNull(),
    pricePaise: bigint("price_paise", { mode: "bigint" }),
    state: text("state").notNull(),
    content: jsonb("content").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.orderId, t.id] }),
    unique().on(t.shopId, t.id),
    unique().on(t.shopId, t.orderId, t.sourceKey),
    unique().on(t.shopId, t.orderId, t.position),
    index("service_line_profile").on(t.shopId, t.profileRevisionId, t.orderId),
    ...policies(),
  ],
);
