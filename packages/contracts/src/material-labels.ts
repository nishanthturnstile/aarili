import { z } from "zod";
import { documentStatusSchema } from "./documents.js";

const id = z.uuid().transform((v) => v.toLowerCase());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const name = z.strictObject({
  en: z.string().min(1).max(200),
  ta: z.string().min(1).max(200),
});
export const materialLabelSelectionSchema = z.strictObject({
  orderId: id,
  pieceId: id.nullable(),
  copies: z.number().int().min(1).max(64),
});
export type MaterialLabelSelection = z.infer<
  typeof materialLabelSelectionSchema
>;
export const materialLabelReviewCommandSchema = z
  .strictObject({
    selections: z.array(materialLabelSelectionSchema).min(1).max(32),
  })
  .refine(
    (v) =>
      v.selections.reduce((n, s) => n + s.copies, 0) <= 64 &&
      new Set(v.selections.map((s) => `${s.orderId}/${s.pieceId}`)).size ===
        v.selections.length,
  );
// This is a separate allowlist, never a private job slip with hidden fields.
export const materialLabelModelSchema = z.strictObject({
  kind: z.literal("material-labels.v1"),
  audience: z.literal("minimal-label"),
  language: z.enum(["en", "ta"]),
  issued: z
    .strictObject({
      docId: id,
      revision: z.number().int().positive(),
      at: z.iso.datetime(),
    })
    .nullable(),
  labels: z
    .array(
      z.strictObject({
        orderId: id,
        orderCode: z.string().min(1).max(120),
        pieceId: id.nullable(),
        pieceName: name.nullable(),
        garment: name,
        quantity: z.number().int().positive().nullable(),
        copy: z.number().int().positive(),
        copies: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(64),
});
export type MaterialLabelModel = z.infer<typeof materialLabelModelSchema>;
export const materialLabelHistorySchema = z.strictObject({
  docId: id,
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  language: z.enum(["en", "ta"]),
  sourceDigest: hash,
  revoked: z.boolean(),
});
export type MaterialLabelHistory = z.infer<typeof materialLabelHistorySchema>;
export const materialLabelReviewSchema = z.strictObject({
  model: materialLabelModelSchema,
  version: z.number().int().positive(),
  sourceDigest: hash,
  history: z.array(materialLabelHistorySchema).max(25),
});
export const materialLabelIssueSchema = z.strictObject({
  selections: z.array(materialLabelSelectionSchema).min(1).max(32),
  docId: id,
  revision: z.number().int().positive().max(2147483647),
  language: z.enum(["en", "ta"]),
  sourceDigest: hash,
  acknowledged: z.literal(true),
});
export type MaterialLabelIssue = z.infer<typeof materialLabelIssueSchema>;
export const materialLabelIssueResultSchema = z.strictObject({
  status: documentStatusSchema,
  sourceDigest: hash,
});

export type MaterialLabelReview = z.infer<typeof materialLabelReviewSchema>;

export const materialLabelCandidatesQuerySchema = z.strictObject({
  before: id.optional(),
});
export const materialLabelCandidatesSchema = z.strictObject({
  orders: z
    .array(
      z.strictObject({
        orderId: id,
        orderCode: z.string().min(1).max(120),
        garment: name,
        pieces: z.array(z.strictObject({ pieceId: id, name })).max(32),
      }),
    )
    .max(20),
  next: id.nullable(),
});
export type MaterialLabelCandidates = z.infer<
  typeof materialLabelCandidatesSchema
>;
