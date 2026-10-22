// Disposable loopback review: synthetic records, private access file, no outbound mail.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  publishSpecification,
  specificationDraft,
  specificationSources,
} from "./test-support/design-specification-fixtures.mjs";
import { withOwnerWeb } from "./test-support/owner-web.mjs";
import { seedQuickOrder } from "./test-support/seed-quick-order.mjs";

const directory = resolve(".scratch/design-specifications-review-host");
const file = (name) => resolve(directory, name);
await mkdir(directory, { recursive: true });
if (process.argv[2] === "stop") {
  await writeFile(file("stop"), "requested");
  console.info("Design-specification review stop requested.");
} else {
  await (await open(file("host.lock"), "wx")).close();
  await rm(file("stop"), { force: true });
  const email = "design-review@example.test",
    password = randomBytes(24).toString("hex");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await withOwnerWeb(
      async ({ origin, setupToken, code, seedCommand, runtime }) => {
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
          { name: "SYNTHETIC Design owner", email, password },
          { "X-Setup-Token": setupToken, "Idempotency-Key": randomUUID() },
        );
        await request("/owner/verify", { code: await code() });
        await request("/auth/sign-in/email", { email, password });
        await request(
          "/owner/complete",
          { shopName: "SYNTHETIC Design specifications" },
          { "Idempotency-Key": randomUUID() },
        );
        const { shop } = await request("/owner/entry");
        const fixture = {
          a: {
            shop: shop.shopId,
            cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          },
          owner: { origin },
          api: { fetch: seedCommand },
        };
        const seed = await seedQuickOrder(runtime, shop.shopId);
        const base = await specificationSources(fixture, {
          customerId: seed.customer.customerId,
          wearerId: seed.wearer.wearerId,
        });
        const target = await base.accept(),
          source = await base.accept();
        const pieceId = target.pieces.identities.find(
          (p) => p.key === base.top.definition.content.code,
        ).id;
        const sourcePiece = source.pieces.identities.find(
          (p) => p.key === base.top.definition.content.code,
        ).id;
        await publishSpecification(
          fixture,
          specificationDraft(target.order.id, pieceId, base.profile),
        );
        await publishSpecification(
          fixture,
          specificationDraft(source.order.id, sourcePiece, base.profile),
        );
        await seed.close();
        await writeFile(
          file("private.json"),
          JSON.stringify({
            origin,
            email,
            password,
            url: `${origin}/orders?order=${target.order.id}`,
            profileId: base.profile.entryId,
            orderId: target.order.id,
            pieceId,
            sourceOrderId: source.order.id,
            choiceIds: base.choices.map((c) => c.entryId),
          }),
          { mode: 0o600 },
        );
        console.info(
          `Design-specification review ready: ${origin}/orders?order=${target.order.id}`,
        );
        console.info(
          `Private sign-in: ${directory}/private.json (never publish).`,
        );
        while (!stopping) {
          try {
            await readFile(file("stop"));
            break;
          } catch {}
          await delay(500);
        }
      },
      { secrets: [password] },
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    for (const name of ["private.json", "stop", "host.lock"])
      await rm(file(name), { force: true });
  }
}
