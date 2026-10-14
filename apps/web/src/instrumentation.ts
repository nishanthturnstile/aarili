export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInprocessJobs, wireJobShutdown } = await import(
      "@aarili/jobs/runtime"
    );
    const runtime = await startInprocessJobs(process.env);
    if (runtime)
      wireJobShutdown(runtime, (outcome) =>
        console.info(`aarili in-process jobs ${outcome}`),
      );
  }
}
