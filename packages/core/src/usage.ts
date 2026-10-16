import { usageEventSchema, usagePeriodSchema } from "@aarili/contracts/usage";
import type { UsageRepository } from "@aarili/db/repositories/usage";

const metricContext = {
  dateBasis: "audit_event.occurred_at (transaction timestamp), UTC [from,to)",
  denominator: null,
  zeroDenominator: "N/A",
  costComplete: false,
} as const;
export const usageMetricDefinitions = {
  events: {
    name: "committed_product_events",
    unit: "events",
    source: "product_event",
    ...metricContext,
  },
  mediaBytes: {
    name: "accepted_media_bytes",
    unit: "bytes",
    source: "media.stored",
    ...metricContext,
  },
  supportSeconds: {
    name: "explicit_support_effort",
    unit: "seconds",
    source: "support.recorded",
    ...metricContext,
  },
  draftsSaved: {
    name: "committed_draft_saves",
    unit: "events",
    source: "draft.saved",
    ...metricContext,
  },
  draftsPromoted: {
    name: "committed_draft_promotions",
    unit: "events",
    source: "draft.promoted",
    ...metricContext,
  },
  draftsAbandoned: {
    name: "committed_draft_abandonments",
    unit: "events",
    source: "draft.abandoned",
    ...metricContext,
  },
  pdfsRendered: {
    name: "accepted_pdf_renders",
    unit: "events",
    source: "pdf.rendered",
    ...metricContext,
  },
} as const;
export const usageMetricBasis = {
  date: "audit_event.occurred_at (transaction timestamp), UTC [from,to)",
  zeroDenominator: "N/A",
  costCompleteness:
    "incomplete: no monetary costs or unavailable messaging/AI consumption",
  media: "cumulative accepted bytes; not current retained storage",
  unavailable:
    "N/A until the source capability is instrumented; empty totals do not establish pilot outcomes",
} as const;
export function createUsageWriter(repository: UsageRepository) {
  return {
    async record(input: unknown) {
      await repository.append(usageEventSchema.parse(input));
    },
    async recordDraftEvent(event: {
      actionId: string;
      draftId: string;
      event: "saved" | "promoted" | "abandoned";
      schemaVersion: number;
    }): Promise<void> {
      await repository.append(
        usageEventSchema.parse({
          actionId: event.actionId,
          subjectId: event.draftId,
          name: `draft.${event.event}`,
          schemaVersion: event.schemaVersion,
        }),
      );
    },
    async read(input: unknown) {
      return repository.read(usagePeriodSchema.parse(input));
    },
  };
}
