import { validateEnvironment } from "@aarili/platform";

validateEnvironment(process.env);
console.info("aarili-worker ready (no job consumers registered)");
const keepAlive = setInterval(() => {}, 60_000);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(keepAlive);
  process.off("SIGINT", shutdown);
  process.off("SIGTERM", shutdown);
  process.off("message", onMessage);
  if (process.connected) process.disconnect();
  console.info("aarili-worker stopped");
}
function onMessage(message: unknown) {
  if (message === "shutdown") shutdown();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// IPC supplies a graceful path on Windows, where SIGTERM cannot be caught.
process.on("message", onMessage);
