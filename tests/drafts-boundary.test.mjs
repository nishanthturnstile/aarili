import { expect, test } from "vitest";
import { checkBoundaries } from "../scripts/check-boundaries.mjs";

test("0.4.2a E8 production draft browser graph rejects server imports and test-only queue fixture", () => {
  expect(
    checkBoundaries(
      new Map([
        [
          "apps/web/src/owner.tsx",
          'import {mutateDraft} from "@aarili/core/drafts";',
        ],
      ]),
    ),
  ).toContainEqual(
    expect.stringContaining("browser graph reaches server package"),
  );
  expect(
    checkBoundaries(
      new Map([
        [
          "apps/web/src/server/draft.ts",
          'import "@aarili/jobs/draft-fixture";',
        ],
        ["packages/jobs/src/draft-fixture.ts", "export const fixture=true;"],
      ]),
    ),
  ).toContainEqual(expect.stringContaining("foundation exemplar"));
});
