import type { OwnerAuth } from "@aarili/auth";
import {
  apiErrorSchema,
  healthResponseSchema,
  healthUnavailableSchema,
} from "@aarili/contracts";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createBookingQuotationsRoutes } from "./booking-quotations.js";
import { createBookingRoutes } from "./bookings.js";
import { createCustomerHistoryRoutes } from "./customer-history.js";
import { createCustomerRoutes } from "./customers.js";
import { createDesignChoicesRoutes } from "./design-choices.js";
import { createDesignReferencesRoutes } from "./design-references.js";
import { createDesignSpecificationsRoutes } from "./design-specifications.js";
import { createDocumentRoutes } from "./documents.js";
import { createDraftRoutes } from "./drafts.js";
import { createGarmentEstimatesRoutes } from "./garment-estimates.js";
import { createJobSlipRoutes } from "./job-slips.js";
import { createManualPatternsRoutes } from "./manual-patterns.js";
import { createMaterialLabelRoutes } from "./material-labels.js";
import { createMeasurementSessionsRoutes } from "./measurement-sessions.js";
import { createMediaRoutes } from "./media.js";
import { createOrderRoutes } from "./orders.js";
import { createOwnerRoutes } from "./owner.js";
import { createPaymentsRoutes } from "./payments.js";
import { createQuotationIssueRoutes } from "./quotation-issues.js";
import { createQuotationRatesRoutes } from "./quotation-rates.js";
import { createRepeatOrderRoutes } from "./repeat-orders.js";
import { createServiceRepeatRoutes } from "./repeat-services.js";
import { createServiceTemplatesRoutes } from "./service-templates.js";
import { createShopCalendarRoutes } from "./shop-calendar.js";
import { createShopCommitmentsRoutes } from "./shop-commitments.js";
import { createShopPoliciesRoutes } from "./shop-policies.js";
import { createSmallServiceRoutes } from "./small-services.js";

export { createShopPoliciesRoutes };

import { createMeasurementFormsRoutes } from "./measurement-forms.js";
import { createServiceCatalogueRoutes } from "./service-catalogue.js";
import { createShopDirectoryRoutes } from "./shop-directory.js";

import { createShopProfileRoutes } from "./shop-profile.js";
import { createGuardianRoutes, createWearerRoutes } from "./wearers.js";

const healthRoute = createRoute({
  method: "get",
  path: "/healthz",
  responses: {
    200: {
      description: "Application and PostgreSQL readiness.",
      content: { "application/json": { schema: healthResponseSchema } },
    },
    503: {
      description: "Database is unavailable, unconfigured or timed out.",
      content: { "application/json": { schema: healthUnavailableSchema } },
    },
  },
});

export function createApi(
  checkDatabase: () => Promise<boolean>,
  owner?: OwnerAuth,
  reportFailure?: () => void,
) {
  const router = new OpenAPIHono().basePath("/api");
  router.use("*", async (c, next) => {
    await next();
    // Observe final responses, including child routes with their own onError.
    // Health 503 is also an operational failure; no request/error data leaves.
    if (c.res.status >= 500) {
      try {
        reportFailure?.();
      } catch {
        /* Diagnostics never change responses. */
      }
    }
  });
  const app = router.openapi(healthRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    let ready = false;
    try {
      ready = await checkDatabase();
    } catch {
      /* Never expose driver/configuration errors. */
    }
    if (!ready)
      return c.json(
        healthUnavailableSchema.parse({
          error: {
            code: "DATABASE_UNAVAILABLE",
            message: "Database is unavailable",
          },
        }),
        503,
      );
    return c.json(
      healthResponseSchema.parse({ status: "ok", service: "aarili-web" }),
      200,
    );
  });
  if (owner) {
    app
      .route("/", createJobSlipRoutes(owner))
      .route("/", createQuotationIssueRoutes(owner));
    app.route("/", createMaterialLabelRoutes(owner));
    app.route("/", createOwnerRoutes(owner));
    app.route("/", createCustomerRoutes(owner));
    app.route("/", createCustomerHistoryRoutes(owner));
    app.route("/", createBookingRoutes(owner));
    app.route("/", createOrderRoutes(owner));
    app.route("/", createRepeatOrderRoutes(owner));
    app.route("/", createSmallServiceRoutes(owner));
    app.route("/", createServiceRepeatRoutes(owner));
    app.route("/", createShopProfileRoutes(owner));
    app.route("/", createShopCalendarRoutes(owner));
    app.route("/", createShopPoliciesRoutes(owner));
    app.route("/", createQuotationRatesRoutes(owner));
    app.route("/", createPaymentsRoutes(owner));
    app.route("/", createGarmentEstimatesRoutes(owner));
    app.route("/", createBookingQuotationsRoutes(owner));
    app.route("/", createShopCommitmentsRoutes(owner));
    app.route("/", createShopDirectoryRoutes(owner));
    app.route("/", createServiceCatalogueRoutes(owner));
    app.route("/", createDesignChoicesRoutes(owner));
    app.route("/", createDesignSpecificationsRoutes(owner));
    app.route("/", createMeasurementSessionsRoutes(owner));
    app.route("/", createManualPatternsRoutes(owner));
    app.route("/", createDesignReferencesRoutes(owner));
    app.route("/", createMeasurementFormsRoutes(owner));
    app.route("/", createServiceTemplatesRoutes(owner));

    app.route("/", createWearerRoutes(owner));
    app.route("/", createGuardianRoutes(owner));
    app.route("/", createDraftRoutes(owner));
    app.route("/", createMediaRoutes(owner));
    app.route("/", createDocumentRoutes(owner));
  }
  app.notFound((c) =>
    c.json(
      apiErrorSchema.parse({
        error: { code: "NOT_FOUND", message: "Route not found" },
      }),
      404,
    ),
  );
  app.onError((_error, c) => {
    return c.json(
      apiErrorSchema.parse({
        error: { code: "INTERNAL_ERROR", message: "Request failed" },
      }),
      500,
    );
  });
  return app;
}
export type HealthRoutes = ReturnType<typeof createApi>;
