# Synthetic PDF reference images

Technical reference images for issue #59, produced from the 50 synthetic strings
in `packages/documents/test/template.mjs`. No real customer data is used.

The coordinator visually inspected all five actual PDF raster pages on
16 October 2026: three A4 pages and two A3 pages, including page breaks, repeated
table headers, long-name wrapping, mixed Latin/Tamil and rupee glyphs. These are
technical layout references; **fluent Tamil review remains owner-deferred** and
is still required before phase acceptance/live template activation.

`pnpm test:pdf` renders with pinned Playwright Chromium and the versioned Noto
font files, then independently rasterizes the PDF through Poppler. Page counts,
font embedding, font-program hashes and page boxes are inspected separately.
Pixel comparison allows at most 0.1% pixels with a channel difference above 24,
to tolerate small rasterization changes without accepting layout/shaping drift.
Nominal A4/A3 boxes use a one-point tolerance for Chromium CSS-pixel rounding;
this is not the later true-scale pattern-printing calibration requirement.

Regeneration is explicit: `pnpm test:pdf -- --update` (or invoke the script with
`--update`). Review every changed PDF page before committing. A missing reference
fails the ordinary check; CI never creates or approves new references silently.
