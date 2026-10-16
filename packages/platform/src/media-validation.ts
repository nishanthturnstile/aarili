import sharp from "sharp";
import { MediaContentRejected } from "./media-content-error.js";
import { validateAudio, validatePdf } from "./private-attachments.js";

export { MediaContentRejected } from "./media-content-error.js";
export type ProcessedMedia = {
  original: Uint8Array;
  derivatives: {
    variant: "display" | "thumbnail";
    bytes: Uint8Array;
    width: number;
    height: number;
    contentType: "image/webp";
  }[];
};
// No URL, filename, filesystem path, renderer or external-command input. Only
// the already bounded staging snapshot enters a native decoder.
export async function validatePrivateMedia(
  input: Uint8Array,
  type: string,
): Promise<ProcessedMedia> {
  const bytes = Buffer.from(input);
  const image = type.startsWith("image/");
  if (!bytes.length || bytes.length > (image ? 20 : 25) * 1024 * 1024)
    throw new MediaContentRejected();
  if (!image) {
    if (type === "application/pdf") validatePdf(bytes);
    else validateAudio(bytes, type);
    return { original: bytes, derivatives: [] };
  }
  const signature =
    type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : type === "image/webp"
          ? bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP" &&
            bytes.readUInt32LE(4) + 8 === bytes.length
          : false;
  if (!signature) throw new MediaContentRejected();
  try {
    const options = {
      limitInputPixels: 40_000_000,
      failOn: "warning" as const,
      sequentialRead: true,
      unlimited: false,
    };
    const metadata = await sharp(bytes, options)
      .timeout({ seconds: 15 })
      .metadata();
    const expected = type.slice(6);
    if (
      metadata.format !== expected ||
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > 40_000_000 ||
      (metadata.pages ?? 1) !== 1
    )
      throw new MediaContentRejected();
    const source = () =>
      sharp(bytes, options).autoOrient().timeout({ seconds: 15 });
    // Default sharp encoding strips all metadata, including EXIF/GPS. Do not
    // call keepMetadata/withMetadata on any accepted original or derivative.
    const original = await (expected === "jpeg"
      ? source().jpeg({ quality: 90 })
      : expected === "png"
        ? source().png()
        : source().webp({ quality: 90 })
    ).toBuffer();
    const derivatives: ProcessedMedia["derivatives"] = [];
    for (const [variant, edge] of [
      ["display", 1600],
      ["thumbnail", 320],
    ] as const) {
      const { data, info } = await source()
        .resize({
          width: edge,
          height: edge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      derivatives.push({
        variant,
        bytes: data,
        width: info.width,
        height: info.height,
        contentType: "image/webp",
      });
    }
    if (original.length > 20 * 1024 * 1024) throw new MediaContentRejected();
    return { original, derivatives };
  } catch (error) {
    if (error instanceof MediaContentRejected) throw error;
    // Never leak native decoder diagnostics or file content.
    throw new MediaContentRejected();
  }
}
