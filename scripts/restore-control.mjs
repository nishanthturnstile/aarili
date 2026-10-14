import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// A private process with a separately scoped credential, never a web endpoint.
export async function restoreControl(client, action = "status", expectedEpoch) {
  if (
    !["status", "restore", "freeze", "reconcile", "disable", "enable"].includes(
      action,
    )
  )
    throw Error("CONTROL_ACTION_DENIED");
  await client.query("BEGIN");
  try {
    const role = (
      await client.query(`select current_user as role,session_user as login,
      pg_has_role(current_user,'app_restore_operator','MEMBER') as scoped,
      rolsuper,rolbypassrls from pg_roles where rolname=current_user`)
    ).rows[0];
    if (
      !role?.scoped ||
      role.role === "app_user" ||
      role.login === "app_user" ||
      role.rolsuper ||
      role.rolbypassrls
    )
      throw Error("OPERATOR_AUTHORITY_DENIED");
    if (action !== "status") {
      if (!expectedEpoch) throw Error("EXPECTED_EPOCH_REQUIRED");
      await client.query("select transition_restore_control($1::uuid,$2)", [
        expectedEpoch,
        action,
      ]);
    }
    const state = (
      await client.query(
        "select restore_epoch as epoch,side_effects_enabled as outbound,money_frozen as frozen from system_state where singleton",
      )
    ).rows[0];
    if (!state) throw Error("CONTROL_UNKNOWN");
    const history = (
      await client.query(
        "select action,previous_epoch,restore_epoch,side_effects_enabled,money_frozen,operator_login,occurred_at from system_control_event order by occurred_at desc,id desc limit 100",
      )
    ).rows;
    await client.query("COMMIT");
    return { state, history: history.reverse() };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const [flag, epoch, ...extra] = process.argv.slice(2);
  const action = flag?.replace(/^--/, "");
  if (
    extra.length ||
    !flag?.startsWith("--") ||
    (action === "status" && epoch) ||
    process.env.OUTBOUND_EFFECTS !== "disabled"
  )
    throw Error("CONTROL_INVOCATION_DENIED");
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: This private standalone CLI must not forward its credential through Turborepo to web/worker tasks.
  const target = process.env.RESTORE_OPERATOR_DATABASE_URL;
  if (!target) throw Error("OPERATOR_CONFIGURATION_MISSING");
  const client = new pg.Client({
    connectionString: target,
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    console.info(JSON.stringify(await restoreControl(client, action, epoch)));
  } finally {
    await client.end();
  }
}
if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url))
  main().catch(() => {
    console.error(
      "Restore control command denied or unavailable; private error suppressed",
    );
    process.exitCode = 1;
  });
