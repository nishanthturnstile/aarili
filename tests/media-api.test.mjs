import { createMediaRoutes } from "@aarili/api/media";
import { expect, test } from "vitest";

const origin = "http://127.0.0.1:3157";
const id = "019a5e57-1111-7000-8000-000000000001";
test("0.4.3a G1/G2 bounded transport rejects malformed/oversized/underreported JSON before business admission", async () => {
  let calls = 0;
  const api = createMediaRoutes({
    origin,
    commandLimit: async () => 0,
    withOwnerMedia: async () => {
      calls++;
      throw Error("must not enter");
    },
  });
  for (const body of [
    '{"unfinished":',
    JSON.stringify({ value: "x".repeat(9000) }),
  ]) {
    const r = await api.fetch(
      new Request(`${origin}/shops/${id}/files/uploads`, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "Content-Length": "1",
        },
        body,
      }),
    );
    expect(r.status).toBe(body.length > 8192 ? 413 : 422);
  }
  expect(calls).toBe(0);
  expect(
    (
      await api.fetch(
        new Request(`${origin}/shops/${id}/drafts`, {
          method: "PUT",
          body: "x".repeat(9000),
        }),
      )
    ).status,
  ).toBe(404);
});
