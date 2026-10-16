import { mediaTechnicalLimits } from "@aarili/contracts/media";
export class PhotoPreparationError extends Error {
  constructor(
    public readonly code:
      | "PHOTO_LIMIT"
      | "CONVERSION_REQUIRED"
      | "PREPARATION_FAILED"
      | "FILE_UNSUPPORTED",
  ) {
    super(code);
  }
}
// Native decoding and canvas encoding only. No upload, persistence, analytics,
// filename inference or remote decoder. HEIC success is device-dependent.
export async function preparePrivateFile(file: File): Promise<Blob> {
  const type = file.type.toLowerCase();
  if (
    ["application/pdf", "audio/mpeg", "audio/mp4", "audio/wav"].includes(type)
  ) {
    if (!file.size || file.size > mediaTechnicalLimits.documentAudioBytes)
      throw new PhotoPreparationError("PHOTO_LIMIT");
    return file;
  }
  const heic = ["image/heic", "image/heif"].includes(type);
  if (!["image/jpeg", "image/png", "image/webp"].includes(type) && !heic)
    throw new PhotoPreparationError("FILE_UNSUPPORTED");
  if (!file.size || file.size > mediaTechnicalLimits.imageBytes)
    throw new PhotoPreparationError("PHOTO_LIMIT");
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > mediaTechnicalLimits.imagePixels
    )
      throw new PhotoPreparationError("PHOTO_LIMIT");
    const scale = Math.min(
      1,
      mediaTechnicalLimits.displayEdge / Math.max(bitmap.width, bitmap.height),
    );
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw Error();
    // Fixed JPEG alpha matte belongs to encoded content, independent of UI theme.
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas?.toBlob(
        (value) => (value ? resolve(value) : reject(Error())),
        "image/jpeg",
        0.8,
      ),
    );
    if (
      blob.type !== "image/jpeg" ||
      !blob.size ||
      blob.size > mediaTechnicalLimits.imageBytes
    )
      throw Error();
    return blob;
  } catch (error) {
    if (error instanceof PhotoPreparationError) throw error;
    throw new PhotoPreparationError(
      heic ? "CONVERSION_REQUIRED" : "PREPARATION_FAILED",
    );
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
