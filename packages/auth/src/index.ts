/// <reference path="../node_modules/bun-types/sqlite.d.ts" />
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import {
  googleDisconnectSchema,
  googleEntrySchema,
  recoveryResetSchema,
  setupCommandSchema,
} from "@aarili/contracts";
import { readShop } from "@aarili/core";
import type { CommandContext } from "@aarili/core/commands";
import {
  createDatabase,
  type Database,
  requireRuntimeRole,
  ShopAccessError,
  sql,
  type Transaction,
  withShop,
} from "@aarili/db";
import * as schema from "@aarili/db/auth-schema";
import { commandRepository } from "@aarili/db/command-repository";
import type { ShopRepository } from "@aarili/db/repositories/shop";
import { shopRepository } from "@aarili/db/shop-repository";
import { createAbuseLimiter } from "@aarili/platform/abuse-limiter";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  addOAuthServerContext,
  createAuthMiddleware,
  getOAuthState,
} from "better-auth/api";
import { v7 } from "uuid";
import {
  type GoogleConfiguration,
  googleFromEnvironment,
  validateGoogle,
} from "./google.js";

export { googleFromEnvironment } from "./google.js";

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
  resetSeconds: 1800,
  freshSeconds: 300,
  recoveryMax: 3,
  recoveryWindow: 300,
  redemptionMax: 5,
  redemptionWindow: 60,
  reauthMax: 5,
  reauthWindow: 60,
};
type Policy = typeof approvedPolicy;
export type AuthConfiguration = {
  connectionString: string;
  origin: string;
  secret: string;
  setupToken: string;
  capture: (message: {
    email: string;
    code: string;
    purpose?: "reset";
  }) => Promise<void>;
  policy?: Partial<Policy>;
  now?: () => Date;
  google?: GoogleConfiguration | undefined;
  // Injection point for rollback evidence; runtime never configures it.
  checkpoint?: (
    step:
      | "identity"
      | "credential"
      | "reservation"
      | "verified"
      | "shop"
      | "reset"
      | "reauthenticated"
      | "google-written"
      | "google-state-consumed",
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
      | "AUTHENTICATION_STALE"
      | "INVALID_RESET"
      | "REQUEST_CONFLICT"
      | "GOOGLE_DENIED"
      | "GOOGLE_UNAVAILABLE"
      | "SHOP_ACCESS_DENIED",
  ) {
    super(code);
  }
}

type SessionResult<T> = { data: T; headers: Headers };
export type OwnerAuth = {
  withOwnerCommand: <T>(
    headers: Headers,
    shopId: string,
    run: (ctx: CommandContext) => Promise<T>,
  ) => Promise<SessionResult<T>>;
  commandLimit: () => Promise<number>;
  withOwnerShop: <T>(
    headers: Headers,
    shopId: string,
    run: (repository: ShopRepository) => Promise<T>,
  ) => Promise<SessionResult<T>>;
  auth: { handler: (request: Request) => Promise<Response> };
  admit: (
    input: { name: string; email: string; password: string; shopName: string },
    token: string,
    key: string,
  ) => Promise<void>;
  resend: (email: string, password: string, token: string) => Promise<void>;
  verify: (code: string) => Promise<void>;
  complete: (headers: Headers) => Promise<SessionResult<{ shopId: string }>>;
  ownerShop: (
    headers: Headers,
  ) => Promise<
    SessionResult<
      | { state: "pending-shop" }
      | { state: "complete"; shopId: string; name: string }
    >
  >;
  googleConnection: (
    headers: Headers,
  ) => Promise<SessionResult<{ enabled: boolean; linked: boolean }>>;
  disconnectGoogle: (headers: Headers) => Promise<Headers>;
  setupLimit: () => Promise<number>;
  resendLimit: () => Promise<number>;
  verifyLimit: () => Promise<number>;
  recoveryLimit: () => Promise<number>;
  redemptionLimit: () => Promise<number>;
  reauthLimit: () => Promise<number>;
  requestRecovery: (email: string) => Promise<void>;
  resetPassword: (input: {
    token: string;
    newPassword: string;
  }) => Promise<void>;
  reauthenticate: (headers: Headers, password: string) => Promise<Headers>;
  withRecentOwner: <T>(
    headers: Headers,
    run: (
      tx: Transaction,
      actor: { userId: string; shopId: string },
    ) => Promise<T>,
  ) => Promise<SessionResult<T>>;
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
  if (configuration.google)
    validateGoogle(configuration.google, configuration.origin);
  const policy = { ...approvedPolicy, ...configuration.policy };
  const now = configuration.now ?? (() => new Date());
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
  function library(
    database: Database | Transaction,
    flow: { parsed?: boolean; linking?: boolean; sessionId?: string } = {},
    oauthValidation = false,
  ): ReturnType<typeof betterAuth> {
    return betterAuth<BetterAuthOptions>({
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
        resetPasswordTokenExpiresIn: policy.resetSeconds,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, token }) => {
          const pending = await state();
          if (!user.emailVerified || user.id !== pending.user_id) return;
          // Capture opaque code only, never the library's URL. Delivery happens
          // after reservation, without holding a transaction during mail/humans.
          try {
            await configuration.capture({
              email: user.email,
              code: token,
              purpose: "reset",
            });
          } catch {
            // Same public response for unknown addresses and failed capture.
            // Requesting another code is safe; the old password stays intact.
          }
        },
      },
      session: {
        additionalFields: {
          authMethod: {
            type: "string",
            required: true,
            defaultValue: "credential",
            input: false,
          },
        },
        expiresIn: policy.sessionSeconds,
        updateAge: policy.updateSeconds,
        freshAge: policy.freshSeconds,
        cookieCache: { enabled: false },
      },
      socialProviders: configuration.google
        ? {
            google: {
              clientId: configuration.google.clientId,
              clientSecret: configuration.google.clientSecret,
              disableSignUp: true,
              disableImplicitSignUp: true,
              disableDefaultScope: true,
              scope: ["openid", "email", "profile"],
              includeGrantedScopes: false,
              accessType: "online",
            },
          }
        : {},
      account: {
        storeStateStrategy: "database",
        skipStateCookieCheck: false,
        storeAccountCookie: false,
        encryptOAuthTokens: true,
        updateAccountOnSignIn: false,
        accountLinking: {
          enabled: !!configuration.google,
          disableImplicitLinking: true,
          trustedProviders: [],
          requireLocalEmailVerified: true,
          allowDifferentEmails: false,
          allowUnlinkingAll: false,
          updateUserInfoOnLink: false,
        },
      },
      // Internal protected bootstrap uses the adapter without an endpoint.
      // All exposed OAuth handlers enable the native endpoint validation gate.
      user: oauthValidation
        ? {
            validateUserInfo: async ({ user, source }, ctx) => {
              if (source.method !== "oauth") return;
              const oauth = await getOAuthState();
              flow.parsed = !!oauth;
              flow.linking = !!oauth?.link;
              const providerEmail = source.oauth?.profile?.email;
              const pending = await state(database);
              const local = await (
                await library(database).$context
              ).internalAdapter.findUserById(pending.user_id ?? "");
              if (
                source.oauth?.providerId !== "google" ||
                source.action === "create-user" ||
                typeof providerEmail !== "string" ||
                source.oauth.profile?.email_verified !== true ||
                !configuration.google?.allowedEmails.includes(
                  providerEmail.toLowerCase(),
                ) ||
                !local?.emailVerified ||
                !pending.completed_at ||
                user.id !== local.id ||
                providerEmail.toLowerCase() !== local.email
              )
                return { error: "google_denied" };
              await requireMembership(database, local.id, pending.shop_id);
              if (source.action === "link-account") {
                // Native state identifies the owner, but does not revalidate the
                // initiating authentication. Bind it to the original DB session.
                const current = await recentIdentity(
                  ctx.headers ?? new Headers(),
                  database,
                );
                if (
                  !oauth?.link ||
                  oauth.link.userId !== current.userId ||
                  oauth.serverContext?.sessionId !== current.sessionId
                )
                  return { error: "google_denied" };
                flow.sessionId = current.sessionId;
              }
            },
          }
        : {},
      hooks: {
        before: createAuthMiddleware(async (ctx) => {
          if (ctx.path === "/link-social" || ctx.path === "/unlink-account") {
            const current = await recentIdentity(
              ctx.headers ?? new Headers(),
              database,
            );
            if (ctx.path === "/link-social") {
              const local = await (
                await library(database).$context
              ).internalAdapter.findUserById(current.userId);
              if (
                !configuration.google?.allowedEmails.includes(
                  local?.email ?? "",
                )
              )
                throw new OwnerAccessError("GOOGLE_DENIED");
              await addOAuthServerContext({ sessionId: current.sessionId });
            }
            flow.sessionId = current.sessionId;
          }
        }),
        after: createAuthMiddleware(async (ctx) => {
          if (ctx.path.startsWith("/callback/")) {
            const oauth = await getOAuthState();
            flow.parsed = !!oauth;
            flow.linking = !!oauth?.link;
          }
        }),
      },
      databaseHooks: {
        session: {
          create: {
            before: async (session, ctx) => ({
              data: {
                ...session,
                authMethod:
                  oauthValidation && ctx?.path.startsWith("/callback/")
                    ? "google"
                    : "credential",
              },
            }),
          },
        },
        account: {
          create: {
            before: async (account) =>
              account.providerId === "google"
                ? {
                    data: {
                      ...account,
                      accessToken: null,
                      refreshToken: null,
                      idToken: null,
                      accessTokenExpiresAt: null,
                      refreshTokenExpiresAt: null,
                    },
                  }
                : undefined,
            after: async (account) => {
              if (account.providerId === "google")
                await connectionEvent(
                  database,
                  account.userId,
                  flow.sessionId,
                  "linked",
                );
            },
          },
          update: {
            before: async (account) => ({
              data: {
                ...account,
                accessToken: null,
                refreshToken: null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
              },
            }),
            after: async (account) => {
              if (account.providerId === "google" && flow.sessionId)
                await connectionEvent(
                  database,
                  account.userId,
                  flow.sessionId,
                  "reauthorised",
                );
            },
          },
        },
      },
      rateLimit: {
        enabled: true,
        storage: "database",
        window: policy.signInWindow,
        max: policy.signInMax,
        customRules: {
          "/sign-in/social": {
            window: policy.signInWindow,
            max: policy.signInMax,
          },
          "/link-social": {
            window: policy.signInWindow,
            max: policy.signInMax,
          },
          "/unlink-account": {
            window: policy.signInWindow,
            max: policy.signInMax,
          },
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
  // Reuse the owner's approved unsafe-request admission rate/window. This
  // synthetic operational bucket has no new business rate or policy number.
  const commandLimit = createAbuseLimiter(
    pool,
    policy.signInMax,
    policy.signInWindow,
    "command",
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
  const recoveryLimit = createAbuseLimiter(
    pool,
    policy.recoveryMax,
    policy.recoveryWindow,
    "owner-recovery",
  );
  const redemptionLimit = createAbuseLimiter(
    pool,
    policy.redemptionMax,
    policy.redemptionWindow,
    "owner-reset",
  );
  const reauthLimit = createAbuseLimiter(
    pool,
    policy.reauthMax,
    policy.reauthWindow,
    "owner-reauth",
  );
  // Serialize credential reads/session creation with reset/re-authentication.
  // Otherwise an old-password sign-in could create a session AFTER revocation.
  async function credentialTransaction<T>(
    run: (tx: Transaction) => Promise<T>,
  ) {
    await ready();
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(120023)`);
      return run(tx);
    });
  }
  async function state(tx: Database | Transaction = db) {
    const result = await tx.execute(
      sql`select user_id, completed_at, shop_id, admission_key, request_hash from owner_bootstrap where singleton`,
    );
    return result.rows[0] as BootstrapRow;
  }
  async function requireMembership(
    database: Database | Transaction,
    userId: string,
    shopId: string | null,
  ) {
    if (!shopId) throw new OwnerAccessError("UNAUTHENTICATED");
    await database.execute(
      sql`select set_config('app.user_id', ${userId}, true)`,
    );
    const own = await database.execute(
      sql`select 1 from shop_membership where user_id=${userId}::uuid and shop_id=${shopId}::uuid and role='owner'`,
    );
    if (!own.rowCount) throw new OwnerAccessError("UNAUTHENTICATED");
  }
  async function recentIdentity(
    headers: Headers,
    database: Database | Transaction,
  ) {
    const current = await identity(headers, library(database), database);
    const live = await database.execute(
      sql`select created_at, expires_at from auth_session where id=${current.sessionId}::uuid and user_id=${current.userId}::uuid for share`,
    );
    const row = live.rows[0];
    const time = now().getTime();
    if (
      !row ||
      !Number.isFinite(time) ||
      new Date(String(row.expires_at)).getTime() <= time
    )
      throw new OwnerAccessError("UNAUTHENTICATED");
    const age = time - new Date(String(row.created_at)).getTime();
    if (!Number.isFinite(age) || age < 0 || age >= policy.freshSeconds * 1000)
      throw new OwnerAccessError("AUTHENTICATION_STALE");
    await requireMembership(
      database,
      current.userId,
      (await state(database)).shop_id,
    );
    return current;
  }
  async function connectionEvent(
    database: Database | Transaction,
    userId: string,
    sessionId: string | undefined,
    action: "linked" | "reauthorised" | "disconnected",
  ) {
    if (!sessionId) throw new OwnerAccessError("GOOGLE_DENIED");
    await database.execute(
      sql`insert into auth_connection_event(user_id,session_id,provider_id,action) values(${userId}::uuid,${sessionId}::uuid,'google',${action})`,
    );
    await checkpoint("google-written");
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
  async function identity(
    headers: Headers,
    resolver = auth,
    database: Database | Transaction = db,
    bootstrapOwner = true,
  ) {
    await ready();
    const { response: resolved, headers: responseHeaders } =
      await resolver.api.getSession({ headers, returnHeaders: true });
    if (
      !resolved?.user.emailVerified ||
      (bootstrapOwner && resolved.user.id !== (await state(database)).user_id)
    )
      throw new OwnerAccessError("UNAUTHENTICATED");
    const method = await database.execute(
      sql`select auth_method from auth_session where id=${resolved.session.id}::uuid`,
    );
    if (!method.rowCount) throw new OwnerAccessError("UNAUTHENTICATED");
    if (
      method.rows[0]?.auth_method === "google" &&
      !configuration.google?.allowedEmails.includes(resolved.user.email)
    )
      throw new OwnerAccessError("UNAUTHENTICATED");
    return {
      userId: resolved.user.id,
      sessionId: resolved.session.id,
      headers: responseHeaders,
    };
  }
  async function requestRecovery(email: string) {
    await ready();
    const pending = await state();
    const found = await (await auth.$context).internalAdapter.findUserByEmail(
      email,
    );
    // Only the reserved verified owner is eligible; no account provisioning.
    // The unknown-address branch retains the library's dummy lookup behavior.
    const eligible =
      found?.user.emailVerified && found.user.id === pending.user_id;
    if (!eligible) {
      await (await auth.$context).internalAdapter.findVerificationValue(
        "dummy-verification-token",
      );
      return;
    }
    await auth.api.requestPasswordReset({ body: { email } });
  }
  async function resetPassword(input: { token: string; newPassword: string }) {
    input = recoveryResetSchema.parse(input);
    await credentialTransaction(async (tx) => {
      // 1.7.7 only wraps token consumption in its own transaction. Explicitly
      // bind ALL native writes to this outer tx; API throws roll it back.
      const bound = library(tx);
      const ctx = await bound.$context;
      const verification = await ctx.internalAdapter.findVerificationValue(
        `reset-password:${input.token}`,
      );
      const pending = await state(tx);
      const user =
        verification &&
        (await ctx.internalAdapter.findUserById(verification.value));
      if (
        !verification ||
        verification.expiresAt.getTime() <= now().getTime() ||
        !user?.emailVerified ||
        user.id !== pending.user_id
      )
        throw new OwnerAccessError("INVALID_RESET");
      await bound.api.resetPassword({ body: input });
      // Invalidate other outstanding codes as well as every pre-reset session.
      await tx.execute(
        sql`delete from auth_verification where value=${user.id} and identifier like 'reset-password:%'`,
      );
      await checkpoint("reset");
    });
  }
  async function reauthenticate(headers: Headers, password: string) {
    return credentialTransaction(async (tx) => {
      const bound = library(tx);
      const current = await identity(headers, bound, tx);
      const live = await tx.execute(
        sql`select 1 from auth_session where id=${current.sessionId}::uuid and expires_at>${now()} for update`,
      );
      if (!live.rowCount) throw new OwnerAccessError("UNAUTHENTICATED");
      const ctx = await bound.$context;
      const user = await ctx.internalAdapter.findUserById(current.userId);
      if (!user) throw new OwnerAccessError("UNAUTHENTICATED");
      const result = await bound.api
        .signInEmail({
          headers,
          body: { email: user.email, password },
          returnHeaders: true,
        })
        .catch(() => {
          throw new OwnerAccessError("INVALID_CREDENTIALS");
        });
      await tx.execute(
        sql`delete from auth_session where id=${current.sessionId}::uuid`,
      );
      await checkpoint("reauthenticated");
      return result.headers;
    });
  }
  async function withRecentOwner<T>(
    headers: Headers,
    run: (
      tx: Transaction,
      actor: { userId: string; shopId: string },
    ) => Promise<T>,
  ) {
    const current = await identity(headers);
    const pending = await state();
    if (!pending.shop_id) throw new OwnerAccessError("UNAUTHENTICATED");
    const shopId = pending.shop_id;
    const data = await withShop(db, current.userId, shopId, async (tx) => {
      // Check database state again in the protected transaction, locking against
      // concurrent revocation. Never accept a client time/id or cached session.
      const live = await tx.execute(
        sql`select created_at, expires_at from auth_session where id=${current.sessionId}::uuid and user_id=${current.userId}::uuid for share`,
      );
      const row = live.rows[0] as
        | { created_at: string; expires_at: string }
        | undefined;
      const time = now().getTime();
      if (
        !row ||
        !Number.isFinite(time) ||
        !Number.isFinite(new Date(row.expires_at).getTime()) ||
        new Date(row.expires_at).getTime() <= time
      )
        throw new OwnerAccessError("UNAUTHENTICATED");
      const age = time - new Date(row.created_at).getTime();
      if (!Number.isFinite(age) || age < 0 || age >= policy.freshSeconds * 1000)
        throw new OwnerAccessError("AUTHENTICATION_STALE");
      return run(tx, { userId: current.userId, shopId });
    });
    return { data, headers: current.headers };
  }
  async function complete(headers: Headers) {
    const { userId, headers: responseHeaders } = await identity(headers);
    const data = await db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`select complete_owner_bootstrap(${userId}::uuid) as shop_id`,
      );
      await checkpoint("shop");
      return { shopId: result.rows[0]?.shop_id as string };
    });
    return { data, headers: responseHeaders };
  }
  async function ownerShop(headers: Headers) {
    const { userId, headers: responseHeaders } = await identity(headers);
    const pending = await state();
    if (!pending.shop_id)
      return {
        data: { state: "pending-shop" as const },
        headers: responseHeaders,
      };
    const shopId = pending.shop_id;
    const data = await withShop(db, userId, shopId, async (tx) => {
      const shop = await readShop(shopRepository(tx), shopId);
      if (!shop) throw new OwnerAccessError("UNAUTHENTICATED");
      return {
        state: "complete" as const,
        ...shop,
      };
    });
    return { data, headers: responseHeaders };
  }
  async function withOwnerShop<T>(
    headers: Headers,
    shopId: string,
    run: (repository: ShopRepository) => Promise<T>,
  ) {
    return withOwnerTransaction(headers, shopId, (tx) =>
      run(shopRepository(tx)),
    );
  }
  async function withOwnerCommand<T>(
    headers: Headers,
    shopId: string,
    run: (ctx: CommandContext) => Promise<T>,
  ) {
    return withOwnerTransaction(headers, shopId, (tx, userId) =>
      run({
        shopId,
        actor: { type: "user", id: userId },
        repository: commandRepository(tx, shopId),
      }),
    );
  }
  async function withOwnerTransaction<T>(
    headers: Headers,
    shopId: string,
    run: (tx: Transaction, userId: string) => Promise<T>,
  ) {
    // Admission remains owner-only. This boundary authorises by actual session
    // plus own membership, independently of the installation singleton.
    const current = await identity(headers, auth, db, false);
    try {
      const data = await withShop(db, current.userId, shopId, async (tx) => {
        const live =
          await tx.execute(sql`select 1 from auth_session s join auth_user u on u.id=s.user_id
          where s.id=${current.sessionId}::uuid and s.user_id=${current.userId}::uuid and u.email_verified and s.expires_at > now() for share of s, u`);
        if (!live.rowCount) throw new OwnerAccessError("UNAUTHENTICATED");
        return run(tx, current.userId);
      });
      return { data, headers: current.headers };
    } catch (error) {
      if (error instanceof ShopAccessError)
        throw new OwnerAccessError("SHOP_ACCESS_DENIED");
      throw error;
    }
  }
  async function googleConnection(headers: Headers) {
    return credentialTransaction(async (tx) => {
      const current = await identity(headers, library(tx), tx);
      const pending = await state(tx);
      await requireMembership(tx, current.userId, pending.shop_id);
      const linked = await tx.execute(
        sql`select 1 from auth_account where user_id=${current.userId}::uuid and provider_id='google'`,
      );
      return {
        data: { enabled: !!configuration.google, linked: !!linked.rowCount },
        headers: current.headers,
      };
    });
  }
  async function unlink(headers: Headers, tx: Transaction, accountId?: string) {
    const current = await recentIdentity(headers, tx);
    const accounts = await tx.execute(
      sql`select id, provider_id, password from auth_account where user_id=${current.userId}::uuid for update`,
    );
    const google = accounts.rows.find(
      (a) => a.provider_id === "google" && (!accountId || a.id === accountId),
    );
    // A remaining row alone is not a usable recovery method. Protect credential
    // access even if multiple Google rows were present in a damaged database.
    if (
      !google ||
      !accounts.rows.some((a) => a.provider_id === "credential" && a.password)
    )
      throw new OwnerAccessError("GOOGLE_DENIED");
    await library(tx).api.unlinkAccount({
      headers,
      body: { accountId: String(google.id) },
    });
    // Connection changes terminate existing access. Credential sign-in and
    // recovery remain the next usable entry points, including after Google auth.
    await tx.execute(
      sql`delete from auth_session where user_id=${current.userId}::uuid`,
    );
    await connectionEvent(
      tx,
      current.userId,
      current.sessionId,
      "disconnected",
    );
    const result = await library(tx).api.signOut({
      headers,
      returnHeaders: true,
    });
    return result.headers;
  }
  async function disconnectGoogle(headers: Headers) {
    return credentialTransaction((tx) => unlink(headers, tx));
  }
  const googleDenied = (linking = false) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${configuration.origin}/${linking ? "connections" : "sign-in"}#google-denied`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  async function googleHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!configuration.google && !path.endsWith("/unlink-account"))
      throw new OwnerAccessError("GOOGLE_UNAVAILABLE");
    if (path.endsWith("/callback/google")) {
      // Accept only Google's authorization-code GET callback, never arbitrary
      // provider endpoints, ID tokens, POST callbacks or untrusted error text.
      if (
        request.method !== "GET" ||
        // Next constructs an internal URL using its listening hostname. Validate
        // the actual HTTP authority against the approved callback host; direct
        // service tests without Host still require the exact configured origin.
        (request.headers.has("Host")
          ? request.headers.get("Host") !== origin.host
          : url.origin !== configuration.origin) ||
        (request.headers.has("Origin") &&
          request.headers.get("Origin") !== configuration.origin) ||
        [...url.searchParams.keys()].some(
          (k) =>
            ![
              "code",
              "state",
              "error",
              "error_description",
              "scope",
              "authuser",
              "prompt",
              "iss",
            ].includes(k),
        ) ||
        ["code", "state", "error", "iss"].some(
          (k) => url.searchParams.getAll(k).length > 1,
        ) ||
        url.searchParams.toString().length > 8192
      )
        return googleDenied();
      const flow: { parsed?: boolean; linking?: boolean; sessionId?: string } =
        {};
      try {
        return await credentialTransaction(async (tx) => {
          const stateRow = await tx.execute(
            sql`select value from auth_verification where identifier=${`auth-state:${url.searchParams.get("state") ?? ""}`} and expires_at>${now()} for update`,
          );
          if (!stateRow.rowCount) throw new OwnerAccessError("GOOGLE_DENIED");
          try {
            return await tx.transaction(async (effects) => {
              const response = await library(effects, flow, true).handler(
                request,
              );
              const location = response.headers.get("Location");
              const success = [
                `${configuration.origin}/owner`,
                `${configuration.origin}/connections#google-linked`,
              ];
              if (
                response.status !== 302 ||
                !location ||
                !success.includes(location)
              ) {
                // Native error redirects can skip after hooks. A successfully
                // authenticated state parse deletes the row before exchange.
                const remaining = await effects.execute(
                  sql`select 1 from auth_verification where identifier=${`auth-state:${url.searchParams.get("state") ?? ""}`}`,
                );
                if (!remaining.rowCount) {
                  flow.parsed = true;
                  const nativeState = JSON.parse(
                    String(stateRow.rows[0]?.value),
                  ) as { link?: unknown };
                  flow.linking = !!nativeState.link;
                  await checkpoint("google-state-consumed");
                }
                throw new OwnerAccessError("GOOGLE_DENIED");
              }
              return response;
            });
          } catch {
            // Roll effects back to the savepoint, but keep the outer lock and
            // state-row lock until consumption commits. A queued callback can
            // never enter between rejection rollback and state deletion.
            if (flow.parsed)
              await tx.execute(
                sql`delete from auth_verification where identifier=${`auth-state:${url.searchParams.get("state") ?? ""}`}`,
              );
            return googleDenied(flow.linking);
          }
        });
      } catch {
        return googleDenied(flow.linking);
      }
    }
    if (
      request.method !== "POST" ||
      url.search ||
      request.headers.get("Origin") !== configuration.origin
    )
      throw new OwnerAccessError("GOOGLE_DENIED");
    const body: unknown = await request
      .clone()
      .json()
      .catch(() => undefined);
    if (path.endsWith("/unlink-account")) {
      const input = googleDisconnectSchema.safeParse(body);
      if (!input.success) throw new OwnerAccessError("GOOGLE_DENIED");
      const responseHeaders = await credentialTransaction((tx) =>
        unlink(request.headers, tx, input.data.accountId),
      );
      return Response.json(
        { state: "google-disconnected" },
        { headers: responseHeaders },
      );
    }
    const input = googleEntrySchema.safeParse(body);
    if (!input.success) throw new OwnerAccessError("GOOGLE_DENIED");
    for (const redirect of [
      input.data.callbackURL,
      input.data.errorCallbackURL,
      input.data.newUserCallbackURL,
    ]) {
      if (redirect !== undefined) {
        const target = new URL(redirect, configuration.origin);
        if (
          target.origin !== configuration.origin ||
          target.username ||
          target.password
        )
          throw new OwnerAccessError("GOOGLE_DENIED");
      }
    }
    const linking = path.endsWith("/link-social");
    const headers = new Headers(request.headers);
    headers.delete("Content-Length");
    const native = new Request(request, {
      headers,
      body: JSON.stringify({
        provider: "google",
        disableRedirect: true,
        requestSignUp: input.data.requestSignUp ?? false,
        callbackURL: `${configuration.origin}${linking ? "/connections#google-linked" : "/owner"}`,
        errorCallbackURL: `${configuration.origin}/sign-in#google-denied`,
        newUserCallbackURL: `${configuration.origin}/owner`,
      }),
    });
    return credentialTransaction(async (tx) => {
      if (linking) await recentIdentity(request.headers, tx);
      const response = await library(tx, {}, true).handler(native);
      if (response.status === 429)
        return Response.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "Wait before trying again",
            },
          },
          { status: 429 },
        );
      if (!response.ok) throw new OwnerAccessError("GOOGLE_DENIED");
      const data = (await response.json()) as { url?: string };
      const destination = new URL(data.url ?? "");
      if (
        destination.origin !== "https://accounts.google.com" ||
        destination.pathname !== "/o/oauth2/v2/auth"
      )
        throw new OwnerAccessError("GOOGLE_DENIED");
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete("Content-Length");
      responseHeaders.delete("Location");
      return Response.json(
        { url: destination.toString() },
        { headers: responseHeaders },
      );
    });
  }
  return {
    auth: {
      handler: async (request) => {
        const path = new URL(request.url).pathname;
        if (
          [
            "/api/auth/sign-in/social",
            "/api/auth/link-social",
            "/api/auth/unlink-account",
            "/api/auth/callback/google",
          ].includes(path)
        )
          return googleHandler(request);
        const allowed =
          (request.method === "POST" &&
            ["/api/auth/sign-in/email", "/api/auth/sign-out"].includes(path)) ||
          (request.method === "GET" && path === "/api/auth/get-session");
        if (!allowed)
          return Promise.resolve(new Response(null, { status: 404 }));
        return request.method === "POST"
          ? credentialTransaction((tx) => library(tx).handler(request))
          : guard(() => auth.handler(request));
      },
    },
    admit,
    resend,
    verify,
    complete,
    ownerShop,
    withOwnerShop,
    withOwnerCommand,
    commandLimit: () => guard(commandLimit),
    googleConnection,
    disconnectGoogle,
    requestRecovery,
    resetPassword,
    reauthenticate,
    withRecentOwner,
    setupLimit: () => guard(setupLimit),
    resendLimit: () => guard(resendLimit),
    verifyLimit: () => guard(verifyLimit),
    recoveryLimit: () => guard(recoveryLimit),
    redemptionLimit: () => guard(redemptionLimit),
    reauthLimit: () => guard(reauthLimit),
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
    google: googleFromEnvironment(env),
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
