import { changeSyntheticRecord, createCommandClient } from "@aarili/api/command-fixture-client";
import type { SyntheticRecord } from "@aarili/contracts/command";
const client = createCommandClient();
client.dev.shops[":shopId"].records.$post({ param: { shopId: "id" }, json: { value: 42 }, header: {} });
client.dev.shops[":shopId"].records[":id"].$delete();
client.dev.shops[":shopId"].records[":id"].$patch({ param: { shopId: "id", id: "id" }, json: { action: "correct", value: "alpha" }, header: {} });
changeSyntheticRecord("id", "id", { action: "finalize", value: "alpha" }, "key", '"v1"');
const invalid: SyntheticRecord = { id: "id", version: "1", value: "alpha", finalized: false, correctionOf: null, eventId: "id" };
void invalid;
