import { expect, test } from "vitest";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";

test("0.4.3a G1/G6 private media browser graph cannot import core, storage, repository or jobs", () => {
  for (const path of [
    "@aarili/core/media",
    "@aarili/db/media-repository",
    "@aarili/platform/media-storage",
    "@aarili/jobs/media",
    "@aarili/jobs/production",
    "@aarili/platform/media-validation",
  ]) {
    expect(
      checkBoundaries(
        new Map([["apps/web/src/owner.tsx", `import '${path}';`]]),
      ),
    ).toContainEqual(
      expect.stringContaining("browser graph reaches server package"),
    );
  }
});
