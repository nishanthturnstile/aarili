import {
  jobRuntimeConfiguration,
  startJobRuntime,
  wireJobShutdown,
} from "@aarili/jobs/runtime";
import { validateEnvironment } from "@aarili/platform";

try {
  validateEnvironment(process.env);
  const connectionString = jobRuntimeConfiguration(process.env, "worker");
  if (!connectionString) throw Error("Worker configuration missing");
  const runtime = await startJobRuntime(connectionString, { mode: "worker" });
  wireJobShutdown(runtime, (outcome) => {
    console.info(`aarili-worker ${outcome}`);
    if (process.connected) process.disconnect();
    if (outcome === "timed-out") process.exit(1);
  });
  console.info(
    `aarili-worker ready: ${runtime.handlers.length ? runtime.handlers.join(", ") : "no job consumers registered"}; real providers disabled`,
  );
} catch {
  console.error(
    "aarili-worker unavailable; inspect runtime configuration and provisioned queues",
  );
  process.exitCode = 1;
}
