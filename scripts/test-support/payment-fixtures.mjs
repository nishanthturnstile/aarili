import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyPayment } from "@aarili/contracts/payments";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { draftUuid } from "./quotation-rate-fixtures.mjs";
import { withTenantFixture } from "./tenant-isolation.mjs";

export function paymentRequest(
  f,
  path,
  {
    method = "POST",
    body = {},
    who = f.a,
    shop = who.shop,
    key = randomUUID(),
    etag,
    origin = f.owner.origin,
  } = {},
) {
  return f.api.fetch(
    new Request(`${f.owner.origin}/api/shops/${shop}/${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...(etag ? { "If-Match": etag } : {}),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
export async function paymentOk(response) {
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
export async function paymentSave(
  f,
  value,
  { id = draftUuid(), key = randomUUID(), etag, who = f.a } = {},
) {
  return (
    await paymentOk(
      await paymentRequest(f, `drafts/${id}`, {
        method: "PUT",
        body: { workflow: "payment.receipt", schemaVersion: 1, payload: value },
        key,
        etag,
        who,
      }),
    )
  ).draft;
}
export const paymentPromote = (f, draft, extra = {}) =>
  paymentRequest(f, `drafts/${draft.id}/promote`, {
    body: {},
    etag: `"v${draft.version}"`,
    ...extra,
  });
export async function paymentPublish(f, value) {
  const d = await paymentSave(f, value);
  await paymentOk(await paymentPromote(f, d));
  return paymentOk(
    await paymentRequest(f, "payments/read", { body: { id: d.id } }),
  );
}
export async function paymentTransition(f, r, action, extra = {}) {
  const e = r.current;
  return paymentSave(f, {
    ...f.value,
    receiptId: r.id,
    expectedVersion: e.version,
    customerId: r.customerId,
    payerId: r.payerId,
    orderId: r.orderId,
    bookingId: r.bookingId,
    amountText: `${Math.floor(e.amountPaise / 100)}.${String(e.amountPaise % 100).padStart(2, "0")}`,
    method: e.method,
    paymentDate: e.paymentDate,
    accountId: e.accountId,
    accountRevisionId: e.accountRevisionId,
    profileId: e.profileId,
    reference: e.reference,
    action,
    attested: action === "cash-received" || action === "upi-seen",
    reason:
      action === "fail" || action === "correct" ? "SYNTHETIC correction" : "",
    ...extra,
  });
}
async function seedPaymentFixture(f) {
  const publish = async (workflow, payload) => {
    const id = draftUuid();
    const d = (
      await paymentOk(
        await paymentRequest(f, `drafts/${id}`, {
          method: "PUT",
          body: { workflow, schemaVersion: 1, payload },
        }),
      )
    ).draft;
    return (await paymentOk(await paymentPromote(f, d))).draft;
  };
  const profile = await paymentOk(
    await paymentRequest(f, "settings/profile", { method: "GET" }),
  );
  await paymentOk(
    await paymentRequest(f, "settings/profile", {
      method: "PUT",
      etag: `"v${profile.version}"`,
      body: profile.profile,
    }),
  );
  const directory = async (content) => {
    const entryId = randomUUID(),
      d = await publish("shop.directory", {
        entryId,
        baseVersion: 0,
        baseRevisionId: null,
        content,
      });
    return { entryId, revisionId: d.result.id };
  };
  await directory({ kind: "methods", enabled: ["cash", "upi", "bank"] });
  const account = await directory({
    kind: "account",
    label: "SYNTHETIC family UPI",
    active: true,
    method: "upi",
    recipient: "family",
    upiId: "synthetic@invalid",
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    ifsc: "",
  });
  const secondAccount = await directory({
    kind: "account",
    label: "SYNTHETIC owner UPI",
    active: true,
    method: "upi",
    recipient: "owner",
    upiId: "second@invalid",
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    ifsc: "",
  });
  const customer = async (who = f.a) =>
    paymentOk(
      await paymentRequest(f, "customers", {
        who,
        body: {
          displayName: `SYNTHETIC payments ${who === f.a ? "A" : "B"}`,
          aliases: [],
          serviceEvidence: {
            noticeId: syntheticCustomerPolicy.notice.id,
            language: "en",
            decision: "grant",
            giver: "self",
            noticeExplained: true,
            source: "in-person",
            occurredAt: new Date().toISOString(),
          },
        },
      }),
    );
  const a = await customer(),
    other = await customer(),
    b = await customer(f.b);
  // Disposable synthetic fixture only. A real operator must perform audited reconciliation.
  await f.admin.query("update system_state set money_frozen=false");
  const options = await paymentOk(await paymentRequest(f, "payments/options"));
  const value = {
    ...emptyPayment(options.today),
    customerId: a.customerId,
    payerId: a.customerId,
    profileId: options.profileId,
    restoreEpoch: options.restoreEpoch,
    amountText: "500.01",
  };
  return {
    publish,
    directory,
    account,
    secondAccount,
    customer: a,
    other,
    foreignCustomer: b,
    options,
    value,
  };
}
export async function withPayments(run, options = {}) {
  return withTenantFixture(
    async (f) => {
      const seed = await seedPaymentFixture(f);
      return run(Object.assign(f, seed));
    },
    { customerPolicy: syntheticCustomerPolicy, ...options },
  );
}
