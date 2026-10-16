import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, resolve, sep } from "node:path";
import { withDocumentSharingHost } from "./test-support/document-sharing-host.mjs";

const args = process.argv.slice(2),
  address = args.includes("--address")
    ? args[args.indexOf("--address") + 1]
    : "127.0.0.1";
const lan = address !== "127.0.0.1";
if (
  lan &&
  !/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/.test(address ?? "")
)
  throw Error("Review host requires loopback or a private LAN IPv4 address");
if (
  !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(address) ||
  !Object.values(networkInterfaces())
    .flat()
    .some((n) => n?.address === address)
)
  throw Error(
    "Choose one current local IPv4 address with --address; wildcard/public listening is not supported",
  );
if (lan && !args.includes("--lan-firewall-ready"))
  throw Error(
    "Follow docs/agents/Local_HTTPS_Review.md first; confirm the single-phone Private-network rule with --lan-firewall-ready",
  );
const root = resolve(".scratch");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(join(root, "document-review-tls-"));
const cert = join(directory, "cert.pem"),
  key = join(directory, "key.pem"),
  der = join(directory, "phone-ca.cer");
const openssl =
  process.platform === "win32" &&
  existsSync("C:/Program Files/Git/usr/bin/openssl.exe")
    ? "C:/Program Files/Git/usr/bin/openssl.exe"
    : "openssl";
let stop;
const stopped = new Promise((resolve) => {
  stop = resolve;
});
const close = () => stop();
process.once("SIGINT", close);
process.once("SIGTERM", close);
try {
  execFileSync(
    openssl,
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=Aarili temporary synthetic review",
      "-addext",
      `subjectAltName=IP:${address}`,
      "-addext",
      "basicConstraints=critical,CA:TRUE",
    ],
    { stdio: "ignore" },
  );
  execFileSync(openssl, ["x509", "-in", cert, "-outform", "DER", "-out", der], {
    stdio: "ignore",
  });
  console.info(
    `Temporary synthetic certificate: ${der}\nNever copy key.pem to a phone. Remove phone trust after review.`,
  );
  await withDocumentSharingHost(
    async ({ origin }) => {
      console.info(
        `Synthetic PDF review: ${origin}\nCtrl+C tears down the host, database, bucket and temporary certificate files.`,
      );
      if (args.includes("--smoke")) stop();
      await stopped;
    },
    { hostname: address, port: 3443, cert, key },
  );
} finally {
  process.removeListener("SIGINT", close);
  process.removeListener("SIGTERM", close);
  const target = resolve(directory);
  if (
    target.startsWith(root + sep) &&
    target.split(sep).at(-1).startsWith("document-review-tls-")
  ) {
    await rm(target, { recursive: true, force: true });
  } else {
    console.error("Temporary TLS cleanup path rejected");
    process.exitCode = 1;
  }
}
