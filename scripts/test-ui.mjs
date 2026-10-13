import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { withPostgres } from "./test-support/postgres.mjs";

await withPostgres(async ({ connectionString }) => {
  const child = spawn(
    process.execPath,
    [
      resolve("node_modules/@playwright/test/cli.js"),
      "test",
      ...process.argv.slice(2),
    ],
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: connectionString },
    },
  );
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`Playwright exited with ${code}`);
});
