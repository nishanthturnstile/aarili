import { expect, test } from "vitest";
import { createWorkGuard } from "../apps/web/src/app/pwa-runtime.js";

test("0.4.1b B4 USE-03 shared guard blocks updates for every dirty, in-flight or uncertain workflow", () => {
  const guard = createWorkGuard();
  const first = guard.track();
  const second = guard.track();
  let changes = 0;
  const unsubscribe = guard.subscribe(() => changes++);
  expect(guard.safe()).toBe(true);
  for (const flag of ["dirty", "inFlight", "outcomeUnknown"] as const) {
    first.set({
      dirty: false,
      inFlight: false,
      outcomeUnknown: false,
      [flag]: true,
    });
    second.set({ dirty: false, inFlight: false, outcomeUnknown: false });
    expect(guard.safe()).toBe(false);
  }
  first.dispose();
  expect(guard.safe()).toBe(true);
  expect(changes).toBe(7);
  unsubscribe();
  second.dispose();
  expect(changes).toBe(7);
});
