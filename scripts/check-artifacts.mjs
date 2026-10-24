import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let checked = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) inspect(path);
    else {
      const output = readFileSync(path, "utf8");
      for (const privateSymbol of [
        "issueJobSlip",
        "quotationRatesRepository",
        "garmentEstimatesRepository",
        "estimateDraftWorkflow",
        "rateDraftWorkflow",
        "quotePolicyReviewWorkflow",
        "issueMaterialLabels",
        "materialLabelsRepository",
        "redact_material_labels",
        "jobSlipSources",
        "jobSlipsRepository",
        "jobSlipPurgeRepository",
        "redact_job_slip",
        "PRIVATE-FITTING-SENTINEL-169",
      ])
        assert(
          !output.includes(privateSymbol),
          "Private job-slip runtime entered browser output",
        );
      assert(
        !output.includes("aarili-private-probe-issue-2"),
        "Server canary entered browser output",
      );
      assert(
        !output.includes("aarili-setup-probe-issue-12"),
        "Setup token canary entered browser output",
      );
      for (const secret of [
        "aarili-google-private-probe-issue-14",
        "synthetic-google-secret-14",
      ]) {
        assert(
          !output.includes(secret),
          "Google client secret entered browser output",
        );
      }
      assert(
        !output.includes("googleFromEnvironment"),
        "Google server configuration entered browser output",
      );
      assert(
        !output.includes("ownerAuthFromEnvironment"),
        "Server auth entered browser output",
      );
      assert(
        !output.includes("executeSynthetic") &&
          !output.includes("commandRepository") &&
          !output.includes("createCommandRoutes"),
        "0.2.3 command/server code entered browser output",
      );
      assert(
        !output.includes("mutateDraft") &&
          !output.includes("draftRepository") &&
          !output.includes("enqueueDraftFixtureJob") &&
          !output.includes("createDraftRoutes"),
        "0.4.2a draft/server code entered browser output",
      );
      assert(
        !output.includes("@t3-oss/env-core"),
        "Server environment package entered browser output",
      );
      assert(
        !output.includes("postJournal") &&
          !output.includes("journalRepository"),
        "0.3.1c journal/server code entered browser output",
      );
      assert(
        !output.includes("syntheticJobWriter") &&
          !output.includes("handleSyntheticJob") &&
          !output.includes("startJobRuntime") &&
          !output.includes("configure_job_schedule") &&
          !output.includes("pg-boss"),
        "0.3.2a queue/server code entered browser output",
      );
      assert(
        !output.includes("createDocumentRenderer") &&
          !output.includes("DOCUMENT_FONT_MANIFEST_INVALID") &&
          !output.includes("playwright-core") &&
          !output.includes("validatePrivateMedia") &&
          !output.includes("media_derivative_guard") &&
          !output.includes("libvips"),
        "0.4.3b native decoder/server code entered browser output",
      );
      assert(
        !output.includes("guardedEffect") &&
          !output.includes("restoreRepository") &&
          !output.includes("prospectiveAuthDelivery") &&
          !output.includes("RESTORE_OPERATOR_DATABASE_URL"),
        "0.3.2b restore/operator server code entered browser output",
      );
      assert(
        !output.includes("Invalid server environment configuration"),
        "Server validation code entered browser output",
      );
      assert(
        !output.includes("mutateDraft") &&
          !output.includes("draftRepository") &&
          !output.includes("enqueueDraftFixtureJob") &&
          !output.includes("createDraftRoutes"),
        "0.4.2a draft/server code entered browser output",
      );
      for (const marker of [
        "createPrivateTelemetry",
        "aarili-private-observability",
        "SENTRY_DSN",
        "private-name-canary-54",
        "private-token-canary-54",
      ]) {
        assert(
          !output.includes(marker),
          "0.4.1d private telemetry entered browser artifacts",
        );
      }
      for (const marker of [
        "createMediaStorage",
        "mediaRepository",
        "mediaJobWriter",
        "mediaProcessingHost",
        "processMedia",
        "createMediaRoutes",
        "GARAGE_DEFAULT_SECRET_KEY",
      ]) {
        assert(
          !output.includes(marker),
          "0.4.3a private media server code entered browser artifacts",
        );
      }
      checked++;
    }
  }
}
inspect("apps/web/.next/static");
inspect("apps/web/public");
assert(checked > 0, "No browser build output found");
console.info(
  `0.1.1a checked ${checked} browser artifacts for synthetic private configuration leakage.`,
);
