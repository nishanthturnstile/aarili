import { randomUUID } from "node:crypto";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateCustomer } from "@aarili/core/customers";
import { syntheticWearerPolicy } from "@aarili/core/wearer-policy";
import { mutateWearer } from "@aarili/core/wearers";
import { createDatabase, withShop } from "@aarili/db";
import { customerRepository } from "@aarili/db/customer-repository";
import { wearerRepository } from "@aarili/db/wearer-repository";
import { seedServiceTemplates } from "./seed-service-templates.mjs";

// Disposable setup uses real core policies/audits, without spending interactive
// admission capacity on fixture creation. No production path imports this file.
export async function seedQuickOrder(runtime, shopId, options = {}) {
  const sources = await seedServiceTemplates(runtime, shopId, options);
  const db = createDatabase(runtime.options.connectionString, 1);
  const actor = { type: "user", id: sources.actor };
  const headers = (version) => ({
    key: randomUUID(),
    requestId: randomUUID(),
    ...(version ? { ifMatch: `"v${version}"` } : {}),
  });
  const at = new Date().toISOString();
  try {
    const customer = await withShop(db.db, actor.id, shopId, (tx) =>
      mutateCustomer(
        {
          shopId,
          actor,
          repository: customerRepository(tx, shopId),
          policy: syntheticCustomerPolicy,
        },
        "create",
        undefined,
        {
          displayName: "SYNTHETIC Meena மீனா",
          phone: "",
          aliases: ["Meena", "மீனா"],
          serviceEvidence: {
            noticeId: syntheticCustomerPolicy.notice.id,
            language: "en",
            decision: "grant",
            giver: "self",
            noticeExplained: true,
            source: "in-person",
            occurredAt: at,
          },
        },
        headers(),
      ),
    );
    const create = await withShop(db.db, actor.id, shopId, async (tx) => {
      const c = await customerRepository(tx, shopId).read(customer.customerId);
      return mutateWearer(
        {
          shopId,
          actor,
          repository: wearerRepository(
            tx,
            shopId,
            syntheticWearerPolicy.notice.id,
          ),
          policy: syntheticWearerPolicy,
        },
        c.id,
        "create",
        undefined,
        {
          mode: "self",
          age: "adult",
          preferences: {
            language: "",
            channel: "",
            fit: "",
            style: "",
            delivery: "",
            source: "",
          },
          relationship: {
            kind: "self",
            statementByPersonId: c.personId,
            authorised: true,
            informed: true,
            source: "in-person",
            occurredAt: at,
            interaction: "SYNTHETIC review fixture",
          },
        },
        headers(),
      );
    });
    await withShop(db.db, actor.id, shopId, async (tx) => {
      const c = await customerRepository(tx, shopId).read(customer.customerId);
      return mutateWearer(
        {
          shopId,
          actor,
          repository: wearerRepository(
            tx,
            shopId,
            syntheticWearerPolicy.notice.id,
          ),
          policy: syntheticWearerPolicy,
        },
        c.id,
        "purpose",
        create.wearerId,
        {
          purpose: "service",
          decision: "grant",
          noticeId: syntheticWearerPolicy.notice.id,
          noticeExplained: true,
          language: "en",
          giverPersonId: c.personId,
          source: "in-person",
          occurredAt: at,
        },
        headers(create.version),
      );
    });
    return { customer, wearer: create, sources, close: () => sources.close() };
  } catch (e) {
    await sources.close();
    throw e;
  } finally {
    await db.pool.end();
  }
}
