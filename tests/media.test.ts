import {
  mediaAdmissionSchema,
  mediaTechnicalLimits,
} from "@aarili/contracts/media";
import {
  admitMedia,
  deniedMediaPolicy,
  type MediaContext,
  mediaFilename,
  processMedia,
} from "@aarili/core/media";
import { createMediaStorage } from "@aarili/platform/media-storage";
import { expect, test, vi } from "vitest";

const id = "019a5e57-1111-7000-8000-000000000001";
test("0.4.3a G1/G2 production unknown authority and unregistered validation fail closed", async () => {
  expect(
    await deniedMediaPolicy.authorize({
      action: "upload",
      subjectId: id,
      purpose: "wearer-photo",
      contentType: "image/png",
    }),
  ).toBeNull();
  expect(
    await processMedia(
      {
        transaction: async () => {
          throw Error("must not run");
        },
      },
      id,
      id,
      null,
    ),
  ).toBe("disabled");
  expect(
    mediaAdmissionSchema.safeParse({
      subjectId: id,
      purpose: "wearer-photo",
      size: 5,
      contentType: "image/png",
      guardianConsent: true,
    }).success,
  ).toBe(false);
  expect(mediaTechnicalLimits.imageBytes).toBe(20971520);
  expect(mediaTechnicalLimits.documentAudioBytes).toBe(26214400);
});
test("0.4.3a G1 AC-53 trusted minor photo still requires recorded guardian authority", async () => {
  const insert = vi.fn(() => {
    throw Error("Denied photo must never create an asset");
  });
  const ctx = {
    shopId: id,
    actor: { type: "user", id },
    repository: {
      lockKey: async () => {},
      replay: async () => undefined,
      insert,
    },
    policy: {
      authorize: async () => ({ minor: true, guardianConsent: false }),
    },
  } as unknown as MediaContext;
  await expect(
    admitMedia(
      ctx,
      {
        subjectId: id,
        purpose: "wearer-photo",
        contentType: "image/png",
        size: 4,
      },
      { key: id, requestId: id },
    ),
  ).rejects.toMatchObject({ status: 403, code: "MEDIA_ACCESS_DENIED" });
  await expect(
    admitMedia(
      ctx,
      {
        subjectId: id,
        purpose: "manual-pattern",
        contentType: "image/png",
        size: 4,
      },
      { key: id, requestId: id },
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    admitMedia(
      ctx,
      {
        subjectId: id,
        purpose: "voice-note",
        contentType: "image/png",
        size: 4,
      },
      { key: id, requestId: id },
    ),
  ).rejects.toMatchObject({ status: 422 });
  expect(insert).not.toHaveBeenCalled();
});
test("0.4.3a G2/G5/G6 storage key namespace and capability bounds reject before I/O", async () => {
  const storage = createMediaStorage({
    endpoint: "http://127.0.0.1:1",
    region: "garage",
    bucket: "synthetic",
    accessKeyId: "synthetic",
    secretAccessKey: "synthetic",
  });
  try {
    await expect(
      storage.signPut(
        `shops/${id}/private/${id}`,
        "image/png",
        300,
        new Date(),
      ),
    ).rejects.toThrow("key rejected");
    await expect(
      storage.removeStaging(`shops/${id}/private/${id}/${id}`),
    ).rejects.toThrow("key rejected");
    await expect(
      storage.signGet(
        `shops/${id}/private/${id}/${id}/${id}`,
        "application/pdf",
        "../../bad.pdf",
        300,
        new Date(),
      ),
    ).rejects.toThrow("grant rejected");
    await expect(
      storage.signPut(
        `shops/${id}/staging/${id}`,
        "image/png",
        301,
        new Date(),
      ),
    ).rejects.toThrow("grant rejected");
    expect(
      mediaFilename({ id, contentType: "application/pdf" } as Parameters<
        typeof mediaFilename
      >[0]),
    ).toBe(`file-${id}.pdf`);
  } finally {
    storage.destroy();
  }
});
