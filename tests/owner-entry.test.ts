import { ownerEntrySchema } from "@aarili/contracts";
import { expect, test } from "vitest";
import {
  type OwnerEntryPath,
  ownerDestination,
} from "../apps/web/src/app/owner-entry-policy.js";

const paths: OwnerEntryPath[] = [
  "/",
  "/owner",
  "/sign-in",
  "/setup",
  "/onboarding",
  "/dashboard",
  "/connections",
];
test("ENTRY-03/04/05/07 finite entry routing never uses a first-login counter and has no redirect loops", () => {
  for (const path of paths) {
    expect(ownerDestination("signed-out", path)).toBe(
      ["/sign-in", "/setup"].includes(path) ? undefined : "/sign-in",
    );
    expect(ownerDestination("needs-onboarding", path)).toBe(
      path === "/onboarding" ? undefined : "/onboarding",
    );
    expect(ownerDestination("ready", path)).toBe(
      ["/dashboard", "/connections"].includes(path) ? undefined : "/dashboard",
    );
    for (const state of ["signed-out", "needs-onboarding", "ready"] as const) {
      const next = ownerDestination(state, path);
      if (next) expect(ownerDestination(state, next)).toBeUndefined();
    }
  }
});
test("ENTRY-04/11 minimal entry contract rejects authority, credentials and inconsistent readiness", () => {
  const owner = { name: "Synthetic owner", email: "owner@example.test" };
  expect(ownerEntrySchema.parse({ state: "needs-onboarding", owner })).toEqual({
    state: "needs-onboarding",
    owner,
  });
  for (const body of [
    { state: "ready", owner },
    { state: "needs-onboarding", owner, setupToken: "private" },
    { state: "needs-onboarding", owner: { ...owner, sessionId: "private" } },
    { state: "ready", owner, shop: { shopId: "wrong", name: "Shop" } },
    { state: "needs-onboarding", owner, isFirstLogin: true },
  ])
    expect(ownerEntrySchema.safeParse(body).success).toBe(false);
});
