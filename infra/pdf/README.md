# Private PDF renderer runtime

This is an explicit verification/runtime resource manifest for #59. No service,
provider, host deployment or production activation is created here. The future
worker image must preserve these tested constraints rather than disable sandboxing.

- Node 24.21.0 Bookworm slim: digest pinned in Dockerfile.
- pnpm 12.11.2; frozen filtered production install from the workspace lock.
- playwright-core 1.64.0; its exact Chromium distribution, full Chromium/new
  headless mode (`channel: chromium`), `chromiumSandbox: true`.
  Native Windows development uses the same pin's default Chromium headless shell
  with `chromiumSandbox: true`; Linux sandbox/golden proof uses this full build.
- Noto Sans and Noto Sans Tamil 5.3.0, regular/600: immutable vendored files,
  OFL notices and SHA-256 manifest in `packages/documents/assets/noto-5.3.0`.
- Non-root UID 1000; no host networking or published ports, no mounted secrets;
  read-only root, writable 256 MiB `/tmp`, 256 MiB shared memory, 1 CPU, 1 GiB RAM,
  256 process limit. No-new-privileges, all capabilities dropped except the
  SYS_CHROOT bounding capability needed for Chromium's namespace sandbox syscall.
  The actual renderer has zero effective capabilities. No SYS_ADMIN/privileged
  container, unconfined profile or no-sandbox flag is used.
- `seccomp.json` is the upstream Playwright v1.64.0 Docker seccomp profile,
  including clone/setns/unshare permission. Source:
  https://github.com/microsoft/playwright/blob/v1.64.0/utils/docker/seccomp_profile.json
  (Apache-2.0 notice retained alongside it).
- Production render concurrency is one; fresh context per document, all browser
  network routed to abort and a restrictive CSP; embedded fonts only. Browser
  starts on demand and closes after 60 seconds idle. Each context has a 45-second
  total budget, operations use 15-second limits where supported. Maximum accepted
  PDF is 25 MiB. Idle/working memory observations are tests, not an OS hard cap.
- The verification stage alone adds Poppler utilities for independent PDF page,
  embedded font, text and raster inspection. These are not application libraries.

`pnpm test:pdf` builds the scoped image and tests real non-root namespace/seccomp
status plus `/proc` renderer state, Tamil/Latin font embedding, A4/A3 boxes, page
breaks and exact synthetic reference images. Fluent Tamil review is deferred by
the owner; automated/technical golden review does not replace it.
