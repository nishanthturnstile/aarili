// Disposable loopback review. Credentials and all synthetic data are temporary.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { seedQuickOrder } from "./test-support/seed-quick-order.mjs";

const directory = resolve(".scratch/quick-order-review-host");
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (["stop", "expire"].includes(process.argv[2])) {
  await writeFile(file(process.argv[2]), "requested");
  console.info(`Quick Order review ${process.argv[2]} requested.`);
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "quick-order-review@example.test";
  const password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(
      async ({ origin, setupToken, code, runtime, expireAuthentication }) => {
        const cookies = new Map();
        async function request(path, body, extra = {}) {
          const r = await fetch(`${origin}/api${path}`, {
            method: body ? "POST" : "GET",
            headers: {
              Origin: origin,
              "Content-Type": "application/json",
              Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
              ...extra,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          for (const c of r.headers.getSetCookie()) {
            const pair = c.split(";")[0],
              i = pair.indexOf("=");
            cookies.set(pair.slice(0, i), pair.slice(i + 1));
          }
          if (!r.ok) throw Error(`Synthetic review setup failed (${r.status})`);
          return r.json();
        }
        await request(
          "/owner/setup",
          { name: "SYNTHETIC Quick Order owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC Quick Order review" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shop } = await request("/owner/entry");
        const seed = await seedQuickOrder(runtime, shop.shopId);
        try {
          await writeFile(
            file("private.json"),
            JSON.stringify({
              origin,
              email,
              password,
              url: `${origin}/orders`,
            }),
            { mode: 0o600 },
          );
          console.info(`Quick Order review ready: ${origin}/orders`);
          console.info(
            "Private sign-in: .scratch/quick-order-review-host/private.json (never publish).",
          );
          while (!stopping) {
            try {
              await readFile(file("expire"));
              await expireAuthentication();
              await rm(file("expire"));
            } catch {}
            try {
              await readFile(file("stop"));
              break;
            } catch {}
            await delay(500);
          }
        } finally {
          await seed.close();
        }
      },
      { secrets: [password] },
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    for (const name of ["private.json", "stop", "expire", "host.lock"])
      await rm(file(name), { force: true });
  }
}
