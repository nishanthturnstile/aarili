import assert from "node:assert/strict";
import { productionJobComposition } from "@aarili/jobs/production";
import { test } from "vitest";

test("0.4.3b H5 production registries contain only reviewed media consumer and unknown private adapters fail closed", async () => {
  const composition = productionJobComposition();
  assert.deepEqual([...composition.handlers.keys()], ["media.process"]);
  const handler = composition.handlers.get("media.process");
  assert.equal(
    await handler(null, { content: "not a locator" }, async () => {}),
    "ignored",
  );
  const id = "019a5e57-1111-7000-8000-000000000001";
  await assert.rejects(
    () =>
      handler(
        null,
        { shopId: id, assetId: id, attemptId: id, initiatorId: id, epoch: id },
        async () => {},
      ),
    /adapter unavailable/,
  );
});
