import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { get as httpsGet } from "node:https";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
// Explicit fixture whitelist, never an arbitrary file/module/URL test service.
export async function withDocumentStatusHost(run, options = {}) {
  const hostname = options.hostname ?? "127.0.0.1";
  const reservation = createServer();
  await new Promise((r) => reservation.listen(options.port ?? 0, hostname, r));
  const port = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  await mkdir(".scratch", { recursive: true });
  const folder = await mkdtemp(resolve(".scratch/pdf-status-host-"));
  await mkdir(join(folder, "app"));
  await symlink(
    resolve("apps/web/node_modules"),
    join(folder, "node_modules"),
    "junction",
  );
  await cp("apps/web/postcss.config.mjs", join(folder, "postcss.config.mjs"));
  await writeFile(
    join(folder, "package.json"),
    '{"private":true,"type":"module"}',
  );
  await writeFile(
    join(folder, "next.config.mjs"),
    `export default {reactStrictMode:true,devIndicators:false,logging:{incomingRequests:false,browserToTerminal:false},allowedDevOrigins:${JSON.stringify([hostname])},turbopack:{root:${JSON.stringify(resolve("."))}},experimental:{externalDir:true}};`,
  );
  await writeFile(
    join(folder, "app/layout.tsx"),
    'import "../../../apps/web/src/app/globals.css";export default function Layout({children}){return <html lang="en"><head><title>Aarili synthetic PDF status</title></head><body>{children}</body></html>}',
  );
  await writeFile(
    join(folder, "app/page.tsx"),
    options.sharing
      ? `import Host from "../../../apps/web/test-support/document-sharing-host";export default function Page(){return <Host selection={${JSON.stringify(options.sharing.selection)}}/>}`
      : 'import Host from "../../../apps/web/test-support/document-status-host";export default function Page(){return <Host/>}',
  );
  if (options.sharing) {
    await mkdir(join(folder, "app/api/[...path]"), { recursive: true });
    await writeFile(
      join(folder, "app/api/[...path]/route.ts"),
      `export const runtime="nodejs";async function route(r){const u=new URL(r.url);if(u.search || (r.method==="POST" && r.headers.get("origin")!==${JSON.stringify(`${options.cert ? "https" : "http"}://${hostname}:${port}`)}))return new Response(null,{status:403});const response=await fetch(${JSON.stringify(options.sharing.bridge)}+u.pathname,{method:r.method,headers:{"content-type":"application/json","idempotency-key":r.headers.get("idempotency-key")??"","if-match":r.headers.get("if-match")??""},...(r.method==="POST"?{body:await r.text()}:{}),cache:"no-store"});return new Response(response.body,{status:response.status,headers:response.headers});}export {route as GET,route as POST};`,
    );
  }
  const child = spawn(
      process.execPath,
      [
        resolve("apps/web/node_modules/next/dist/bin/next"),
        "dev",
        "--hostname",
        hostname,
        "--port",
        String(port),
        ...(options.cert
          ? [
              "--experimental-https",
              "--experimental-https-key",
              resolve(options.key),
              "--experimental-https-cert",
              resolve(options.cert),
            ]
          : []),
      ],
      { cwd: folder, stdio: ["ignore", "pipe", "pipe"] },
    ),
    exit = once(child, "exit");
  let output = "";
  child.stdout.on("data", (b) => {
    output += b;
  });
  child.stderr.on("data", (b) => {
    output += b;
  });
  const origin = `${options.cert ? "https" : "http"}://${hostname}:${port}`;
  const ca = options.cert ? await readFile(options.cert) : null;
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null)
        throw Error("Document component host exited");
      try {
        const ok = ca
          ? await new Promise((resolve, reject) => {
              const r = httpsGet(origin, { ca, timeout: 2000 }, (res) => {
                res.resume();
                resolve(res.statusCode === 200);
              });
              r.on("error", reject);
              r.on("timeout", () => r.destroy(Error("Host timeout")));
            })
          : await fetch(origin, { signal: AbortSignal.timeout(2000) }).then(
              async (r) => {
                await r.arrayBuffer();
                return r.ok;
              },
            );
        if (ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(200);
    }
    if (!ready)
      throw Error(
        `Document component host unavailable: ${output.slice(-2000)}`,
      );
    await run(origin);
  } finally {
    child.kill();
    await exit;
  }
}
