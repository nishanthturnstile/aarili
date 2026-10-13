import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
const id = () => uuid("id").primaryKey().default(sql`uuidv7()`);

// Better Auth identity/session tables are the architecture §8.2 exception.
export const user = pgTable("auth_user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: instant("created_at"),
  updatedAt: instant("updated_at"),
});
export const account = pgTable(
  "auth_account",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: instant("created_at"),
    updatedAt: instant("updated_at"),
  },
  (t) => [
    uniqueIndex("auth_account_provider_unique").on(t.providerId, t.accountId),
  ],
);
export const session = pgTable("auth_session", {
  id: id(),
  expiresAt: instant("expires_at"),
  token: text("token").notNull().unique(),
  createdAt: instant("created_at"),
  updatedAt: instant("updated_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
});
export const verification = pgTable("auth_verification", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: instant("expires_at"),
  createdAt: instant("created_at"),
  updatedAt: instant("updated_at"),
});
export const rateLimit = pgTable("auth_rate_limit", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
