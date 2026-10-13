import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { migrateDatabase } from "../migrate.mjs";
import { withPostgres } from "./postgres.mjs";

// Each UI language/device scenario gets its own disposable DB + production web
// process. Migration credentials stay in this fixture, never the web environment.
export async function withOwnerWeb(run) {
  return withPostgres(
    async ({ connectionString, migrationConnectionString }) => {
      await migrateDatabase(migrationConnectionString);
      const socket = createServer();
      await new Promise((r) => socket.listen(0, "127.0.0.1", r));
      const port = socket.address().port;
      await new Promise((r) => socket.close(r));
      const captureDirectory = await mkdtemp(
        join(tmpdir(), "aarili-owner-mail-"),
      );
      const setupToken = randomBytes(32).toString("hex");
      const origin = `http://127.0.0.1:${port}`;
      const webEnv = {
        ...process.env,
        DATABASE_URL: connectionString,
        AUTH_ORIGIN: origin,
        BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
        SETUP_TOKEN: setupToken,
        AUTH_CAPTURE_DIRECTORY: captureDirectory,
        AARILI_SYNTHETIC_AUTH: "true",
        NODE_ENV: "production",
      };
      delete webEnv.MIGRATION_DATABASE_URL;
      delete webEnv.AARILI_UI_VERIFICATION;
      const web = spawn(
        process.execPath,
        [
          resolve("apps/web/node_modules/next/dist/bin/next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ],
        {
          cwd: resolve("apps/web"),
          env: webEnv,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const exit = once(web, "exit");
      let output = "";
      web.stdout.on("data", (b) => {
        output += b;
      });
      web.stderr.on("data", (b) => {
        output += b;
      });
      async function code() {
        const files = await readdir(captureDirectory);
        const file = files.at(-1);
        if (!file) throw new Error("Verification was not captured");
        return JSON.parse(await readFile(join(captureDirectory, file), "utf8"))
          .code;
      }
      try {
        let ready = false;
        for (let n = 0; n < 150; n++) {
          if (web.exitCode !== null)
            throw new Error("Synthetic web failed to boot");
          try {
            if ((await fetch(`${origin}/api/healthz`)).ok) {
              ready = true;
              break;
            }
          } catch {}
          await delay(100);
        }
        if (!ready) throw new Error("Synthetic web boot timed out");
        await run({ origin, setupToken, code });
        if (output.includes(setupToken))
          throw new Error("Setup token entered server logs");
      } finally {
        web.kill();
        await exit;
        await rm(captureDirectory, { recursive: true, force: true });
      }
    },
  );
}
