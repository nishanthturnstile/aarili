import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { createMediaStorage } from "./media-storage.js";

type Configuration = Parameters<typeof createMediaStorage>[0];
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
function check(key: string) {
  if (
    !new RegExp(
      `^shops/${uuid}/docs/${uuid}/[1-9][0-9]{0,9}-[0-9a-f]{64}\\.pdf$`,
    ).test(key)
  )
    throw Error("DOCUMENT_KEY_REJECTED");
}
function client(config: Configuration) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
    maxAttempts: 1,
    requestHandler: { requestTimeout: 10000, connectionTimeout: 3000 },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
// No filename, URL or arbitrary key comes from user content. Hash-bound keys
// are fixed by core; a conflict can only acknowledge byte-identical content.
export function createDocumentStorage(config: Configuration) {
  const s3 = client(config);
  async function existing(key: string, bytes: Buffer, sha256: string) {
    try {
      const prior = await s3.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
      const body = prior.Body;
      const close = () => {
        if (body && "destroy" in body && typeof body.destroy === "function")
          body.destroy();
      };
      if (!body || prior.ContentLength !== bytes.length) {
        close();
        throw Error("DOCUMENT_STORAGE_CONFLICT");
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        size += chunk.length;
        if (size > bytes.length) {
          close();
          throw Error("DOCUMENT_STORAGE_CONFLICT");
        }
        chunks.push(Buffer.from(chunk));
      }
      if (
        size !== bytes.length ||
        createHash("sha256").update(Buffer.concat(chunks)).digest("hex") !==
          sha256
      )
        throw Error("DOCUMENT_STORAGE_CONFLICT");
    } catch {
      throw Error("DOCUMENT_STORAGE_CONFLICT");
    }
  }
  return {
    async read(key: string) {
      check(key);
      try {
        const r = await s3.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
        const body = r.Body;
        if (!body) throw Error("DOCUMENT_STORAGE_UNAVAILABLE");
        const close = () => {
          if ("destroy" in body && typeof body.destroy === "function")
            body.destroy();
        };
        if (!r.ContentLength || r.ContentLength > 25 * 1024 * 1024) {
          close();
          throw Error("DOCUMENT_BYTES_REJECTED");
        }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const b of body as AsyncIterable<Uint8Array>) {
          size += b.length;
          if (size > 25 * 1024 * 1024) {
            close();
            throw Error("DOCUMENT_BYTES_REJECTED");
          }
          chunks.push(Buffer.from(b));
        }
        if (size !== r.ContentLength) throw Error("DOCUMENT_BYTES_REJECTED");
        return new Uint8Array(Buffer.concat(chunks));
      } catch {
        throw Error("DOCUMENT_STORAGE_UNAVAILABLE");
      }
    },
    async put(key: string, input: Uint8Array, sha256: string) {
      check(key);
      const bytes = Buffer.from(input);
      if (
        !bytes.length ||
        bytes.length > 25 * 1024 * 1024 ||
        createHash("sha256").update(bytes).digest("hex") !== sha256 ||
        !key.endsWith(`-${sha256}.pdf`)
      )
        throw Error("DOCUMENT_BYTES_REJECTED");
      let found = false;
      try {
        await s3.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
        found = true;
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "NotFound")
          throw Error("DOCUMENT_STORAGE_UNAVAILABLE");
      }
      if (found) {
        await existing(key, bytes, sha256);
        return;
      }
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: bytes,
            ContentType: "application/pdf",
            CacheControl: "private, no-store",
            IfNoneMatch: "*",
          }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "PreconditionFailed")
          throw Error("DOCUMENT_STORAGE_UNAVAILABLE");
        await existing(key, bytes, sha256);
      }
    },
    async signGet(key: string, filename: string) {
      check(key);
      if (
        !new RegExp(`^document-${uuid}-[1-9][0-9]{0,9}\\.pdf$`).test(filename)
      )
        throw Error("DOCUMENT_FILENAME_REJECTED");
      try {
        return await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: config.bucket,
            Key: key,
            ResponseContentType: "application/pdf",
            ResponseCacheControl: "private, no-store",
            ResponseContentDisposition: `attachment; filename="${filename}"`,
          }),
          { expiresIn: 300 },
        );
      } catch {
        throw Error("DOCUMENT_ACCESS_UNAVAILABLE");
      }
    },
    destroy: () => s3.destroy(),
  };
}
// Explicit operator-only capability; never available to ordinary document API
// composition, and never used as a general bucket/retention erasure facility.
export function createDocumentOrphanStorage(config: Configuration) {
  const s3 = client(config);
  return {
    async has(key: string) {
      check(key);
      try {
        await s3.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
        return true;
      } catch (error) {
        if (error instanceof Error && error.name === "NotFound") return false;
        throw Error("DOCUMENT_MAINTENANCE_UNAVAILABLE");
      }
    },
    async remove(key: string) {
      check(key);
      try {
        await s3.send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
      } catch {
        throw Error("DOCUMENT_MAINTENANCE_UNAVAILABLE");
      }
    },
    destroy: () => s3.destroy(),
  };
}
