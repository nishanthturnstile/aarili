import {
  jobRuntimeConfiguration,
  startJobRuntime,
  wireJobShutdown,
} from "@aarili/jobs/runtime";
import { validateEnvironment } from "@aarili/platform";

import { privateTelemetry } from "@aarili/platform/telemetry";

try {
  validateEnvironment(process.env);
  const connectionString = jobRuntimeConfiguration(process.env, "worker");
  if (!connectionString) throw Error("Worker configuration missing");
  const runtime = await startJobRuntime(connectionString, {
    mode: "worker",
    reportFailure: () =>
      privateTelemetry.report({ surface: "worker", code: "worker.job_failed" }),
  });
  wireJobShutdown(runtime, (outcome) => {
    console.info(`aarili-worker ${outcome}`);
    if (process.connected) process.disconnect();
    if (outcome === "timed-out") process.exit(1);
  });
  console.info(
    `aarili-worker ready: ${runtime.handlers.length ? runtime.handlers.join(", ") : "no job consumers registered"}; real providers disabled`,
  );
} catch {
  privateTelemetry.report({ surface: "worker", code: "worker.unavailable" });
  console.error(
    "aarili-worker unavailable; inspect runtime configuration and provisioned queues",
  );
  process.exitCode = 1;
}
