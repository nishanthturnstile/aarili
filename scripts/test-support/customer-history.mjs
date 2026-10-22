import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { seedServiceAdditions } from "./service-additions.mjs";
import { withTenantFixture } from "./tenant-isolation.mjs";

export async function withHistoryFixture(run, options = {}) {
  return withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      f.request = (
        path,
        {
          method = "POST",
          body,
          etag,
          who = f.a,
          origin = f.owner.origin,
          cookie = who.cookie,
        } = {},
      ) =>
        f.api.fetch(
          new Request(`${f.owner.origin}/api/shops/${who.shop}/${path}`, {
            method,
            headers: {
              Origin: origin,
              Cookie: cookie,
              "Content-Type": "application/json",
              "Idempotency-Key": randomUUID(),
              ...(etag ? { "If-Match": etag } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        );
      f.ok = async (path, opts) => {
        const r = await f.request(path, opts);
        assert.equal(r.status, 200, `${path}: ${await r.clone().text()}`);
        return r.json();
      };
      f.services = await seedServiceAdditions({
        setup: f.ok,
        runtime: f.runtime.pool,
        shopId: f.a.shop,
      });
      f.customerId = f.services.seed.customer.customerId;
      f.wearerId = f.services.seed.wearer.wearerId;
      f.history = (extra = {}) =>
        f.ok("customer-history", {
          body: { customerId: f.customerId, ...extra },
        });
      f.accept = async (value = f.services.saree.intake) => {
        value = {
          ...value,
          subjectId: randomUUID(),
          lines: value.lines.map((line) => ({ ...line, id: randomUUID() })),
        };
        const review = await f.ok("small-services/orders/review", {
          body: value,
        });
        assert.deepEqual(review.issues, []);
        const id = await f.services.config.publish("order.service", {
          ...value,
          commitmentReview: {
            fingerprint: review.fingerprint,
            acknowledged: true,
            exceptionReason: "SYNTHETIC history fixture",
            waiveRush: false,
            waiverReason: "",
          },
        });
        return f.ok(`small-services/orders/${id}`, { method: "GET" });
      };
      try {
        return await run(f);
      } finally {
        await f.services.close();
      }
    },
    { customerPolicy: syntheticCustomerPolicy, ...options },
  );
}
export async function completeHistoryLine(f, id) {
  const p = await f.ok(`small-services/progress/${id}`, { method: "GET" }),
    line = p.lines[0];
  return f.ok(`small-services/progress/${id}/lines/${line.line.id}`, {
    etag: `"v${line.version}"`,
    body: {
      commandId: randomUUID(),
      action: "complete",
      orderVersion: p.orderVersion,
      scopeDigest: p.scopeDigest,
      sourceId: line.sourceId,
      sourceDigest: line.sourceDigest,
      attested: true,
      note: "SYNTHETIC private completion note",
    },
  });
}
