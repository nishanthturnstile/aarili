import { z } from "zod";

// Queue metadata only. Personal content and arbitrary fields are rejected.
export const syntheticJobSchema = z.strictObject({
  requestId: z.uuid().transform((id) => id.toLowerCase()),
  shopId: z.uuid().transform((id) => id.toLowerCase()),
  initiatorId: z.uuid().transform((id) => id.toLowerCase()),
  entityId: z.uuid().transform((id) => id.toLowerCase()),
  version: z.number().int().min(1).max(2147483647),
});
export type SyntheticJob = z.infer<typeof syntheticJobSchema>;
