import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createApi, createShopPoliciesRoutes } from "@aarili/api";
import { createCommandRoutes } from "@aarili/api/commands";
import { createCustomerRoutes } from "@aarili/api/customers";
import { createDocumentRoutes } from "@aarili/api/documents";
import { createDraftRoutes } from "@aarili/api/drafts";
import { createMediaRoutes } from "@aarili/api/media";
import { createServiceCatalogueRoutes } from "@aarili/api/service-catalogue";
import { createServiceTemplatesRoutes } from "@aarili/api/service-templates";
import { createShopCommitmentsRoutes } from "@aarili/api/shop-commitments";
import { createShopDirectoryRoutes } from "@aarili/api/shop-directory";
import { createShopProfileRoutes } from "@aarili/api/shop-profile";
import { createGuardianRoutes, createWearerRoutes } from "@aarili/api/wearers";

// Offline schema generation: no DB connection, credentials or external effect.
const api = createApi(async () => false);
api.route(
  "/",
  createShopPoliciesRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerShopPolicies: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createShopProfileRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerShopProfile: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createGuardianRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerGuardian: async () => {
      throw Error("Offline schema only");
    },
  }),
);
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
api.route(
  "/",
  createServiceCatalogueRoutes({
    origin: "http://127.0.0.1:3000",
    commandLimit: async () => null,
    withOwnerServiceCatalogue: async () => {
      throw Error("Offline catalogue generation");
    },
  }),
);
api.route(
  "/",
  createShopDirectoryRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerShopDirectory: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createShopCommitmentsRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => {
      throw Error("Offline schema only");
    },
    withOwnerShopCommitments: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createServiceTemplatesRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => null,
    withOwnerServiceTemplates: async () => {
      throw Error("Offline template generation");
    },
  }),
);
const document = api.getOpenAPI31Document({
  openapi: "3.1.0",
  info: { title: "Aarili development contracts", version: "0.2.3" },
});
for (const [path, method] of [
  ["", "get"],
  ["/history", "post"],
  ["/revisions/{id}", "get"],
  ["/preview", "post"],
])
  assert(
    document.paths[`/api/shops/{shopId}/settings/commitments${path}`]?.[method],
    `Missing commitment contract ${method} ${path}`,
  );
if (!document.paths["/api/shops/{shopId}/settings/policies/readiness"]?.get)
  throw Error("Commercial policy readiness contract is missing");
assert.equal(
  Object.keys(document.paths).filter((p) => p.includes("/settings/directory/"))
    .length,
  4,
  "Directory routes must be present in offline OpenAPI",
);
for (const [path, method] of [
  ["list", "post"],
  ["entries/{id}", "get"],
  ["history", "post"],
  ["revisions/{id}", "get"],
  ["definitions/{id}", "get"],
])
  assert(
    document.paths[`/api/shops/{shopId}/settings/catalogue/${path}`]?.[method],
    `Missing catalogue contract ${method} ${path}`,
  );

await mkdir("test-results", { recursive: true });
for (const [path, method] of [
  ["list", "post"],
  ["entries/{id}", "get"],
  ["history", "post"],
  ["revisions/{id}", "get"],
  ["definitions/{id}", "get"],
  ["preview", "post"],
])
  assert(
    document.paths[`/api/shops/{shopId}/settings/service-templates/${path}`]?.[
      method
    ],
    `Missing service template contract ${method} ${path}`,
  );
await writeFile(
  "test-results/openapi.json",
  `${JSON.stringify(document, null, 2)}\n`,
);
console.info(
  `0.2.3 generated ${Object.keys(document.paths).length} health/command/draft/media paths without mounting production API docs.`,
);
