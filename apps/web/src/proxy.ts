import { ownerEntrySchema } from "@aarili/contracts";
import { type NextRequest, NextResponse } from "next/server";
import {
  type OwnerEntryPath,
  type OwnerEntryState,
  ownerDestination,
} from "./app/owner-entry-policy";
import { handleApi } from "./server/api";

export async function proxy(request: NextRequest) {
  if (!["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  let state: OwnerEntryState = "signed-out";
  let renewal: string[] = [];
  function blocked(path: "/entry-unavailable" | "/entry-denied") {
    // App-page rendering can replace a rewrite's non-success status with 200.
    // Use an explicit temporary destination; the API keeps its 403/503 contract.
    const response = NextResponse.redirect(new URL(path, request.url), 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    for (const cookie of renewal) response.headers.append("Set-Cookie", cookie);
    return response;
  }
  // Absence can establish signed-out state. Presence never grants access.
  if (request.headers.get("cookie")) {
    try {
      const result = await handleApi(
        new Request(new URL("/api/owner/entry", request.url), {
          headers: { Cookie: request.headers.get("cookie") ?? "" },
        }),
      );
      renewal = result.headers.getSetCookie();
      if (result.status === 403) return blocked("/entry-denied");
      if (result.status !== 401) {
        if (!result.ok) return blocked("/entry-unavailable");
        const entry = ownerEntrySchema.safeParse(await result.json());
        if (!entry.success) return blocked("/entry-unavailable");
        state = entry.data.state;
      }
    } catch {
      return blocked("/entry-unavailable");
    }
  }
  const destination = ownerDestination(
    state,
    request.nextUrl.pathname as OwnerEntryPath,
  );
  const response = destination
    ? NextResponse.redirect(new URL(destination, request.url), 307)
    : NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  for (const cookie of renewal) response.headers.append("Set-Cookie", cookie);
  return response;
}

export const config = {
  matcher: [
    "/",
    "/owner",
    "/sign-in",
    "/setup",
    "/onboarding",
    "/dashboard",
    "/connections",
    "/customers/:path*",
  ],
};
