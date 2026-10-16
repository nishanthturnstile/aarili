import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Same reviewed Garage image/config as infra, isolated ephemeral filesystem and
// loopback dynamic port. Capture command failures without credentials/env dumps.
const image =
  "dxflrs/garage:v2.4.1@sha256:9c96caa2612d3411acc5b0e6701fb238dbfba33e533a6d7d3d811a4b12d0d020";
async function docker(args, env = {}) {
  return new Promise((ok, no) => {
    const p = spawn("docker", args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (b) => {
      out += b;
    });
    p.stderr.resume();
    p.on("error", () => no(Error("Private test storage Docker unavailable")));
    p.on("exit", (code) =>
      code === 0
        ? ok(out)
        : no(Error("Private test storage Docker command failed")),
    );
  });
}
export async function withPrivateS3(run) {
  const folder = await mkdtemp(join(tmpdir(), "aarili-57-private-s3-"));
  const name = `aarili57-${randomUUID()}`;
  let started = false;
  const config = {
    region: "garage",
    bucket: "aarili-synthetic",
    accessKeyId: `GK${randomBytes(12).toString("hex")}`,
    secretAccessKey: randomBytes(32).toString("hex"),
  };
  try {
    await writeFile(
      join(folder, "garage.toml"),
      `metadata_dir = "/tmp/meta"\ndata_dir = "/tmp/data"\ndb_engine = "sqlite"\nreplication_factor = 1\nrpc_bind_addr = "0.0.0.0:3901"\nrpc_public_addr = "127.0.0.1:3901"\nrpc_secret = "${randomBytes(32).toString("hex")}"\n[s3_api]\ns3_region = "garage"\napi_bind_addr = "0.0.0.0:3900"\n`,
    );
    await docker(
      [
        "run",
        "--detach",
        "--rm",
        "--name",
        name,
        "--publish",
        "127.0.0.1::3900",
        "--env",
        "GARAGE_DEFAULT_ACCESS_KEY",
        "--env",
        "GARAGE_DEFAULT_SECRET_KEY",
        "--env",
        "GARAGE_DEFAULT_BUCKET",
        "--mount",
        `type=bind,source=${join(folder, "garage.toml")},target=/etc/garage.toml,readonly`,
        image,
        "/garage",
        "server",
        "--single-node",
        "--default-bucket",
      ],
      {
        GARAGE_DEFAULT_ACCESS_KEY: config.accessKeyId,
        GARAGE_DEFAULT_SECRET_KEY: config.secretAccessKey,
        GARAGE_DEFAULT_BUCKET: config.bucket,
      },
    );
    started = true;
    const port = Number(
      (await docker(["port", name, "3900/tcp"])).trim().match(/:(\d+)$/)?.[1],
    );
    if (!port) throw Error("Private test port missing");
    config.endpoint = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 90; i++) {
      try {
        const r = await fetch(config.endpoint, {
          signal: AbortSignal.timeout(1000),
        });
        if (r.status === 403) {
          ready = true;
          break;
        }
      } catch {}
      await delay(500);
    }
    if (!ready) throw Error("Private test storage startup timed out");
    return await run(config);
  } finally {
    if (started) await docker(["stop", "--time", "1", name]);
    if (
      resolve(folder).startsWith(
        `${resolve(tmpdir())}\\aarili-57-private-s3-`,
      ) ||
      resolve(folder).startsWith(`${resolve(tmpdir())}/aarili-57-private-s3-`)
    )
      await rm(folder, { recursive: true, force: true });
  }
}
