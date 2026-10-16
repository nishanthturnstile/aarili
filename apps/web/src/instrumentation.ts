import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInprocessJobs, wireJobShutdown } = await import(
      "@aarili/jobs/runtime"
    );
    const { privateTelemetry } = await import("@aarili/platform/telemetry");
    const runtime = await startInprocessJobs(process.env, undefined, () =>
      privateTelemetry.report({ surface: "web", code: "web.job_failed" }),
    );
    if (runtime)
      wireJobShutdown(runtime, (outcome) =>
        console.info(`aarili in-process jobs ${outcome}`),
      );
  }
}

export const onRequestError: Instrumentation.onRequestError = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { privateTelemetry } = await import("@aarili/platform/telemetry");
      privateTelemetry.report({ surface: "web", code: "web.unhandled" });
    } catch {
      /* Reporting cannot block the error response. */
    }
  }
};
