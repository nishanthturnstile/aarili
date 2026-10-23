import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv, promisify } from "node:util";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";

const execute = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const local = resolve(root, "infra/.local");
const project = "aarili-local";

export function ports(environment) {
  const result = {};
  for (const [name, fallback] of [
    ["AARILI_PG_PORT", 55432],
    ["AARILI_S3_PORT", 53900],
  ]) {
    const value = environment[name] ?? String(fallback);
    if (!/^\d+$/.test(value) || +value < 1024 || +value > 65535)
      throw new Error(`${name} must be an integer between 1024 and 65535.`);
    result[name] = +value;
  }
  if (result.AARILI_PG_PORT === result.AARILI_S3_PORT)
    throw new Error("PostgreSQL and S3 require distinct host ports.");
  if (result.AARILI_PG_PORT === 5432 || result.AARILI_S3_PORT === 5432)
    throw new Error(
      "Port 5432 is reserved for existing local-infra resources.",
    );
  return result;
}

export function reservedPort(output, port) {
  return output.split(/\r?\n/).some((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s*\*?\s*$/);
    return match && port >= +match[1] && port <= +match[2];
  });
}

export async function availablePort(port) {
  return new Promise((done) => {
    const server = createServer();
    server.once("error", () => done(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close(() => done(true)),
    );
  });
}

function settings() {
  const override = resolve(root, "infra/.env");
  const file = existsSync(override)
    ? parseEnv(readFileSync(override, "utf8"))
    : {};
  if (
    Object.keys(file).some(
      (name) => !["AARILI_PG_PORT", "AARILI_S3_PORT"].includes(name),
    )
  )
    throw new Error(
      "infra/.env supports only AARILI_PG_PORT and AARILI_S3_PORT.",
    );
  return ports({ ...file, ...process.env });
}

async function command(binary, args, options = {}) {
  try {
    return (
      await execute(binary, args, {
        cwd: root,
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
        ...options,
      })
    ).stdout.trim();
  } catch {
    // Raw Docker/SDK errors can include credentials, config and daemon addresses.
    throw new Error(
      `${binary === "docker" ? "Docker operation" : "Environment probe"} failed. Check Docker Desktop's Linux engine, selected context, service health and port overrides. Raw output suppressed.`,
    );
  }
}

function composeArgs() {
  return [
    "compose",
    "--project-name",
    project,
    "--project-directory",
    resolve(root, "infra"),
    "--env-file",
    resolve(local, "compose.env"),
    "-f",
    resolve(root, "infra/compose.yaml"),
  ];
}

async function compose(args) {
  await localDaemon();
  return command("docker", [...composeArgs(), ...args], {
    env: {
      ...process.env,
      ...parseEnv(readFileSync(resolve(local, "compose.env"), "utf8")),
      ...Object.fromEntries(
        Object.entries(settings()).map(([k, v]) => [k, String(v)]),
      ),
    },
  });
}

async function localDaemon() {
  const context = await command("docker", ["context", "show"]);
  const discovery = JSON.parse(
    await command("docker", ["context", "inspect", context]),
  );
  const configured = discovery[0]?.Endpoints?.docker?.Host ?? "";
  const endpoint = process.env.DOCKER_CONTEXT
    ? configured
    : (process.env.DOCKER_HOST ?? configured);
  if (!/^(npipe|unix):/.test(endpoint))
    throw new Error(
      "Local Docker named-pipe/Unix-socket transport required. Remote or TCP daemons are refused for local infrastructure.",
    );
  assert.equal(
    await command("docker", ["info", "--format", "{{.OSType}}"]),
    "linux",
    "Select Docker Desktop Linux containers.",
  );
  return endpoint.startsWith("npipe:") ? "Windows named pipe" : "Unix socket";
}

function credentials() {
  if (!existsSync(resolve(local, "credentials.json")))
    throw new Error(
      "Local credentials missing. Run pnpm infra:init first; preserve existing credentials when volumes contain data.",
    );
  return JSON.parse(readFileSync(resolve(local, "credentials.json"), "utf8"));
}

function initialize() {
  settings();
  if (existsSync(local))
    throw new Error(
      "infra/.local already exists. Initialization refuses to overwrite credentials or partially generated state.",
    );
  mkdirSync(local, { recursive: true, mode: 0o700 });
  const secret = () => randomBytes(32).toString("hex");
  const data = {
    admin: secret(),
    owner: secret(),
    user: secret(),
    accessKeyId: `GK${randomBytes(16).toString("hex")}`,
    secretAccessKey: secret(),
  };
  const save = (name, value) =>
    writeFileSync(resolve(local, name), value, { mode: 0o600, flag: "wx" });
  save("credentials.json", `${JSON.stringify(data)}\n`);
  for (const name of ["admin", "owner", "user"])
    save(`${name}_password`, data[name]);
  save(
    "compose.env",
    `GARAGE_DEFAULT_ACCESS_KEY=${data.accessKeyId}\nGARAGE_DEFAULT_SECRET_KEY=${data.secretAccessKey}\n`,
  );
  save(
    "garage.toml",
    `metadata_dir = "/var/lib/garage/meta"\ndata_dir = "/var/lib/garage/data"\ndb_engine = "sqlite"\nreplication_factor = 1\nrpc_bind_addr = "0.0.0.0:3901"\nrpc_public_addr = "127.0.0.1:3901"\nrpc_secret = "${secret()}"\n[s3_api]\ns3_region = "garage"\napi_bind_addr = "0.0.0.0:3900"\n`,
  );
  console.info(
    "Generated synthetic local credentials in ignored infra/.local. No values displayed.",
  );
}

async function doctor() {
  const configured = settings();
  console.info(
    `Native runtime: ${process.platform}/${process.arch}; Node ${process.versions.node}`,
  );
  assert.equal(
    process.versions.node,
    "24.22.1",
    "Use repository Node 24.22.1 pin.",
  );
  console.info(
    `Port override file: ${existsSync(resolve(root, "infra/.env")) ? "present" : "absent"}; process overrides: ${["AARILI_PG_PORT", "AARILI_S3_PORT"].filter((key) => process.env[key] !== undefined).join(", ") || "absent"}`,
  );
  console.info(
    `Daemon overrides: DOCKER_HOST ${process.env.DOCKER_HOST ? "present" : "absent"}, DOCKER_CONTEXT ${process.env.DOCKER_CONTEXT ? "present" : "absent"}; values withheld.`,
  );
  if (/^(tcp|http):/i.test(process.env.DOCKER_HOST ?? ""))
    throw new Error(
      "Unencrypted Docker TCP override refused. Use Docker Desktop's local context.",
    );
  const version = await command("docker", [
    "version",
    "--format",
    "{{.Client.Version}} / {{.Server.Version}}",
  ]);
  console.info(
    `Docker client/server: ${version}; ${await command("docker", ["compose", "version", "--short"])}`,
  );
  console.info(
    `Daemon discovery: ${await localDaemon()}; context selected (name withheld).`,
  );
  const owned = JSON.parse(
    await command("docker", [
      "ps",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      "json",
    ]).then((lines) => `[${lines.split(/\r?\n/).filter(Boolean).join(",")}]`),
  );
  let reservations = "";
  if (process.platform === "win32") {
    for (const family of ["ipv4", "ipv6"])
      reservations += `\n${await command("netsh", ["interface", family, "show", "excludedportrange", "protocol=tcp"])}`;
  }
  for (const [name, port] of Object.entries(configured)) {
    const expected = name === "AARILI_PG_PORT" ? "postgres" : "s3";
    const own = owned.some(
      (item) =>
        item.Labels.includes(`com.docker.compose.service=${expected}`) &&
        item.Ports.includes(`127.0.0.1:${port}->`),
    );
    if (reservedPort(reservations, port))
      throw new Error(
        `${name} ${port} is in a Windows excluded range. Choose an override.`,
      );
    if (!own && !(await availablePort(port)))
      throw new Error(
        `${name} ${port} is occupied or unavailable. Choose an override; existing listeners are preserved.`,
      );
    console.info(
      `${name}: 127.0.0.1:${port} ${own ? "owned running listener" : "available"}; reservation check ${process.platform === "win32" ? "passed" : "not applicable"}.`,
    );
  }
  console.info(
    `Credentials: ${existsSync(resolve(local, "credentials.json")) ? "present" : "absent (run infra:init)"}; Linux engine reachable. Container endpoints: postgres:5432 and s3:3900 on aarili-local_local only.`,
  );
}

async function sql(role, action) {
  const data = credentials();
  const client = new pg.Client({
    host: "127.0.0.1",
    port: settings().AARILI_PG_PORT,
    database: "aarili",
    user: role === "admin" ? "postgres" : `app_${role}`,
    password: data[role],
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  try {
    await client.connect();
    return await action(client);
  } finally {
    await client.end();
  }
}

function s3() {
  const data = credentials();
  return new S3Client({
    endpoint: `http://127.0.0.1:${settings().AARILI_S3_PORT}`,
    region: "garage",
    forcePathStyle: true,
    credentials: {
      accessKeyId: data.accessKeyId,
      secretAccessKey: data.secretAccessKey,
    },
    maxAttempts: 1,
    requestHandler: { requestTimeout: 5000, connectionTimeout: 5000 },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

async function check() {
  await sql("user", async (client) => {
    const { rows } = await client.query(
      "SELECT current_user AS role, current_setting('server_version_num')::int AS version, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user",
    );
    assert.equal(rows[0].role, "app_user");
    const maintenance = await client.query(
      "SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, pg_has_role('app_user',oid,'MEMBER') AS runtime_member FROM pg_roles WHERE rolname IN ('app_backup','app_privacy','app_restore_operator')",
    );
    assert.equal(
      maintenance.rowCount,
      3,
      "Retained volumes require explicit pnpm infra:roles upgrade",
    );
    for (const role of maintenance.rows) {
      assert.equal(role.rolcanlogin, false);
      assert.equal(role.rolsuper, false);
      assert.equal(role.runtime_member, false);
      assert.equal(role.rolbypassrls, role.rolname === "app_backup");
    }
    assert(rows[0].version >= 180000 && rows[0].version < 190000);
    for (const field of [
      "rolsuper",
      "rolbypassrls",
      "rolcreatedb",
      "rolcreaterole",
    ])
      assert.equal(rows[0][field], false);
    const extensions = await client.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm','pgcrypto') ORDER BY extname",
    );
    assert.deepEqual(
      extensions.rows.map((row) => row.extname),
      ["pg_trgm", "pgcrypto"],
    );
    await client.query("BEGIN");
    try {
      await assert.rejects(
        client.query("CREATE TABLE public.forbidden_probe(id int)"),
        { code: "42501" },
      );
    } finally {
      await client.query("ROLLBACK");
    }
    await assert.rejects(client.query("SET ROLE app_owner"), { code: "42501" });
    await client.query(
      "SELECT uuidv7(), similarity('aarili', 'aarili'), gen_random_bytes(8)",
    );
  });
  await sql("owner", async (client) => {
    const { rows } = await client.query(
      "SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()",
    );
    assert.equal(rows[0].owner, "app_owner");
    const roles = await client.query(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user",
    );
    assert.equal(roles.rows[0].rolsuper, false);
    assert.equal(roles.rows[0].rolbypassrls, false);
  });
  const client = s3();
  const input = {
    Bucket: "aarili-synthetic",
    Key: `probes/${randomUUID()}.txt`,
  };
  try {
    const value = "Aarili synthetic S3 probe";
    await client.send(new PutObjectCommand({ ...input, Body: value }));
    assert.equal(
      await (
        await client.send(new GetObjectCommand(input))
      ).Body.transformToString(),
      value,
    );
    const anonymous = await fetch(
      `http://127.0.0.1:${settings().AARILI_S3_PORT}/${input.Bucket}/${input.Key}`,
      { signal: AbortSignal.timeout(5000) },
    );
    assert(
      [400, 403].includes(anonymous.status),
      "Anonymous object access must fail",
    );
    await client.send(new DeleteObjectCommand(input));
    await assert.rejects(client.send(new GetObjectCommand(input)), {
      name: "NoSuchKey",
    });
  } finally {
    client.destroy();
  }
  console.info(
    "Native PostgreSQL 18, extensions, owner/runtime role restrictions and authenticated S3 put/read/remove (anonymous denied) passed.",
  );
}

async function unrelated() {
  const ids = await command("docker", [
    "ps",
    "-aq",
    "--filter",
    `label=com.docker.compose.project!=${project}`,
  ]);
  if (!ids) return "[]";
  const entries = JSON.parse(
    await command("docker", ["inspect", ...ids.split(/\r?\n/)]),
  );
  return JSON.stringify(
    entries
      .map((item) => ({
        id: item.Id,
        started: item.State.StartedAt,
        status: item.State.Status,
        mounts: item.Mounts,
        networks: item.NetworkSettings.Networks,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

async function up() {
  credentials();
  await doctor();
  await compose(["up", "--detach", "--wait", "--wait-timeout", "90"]);
  await check();
}

async function persistence() {
  const before = await unrelated();
  await up();
  const marker = randomUUID();
  const schema = `probe_${marker.replaceAll("-", "")}`;
  const client = s3();
  const input = { Bucket: "aarili-synthetic", Key: `probes/${marker}.txt` };
  try {
    await sql("owner", (db) => db.query(`CREATE SCHEMA ${schema}`));
    await client.send(new PutObjectCommand({ ...input, Body: marker }));
    await compose(["down"]);
    await up();
    await sql("owner", async (db) =>
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM pg_namespace WHERE nspname=$1",
            [schema],
          )
        ).rows[0].count,
        1,
      ),
    );
    assert.equal(
      await (
        await client.send(new GetObjectCommand(input))
      ).Body.transformToString(),
      marker,
    );
    assert.equal(
      await unrelated(),
      before,
      "Unrelated resource identity/state/mounts/networks changed",
    );
    console.info(
      "Normal down/up preserved PostgreSQL catalog state and S3 object bytes. Unrelated container identities/state/mounts/networks unchanged.",
    );
  } finally {
    await sql("owner", (db) => db.query(`DROP SCHEMA IF EXISTS ${schema}`));
    await client.send(new DeleteObjectCommand(input));
    client.destroy();
  }
}

export async function main(action) {
  switch (action) {
    case "init":
      initialize();
      break;
    case "doctor":
      await doctor();
      break;
    case "up":
      await up();
      break;
    case "down":
      credentials();
      await compose(["down"]);
      console.info(
        "Aarili containers/network stopped; named volumes and credentials preserved.",
      );
      break;
    case "roles":
      await localDaemon();
      await sql("admin", async (client) => {
        await client.query(
          readFileSync(
            resolve(root, "infra/provision-maintenance-roles.sql"),
            "utf8",
          ),
        );
      });
      console.info(
        "Explicit local maintenance roles provisioned without LOGIN or runtime credentials. Apply reviewed migrations separately.",
      );
      break;
    case "check":
      await check();
      break;
    case "verify":
      await persistence();
      break;
    default:
      throw new Error(
        "Use infra:init, infra:doctor, infra:up, infra:check, infra:verify or infra:down. Destructive reset has no automatic command.",
      );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await main(process.argv[2]);
  } catch (error) {
    console.error(
      error instanceof Error &&
        (error.message.startsWith("Docker operation") ||
          error.message.startsWith("Environment probe") ||
          /^(AARILI_|Port |PostgreSQL and S3|infra\/|Local credentials|Local Docker|Unencrypted Docker|Use infra:)/.test(
            error.message,
          ))
        ? error.message
        : "Infrastructure verification failed. Check pinned native runtime, Docker Linux engine, generated credentials and service readiness. Error details withheld to protect secrets.",
    );
    process.exitCode = 1;
  }
}
