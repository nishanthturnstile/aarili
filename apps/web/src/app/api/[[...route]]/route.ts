import { createApi } from "@aarili/api";
import { ownerAuthFromEnvironment } from "@aarili/auth";
import { validateEnvironment } from "@aarili/platform";
import { checkDatabaseReadiness } from "@aarili/platform/database-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const environment = validateEnvironment(process.env);
const app = createApi(
  () => checkDatabaseReadiness(process.env.DATABASE_URL),
  ownerAuthFromEnvironment(process.env),
  environment.NODE_ENV,
);
export const GET = (request: Request) => app.fetch(request);
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;
export const HEAD = GET;
