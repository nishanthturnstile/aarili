import { sql } from "drizzle-orm";
import {
  boolean,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

// Reviewed SQL owns FORCE, grants/functions and existing bootstrap policies.
// These declarations describe the actual tenant columns and restrictive guards.
export const shop = pgTable(
  "shop",
  {
    shopId: uuid("shop_id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    isPractice: boolean("is_practice").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("tenant_context", {
      as: "restrictive",
      for: "all",
      to: "app_user",
      using: sql`shop_context_allows(${t.shopId})`,
      withCheck: sql`shop_context_allows(${t.shopId})`,
    }),
  ],
);
export const shopMembership = pgTable(
  "shop_membership",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shop.shopId),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.userId] }),
    pgPolicy("membership_identity", {
      as: "restrictive",
      for: "all",
      to: "app_user",
      using: sql`${t.userId} = NULLIF(current_setting('app.user_id', true), '')::uuid`,
      withCheck: sql`${t.userId} = NULLIF(current_setting('app.user_id', true), '')::uuid`,
    }),
  ],
);
