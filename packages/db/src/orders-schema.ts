import { sql } from "drizzle-orm";
import {
  bigint,
  date,
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

// Reviewed 0030 SQL owns composite FKs, FORCE RLS, exact grants and all guards.
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
export const garmentOrder = pgTable(
  "garment_order",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    codeNumber: bigint("code_number", { mode: "bigint" }).notNull(),
    code: text("code").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    wearerId: uuid("wearer_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    priceState: text("price_state").notNull(),
    pricePaise: bigint("price_paise", { mode: "bigint" }),
    version: integer("version").notNull(),
    presentation: text("presentation").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.code),
    unique().on(t.shopId, t.originDraftId),
    unique().on(t.shopId, t.codeNumber),
    ...policies(),
  ],
);
export const orderAcceptanceSnapshot = pgTable(
  "order_acceptance_snapshot",
  {
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    manifestId: uuid("manifest_id").notNull(),
    definitionId: uuid("definition_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    bindingId: uuid("binding_id").notNull(),
    ruleId: uuid("rule_id").notNull(),
    calendarId: uuid("calendar_id").notNull(),
    profileId: uuid("profile_id").notNull(),
    policiesId: uuid("policies_id").notNull(),
    presentationId: uuid("presentation_id"),
    content: jsonb("content").notNull(),
    digest: text("digest").notNull(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.orderId] }), ...policies()],
);
export const orderRequirement = pgTable(
  "order_requirement",
  {
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    position: integer("position").notNull(),
    section: text("section").notNull(),
    sourceKey: text("source_key").notNull(),
    assigneeId: uuid("assignee_id"),
    content: jsonb("content").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.orderId, t.position] }),
    unique().on(t.shopId, t.orderId, t.section, t.sourceKey),
    ...policies(),
  ],
);
export const orderCapacityDemand = pgTable(
  "order_capacity_demand",
  {
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    deliveryDate: date("delivery_date", { mode: "string" }).notNull(),
    unit: text("unit").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.orderId] }),
    index("order_capacity_bucket").on(
      t.shopId,
      t.categoryId,
      t.deliveryDate,
      t.orderId,
    ),
    ...policies(),
  ],
);
export const orderPresentationEvent = pgTable(
  "order_presentation_event",
  {
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    version: integer("version").notNull(),
    mode: text("mode").notNull(),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.orderId, t.version] }),
    ...policies(),
  ],
);

// Reviewed 0031 SQL owns composite tenant/source FKs and immutable provenance guards.
export const orderPieceSet = pgTable(
  "order_piece_set",
  {
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    version: integer("version").notNull(),
    orderVersion: integer("order_version").notNull(),
    snapshotDigest: text("snapshot_digest").notNull(),
    structureDigest: text("structure_digest").notNull(),
    content: jsonb("content").notNull(),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    commandKey: uuid("command_key").notNull(),
    reason: text("reason").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.orderId] }), ...policies()],
);
export const orderPiece = pgTable(
  "order_piece",
  {
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    id: uuid("id").notNull(),
    sourceKey: text("source_key").notNull(),
    entryId: uuid("entry_id").notNull(),
    revisionId: uuid("revision_id").notNull(),
    content: jsonb("content").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.orderId, t.id] }),
    unique().on(t.shopId, t.id),
    unique().on(t.shopId, t.orderId, t.sourceKey),
    ...policies(),
  ],
);
export const orderRequirementScope = pgTable(
  "order_requirement_scope",
  {
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    position: integer("position").notNull(),
    pieceKey: text("piece_key"),
    pieceId: uuid("piece_id"),
    addonKey: text("addon_key"),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.orderId, t.position] }),
    index("order_scope_piece").on(t.shopId, t.orderId, t.pieceId, t.position),
    ...policies(),
  ],
);
