import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { startJobRuntime } from "@aarili/jobs/runtime";
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { withMediaProcessing } from "./media-processing.mjs";
export async function withMediaWeb(
  run,
  { surface = "media", fixture = withMediaProcessing } = {},
) {
  const reservation = createServer();
  await new Promise((r) => reservation.listen(0, "127.0.0.1", r));
  const port = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  const origin = `http://127.0.0.1:${port}`;
  await fixture(async (f) => {
    const client = new S3Client({
      ...f.config,
      credentials: {
        accessKeyId: f.config.accessKeyId,
        secretAccessKey: f.config.secretAccessKey,
      },
      forcePathStyle: true,
      maxAttempts: 1,
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
    let directCors = true;
    try {
      await client.send(
        new PutBucketCorsCommand({
          Bucket: f.config.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: [origin],
                AllowedMethods: ["PUT", "GET"],
                AllowedHeaders: ["content-type"],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 0,
              },
            ],
          },
        }),
      );
    } catch {
      directCors = false;
      console.info(
        "Synthetic Garage bucket CORS unavailable; fixed test-only signed-PUT proxy selected",
      );
    } finally {
      client.destroy();
    }
    const grants = new Map();
    if (!directCors) {
      const original = f.storage.signPut;
      f.storage.signPut = async (...args) => {
        const url = await original(...args),
          token = randomUUID();
        grants.set(token, {
          url,
          type: args[1],
          expires: Date.now() + args[2] * 1000,
        });
        return `${origin}/api/_verification/upload/${token}`;
      };
    }
    const server = createServer(async (req, res) => {
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 25 * 1024 * 1024) {
            res.writeHead(413).end();
            return;
          }
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks),
          headers = new Headers();
        for (const [key, value] of Object.entries(req.headers))
          if (typeof value === "string") headers.set(key, value);
        if (req.url.startsWith("/api/_verification/upload/")) {
          const token = req.url.slice("/api/_verification/upload/".length),
            grant = grants.get(token);
          if (
            directCors ||
            req.method !== "PUT" ||
            headers.get("Origin") !== origin ||
            !grant ||
            Date.now() > grant.expires ||
            headers.get("Content-Type") !== grant.type
          ) {
            res.writeHead(403).end();
            return;
          }
          const result = await fetch(grant.url, {
            method: "PUT",
            headers: { "Content-Type": grant.type },
            body,
            redirect: "error",
          });
          await result.arrayBuffer();
          res.writeHead(result.status).end();
          return;
        }
        headers.set("Origin", f.owner.origin);
        const response = await f.api.fetch(
          new Request(`${f.owner.origin}${req.url}`, {
            method: req.method,
            headers,
            ...(body.length ? { body } : {}),
          }),
        );
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        res.writeHead(500).end();
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const apiOrigin = `http://127.0.0.1:${server.address().port}`;
    await mkdir(".scratch", { recursive: true });
    const directory = await mkdtemp(resolve(".scratch/media-host-"));
    await mkdir(join(directory, "app/api/[...path]"), { recursive: true });
    await symlink(
      resolve("apps/web/node_modules"),
      join(directory, "node_modules"),
      "junction",
    );
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    );
    await writeFile(
      join(directory, "next.config.mjs"),
      `export default {reactStrictMode:true,devIndicators:false,logging:{incomingRequests:false,browserToTerminal:false},turbopack:{root:${JSON.stringify(resolve("."))}},experimental:{externalDir:true}};`,
    );
    await cp(
      "apps/web/postcss.config.mjs",
      join(directory, "postcss.config.mjs"),
    );
    await cp("apps/web/public", join(directory, "public"), { recursive: true });
    await writeFile(
      join(directory, "app/layout.tsx"),
      'import "../../../apps/web/src/app/globals.css";export default function Layout({children}){return <html lang="en"><head><title>Aarili synthetic private media</title></head><body>{children}</body></html>}',
    );
    await writeFile(
      join(directory, "app/page.tsx"),
      surface === "quotation-issues"
        ? `import Host from "../../../apps/web/test-support/quotation-issue-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} proposalId=${JSON.stringify(f.proposalId)}/>}`
        : surface === "job-slips"
          ? `import Host from "../../../apps/web/test-support/job-slip-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} orderId=${JSON.stringify(f.scope.orderId)}/>} `
          : surface === "manual-patterns"
            ? `import Host from "../../../apps/web/test-support/manual-pattern-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} order={${JSON.stringify(f.target.order)}}/>}`
            : surface === "measurement-fit"
              ? `import Host from "../../../apps/web/test-support/measurement-fit-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} customerId=${JSON.stringify(f.identity.customerId)} wearerId=${JSON.stringify(f.identity.wearerId)} order={${JSON.stringify(f.target.order)}}/>}`
              : surface === "design-references"
                ? `import Host from "../../../apps/web/test-support/design-reference-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} order={${JSON.stringify(f.target.order)}}/>}`
                : surface === "shop-profile"
                  ? 'import {OwnerFlow} from "../../../apps/web/src/app/owner-flow";export default function Page(){return <OwnerFlow mode="settings"/>}'
                  : `import Host from "../../../apps/web/test-support/media-host-app";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} subjectId=${JSON.stringify(f.subjectId)}/>}`,
    );
    if (surface === "shop-profile") {
      await mkdir(join(directory, "app/settings"), { recursive: true });
      await writeFile(
        join(directory, "app/settings/page.tsx"),
        'import {OwnerFlow} from "../../../../apps/web/src/app/owner-flow";export default function Page(){return <OwnerFlow mode="settings"/>}',
      );
    }
    if (
      surface === "design-references" ||
      surface === "measurement-fit" ||
      surface === "manual-patterns" ||
      surface === "job-slips" ||
      surface === "quotation-issues"
    ) {
      await mkdir(join(directory, "app/sign-in"), { recursive: true });
      await writeFile(
        join(directory, "app/sign-in/page.tsx"),
        'import {OwnerFlow} from "../../../../apps/web/src/app/owner-flow";export default function Page(){return <OwnerFlow mode="sign-in"/>}',
      );
      for (const route of ["owner", "dashboard"]) {
        await mkdir(join(directory, `app/${route}`), { recursive: true });
        await writeFile(
          join(directory, `app/${route}/page.tsx`),
          surface === "quotation-issues"
            ? `import Host from "../../../../apps/web/test-support/quotation-issue-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} proposalId=${JSON.stringify(f.proposalId)}/>}`
            : surface === "job-slips"
              ? `import Host from "../../../../apps/web/test-support/job-slip-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} orderId=${JSON.stringify(f.scope.orderId)}/>} `
              : surface === "manual-patterns"
                ? `import Host from "../../../../apps/web/test-support/manual-pattern-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} order={${JSON.stringify(f.target.order)}}/>}`
                : surface === "measurement-fit"
                  ? `import Host from "../../../../apps/web/test-support/measurement-fit-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} customerId=${JSON.stringify(f.identity.customerId)} wearerId=${JSON.stringify(f.identity.wearerId)} order={${JSON.stringify(f.target.order)}}/>}`
                  : `import Host from "../../../../apps/web/test-support/design-reference-host";export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} order={${JSON.stringify(f.target.order)}}/>}`,
        );
      }
    }
    await writeFile(
      join(directory, "app/api/[...path]/route.ts"),
      `async function proxy(request:Request){const url=new URL(request.url);const response=await fetch(${JSON.stringify(apiOrigin)}+url.pathname+url.search,{method:request.method,headers:request.headers,...(request.method==='GET'?{}:{body:await request.arrayBuffer()}),cache:'no-store'});return new Response(response.body,{status:response.status,headers:response.headers});}export {proxy as GET,proxy as POST,proxy as PUT};`,
    );
    const runtime = await startJobRuntime(
      f.runtime.pool.options.connectionString,
      { mode: "inprocess", pollMilliseconds: 50 },
      f.composition,
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
        { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
      ),
      exit = once(child, "exit");
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    try {
      let ready = false;
      for (let i = 0; i < 150; i++) {
        if (child.exitCode !== null) throw Error("Synthetic media host exited");
        try {
          const response = await fetch(origin, {
            signal: AbortSignal.timeout(2000),
          });
          await response.arrayBuffer();
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {}
        await delay(200);
      }
      if (!ready) throw Error(`Synthetic media host unavailable: ${output}`);
      console.info(
        `Synthetic browser upload transport: ${directCors ? "Garage direct CORS" : "fixed signed-PUT proxy"}`,
      );
      await run({ ...f, origin, directCors });
    } finally {
      child.kill();
      await exit;
      await runtime.stop();
      await new Promise((r) => server.close(r));
      grants.clear();
    }
  });
}
