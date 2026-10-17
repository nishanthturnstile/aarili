import { handleApi } from "../../../server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleApi;
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;
export const HEAD = GET;
