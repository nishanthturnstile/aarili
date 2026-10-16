import * as api from "@aarili/api/client";
import { afterEach, expect, test, vi } from "vitest";
import { createPrivateUpload } from "../apps/web/src/app/media-upload.ts";
import { createWorkGuard } from "../apps/web/src/app/pwa-runtime.ts";

const id = "019a5e57-1111-7000-8000-000000000001";
const asset = {
  id,
  subjectId: id,
  purpose: "manual-pattern",
  contentType: "image/jpeg",
  size: 4,
  status: "pending_upload",
  version: 1,
  createdAt: "2026-10-16T00:00:00.000Z",
};
const grant = {
  asset,
  upload: {
    url: "https://storage.invalid/synthetic",
    headers: { "Content-Type": "image/jpeg" },
    method: "PUT",
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
};
function nativeStub() {
  vi.stubGlobal("createImageBitmap", async () => ({
    width: 30,
    height: 20,
    close() {},
  }));
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob: (callback) =>
        callback(new Blob(["jpeg"], { type: "image/jpeg" })),
    }),
  });
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  api.clearOwnerState();
});
test("0.4.3b H1/H6 uncertain completion replays exact key/version; selected work blocks update and queued is not ready", async () => {
  nativeStub();
  const guard = createWorkGuard(),
    controller = createPrivateUpload({
      shopId: id,
      subjectId: id,
      purpose: "manual-pattern",
      guard,
    });
  vi.spyOn(api, "requestMediaUpload").mockResolvedValue(grant);
  const complete = vi
    .spyOn(api, "completeMediaUpload")
    .mockRejectedValueOnce(Error("Lost response"))
    .mockResolvedValue({
      asset: { ...asset, status: "processing", version: 2 },
    });
  const put = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", put);
  await controller.select(
    new File(["source"], "synthetic.jpg", { type: "image/jpeg" }),
  );
  expect(controller.snapshot().state).toBe("selected");
  expect(guard.safe()).toBe(false);
  await controller.upload();
  expect(controller.snapshot().state).toBe("uncertain");
  expect(guard.safe()).toBe(false);
  await controller.upload();
  expect(controller.snapshot().state).toBe("processing");
  expect(guard.safe()).toBe(true);
  expect(complete.mock.calls).toHaveLength(2);
  expect(complete.mock.calls[0]).toEqual(complete.mock.calls[1]);
  expect(put).toHaveBeenCalledTimes(1);
  controller.dispose();
});
test("0.4.3b H6 owner invalidation aborts memory scope and rejects late capability; definitive rejection is not unknown", async () => {
  nativeStub();
  let resolve;
  const admission = vi.spyOn(api, "requestMediaUpload").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const controller = createPrivateUpload({
    shopId: id,
    subjectId: id,
    purpose: "manual-pattern",
  });
  await controller.select(
    new File(["source"], "synthetic.jpg", { type: "image/jpeg" }),
  );
  const pending = controller.upload();
  api.clearOwnerState();
  resolve(grant);
  await pending;
  expect(controller.snapshot()).toMatchObject({
    state: "accessEnded",
    asset: null,
    bytes: null,
    busy: false,
  });
  await controller.upload();
  expect(admission).toHaveBeenCalledTimes(1);
  controller.dispose();
  admission.mockRejectedValue(
    new api.MediaRequestError(422, "VALIDATION_FAILED"),
  );
  const next = createPrivateUpload({
    shopId: id,
    subjectId: id,
    purpose: "manual-pattern",
  });
  await next.select(
    new File(["source"], "synthetic.jpg", { type: "image/jpeg" }),
  );
  await next.upload();
  expect(next.snapshot()).toMatchObject({
    state: "failed",
    error: "REQUEST_REJECTED",
  });
  next.dispose();
});
