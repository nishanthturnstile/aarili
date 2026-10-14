import type { SyntheticJob } from "@aarili/contracts/jobs";
import type { SyntheticJobWriter } from "@aarili/db/repositories/jobs";
declare const job: SyntheticJob;
const personal: SyntheticJob = { ...job, token: "secret" };
const snapshot: SyntheticJob = { ...job, amountPaise: 100 };
const version: SyntheticJob = { ...job, version: "1" };
declare const writer: SyntheticJobWriter;
writer.enqueue(job, "request", "key");
