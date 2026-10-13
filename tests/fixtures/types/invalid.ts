import { createHealthClient } from "@aarili/api/client";
import type { HealthResponse } from "@aarili/contracts";

const client = createHealthClient("http://localhost:3000");
client.api.healthz.$post();
const extra: HealthResponse = { status: "ok", service: "aarili-web", shopId: "not-a-health-field" };
void extra;
const invalid: HealthResponse = { status: "paid", service: "aarili-worker" };
void invalid;
