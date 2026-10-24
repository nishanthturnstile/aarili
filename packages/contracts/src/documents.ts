import { z } from "zod";

export const documentLocatorSchema = z.strictObject({
  shopId: z.uuid().transform((value) => value.toLowerCase()),
  docId: z.uuid().transform((value) => value.toLowerCase()),
  revision: z.number().int().min(1).max(2147483647),
  jobId: z.uuid().transform((value) => value.toLowerCase()),
  initiatorId: z.uuid().transform((value) => value.toLowerCase()),
  epoch: z.uuid().transform((value) => value.toLowerCase()),
});
export const documentIssueSchema = z.strictObject({
  docId: z.uuid().transform((value) => value.toLowerCase()),
  revision: z.number().int().min(1).max(2147483647),
  template: z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/),
  templateRevision: z.number().int().min(1).max(2147483647),
  language: z.enum(["en", "ta"]),
  paper: z.enum(["A4", "A3"]).default("A4"),
  model: z.unknown(),
});
export type DocumentIssue = z.infer<typeof documentIssueSchema>;
export type DocumentIssueInput = z.input<typeof documentIssueSchema>;
export const documentStatusSchema = z.strictObject({
  docId: z.uuid().transform((value) => value.toLowerCase()),
  revision: z.number().int().positive(),
  language: z.enum(["en", "ta"]),
  paper: z.enum(["A4", "A3"]),
  state: z.enum(["pending", "rendering", "failed", "ready"]),
  version: z.number().int().positive(),
  canRetry: z.boolean(),
  layoutFailure: z
    .string()
    .regex(/^label-(?:[1-9]|[1-5][0-9]|6[0-4])$/)
    .optional(),
  failure: z
    .enum([
      "RENDER_RETRYABLE",
      "RETRIES_EXHAUSTED",
      "RESTORE_BLOCKED",
      "PROCESSING_UNAVAILABLE",
    ])
    .nullable(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
});
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export const documentAccessSchema = z.strictObject({
  url: z.url(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export const documentShareCommandSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("prepared") }),
  z.strictObject({ kind: z.literal("marked-sent"), preparedId: z.uuid() }),
]);
export type DocumentShareCommand = z.infer<typeof documentShareCommandSchema>;
export const documentShareEventSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(["prepared", "marked-sent"]),
  actorId: z.uuid(),
  createdAt: z.iso.datetime(),
  preparedId: z.uuid().nullable(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type DocumentShareEvent = z.infer<typeof documentShareEventSchema>;
export const documentShareHistorySchema = z
  .array(documentShareEventSchema)
  .max(50);
