import { etagSchema } from "@aarili/contracts/request";
export function versionTag(version: number) {
  return `"v${version}"`;
}
export function parseExpectedVersion(header: string | undefined):
  | { ok: true; version: number }
  | {
      ok: false;
      status: 428 | 422;
      code: "PRECONDITION_REQUIRED" | "VALIDATION_FAILED";
    } {
  if (header === undefined)
    return { ok: false, status: 428, code: "PRECONDITION_REQUIRED" };
  if (!etagSchema.safeParse(header).success)
    return { ok: false, status: 422, code: "VALIDATION_FAILED" };
  return { ok: true, version: Number(header.slice(2, -1)) };
}
