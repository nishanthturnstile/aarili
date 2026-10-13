import {
  clearOwnerState,
  onOwnerInvalidation,
  ownerSession,
  readOwnerShop,
} from "@aarili/api/client";
import { ownerAuthFromEnvironment } from "@aarili/auth";
import {
  reauthenticationSchema,
  recoveryRequestSchema,
  recoveryResetSchema,
} from "@aarili/contracts";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  clearOwnerState();
  vi.unstubAllGlobals();
});
test("0.2.1b B5 strict recovery contracts reject malformed codes, short passwords and client redirects/identity/time", () => {
  expect(
    recoveryRequestSchema.parse({ email: "OWNER@example.test" }).email,
  ).toBe("owner@example.test");
  for (const value of [
    { email: "invalid" },
    { email: "owner@example.test", redirectTo: "https://evil.example" },
  ])
    expect(recoveryRequestSchema.safeParse(value).success).toBe(false);
  for (const value of [
    { token: "x", newPassword: "long-synthetic-password" },
    { token: "A".repeat(24), newPassword: "short" },
    {
      token: "A".repeat(24),
      newPassword: "long-synthetic-password",
      callbackURL: "/owner",
    },
  ])
    expect(recoveryResetSchema.safeParse(value).success).toBe(false);
  for (const extra of [
    { userId: "owner" },
    { now: Date.now() },
    { email: "owner@example.test" },
  ])
    expect(
      reauthenticationSchema.safeParse({
        password: "synthetic-password",
        ...extra,
      }).success,
    ).toBe(false);
});
test("0.2.1b B6 late authenticated response cannot repopulate state after identity invalidation even if abort is ignored", async () => {
  let deliver: ((response: Response) => void) | undefined;
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", (_request: Request, init: RequestInit) => {
    signal = init.signal ?? undefined;
    return new Promise<Response>((resolve) => {
      deliver = resolve;
    });
  });
  const notified = vi.fn();
  const unsubscribe = onOwnerInvalidation(notified);
  const pending = readOwnerShop();
  const rejected = expect(pending).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  clearOwnerState();
  expect(signal?.aborted).toBe(true);
  deliver?.(
    Response.json({
      state: "complete",
      shopId: "019b5555-0000-7000-8000-000000000001",
      name: "Previous identity",
    }),
  );
  await rejected;
  expect(notified).toHaveBeenCalledTimes(1);
  unsubscribe();
});
test("0.2.1b B6 invalid session and failed logout both clear memory before navigation/network completion", async () => {
  const notified = vi.fn();
  const unsubscribe = onOwnerInvalidation(notified);
  vi.stubGlobal("fetch", async () =>
    Response.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign-in required" } },
      { status: 401 },
    ),
  );
  await expect(readOwnerShop()).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  expect(notified).toHaveBeenCalledTimes(1);
  vi.stubGlobal("fetch", async () => {
    throw new Error("synthetic offline");
  });
  await expect(ownerSession("sign-out")).rejects.toThrow("synthetic offline");
  expect(notified).toHaveBeenCalledTimes(3);
  unsubscribe();
});
test("0.2.1b B7 accidental outbound credentials never activate an email transport", () => {
  expect(
    ownerAuthFromEnvironment({
      RESEND_API_KEY: "synthetic-never-send",
      SMTP_URL: "https://invalid.test",
      BETTER_AUTH_URL: "https://invalid.test",
    }),
  ).toBeUndefined();
});
test("0.2.1b B6 reads started DURING sign-out are discarded on completion; late 401 cannot invalidate a newer identity", async () => {
  let finishLogout: ((response: Response) => void) | undefined;
  let finishRead: ((response: Response) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    (url: string) =>
      new Promise<Response>((resolve) => {
        if (String(url).includes("sign-out")) finishLogout = resolve;
        else finishRead = resolve;
      }),
  );
  const logout = ownerSession("sign-out");
  const pending = readOwnerShop();
  const rejected = expect(pending).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  finishLogout?.(Response.json({ success: true }));
  await logout;
  const notified = vi.fn();
  const unsubscribe = onOwnerInvalidation(notified);
  finishRead?.(
    Response.json(
      { error: { code: "UNAUTHENTICATED", message: "Old identity ended" } },
      { status: 401 },
    ),
  );
  await rejected;
  expect(notified).not.toHaveBeenCalled();
  unsubscribe();
});
