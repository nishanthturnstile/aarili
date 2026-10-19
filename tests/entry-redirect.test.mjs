import assert from "node:assert/strict";
import { createServer } from "node:http";
import { request } from "@playwright/test";
import { test } from "vitest";
import { readEntryRedirect } from "../scripts/test-support/entry-redirect.mjs";

async function withProbe(handler, run) {
  let calls = 0;
  const server = createServer((req, res) => handler(req, res, ++calls));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const context = await request.newContext();
  try {
    await run(
      context,
      `http://127.0.0.1:${server.address().port}/`,
      () => calls,
    );
  } finally {
    await context.dispose();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("ENTRY-01 read-only redirect probe recovers one real connection reset", async () => {
  await withProbe(
    (req, res, calls) => {
      if (calls === 1) return req.socket.destroy();
      res.writeHead(307, { Location: "/sign-in", "Cache-Control": "no-store" });
      res.end();
    },
    async (context, url, calls) => {
      const response = await readEntryRedirect(context, url);
      assert.equal(response.status(), 307);
      assert.equal(response.headers().location, "/sign-in");
      assert.equal(calls(), 2);
    },
  );
});

test("ENTRY-01 transport recovery never retries an HTTP error response", async () => {
  await withProbe(
    (_req, res) => {
      res.writeHead(503);
      res.end();
    },
    async (context, url, calls) => {
      const response = await readEntryRedirect(context, url);
      assert.equal(response.status(), 503);
      assert.equal(calls(), 1);
    },
  );
});

test("ENTRY-01 persistent connection reset fails after two attempts", async () => {
  await withProbe(
    (req) => req.socket.destroy(),
    async (context, url, calls) => {
      await assert.rejects(
        () => readEntryRedirect(context, url),
        /ECONNRESET|socket hang up/,
      );
      assert.equal(calls(), 2);
    },
  );
});
