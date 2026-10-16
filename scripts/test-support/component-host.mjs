import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
// Explicit fixture whitelist, never an arbitrary file/module/URL test service.
export async function withDocumentStatusHost(run) {
  const reservation = createServer();
  await new Promise((r) => reservation.listen(0, "127.0.0.1", r));
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
    `export default {reactStrictMode:true,devIndicators:false,turbopack:{root:${JSON.stringify(resolve("."))}},experimental:{externalDir:true}};`,
  );
  await writeFile(
    join(folder, "app/layout.tsx"),
    'import "../../../apps/web/src/app/globals.css";export default function Layout({children}){return <html lang="en"><head><title>Aarili synthetic PDF status</title></head><body>{children}</body></html>}',
  );
  await writeFile(
    join(folder, "app/page.tsx"),
    'import Host from "../../../apps/web/test-support/document-status-host";export default function Page(){return <Host/>}',
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
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null)
        throw Error("Document component host exited");
      try {
        const r = await fetch(origin, { signal: AbortSignal.timeout(2000) });
        await r.arrayBuffer();
        if (r.ok) {
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
