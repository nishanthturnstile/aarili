import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withPayments } from "./payment-fixtures.mjs";

// Production OwnerFlow/PaymentsScreen + real owner API/RLS, no media/queue or live
// credentials. Like the existing draft host, this is a disposable verification
// directory, not a feature worktree. Generated files remain ignored.
export async function withPaymentWeb(run) {
  return withPayments(async (f) => {
    const reservation = createServer();
    await new Promise((r) => reservation.listen(0, "127.0.0.1", r));
    const port = reservation.address().port;
    await new Promise((r) => reservation.close(r));
    const origin = `http://127.0.0.1:${port}`;
    const bridge = createServer(async (req, res) => {
      try {
        const pieces = [];
        let size = 0;
        for await (const piece of req) {
          size += piece.length;
          if (size > 131072) {
            res.writeHead(413).end();
            return;
          }
          pieces.push(piece);
        }
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers))
          if (typeof v === "string") headers.set(k, v);
        headers.set("Origin", f.owner.origin);
        const body = Buffer.concat(pieces);
        const response = await f.api.fetch(
          new Request(`${f.owner.origin}${req.url}`, {
            method: req.method,
            headers,
            ...(body.length ? { body } : {}),
          }),
        );
        res.statusCode = response.status;
        response.headers.forEach((v, k) => {
          if (k !== "set-cookie") res.setHeader(k, v);
        });
        if (response.headers.getSetCookie().length)
          res.setHeader("Set-Cookie", response.headers.getSetCookie());
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        res.writeHead(503).end();
      }
    });
    await new Promise((r) => bridge.listen(0, "127.0.0.1", r));
    const apiOrigin = `http://127.0.0.1:${bridge.address().port}`;
    await mkdir(".scratch", { recursive: true });
    const folder = await mkdtemp(resolve(".scratch/payment-host-"));
    await mkdir(join(folder, "app/api/[...path]"), { recursive: true });
    await symlink(
      resolve("apps/web/node_modules"),
      join(folder, "node_modules"),
      "junction",
    );
    await writeFile(
      join(folder, "package.json"),
      '{"private":true,"type":"module"}',
    );
    await writeFile(
      join(folder, "next.config.mjs"),
      `export default {reactStrictMode:true,devIndicators:false,logging:{incomingRequests:false,browserToTerminal:false},turbopack:{root:${JSON.stringify(resolve("."))}},experimental:{externalDir:true}};`,
    );
    await cp("apps/web/postcss.config.mjs", join(folder, "postcss.config.mjs"));
    await cp("apps/web/public", join(folder, "public"), { recursive: true });
    await writeFile(
      join(folder, "app/layout.tsx"),
      'import "../../../apps/web/src/app/globals.css";export default function Layout({children}){return <html lang="en"><head><title>Aarili synthetic payments</title></head><body>{children}</body></html>}',
    );
    await writeFile(
      join(folder, "app/page.tsx"),
      'import {OwnerFlow} from "../../../apps/web/src/app/owner-flow";export default function Page(){return <OwnerFlow mode="payments"/>}',
    );
    for (const [route, mode] of [
      ["owner", "owner"],
      ["sign-in", "sign-in"],
      ["payments", "payments"],
      ["dashboard", "dashboard"],
      ["settings", "settings"],
      ["customers", "customers"],
      ["orders", "orders"],
    ]) {
      await mkdir(join(folder, `app/${route}`), { recursive: true });
      await writeFile(
        join(folder, `app/${route}/page.tsx`),
        `import {OwnerFlow} from "../../../../apps/web/src/app/owner-flow";export default function Page(){return <OwnerFlow mode="${mode}"/>}`,
      );
    }
    await writeFile(
      join(folder, "app/api/[...path]/route.ts"),
      `export const runtime="nodejs";async function proxy(request:Request){const url=new URL(request.url);const response=await fetch(${JSON.stringify(apiOrigin)}+url.pathname+url.search,{method:request.method,headers:request.headers,...(request.method==='GET'?{}:{body:await request.arrayBuffer()}),cache:'no-store'});return new Response(response.body,{status:response.status,headers:response.headers});}export {proxy as GET,proxy as POST,proxy as PUT};`,
    );
    const child = spawn(
        process.execPath,
        [
          resolve("apps/web/node_modules/next/dist/bin/next"),
          "dev",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
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
    try {
      let ready = false;
      for (let i = 0; i < 120; i++) {
        if (child.exitCode !== null)
          throw Error(`Payment host exited: ${output.slice(-1500)}`);
        try {
          const r = await fetch(origin, { signal: AbortSignal.timeout(2000) });
          await r.arrayBuffer();
          if (r.ok) {
            ready = true;
            break;
          }
        } catch {}
        await delay(250);
      }
      if (!ready) throw Error(`Payment host not ready: ${output.slice(-1500)}`);
      await run({ ...f, origin });
    } finally {
      child.kill();
      await Promise.race([exit, delay(5000)]);
      if (child.exitCode === null) {
        child.kill("SIGKILL");
        await exit;
      }
      await new Promise((r) => bridge.close(r));
    }
  });
}
