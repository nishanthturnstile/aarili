import { createApi } from "@aarili/api";
import { validateEnvironment } from "@aarili/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
validateEnvironment(process.env);
const app = createApi();
export const GET = (request: Request) => app.fetch(request);
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;
export const HEAD = GET;
