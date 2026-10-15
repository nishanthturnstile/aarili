// Test-only composition. No route or handler is imported by normal startup.

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { pwaMessages } from "../../packages/i18n/src/pwa-messages.ts";

export async function withPwaHost(run, { upstreamOrigin } = {}) {
  const runtime = stripTypeScriptTypes(
    await readFile("apps/web/src/app/pwa-runtime.ts", "utf8"),
  );
  const worker = await readFile("apps/web/public/sw.js", "utf8");
  const config = { revision: 1, denyWorker: false, failAsset: false };
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    response.setHeader("Cache-Control", "no-store");
    if (path === "/sw.js") {
      response.writeHead(config.denyWorker ? 403 : 200, {
        "Content-Type": "text/javascript",
      });
      response.end(
        worker.replaceAll(
          "aarili-offline-v1",
          `aarili-offline-v${config.revision}`,
        ),
      );
    } else if (upstreamOrigin) {
      const upstream = await fetch(new URL(request.url, upstreamOrigin));
      const headers = Object.fromEntries(upstream.headers);
      for (const name of [
        "content-encoding",
        "content-length",
        "transfer-encoding",
        "connection",
      ])
        delete headers[name];
      response.writeHead(upstream.status, headers);
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } else if (path === "/test-runtime.js") {
      response.writeHead(200, { "Content-Type": "text/javascript" });
      response.end(runtime);
    } else if (
      path === "/offline.html" ||
      /^\/pwa\/(offline\.css|latin\.woff2|tamil\.woff2)$/.test(path)
    ) {
      if (config.failAsset && path === "/pwa/tamil.woff2") {
        response.writeHead(503);
        response.end();
        return;
      }
      response.setHeader(
        "Content-Type",
        path.endsWith("html")
          ? "text/html"
          : path.endsWith("css")
            ? "text/css"
            : "font/woff2",
      );
      response.end(await readFile(`apps/web/public${path}`));
    } else if (path === "/setup" || path === "/owner") {
      response.setHeader("Content-Type", "text/html");
      response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>PWA synthetic host</title><link rel="stylesheet" href="/pwa/offline.css"></head><body><main><h1>Synthetic workflow</h1><label>Input <input id="value"></label><p id="state"></p><p id="update" role="status"></p><button id="retry">Retry</button><script type="module">
import {createWorkGuard, startPwa} from '/test-runtime.js';
const messages = ${JSON.stringify(pwaMessages)};
const guard = createWorkGuard(), work = guard.track();
let current = 'starting', locale = 'en', stop;
const render = () => { document.querySelector('#state').textContent = current; document.querySelector('#update').textContent = current === 'waiting' && guard.safe() ? messages[locale].waiting : ''; };
guard.subscribe(render);
const boot = () => { stop?.(); stop = startPwa(state => { current=state; render(); }); };
document.querySelector('#value').addEventListener('input', () => work.set({dirty:true,inFlight:false,outcomeUnknown:false}));
document.querySelector('#retry').onclick = boot;
window.host = {set: state => work.set(state), language: value => {locale=value; document.documentElement.lang=value; render();}};
boot();
</script></main></body></html>`);
    } else {
      response.setHeader("Content-Type", "application/json");
      response.end('{"syntheticPrivate":"must-not-cache"}');
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    await run({ origin: `http://127.0.0.1:${server.address().port}`, config });
  } finally {
    await new Promise((done) => server.close(done));
  }
}
