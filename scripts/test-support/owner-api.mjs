import { createApi } from "@aarili/api";
import { OwnerAccessError } from "@aarili/auth";

// Test-only adapter. No environment switch or application route installs it.
export function createOwnerVerificationApi(check, owner) {
  return createApi(check, owner).post("/owner/sensitive-probe", async (c) => {
    if (c.req.header("Origin") !== owner.origin)
      return c.json({ error: { code: "UNSAFE_ORIGIN" } }, 403);
    try {
      const result = await owner.withRecentOwner(
        c.req.raw.headers,
        async () => ({
          state: "probe-accepted",
        }),
      );
      for (const cookie of result.headers.getSetCookie())
        c.header("Set-Cookie", cookie, { append: true });
      return c.json(result.data, 200);
    } catch (error) {
      if (!(error instanceof OwnerAccessError)) throw error;
      return c.json(
        { error: { code: error.code } },
        error.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    }
  });
}
