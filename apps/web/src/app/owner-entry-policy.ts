export type OwnerEntryState = "signed-out" | "needs-onboarding" | "ready";
export type OwnerEntryPath =
  | "/"
  | "/owner"
  | "/sign-in"
  | "/setup"
  | "/onboarding"
  | "/dashboard"
  | "/connections"
  | "/settings"
  | "/payments"
  | "/orders"
  | "/customers"
  | `/customers/${string}`;

// Both the server boundary and mounted client use this finite route policy.
// An unavailable/denied read is never classified as a new or signed-out owner.
export function ownerDestination(state: OwnerEntryState, path: OwnerEntryPath) {
  if (state === "signed-out")
    return path === "/sign-in" || path === "/setup" ? undefined : "/sign-in";
  if (state === "needs-onboarding")
    return path === "/onboarding" ? undefined : "/onboarding";
  return path === "/dashboard" ||
    path === "/connections" ||
    path === "/settings" ||
    path === "/payments" ||
    path === "/orders" ||
    path === "/customers" ||
    path.startsWith("/customers/")
    ? undefined
    : "/dashboard";
}
