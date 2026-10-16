import { createServer } from "node:http";
import { withDocumentStatusHost } from "./component-host.mjs";
import { withDocuments } from "./documents.mjs";

// A disposable synthetic owner/DB/bucket, bound to one document. No normal app
// host mode, fixture login, arbitrary proxy or external service is exposed.
export async function withDocumentSharingHost(run, options = {}) {
  await withDocuments(async (f) => {
    const { input } = await f.issue();
    await f.process(input);
    let loseReply = false,
      unavailable = false,
      delayFile = null;
    const paths = new Set(["status", "retry", "file", "history"]);
    const prefix = `/api/shops/${f.a.shop}/documents/${input.docId}/1/`;
    const bridge = createServer(async (req, res) => {
      try {
        const suffix = req.url?.slice(prefix.length);
        if (
          !req.url?.startsWith(prefix) ||
          !paths.has(suffix) ||
          !["GET", "POST"].includes(req.method)
        ) {
          res.writeHead(404).end();
          return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 200000) {
            res.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
        if (suffix === "file" && delayFile) await delayFile;
        if (suffix === "file" && unavailable) {
          res
            .writeHead(503, {
              "content-type": "application/json",
              "cache-control": "no-store",
            })
            .end('{"error":{"code":"DOCUMENT_STORAGE_UNAVAILABLE"}}');
          return;
        }
        const response = await f.request(`/${input.docId}/1/${suffix}`, {
          method: req.method,
          ...(size
            ? { body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }
            : {}),
          key: req.headers["idempotency-key"],
          etag: req.headers["if-match"],
        });
        if (loseReply && suffix === "history" && req.method === "POST") {
          loseReply = false;
          res
            .writeHead(503, { "content-type": "application/json" })
            .end('{"error":{"code":"RESPONSE_LOST"}}');
          return;
        }
        const headers = Object.fromEntries(response.headers);
        delete headers["set-cookie"];
        res.writeHead(response.status, headers);
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        if (!res.headersSent)
          res.writeHead(503, { "content-type": "application/json" });
        res.end('{"error":{"code":"FIXTURE_UNAVAILABLE"}}');
      }
    });
    await new Promise((r) => bridge.listen(0, "127.0.0.1", r));
    try {
      await withDocumentStatusHost(
        (origin) =>
          run({
            origin,
            f,
            input,
            loseNextReply() {
              loseReply = true;
            },
            storageUnavailable(value) {
              unavailable = value;
            },
            delayFile(value) {
              delayFile = value;
            },
          }),
        {
          ...options,
          sharing: {
            selection: { shopId: f.a.shop, docId: input.docId, revision: 1 },
            bridge: `http://127.0.0.1:${bridge.address().port}`,
          },
        },
      );
    } finally {
      await new Promise((r) => bridge.close(r));
    }
  });
}
