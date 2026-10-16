import {
  clearOwnerState,
  completeMediaUpload,
  MediaRequestError,
  onOwnerInvalidation,
  requestMediaRead,
  requestMediaUpload,
} from "@aarili/api/client";
import { afterEach, expect, test, vi } from "vitest";

const id = "019a5e57-1111-7000-8000-000000000001";
const asset = {
  id,
  subjectId: id,
  purpose: "order-document" as const,
  contentType: "application/pdf" as const,
  size: 4,
  status: "processing" as const,
  version: 2,
  createdAt: "2026-10-16T00:00:00.000Z",
};
const input = {
  subjectId: id,
  purpose: "order-document" as const,
  contentType: "application/pdf" as const,
  size: 4,
};
afterEach(() => {
  vi.unstubAllGlobals();
  clearOwnerState();
});
test("0.4.3a G2/G3 typed media mutation client checks ETags and returns version-derived preconditions", async () => {
  for (const etag of [undefined, "*", '"v1"', '"v2"']) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ asset }, { headers: etag ? { ETag: etag } : {} }),
      ),
    );
    if (etag === '"v2"')
      expect(await completeMediaUpload(id, id, id, '"v1"')).toEqual({ asset });
    else
      await expect(completeMediaUpload(id, id, id, '"v1"')).rejects.toThrow(
        "REQUEST_FAILED",
      );
  }
  const upload = {
    asset: { ...asset, status: "pending_upload", version: 1 },
    upload: {
      url: "https://private.example.test/capability",
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      expiresAt: "2026-10-16T00:05:00.000Z",
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(upload, { headers: { ETag: '"v1"' } })),
  );
  expect(await requestMediaUpload(id, input, id)).toEqual(upload);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(upload)),
  );
  await expect(requestMediaUpload(id, input, id)).rejects.toThrow(
    "REQUEST_FAILED",
  );
});
test("0.4.3a G1/G5 malformed401 invalidates memory and shop403 retains safe status", async () => {
  const invalidate = vi.fn();
  const stop = onOwnerInvalidation(invalidate);
  try {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not JSON", { status: 401 })),
    );
    await expect(requestMediaRead(id, id)).rejects.toEqual(
      new MediaRequestError(401, "UNAUTHENTICATED"),
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { code: "SHOP_ACCESS_DENIED", message: "Denied" } },
          { status: 403 },
        ),
      ),
    );
    await expect(requestMediaRead(id, id)).rejects.toEqual(
      new MediaRequestError(403, "SHOP_ACCESS_DENIED"),
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
  } finally {
    stop();
  }
});
test("0.4.3a G5 late old identity response cannot reveal capability or invalidate new identity", async () => {
  for (const status of [200, 401]) {
    let release: (r: Response) => void = () => {};
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const pending = requestMediaRead(id, id);
    await Promise.resolve();
    clearOwnerState();
    const invalidate = vi.fn();
    const stop = onOwnerInvalidation(invalidate);
    release(
      status === 401
        ? new Response("not JSON", { status })
        : Response.json({
            url: "https://private.example.test/old-secret",
            filename: "file.pdf",
            expiresAt: "2026-10-16T00:05:00.000Z",
          }),
    );
    await expect(pending).rejects.toThrow("UNAUTHENTICATED");
    expect(invalidate).not.toHaveBeenCalled();
    stop();
  }
});
