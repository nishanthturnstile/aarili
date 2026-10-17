import { createApi } from "@aarili/api";
import { ownerAuthFromEnvironment } from "@aarili/auth";
import { validateEnvironment } from "@aarili/platform";
import { checkDatabaseReadiness } from "@aarili/platform/database-health";
import { privateTelemetry } from "@aarili/platform/telemetry";

validateEnvironment(process.env);
// Proxy and route runtimes each own their composition. Neither assumes a shared
// process, pool or mutable global with the other runtime.
const app = createApi(
  () => checkDatabaseReadiness(process.env.DATABASE_URL),
  ownerAuthFromEnvironment(process.env),
  () => privateTelemetry.report({ surface: "web", code: "web.request_failed" }),
);
export const handleApi = (request: Request) => app.fetch(request);
