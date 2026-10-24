import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createApi, createShopPoliciesRoutes } from "@aarili/api";
import { createCommandRoutes } from "@aarili/api/commands";
import { createCustomerHistoryRoutes } from "@aarili/api/customer-history";
import { createCustomerRoutes } from "@aarili/api/customers";
import { createDesignChoicesRoutes } from "@aarili/api/design-choices";
import { createDesignReferencesRoutes } from "@aarili/api/design-references";
import { createDesignSpecificationsRoutes } from "@aarili/api/design-specifications";
import { createDocumentRoutes } from "@aarili/api/documents";
import { createDraftRoutes } from "@aarili/api/drafts";
import { createJobSlipRoutes } from "@aarili/api/job-slips";
import { createManualPatternsRoutes } from "@aarili/api/manual-patterns";
import { createMediaRoutes } from "@aarili/api/media";
import { createBookingRoutes, createOrderRoutes } from "@aarili/api/orders";
import { createServiceCatalogueRoutes } from "@aarili/api/service-catalogue";
import { createServiceTemplatesRoutes } from "@aarili/api/service-templates";
import { createShopCommitmentsRoutes } from "@aarili/api/shop-commitments";
import { createShopDirectoryRoutes } from "@aarili/api/shop-directory";
import { createShopProfileRoutes } from "@aarili/api/shop-profile";
import { createSmallServiceRoutes } from "@aarili/api/small-services";
import { createGuardianRoutes, createWearerRoutes } from "@aarili/api/wearers";

// Offline schema generation: no DB connection, credentials or external effect.
const api = createApi(async () => false);
api.route(
  "/",
  createJobSlipRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => 0,
    withOwnerJobSlips: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createManualPatternsRoutes({
    origin: "http://127.0.0.1:3103",
    withOwnerManualPatterns: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createDesignReferencesRoutes({
    origin: "http://127.0.0.1:3103",
    withOwnerDesignReferences: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createDesignSpecificationsRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => 0,
    withOwnerDesignSpecifications: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createCustomerHistoryRoutes({
    origin: "http://127.0.0.1:3103",
    withOwnerHistory: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createSmallServiceRoutes({
    origin: "http://127.0.0.1:3103",
    withOwnerSmallServices: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createBookingRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => 0,
    withOwnerQuickOrder: async () => {
      throw Error("Offline schema only");
    },
  }),
);
api.route(
  "/",
  createOrderRoutes({
    commandLimit: async () => 0,
    origin: "http://127.0.0.1:3103",
    withOwnerQuickOrder: async () => {
      throw Error("Offline schema only");
    },
  }),
);
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
api.route(
  "/",
  createDesignChoicesRoutes({
    origin: "http://127.0.0.1:3103",
    commandLimit: async () => null,
    withOwnerDesignChoices: async () => {
      throw Error("Offline design schema only");
    },
  }),
);
const document = api.getOpenAPI31Document({
  openapi: "3.1.0",
  info: { title: "Aarili development contracts", version: "0.2.3" },
});
for (const path of [
  "review",
  "list",
  "{id}/read",
  "{id}/history",
  "{id}/presentation",
])
  assert(
    document.paths[`/api/shops/{shopId}/orders/${path}`]?.post,
    `Missing accepted order contract ${path}`,
  );
assert(
  document.paths["/api/shops/{shopId}/orders/intake-preview"]?.post,
  "Missing Quick Order intake preview contract",
);
for (const path of ["candidates", "review", "read", "list", "history"])
  assert(
    document.paths[`/api/shops/{shopId}/orders/bookings/${path}`]?.post,
    `Missing booking contract ${path}`,
  );
for (const [path, method] of [
  ["", "get"],
  ["/history", "post"],
  ["/revisions/{id}", "get"],
  ["/preview", "post"],
  ["/bindings/{categoryId}", "get"],
  ["/binding-revisions/{id}", "get"],
  ["/binding-history", "post"],
  ["/bound-preview", "post"],
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
  ["profiles/list", "post"],
  ["profiles/history", "post"],
  ["profiles/{id}", "get"],
  ["orders/review", "post"],
  ["orders/list", "post"],
  ["orders/{id}", "get"],
])
  assert(
    document.paths[`/api/shops/{shopId}/small-services/${path}`]?.[method],
    `Missing small-service contract ${method} ${path}`,
  );
for (const [path, method] of [
  ["list", "post"],
  ["entries/{id}", "get"],
  ["history", "post"],
  ["revisions/{id}", "get"],
  ["definitions/{id}", "get"],
  ["preview", "post"],
  ["presentation", "post"],
])
  assert(
    document.paths[`/api/shops/{shopId}/settings/service-templates/${path}`]?.[
      method
    ],
    `Missing service template contract ${method} ${path}`,
  );
for (const [path, method] of [
  ["list", "post"],
  ["entries/{id}", "get"],
  ["history", "post"],
  ["revisions/{id}", "get"],
  ["definitions/{id}", "get"],
  ["preview", "post"],
])
  assert(
    document.paths[`/api/shops/{shopId}/settings/design-choices/${path}`]?.[
      method
    ],
    `Missing design choices contract ${method} ${path}`,
  );
for (const [path, method] of [
  ["list", "post"],
  ["versions/{id}", "get"],
  ["reuse", "post"],
])
  assert(
    document.paths[`/api/shops/{shopId}/design-specifications/${path}`]?.[
      method
    ],
    `Missing design specification contract ${method} ${path}`,
  );
for (const [path, method] of [
  ["library", "post"],
  ["subjects/{id}", "get"],
  ["subjects/list", "post"],
  ["assets", "post"],
  ["read", "post"],
  ["drafts/read", "post"],
])
  assert(
    document.paths[`/api/shops/{shopId}/design-references/${path}`]?.[method],
    `Missing reference contract ${method} ${path}`,
  );
for (const path of ["list", "compare", "assets", "read", "reuse"])
  assert(
    document.paths[`/api/shops/{shopId}/manual-patterns/${path}`]?.post,
    `Missing private pattern query contract ${path}`,
  );
await writeFile(
  "test-results/openapi.json",
  `${JSON.stringify(document, null, 2)}\n`,
);
console.info(
  `0.2.3 generated ${Object.keys(document.paths).length} health/command/draft/media paths without mounting production API docs.`,
);
