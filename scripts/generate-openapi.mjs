import { mkdir, writeFile } from "node:fs/promises";
import { createApi } from "@aarili/api";
import { createCommandRoutes } from "@aarili/api/commands";

// Offline schema generation: no DB connection, credentials or external effect.
const api = createApi(async () => false);
api.route(
  "/",
  createCommandRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => {
      throw new Error("Offline schema only");
    },
    withOwnerCommand: async () => {
      throw new Error("Offline schema only");
    },
  }),
);
const document = api.getOpenAPI31Document({
  openapi: "3.1.0",
  info: { title: "Aarili development contracts", version: "0.2.3" },
});
await mkdir("test-results", { recursive: true });
await writeFile(
  "test-results/openapi.json",
  `${JSON.stringify(document, null, 2)}\n`,
);
console.info(
  `0.2.3 generated ${Object.keys(document.paths).length} health/command paths without mounting production API docs.`,
);
