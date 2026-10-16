export class MediaContentRejected extends Error {
  constructor(
    public readonly reason: "malformed" | "unsupported" = "malformed",
  ) {
    super(
      reason === "unsupported"
        ? "MEDIA_PROFILE_UNSUPPORTED"
        : "MEDIA_CONTENT_REJECTED",
    );
  }
}
