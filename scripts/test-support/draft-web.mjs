import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
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
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createApi } from "@aarili/api";
import { syntheticDraftRegistry } from "./drafts.mjs";
import { withTenantFixture } from "./tenant-isolation.mjs";

// Real owner auth, forced-RLS repositories, production API mount, disposable
// PostgreSQL and a separate Next host. No fixture route enters apps/web/src.
export async function withDraftWeb(run) {
  const transactions = new WeakMap();
  await withTenantFixture(
    async (f) => {
      await f.migration.query(
        await readFile("tests/fixtures/drafts.sql", "utf8"),
      );
      const observations = [];
      async function stats() {
        return (
          await f.admin.query(
            "select count(*)::int as count,min(created_at)::text as minimum,max(created_at)::text as maximum,clock_timestamp()::text as clock from durable_draft where shop_id=$1",
            [f.a.shop],
          )
        ).rows[0];
      }
      const owner = {
        ...f.owner,
        withOwnerDraft(headers, shopId, callback) {
          return f.owner.withOwnerDraft(headers, shopId, (context) =>
            callback({
              ...context,
              repository: {
                ...context.repository,
                async list(limit, cursor) {
                  const result = await context.repository.list(limit, cursor);
                  observations.push({
                    limit,
                    before: result.before,
                    cursorBefore: cursor?.before ?? null,
                    rows: result.rows.length,
                    database: await stats(),
                  });
                  return result;
                },
              },
              workflows: syntheticDraftRegistry(
                transactions.get(context.instrumentation),
                shopId,
              ),
            }),
          );
        },
      };
      const api = createApi(async () => true, owner);
      const server = createServer(async (request, response) => {
        try {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const headers = new Headers();
          for (const [key, value] of Object.entries(request.headers))
            if (typeof value === "string") headers.set(key, value);
          headers.set("Origin", owner.origin);
          const body = Buffer.concat(chunks);
          const result = await api.fetch(
            new Request(`${owner.origin}${request.url}`, {
              method: request.method,
              headers,
              ...(body.length ? { body } : {}),
            }),
          );
          response.statusCode = result.status;
          result.headers.forEach((value, key) => {
            response.setHeader(key, value);
          });
          response.end(Buffer.from(await result.arrayBuffer()));
        } catch {
          response.statusCode = 500;
          response.end();
        }
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const apiOrigin = `http://127.0.0.1:${server.address().port}`;
      await mkdir(".scratch", { recursive: true });
      const directory = await mkdtemp(resolve(".scratch/draft-host-"));
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
        `export default { reactStrictMode:true, devIndicators:false, logging:{incomingRequests:false,browserToTerminal:false}, turbopack:{root:${JSON.stringify(resolve("."))}}, experimental:{externalDir:true} };`,
      );
      await cp(
        "apps/web/postcss.config.mjs",
        join(directory, "postcss.config.mjs"),
      );
      await cp("apps/web/public", join(directory, "public"), {
        recursive: true,
      });
      await writeFile(
        join(directory, "app/layout.tsx"),
        'import "../../../apps/web/src/app/globals.css"; export default function Layout({children}) { return <html lang="en"><head><title>Aarili synthetic draft recovery</title></head><body>{children}</body></html> }',
      );
      await writeFile(
        join(directory, "app/page.tsx"),
        `import Host from "../../../apps/web/test-support/draft-host-app"; export default function Page(){return <Host shopId=${JSON.stringify(f.a.shop)} />}`,
      );
      await writeFile(
        join(directory, "app/api/[...path]/route.ts"),
        `async function proxy(request:Request){ const url=new URL(request.url); const response=await fetch(${JSON.stringify(apiOrigin)}+url.pathname+url.search,{method:request.method,headers:request.headers,...(request.method==='GET'?{}:{body:await request.arrayBuffer()}),cache:'no-store'});return new Response(response.body,{status:response.status,headers:response.headers});} export {proxy as GET,proxy as PUT,proxy as POST};`,
      );
      const socket = createServer();
      await new Promise((r) => socket.listen(0, "127.0.0.1", r));
      const port = socket.address().port;
      await new Promise((r) => socket.close(r));
      const origin = `http://127.0.0.1:${port}`;
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
      );
      const exit = once(child, "exit");
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
          if (child.exitCode !== null) throw new Error(output);
          try {
            const probe = await fetch(origin, {
              signal: AbortSignal.timeout(2000),
            });
            await probe.arrayBuffer();
            if (probe.ok) {
              ready = true;
              break;
            }
          } catch {}
          await delay(200);
        }
        if (!ready) throw new Error(`Draft host unavailable: ${output}`);
        await run({
          origin,
          observations,
          stats,
          ...f,
          async seedDrafts(count) {
            const prior = await stats();
            for (let i = 0; i < count; i++) {
              const id = (await f.admin.query("select uuidv7() as id")).rows[0]
                .id;
              const response = await api.fetch(
                new Request(
                  `${owner.origin}/api/shops/${f.a.shop}/drafts/${id}`,
                  {
                    method: "PUT",
                    headers: {
                      Origin: owner.origin,
                      Cookie: f.a.cookie,
                      "Content-Type": "application/json",
                      "Idempotency-Key": randomUUID(),
                    },
                    body: JSON.stringify({
                      workflow: "fixture.intake",
                      schemaVersion: 1,
                      payload: {
                        value: `synthetic-resume-${i}`,
                        amountRaw: "",
                        measurementRaw: "",
                      },
                    }),
                  },
                ),
              );
              await response.arrayBuffer();
              if (!response.ok)
                throw Error(`Synthetic resume seed failed: ${response.status}`);
            }
            const after = await stats();
            if (after.count - prior.count !== count)
              throw Error(
                `Synthetic seed count mismatch: ${JSON.stringify({ prior, after, requested: count })}`,
              );
            console.info(
              `Synthetic draft seed metadata: ${JSON.stringify(after)}`,
            );
          },
          async authorize(id) {
            await f.admin.query(
              "insert into draft_synthetic_state(shop_id,id,authorized) values($1,$2,true) on conflict(shop_id,id) do update set authorized=true",
              [f.a.shop, id],
            );
          },
        });
      } finally {
        child.kill();
        await exit;
        await new Promise((r) => server.close(r));
      }
    },
    {
      draftInstrumentation(tx) {
        const marker = { recordDraftEvent: async () => {} };
        transactions.set(marker, tx);
        return marker;
      },
    },
  );
}
