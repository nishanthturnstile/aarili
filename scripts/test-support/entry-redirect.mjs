// Read-only redirect probes retain their response assertions in the caller.
export function readEntryRedirect(context, url) {
  // Playwright retries only ECONNRESET here; HTTP/status failures stay visible.
  return context.get(url, { maxRedirects: 0, maxRetries: 1 });
}
