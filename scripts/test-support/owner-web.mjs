import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { ownerAuthFromEnvironment } from "@aarili/auth";
import pg from "pg";
import { migrateDatabase } from "../migrate.mjs";
import { createOwnerVerificationApi } from "./owner-api.mjs";
import { withPostgres } from "./postgres.mjs";

// Each UI language/device scenario gets its own disposable DB + production web
// process. Migration credentials stay in this fixture, never the web environment.
export async function withOwnerWeb(
  run,
  { onFailure, secrets = [], google } = {},
) {
  return withPostgres(
    async ({
      connectionString,
      migrationConnectionString,
      adminConnectionString,
      stop,
    }) => {
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
        // Accidental provider configuration cannot select a transport.
        RESEND_API_KEY: "synthetic-outbound-disabled-canary",
        SMTP_URL: "https://invalid.example.test",
        NODE_ENV: "production",
        ...(google
          ? {
              AUTH_GOOGLE_ENABLED: "true",
              AUTH_GOOGLE_ENVIRONMENT: "development",
              AUTH_GOOGLE_APPROVED_ORIGIN: origin,
              AUTH_GOOGLE_ALLOWED_EMAILS: "owner@example.test",
              GOOGLE_DEV_CLIENT_ID: "synthetic-google-client-14",
              GOOGLE_DEV_CLIENT_SECRET: "synthetic-google-secret-14",
              TEST_GOOGLE_TRANSPORT_ORIGIN: google.origin,
              NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import="${pathToFileURL(resolve("scripts/test-support/google-transport.mjs"))}"`,
            }
          : { AUTH_GOOGLE_ENABLED: "false" }),
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
      const runtime = new pg.Pool({ connectionString });
      let probeOwner;
      async function probeRecent(headers) {
        probeOwner ??= ownerAuthFromEnvironment(webEnv);
        return createOwnerVerificationApi(async () => true, probeOwner).fetch(
          new Request(`${origin}/api/owner/sensitive-probe`, {
            method: "POST",
            headers,
          }),
        );
      }
      web.stdout.on("data", (b) => {
        output += b;
      });
      web.stderr.on("data", (b) => {
        output += b;
      });
      async function code(purpose = "verification") {
        const files = await readdir(captureDirectory);
        const messages = await Promise.all(
          files.map(async (file) => ({
            message: JSON.parse(
              await readFile(join(captureDirectory, file), "utf8"),
            ),
            time: (await stat(join(captureDirectory, file))).mtimeMs,
          })),
        );
        const found = messages
          .filter(
            ({ message }) => (message.purpose ?? "verification") === purpose,
          )
          .sort((a, b) => a.time - b.time)
          .at(-1);
        if (!found) throw new Error("Synthetic mail was not captured");
        return found.message.code;
      }
      const privateValues = new Set([setupToken, ...secrets]);
      async function privateCaptures() {
        for (const value of secrets) privateValues.add(value);
        for (const file of await readdir(captureDirectory)) {
          const message = JSON.parse(
            await readFile(join(captureDirectory, file), "utf8"),
          );
          privateValues.add(message.code);
        }
      }
      let phase = "readiness";
      try {
        let ready = false;
        for (let n = 0; n < 150; n++) {
          if (web.exitCode !== null)
            throw new Error("Synthetic web failed to boot");
          try {
            const health = await fetch(`${origin}/api/healthz`, {
              signal: AbortSignal.timeout(5000),
            });
            await health.arrayBuffer();
            if (health.ok) {
              ready = true;
              break;
            }
          } catch {}
          await delay(100);
        }
        if (!ready) throw new Error("Synthetic web boot timed out");
        phase = "removed-route checks";
        for (const path of [
          "/api/dev/shops/019a5e55-2222-7000-8000-000000000001/records",
          "/api/dev/shops/019a5e55-2222-7000-8000-000000000001/records/019a5e55-2222-7000-8000-000000000002",
          "/api/owner/sensitive-probe",
          "/api/docs",
          "/api/openapi.json",
        ]) {
          for (const method of ["GET", "POST", "PATCH"]) {
            const response = await fetch(`${origin}${path}`, {
              method,
              signal: AbortSignal.timeout(5000),
            });
            // Node fetch does not deterministically release unread bodies.
            await response.arrayBuffer();
            if (response.status !== 404)
              throw new Error(
                `Retired runtime route remains available: ${method} ${path}`,
              );
          }
        }
        phase = "owner scenario";
        console.info("Owner fixture: retired routes denied; running scenario");
        await run({
          origin,
          setupToken,
          code,
          runtime,
          probeRecent,
          stopDatabase: stop,
          revokeOwnerMembership: async () => {
            // Disposable-fixture fault injection only. This credential never
            // enters the web process and proves no runtime bypass capability.
            const admin = new pg.Client({
              connectionString: adminConnectionString,
            });
            try {
              await admin.connect();
              await admin.query("delete from shop_membership");
            } finally {
              await admin.end();
            }
          },
        });
        phase = "private capture audit";
        console.info(
          "Owner fixture: scenario finished; checking private captures",
        );
        if (output.includes(setupToken))
          throw new Error("Setup token entered server logs");
        await privateCaptures();
        for (const value of privateValues) {
          if (output.includes(value))
            throw new Error("Auth code entered server logs");
        }
      } catch (error) {
        // Hard assertion errors can carry an ARIA snapshot with pasted tokens.
        // Throw a fresh sanitized error after blanking the page, before the
        // runner creates error-context/source artifacts or reports the failure.
        await privateCaptures();
        await onFailure?.();
        let message =
          error instanceof Error ? error.message : "Owner browser check failed";
        for (const value of privateValues)
          message = message.replaceAll(value, "[REDACTED]");
        throw new Error(`Owner fixture ${phase}: ${message}`);
      } finally {
        console.info("Owner fixture: stopping disposable web process");
        web.kill();
        let shutdownTimer;
        const stopped = await Promise.race([
          exit.then(() => true),
          new Promise((resolve) => {
            shutdownTimer = setTimeout(() => resolve(false), 5000);
          }),
        ]);
        clearTimeout(shutdownTimer);
        if (!stopped) {
          // Only this fixture's child. Production graceful shutdown is proved
          // separately by smoke; fixture cleanup cannot wait indefinitely.
          console.info("Owner fixture: forcing disposable web process cleanup");
          web.kill("SIGKILL");
          await exit;
        }
        await runtime.end();
        await probeOwner?.close();
        await rm(captureDirectory, { recursive: true, force: true });
      }
    },
  );
}
