/// <reference path="../node_modules/bun-types/sqlite.d.ts" />
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { setupCommandSchema } from "@aarili/contracts";
import {
  createDatabase,
  type Database,
  requireRuntimeRole,
  sql,
  type Transaction,
  withShop,
} from "@aarili/db";
import * as schema from "@aarili/db/auth-schema";
import { createAbuseLimiter } from "@aarili/platform/abuse-limiter";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { v7 } from "uuid";

// Owner approved on 13 October 2026. Tests may inject short boundaries without
// changing the approved deployment policy. No live transport in this slice.
const approvedPolicy = {
  passwordMin: 15,
  passwordMax: 128,
  sessionSeconds: 43200,
  updateSeconds: 3600,
  verificationSeconds: 1800,
  signInMax: 5,
  signInWindow: 60,
  setupMax: 3,
  setupWindow: 300,
};
type Policy = typeof approvedPolicy;
export type AuthConfiguration = {
  connectionString: string;
  origin: string;
  secret: string;
  setupToken: string;
  capture: (message: { email: string; code: string }) => Promise<void>;
  policy?: Policy;
  // Injection point for rollback evidence; runtime never configures it.
  checkpoint?: (
    step: "identity" | "credential" | "reservation" | "verified" | "shop",
  ) => Promise<void>;
};
type BootstrapRow = {
  user_id: string | null;
  completed_at: Date | null;
  shop_id: string | null;
  admission_key: string | null;
  request_hash: string | null;
};
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class OwnerAccessError extends Error {
  constructor(
    public readonly code:
      | "SETUP_CLOSED"
      | "INVALID_CREDENTIALS"
      | "INVALID_VERIFICATION"
      | "MAIL_UNAVAILABLE"
      | "UNAUTHENTICATED"
      | "REQUEST_CONFLICT",
  ) {
    super(code);
  }
}

export type OwnerAuth = {
  auth: { handler: (request: Request) => Promise<Response> };
  admit: (
    input: { name: string; email: string; password: string; shopName: string },
    token: string,
    key: string,
  ) => Promise<void>;
  resend: (email: string, password: string, token: string) => Promise<void>;
  verify: (code: string) => Promise<void>;
  complete: (headers: Headers) => Promise<{ shopId: string }>;
  ownerShop: (
    headers: Headers,
  ) => Promise<
    | { state: "pending-shop" }
    | { state: "complete"; shopId: string; name: string }
  >;
  setupLimit: () => Promise<number>;
  resendLimit: () => Promise<number>;
  verifyLimit: () => Promise<number>;
  origin: string;
  close: () => Promise<void>;
};
export function createOwnerAuth(configuration: AuthConfiguration): OwnerAuth {
  const origin = new URL(configuration.origin);
  if (
    origin.origin !== configuration.origin ||
    !["http:", "https:"].includes(origin.protocol) ||
    configuration.origin.includes("*")
  )
    throw new Error("Exact auth origin required");
  if (
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
  )
    throw new Error("HTTP is loopback-only");
  if (configuration.secret.length < 32) throw new Error("Auth secret required");
  const policy = configuration.policy ?? approvedPolicy;
  const { db, pool } = createDatabase(configuration.connectionString);
  let runtimeReady: Promise<void> | undefined;
  async function ready() {
    runtimeReady ??= requireRuntimeRole(db).catch(() => {
      runtimeReady = undefined;
      throw new Error("Runtime database unavailable");
    });
    await runtimeReady;
  }
  async function guard<T>(action: () => Promise<T>): Promise<T> {
    await ready();
    return action();
  }
  function library(database: Database | Transaction) {
    return betterAuth({
      appName: "Aarili",
      baseURL: configuration.origin,
      basePath: "/api/auth",
      secret: configuration.secret,
      database: drizzleAdapter(database, {
        provider: "pg",
        schema,
        transaction: true,
      }),
      trustedOrigins: [configuration.origin],
      emailAndPassword: {
        enabled: true,
        disableSignUp: true,
        requireEmailVerification: true,
        minPasswordLength: policy.passwordMin,
        maxPasswordLength: policy.passwordMax,
      },
      session: {
        expiresIn: policy.sessionSeconds,
        updateAge: policy.updateSeconds,
        cookieCache: { enabled: false },
      },
      account: { accountLinking: { enabled: false } },
      rateLimit: {
        enabled: true,
        storage: "database",
        window: policy.signInWindow,
        max: policy.signInMax,
        customRules: {
          "/sign-in/email": {
            window: policy.signInWindow,
            max: policy.signInMax,
          },
        },
      },
      advanced: {
        disableCSRFCheck: false,
        disableOriginCheck: false,
        useSecureCookies: origin.protocol === "https:",
        defaultCookieAttributes: {
          httpOnly: true,
          sameSite: "lax",
          secure: origin.protocol === "https:",
        },
        database: { generateId: () => v7() },
        ipAddress: { ipAddressHeaders: [], disableIpTracking: false },
      },
      logger: { disabled: true },
    });
  }
  const auth = library(db);
  const setupLimit = createAbuseLimiter(
    pool,
    policy.setupMax,
    policy.setupWindow,
    "owner-setup",
  );
  const resendLimit = createAbuseLimiter(
    pool,
    policy.setupMax,
    policy.setupWindow,
    "owner-resend",
  );
  const verifyLimit = createAbuseLimiter(
    pool,
    policy.signInMax,
    policy.signInWindow,
    "owner-verify",
  );
  const checkpoint = configuration.checkpoint ?? (async () => {});
  async function state(tx: Database | Transaction = db) {
    const result = await tx.execute(
      sql`select user_id, completed_at, shop_id, admission_key, request_hash from owner_bootstrap where singleton`,
    );
    return result.rows[0] as BootstrapRow;
  }
  function requireToken(token: string) {
    if (
      configuration.setupToken.length < 32 ||
      !timingSafeEqual(
        Buffer.from(digest(token)),
        Buffer.from(digest(configuration.setupToken)),
      )
    )
      throw new OwnerAccessError("SETUP_CLOSED");
  }
  async function captureVerification(userId: string, email: string) {
    const code = randomBytes(32).toString("base64url");
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(120022)`);
      if ((await state(tx)).completed_at)
        throw new OwnerAccessError("SETUP_CLOSED");
      // Multiple deliveries may be pending; every code is consumed atomically and
      // verification of the identity makes all outstanding codes unusable.
      await tx.execute(
        sql`insert into owner_verification(token_hash,user_id,expires_at) values(${digest(code)},${userId}::uuid,now() + ${policy.verificationSeconds} * interval '1 second')`,
      );
    });
    try {
      await configuration.capture({ email, code });
    } catch {
      throw new OwnerAccessError("MAIL_UNAVAILABLE");
    }
  }
  async function admit(
    input: { name: string; email: string; password: string; shopName: string },
    token: string,
    key: string,
  ) {
    requireToken(token);
    await ready();
    input = setupCommandSchema.parse(input);
    const requestHash = createHmac("sha256", configuration.secret)
      .update(JSON.stringify(input))
      .digest("hex");
    const password = await (await auth.$context).password.hash(input.password);
    const userId = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(120022)`);
      const pending = await state(tx);
      if (pending.completed_at) throw new OwnerAccessError("SETUP_CLOSED");
      if (pending.user_id) {
        if (
          pending.admission_key === key &&
          pending.request_hash === requestHash
        )
          return pending.user_id;
        throw new OwnerAccessError(
          pending.admission_key === key ? "REQUEST_CONFLICT" : "SETUP_CLOSED",
        );
      }
      const existing = await tx.execute(sql`select 1 from auth_user limit 1`);
      if (existing.rowCount) throw new OwnerAccessError("SETUP_CLOSED");
      // A fresh adapter is explicitly bound to tx. No public signup, admin plugin
      // or after-hook is involved; injected failures prove these writes rollback.
      const ctx = await library(tx).$context;
      const owner = await ctx.internalAdapter.createUser(
        { name: input.name, email: input.email, emailVerified: false },
        { method: "email" },
      );
      await checkpoint("identity");
      await ctx.internalAdapter.linkAccount({
        accountId: owner.id,
        providerId: "credential",
        userId: owner.id,
        password,
      });
      await checkpoint("credential");
      await tx.execute(
        sql`update owner_bootstrap set user_id=${owner.id}::uuid,shop_name=${input.shopName},admission_key=${key},request_hash=${requestHash},reserved_at=now() where singleton`,
      );
      await checkpoint("reservation");
      return owner.id;
    });
    await captureVerification(userId, input.email);
  }
  async function resend(email: string, password: string, token: string) {
    requireToken(token);
    await ready();
    const pending = await state();
    const ctx = await auth.$context;
    const found = await ctx.internalAdapter.findUserByEmail(email, {
      includeAccounts: true,
    });
    const credential = found?.accounts.find(
      (a) => a.providerId === "credential",
    );
    const valid =
      credential?.password &&
      (await ctx.password.verify({ hash: credential.password, password }));
    if (
      !found ||
      !valid ||
      found.user.id !== pending.user_id ||
      found.user.emailVerified ||
      pending.completed_at
    )
      throw new OwnerAccessError("INVALID_CREDENTIALS");
    await captureVerification(found.user.id, found.user.email);
  }
  async function verify(code: string) {
    await ready();
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(120022)`);
      const result = await tx.execute(
        sql`select user_id from owner_verification where token_hash=${digest(code)} and consumed_at is null and expires_at>now() for update`,
      );
      const userId = result.rows[0]?.user_id as string | undefined;
      const pending = await state(tx);
      if (!userId || pending.user_id !== userId || pending.completed_at)
        throw new OwnerAccessError("INVALID_VERIFICATION");
      const ctx = await library(tx).$context;
      const existing = await ctx.internalAdapter.findUserById(userId);
      if (!existing || existing.emailVerified)
        throw new OwnerAccessError("INVALID_VERIFICATION");
      await ctx.internalAdapter.updateUser(userId, { emailVerified: true });
      await tx.execute(
        sql`update owner_verification set consumed_at=now() where user_id=${userId}::uuid and consumed_at is null`,
      );
      await checkpoint("verified");
    });
  }
  async function identity(headers: Headers) {
    await ready();
    const resolved = await auth.api.getSession({ headers });
    if (
      !resolved?.user.emailVerified ||
      resolved.user.id !== (await state()).user_id
    )
      throw new OwnerAccessError("UNAUTHENTICATED");
    return resolved.user.id;
  }
  async function complete(headers: Headers) {
    const userId = await identity(headers);
    return db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`select complete_owner_bootstrap(${userId}::uuid) as shop_id`,
      );
      await checkpoint("shop");
      return { shopId: result.rows[0]?.shop_id as string };
    });
  }
  async function ownerShop(headers: Headers) {
    const userId = await identity(headers);
    const pending = await state();
    if (!pending.shop_id) return { state: "pending-shop" as const };
    return withShop(db, userId, pending.shop_id, async (tx) => {
      const result = await tx.execute(
        sql`select shop_id, name from shop where shop_id=${pending.shop_id}::uuid`,
      );
      if (!result.rowCount) throw new OwnerAccessError("UNAUTHENTICATED");
      return {
        state: "complete" as const,
        shopId: result.rows[0]?.shop_id as string,
        name: result.rows[0]?.name as string,
      };
    });
  }
  return {
    auth: { handler: (request) => guard(() => auth.handler(request)) },
    admit,
    resend,
    verify,
    complete,
    ownerShop,
    setupLimit: () => guard(setupLimit),
    resendLimit: () => guard(resendLimit),
    verifyLimit: () => guard(verifyLimit),
    origin: configuration.origin,
    close: () => pool.end(),
  };
}

export function ownerAuthFromEnvironment(
  env: Record<string, string | undefined>,
): OwnerAuth | undefined {
  if (env.AARILI_SYNTHETIC_AUTH !== "true") return undefined;
  const {
    DATABASE_URL,
    AUTH_ORIGIN,
    BETTER_AUTH_SECRET,
    SETUP_TOKEN,
    AUTH_CAPTURE_DIRECTORY,
  } = env;
  if (
    !DATABASE_URL ||
    !AUTH_ORIGIN ||
    !BETTER_AUTH_SECRET ||
    !AUTH_CAPTURE_DIRECTORY ||
    !isAbsolute(AUTH_CAPTURE_DIRECTORY)
  )
    throw new Error("Synthetic auth configuration missing");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(AUTH_ORIGIN).hostname)
  )
    throw new Error("Synthetic auth is loopback-only");
  return createOwnerAuth({
    connectionString: DATABASE_URL,
    origin: AUTH_ORIGIN,
    secret: BETTER_AUTH_SECRET,
    setupToken: SETUP_TOKEN ?? "",
    capture: async (message) => {
      await mkdir(AUTH_CAPTURE_DIRECTORY, { recursive: true, mode: 0o700 });
      await writeFile(
        join(AUTH_CAPTURE_DIRECTORY, `${randomBytes(16).toString("hex")}.json`),
        JSON.stringify(message),
        { flag: "wx", mode: 0o600 },
      );
    },
  });
}
