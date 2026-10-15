import {
  startInprocessJobs,
  startJobRuntime,
  wireJobShutdown,
} from "@aarili/jobs/foundation-runtime";

// Disposable process fixture only. No production/environment fault switch.
const [mode, phase, timeout] = process.argv.slice(2);
let release;
let reloadedModule;
const pause = async () => {
  process.send({ type: "barrier", phase });
  await new Promise((resolve) => {
    release = resolve;
  });
};
process.on("message", (message) => {
  if (message === "resume") release?.();
});
try {
  const runtime =
    mode === "reload"
      ? await startInprocessJobs({
          ...process.env,
          NODE_ENV: "development",
          RUN_JOBS_INPROCESS: "true",
        })
      : await startJobRuntime(process.env.DATABASE_URL, {
          mode,
          pollMilliseconds: 50,
          hooks: {
            ...(phase === "before-commit" ? { beforeCommit: pause } : {}),
            ...(phase === "after-commit" ? { afterCommit: pause } : {}),
          },
        });
  if (mode === "reload") {
    const reloaded = await import(
      new URL(
        "../../packages/jobs/dist/foundation-runtime.js?reload=37",
        import.meta.url,
      )
    );
    const again = await reloaded.startInprocessJobs({
      ...process.env,
      NODE_ENV: "development",
      RUN_JOBS_INPROCESS: "true",
    });
    if (again !== runtime) throw Error("Duplicate reload registration");
    // Both module instances must also reuse the same signal wiring.
    reloadedModule = reloaded;
  }
  wireJobShutdown(
    runtime,
    (outcome) => {
      process.send({ type: "stopped", outcome });
      if (process.connected) process.disconnect();
      if (outcome === "timed-out") process.exit(1);
    },
    Number(timeout ?? 10000),
  );
  reloadedModule?.wireJobShutdown(runtime, () => {
    throw Error("Duplicate shutdown wiring");
  });
  process.send({ type: "ready", handlers: runtime.handlers });
} catch {
  console.error("Disposable runner unavailable");
  process.exitCode = 1;
}
