import { z } from "zod";

// SET-07/08: identifiers describe manual receiving destinations, never credentials.
const text = (max: number) => z.string().trim().max(max);
const label = text(160).min(1);
export const receivingMethodSchema = z.enum(["cash", "upi", "bank"]);
const account = z.strictObject({
  kind: z.literal("account"),
  label: text(160),
  active: z.boolean(),
  method: receivingMethodSchema,
  recipient: z.enum(["owner", "family"]),
  upiId: text(254),
  bankName: text(160),
  accountHolder: text(160),
  accountNumber: text(34),
  ifsc: text(11),
});
const vendor = z.strictObject({
  kind: z.literal("vendor"),
  label: text(160),
  active: z.boolean(),
  phone: text(40),
  capability: text(500),
  artisan: z.boolean(),
  supplier: z.boolean(),
});
const methods = z.strictObject({
  kind: z.literal("methods"),
  enabled: z.array(receivingMethodSchema).max(3),
});
export const directoryContentSchema = z.discriminatedUnion("kind", [
  account,
  vendor,
  methods,
]);
export type DirectoryContent = z.infer<typeof directoryContentSchema>;
export const directoryDraftSchema = z.strictObject({
  entryId: z.uuid(),
  baseVersion: z.number().int().min(0).max(2147483646),
  baseRevisionId: z.uuid().nullable(),
  content: directoryContentSchema,
});
export type DirectoryDraft = z.infer<typeof directoryDraftSchema>;
export const directoryCommandSchema = directoryDraftSchema.superRefine(
  (v, ctx) => {
    const issue = (path: string[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    if ((v.baseVersion === 0) !== (v.baseRevisionId === null))
      issue(["baseVersion"], "Invalid base revision");
    const c = v.content;
    if (c.kind === "methods") {
      if (new Set(c.enabled).size !== c.enabled.length)
        issue(["content", "enabled"], "Choose each method once");
      return;
    }
    if (!label.safeParse(c.label).success)
      issue(["content", "label"], "Enter a name");
    if (c.kind === "vendor") {
      if (!c.artisan && !c.supplier)
        issue(["content", "artisan"], "Choose artisan, supplier or both");
      return;
    }
    if (c.method === "upi" && !/^[^\s@]+@[^\s@]+$/.test(c.upiId))
      issue(["content", "upiId"], "Enter a UPI ID");
    if (c.method === "bank") {
      if (!c.bankName) issue(["content", "bankName"], "Enter the bank name");
      if (!c.accountHolder)
        issue(["content", "accountHolder"], "Enter the account holder");
      if (!/^[0-9]{4,34}$/.test(c.accountNumber))
        issue(["content", "accountNumber"], "Enter the account number");
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(c.ifsc))
        issue(["content", "ifsc"], "Enter an IFSC");
    }
    if (c.method !== "upi" && c.upiId)
      issue(["content", "upiId"], "Remove identifiers for the other method");
    if (
      c.method !== "bank" &&
      [c.bankName, c.accountHolder, c.accountNumber, c.ifsc].some(Boolean)
    )
      issue(["content", "bankName"], "Remove identifiers for the other method");
  },
);
export const directoryRevisionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  entryId: z.uuid(),
  version: z.number().int().positive(),
  previousId: z.uuid().nullable(),
  actorId: z.uuid(),
  effectiveAt: z.iso.datetime(),
  originDraftId: z.uuid(),
  content: directoryContentSchema,
});
export type DirectoryRevision = z.infer<typeof directoryRevisionSchema>;
// List responses deliberately omit full receiving identifiers and vendor contacts.
export const directorySummarySchema = z.strictObject({
  entryId: z.uuid(),
  kind: z.enum(["account", "vendor", "methods"]),
  version: z.number().int().positive(),
  label: z.string(),
  active: z.boolean(),
  maskedIdentifier: z.string(),
});
export type DirectorySummary = z.infer<typeof directorySummarySchema>;
export const directoryQuerySchema = z.strictObject({
  before: z.uuid().optional(),
});
export const directoryListSchema = z.strictObject({
  entries: z.array(directorySummarySchema),
  next: z.uuid().nullable(),
  readiness: z.enum([
    "missingMethods",
    "missingReceivingAccount",
    "configured",
  ]),
  paymentRecording: z.literal("notImplemented"),
});
export const directoryHistoryQuerySchema = z.strictObject({
  entryId: z.uuid(),
  beforeVersion: z.number().int().positive().optional(),
});
export const directoryHistorySchema = z.strictObject({
  revisions: z.array(directoryRevisionSchema),
  next: z.number().int().positive().nullable(),
});
export function summarizeDirectory(r: DirectoryRevision): DirectorySummary {
  const c = r.content;
  return {
    entryId: r.entryId,
    version: r.version,
    kind: c.kind,
    label: c.kind === "methods" ? c.enabled.join(", ") : c.label,
    active: c.kind === "methods" ? c.enabled.length > 0 : c.active,
    maskedIdentifier:
      c.kind !== "account" || c.method === "cash"
        ? ""
        : c.method === "bank"
          ? `••••${c.accountNumber.slice(-4)}`
          : `••••@${c.upiId.split("@")[1] ?? ""}`,
  };
}

export const directoryEntrySchema = z.strictObject({
  revision: directoryRevisionSchema.nullable(),
});
