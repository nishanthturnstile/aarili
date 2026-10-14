import { jobRuntimeConfiguration } from "@aarili/jobs/runtime";
import { describe, expect, it } from "vitest";

describe("0.3.2c F1/F9 explicit topology and fail-closed environment", () => {
  it("keeps web enqueue-only unless explicitly opted into development", () => {
    expect(jobRuntimeConfiguration({}, "inprocess")).toBeUndefined();
    expect(
      jobRuntimeConfiguration({ NODE_ENV: "production" }, "inprocess"),
    ).toBeUndefined();
    expect(
      jobRuntimeConfiguration(
        {
          NODE_ENV: "development",
          RUN_JOBS_INPROCESS: "true",
          DATABASE_URL: "synthetic",
        },
        "inprocess",
      ),
    ).toBe("synthetic");
  });
  it("denies invalid flags, production in-process, absent worker DB, public configuration and outbound activation", () => {
    for (const env of [
      { RUN_JOBS_INPROCESS: "yes" },
      { NODE_ENV: "production", RUN_JOBS_INPROCESS: "true" },
      {},
      { DATABASE_URL: "synthetic", NEXT_PUBLIC_PRIVATE: "synthetic" },
      { DATABASE_URL: "synthetic", OUTBOUND_EFFECTS: "enabled" },
    ])
      expect(() => jobRuntimeConfiguration(env, "worker")).toThrow(
        "configuration denied",
      );
  });
});
