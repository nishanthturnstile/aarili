import { mkdir, writeFile } from "node:fs/promises";
import { createApi } from "@aarili/api";
import { createCommandRoutes } from "@aarili/api/commands";
import { createCustomerRoutes } from "@aarili/api/customers";
import { createDocumentRoutes } from "@aarili/api/documents";
import { createDraftRoutes } from "@aarili/api/drafts";
import { createMediaRoutes } from "@aarili/api/media";
import { createWearerRoutes } from "@aarili/api/wearers";

// Offline schema generation: no DB connection, credentials or external effect.
const api = createApi(async () => false);
api.route(
  "/",
  createWearerRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerWearer: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createCustomerRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerCustomer: async () => {
      throw Error("Offline schema only");
    },
  }),
);
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
api.route(
  "/",
  createDraftRoutes({
    origin: "http://127.0.0.1:3155",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerDraft: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createMediaRoutes({
    origin: "http://127.0.0.1:3157",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerMedia: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createDocumentRoutes({
    origin: "http://127.0.0.1:3159",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerDocument: async () => {
      throw Error("Offline schema only");
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
  `0.2.3 generated ${Object.keys(document.paths).length} health/command/draft/media paths without mounting production API docs.`,
);
