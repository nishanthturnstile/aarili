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
  uniqueIndex,
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
// Reviewed 0033 owns the composite FKs, FORCE policies and immutable guards.
export const bookingCommercialRevision = pgTable(
  "booking_commercial_revision",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    version: integer("version").notNull(),
    basis: text("basis").notNull(),
    packagePaise: bigint("package_paise", { mode: "bigint" }),
    allocation: text("allocation").notNull(),
    scope: jsonb("scope").notNull(),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    reason: text("reason").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.bookingId),
    unique().on(t.shopId, t.originDraftId),
    ...policies(),
  ],
);
export const orderDraftConversion = pgTable(
  "order_draft_conversion",
  {
    shopId: uuid("shop_id").notNull(),
    sourceDraftId: uuid("source_draft_id").notNull(),
    targetDraftId: uuid("target_draft_id").notNull(),
    lineId: uuid("line_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    commandKey: uuid("command_key").notNull(),
    requestId: uuid("request_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.sourceDraftId] }),
    unique().on(t.shopId, t.targetDraftId),
    ...policies(),
  ],
);
export const garmentOrder = pgTable(
  "garment_order",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    codeNumber: bigint("code_number", { mode: "bigint" }).notNull(),
    code: text("code").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    originLineId: uuid("origin_line_id"),
    customerId: uuid("customer_id").notNull(),
    wearerId: uuid("wearer_id"),
    intakeKind: text("intake_kind").notNull(),
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
    uniqueIndex("garment_order_single_origin")
      .on(t.shopId, t.originDraftId)
      .where(sql`${t.originLineId} is null`),
    uniqueIndex("garment_order_group_origin")
      .on(t.shopId, t.originDraftId, t.originLineId)
      .where(sql`${t.originLineId} is not null`),
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

// 0032 reviewed SQL owns composite FKs, append-only guards and atomic completion.
export const booking = pgTable(
  "booking",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    codeNumber: bigint("code_number", { mode: "bigint" }).notNull(),
    code: text("code").notNull(),
    customerId: uuid("customer_id").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    version: integer("version").notNull(),
    currentRevisionId: uuid("current_revision_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.code),
    unique().on(t.shopId, t.codeNumber),
    unique().on(t.shopId, t.originDraftId),
    ...policies(),
  ],
);
export const bookingRevision = pgTable(
  "booking_revision",
  {
    shopId: uuid("shop_id").notNull(),
    id: uuid("id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    version: integer("version").notNull(),
    originDraftId: uuid("origin_draft_id").notNull(),
    context: jsonb("context").notNull(),
    sources: jsonb("sources").notNull(),
    payerId: uuid("payer_id"),
    actorId: uuid("actor_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    reason: text("reason").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.id] }),
    unique().on(t.shopId, t.bookingId, t.version),
    unique().on(t.shopId, t.bookingId, t.id),
    unique().on(t.shopId, t.originDraftId),
    ...policies(),
  ],
);
export const bookingMember = pgTable(
  "booking_member",
  {
    shopId: uuid("shop_id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    orderId: uuid("order_id").notNull(),
    sourceVersion: integer("source_version").notNull(),
    sourceDigest: text("source_digest").notNull(),
    revisionId: uuid("revision_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.orderId] }),
    unique().on(t.shopId, t.bookingId, t.orderId),
    index().on(t.shopId, t.bookingId, t.orderId),
    ...policies(),
  ],
);
export const bookingMembershipHistory = pgTable(
  "booking_membership_history",
  {
    shopId: uuid("shop_id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    orderId: uuid("order_id").notNull(),
    revisionId: uuid("revision_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.bookingId, t.orderId] }),
    ...policies(),
  ],
);
