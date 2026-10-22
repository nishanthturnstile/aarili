import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { HistoryCursor } from "@aarili/core/customer-history";

// Separate purpose-derived key, authenticated encryption, no personal values.
// Tokens are memory-only and expire; deployments rotating auth secrets reset them.
export function historyCursorCodec(secret: string) {
  const key = createHash("sha256")
    .update("aarili:customer-history:v1\0")
    .update(secret)
    .digest();
  return {
    seal(value: HistoryCursor) {
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
      const data = Buffer.concat([
        cipher.update(JSON.stringify(value), "utf8"),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString(
        "base64url",
      );
    },
    open(value: string): unknown {
      const data = Buffer.from(value, "base64url");
      if (data.length < 29) throw Error("Invalid history cursor");
      const cipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          cipher.update(data.subarray(28)),
          cipher.final(),
        ]).toString("utf8"),
      );
    },
  };
}
