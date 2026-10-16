import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// Server-only adapter. Never log SDK exceptions (they may contain signed requests).
// No ambient credentials/default endpoint; deployment activation is explicit.
export function createMediaStorage(config: {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 1,
    requestHandler: { requestTimeout: 10000, connectionTimeout: 3000 },
  });
  const keyAllowed = (
    key: string,
    kind: "staging" | "private" | "seal-prefix",
  ) => {
    const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    const suffix =
      kind === "staging"
        ? `${uuid}`
        : kind === "seal-prefix"
          ? `${uuid}/${uuid}`
          : `${uuid}/${uuid}/${uuid}`;
    if (
      !new RegExp(
        `^shops/${uuid}/${kind === "staging" ? "staging" : "private"}/${suffix}$`,
      ).test(key)
    )
      throw Error("Media storage key rejected");
  };
  return {
    async signPut(key: string, type: string, expires: number, now: Date) {
      keyAllowed(key, "staging");
      if (expires < 1 || expires > 300) throw Error("Media grant rejected");
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ContentType: type,
        }),
        {
          expiresIn: expires,
          signingDate: now,
          signableHeaders: new Set(["content-type"]),
        },
      ).catch(() => {
        throw Error("Private upload grant failed");
      });
    },
    async signGet(
      key: string,
      type: string,
      filename: string,
      expires: number,
      now: Date,
    ) {
      keyAllowed(key, "private");
      if (
        expires < 1 ||
        expires > 300 ||
        !/^file-[0-9a-f-]{36}\.[a-z0-9]+$/.test(filename)
      )
        throw Error("Media grant rejected");
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ResponseContentType: type,
          ResponseContentDisposition: `attachment; filename="${filename}"`,
          ResponseCacheControl: "private, no-store",
        }),
        { expiresIn: expires, signingDate: now },
      ).catch(() => {
        throw Error("Private read grant failed");
      });
    },
    async snapshot(key: string, maxBytes: number) {
      keyAllowed(key, "staging");
      if (maxBytes < 1 || maxBytes > 25 * 1024 * 1024)
        throw Error("Media snapshot rejected");
      try {
        const r = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        );
        if (!r.Body) throw Error();
        const body = r.Body;
        if ((r.ContentLength ?? Infinity) > maxBytes) {
          if ("destroy" in body && typeof body.destroy === "function")
            body.destroy();
          throw Error();
        }
        const chunks: Uint8Array[] = [];
        let length = 0;
        for await (const chunk of body as AsyncIterable<Uint8Array>) {
          length += chunk.length;
          if (length > maxBytes) throw Error();
          chunks.push(chunk);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        return bytes;
      } catch {
        throw Error("Private storage read failed");
      }
    },
    async seal(prefix: string, bytes: Uint8Array, type: string) {
      keyAllowed(prefix, "seal-prefix");
      // Caller can supply only a claim prefix, never an existing complete key.
      // Fresh opaque suffixes guarantee distinct destinations even on local S3
      // implementations that ignore If-None-Match. Never reuse a prior output.
      const key = `${prefix}/${crypto.randomUUID()}`;
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: bytes,
            ContentType: type,
            CacheControl: "private, no-store",
            ContentDisposition: "attachment",
            IfNoneMatch: "*",
          }),
        );
        return key;
      } catch {
        throw Error("Private storage seal failed");
      }
    },
    async removeStaging(key: string) {
      keyAllowed(key, "staging");
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
        );
      } catch {
        throw Error("Private staging cleanup failed");
      }
    },
    destroy() {
      client.destroy();
    },
  };
}
