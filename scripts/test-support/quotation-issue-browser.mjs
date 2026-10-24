import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

// Run retained templates and native renderer through Node, outside Playwright's
// module rewriting. The IPC seam exposes only finite synthetic test controls.
export async function withQuotationIssueBrowserHost(run) {
  const child = spawn(
    process.execPath,
    [resolve("scripts/test-support/quotation-issue-host-process.mjs")],
    { stdio: ["ignore", "pipe", "pipe", "ipc"] },
  );
  let output = "",
    serial = 0;
  const pending = new Map();
  const exit = once(child, "exit");
  child.stdout.on("data", (b) => {
    output += b;
  });
  child.stderr.on("data", (b) => {
    output += b;
  });
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  child.on("exit", () => {
    readyReject(Error(`Synthetic sharing host exited: ${output.slice(-2000)}`));
    for (const p of pending.values())
      p.reject(Error("Synthetic sharing host exited"));
  });
  child.on("message", (m) => {
    if (m.ready) readyResolve(m);
    else {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        m.error ? p.reject(Error(m.error)) : p.resolve(m.value);
      }
    }
  });
  function control(command, value) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      child.send({ id, command, value });
    });
  }
  try {
    const { origin, cookie, proposalId } = await ready;
    await run({
      origin,
      cookie,
      proposalId,
      sourceChange: () => control("sourceChange"),
      renderFailure: (value) => control("renderFailure", value),
    });
  } finally {
    if (child.exitCode === null) {
      child.send({ command: "stop" });
      await exit;
    }
  }
}
