import { Client, type ClientConfig } from "pg";

export const HEALTH_TIMEOUT_MS = 1500;

// Operational SELECT only: no tenant tables or business repositories are accessed.
export async function checkDatabaseReadiness(
  connectionString: string | undefined,
  options: {
    timeoutMs?: number;
    createClient?: (
      config: ClientConfig,
    ) => Pick<Client, "connect" | "query" | "end" | "on">;
  } = {},
): Promise<boolean> {
  if (!connectionString) return false;
  const timeoutMs = options.timeoutMs ?? HEALTH_TIMEOUT_MS;
  let client: ReturnType<NonNullable<typeof options.createClient>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const url = new URL(connectionString);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      decodeURIComponent(url.username) !== "app_user" ||
      !url.hostname ||
      !url.pathname ||
      url.pathname === "/" ||
      // pg URL query parameters override ClientConfig, including identity and
      // timeout settings. Only the deployment TLS mode may be supplied here.
      [...url.searchParams.keys()].some((key) => key !== "sslmode")
    )
      return false;
    client = (options.createClient ?? ((config) => new Client(config)))({
      connectionString,
      application_name: "aarili-health",
      connectionTimeoutMillis: timeoutMs,
      statement_timeout: timeoutMs,
      query_timeout: timeoutMs,
    });
    // A broken idle socket must not turn an operational failure into an uncaught event.
    client.on("error", () => {});
    const connection = client;
    return await Promise.race([
      (async () => {
        await connection.connect();
        const result = await connection.query("SELECT 1::integer AS ready");
        return result.rows.length === 1 && result.rows[0]?.ready === 1;
      })(),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    // pg destroys the socket when a query is still active, including on timeout.
    await client?.end().catch(() => {});
  }
}
