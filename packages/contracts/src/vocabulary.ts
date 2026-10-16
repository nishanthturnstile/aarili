import { z } from "zod";

const label = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => value.trim().length > 0);
export const vocabularyInputSchema = z.strictObject({
  labelTa: label,
  labelEn: label,
  aliases: z.array(label).max(100),
  reason: z
    .string()
    .min(1)
    .max(240)
    .refine((value) => value.trim().length > 0),
});
export type VocabularyInput = z.infer<typeof vocabularyInputSchema>;
export const vocabularyRevisionSchema = vocabularyInputSchema.extend({
  id: z.uuid(),
  vocabularyId: z.uuid(),
  revision: z.number().int().min(1).max(2147483647),
  previousId: z.uuid().nullable(),
  eventId: z.uuid(),
  actorId: z.uuid(),
  algorithmVersion: z.literal(1),
});
export type VocabularyRevision = z.infer<typeof vocabularyRevisionSchema>;
