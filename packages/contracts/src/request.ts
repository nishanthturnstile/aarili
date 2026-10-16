import { z } from "zod";
export const actorSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("user"), id: z.uuid() }),
  z.strictObject({ type: z.literal("system"), id: z.uuid() }),
  z.strictObject({ type: z.literal("import"), id: z.uuid() }),
  z.strictObject({ type: z.literal("support"), id: z.uuid() }),
]);
export type Actor = z.infer<typeof actorSchema>;
export const idempotencyHeaderSchema = z.uuid();
export const etagSchema = z
  .string()
  .regex(/^"v[1-9][0-9]*"$/)
  .refine(
    (value) =>
      Number.isSafeInteger(Number(value.slice(2, -1))) &&
      Number(value.slice(2, -1)) <= 2147483647,
  );
