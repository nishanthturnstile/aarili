import {
  paymentEventSchema,
  paymentReceiptSchema,
} from "@aarili/contracts/payments";
import {
  directoryRevisionSchema,
  summarizeDirectory,
} from "@aarili/contracts/shop-directory";
import { fromPostgresBigint, toPostgresBigint } from "@aarili/money";
import { sql, type Transaction } from "./index.js";
import type { PaymentsRepository } from "./repositories/payments.js";

export function paymentsRepository(
  tx: Transaction,
  shopId: string,
): PaymentsRepository {
  shopId = shopId.toLowerCase();
  const lock = async (key: string) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${key},0))`,
    );
  };
  const eventColumns = sql`e.*,a.entry_id as account_entry,a.version as account_version,a.previous_id as account_previous,a.actor_id as account_actor,a.effective_at as account_effective,a.origin_draft_id as account_draft,a.content as account_content,p.profile->>'displayName' as business`;
  const eventJoins = sql`left join shop_directory_revision a on (a.shop_id,a.id)=(e.shop_id,e.account_revision_id) join shop_profile_revision p on (p.shop_id,p.id)=(e.shop_id,e.profile_id)`;
  const event = (r: Record<string, unknown>) => {
    let label = "",
      masked = "";
    if (r.account_revision_id) {
      const a = summarizeDirectory(
        directoryRevisionSchema.parse({
          schemaVersion: 1,
          id: r.account_revision_id,
          entryId: r.account_entry,
          version: r.account_version,
          previousId: r.account_previous,
          actorId: r.account_actor,
          effectiveAt: new Date(r.account_effective as string).toISOString(),
          originDraftId: r.account_draft,
          content: r.account_content,
        }),
      );
      label = a.label;
      masked = a.maskedIdentifier;
    }
    return paymentEventSchema.parse({
      id: r.id,
      receiptId: r.receipt_id,
      version: r.version,
      previousId: r.previous_id,
      status: r.status,
      amountPaise: fromPostgresBigint(r.amount_paise as string),
      method: r.method,
      paymentDate: r.payment_date,
      accountId: r.account_id,
      accountRevisionId: r.account_revision_id,
      accountLabel: label,
      maskedIdentifier: masked,
      profileId: r.profile_id,
      recipientBusiness: r.business,
      reference: r.reference,
      reason: r.reason,
      attestation: r.attestation,
      restoreEpoch: r.restore_epoch,
      actorId: r.actor_id,
      recordedAt: new Date(r.recorded_at as string).toISOString(),
      journalId: r.journal_id,
      originDraftId: r.origin_draft_id,
    });
  };
  const select = sql`select ${eventColumns},r.id as root_id,r.customer_id,r.payer_id,r.order_id,r.booking_id,r.created_at as root_created,cp.display_name as customer_label,pp.display_name as payer_label
    from payment_receipt r join lateral(select * from payment_event pe where pe.shop_id=r.shop_id and pe.receipt_id=r.id order by version desc limit 1)e on true ${eventJoins}
    join customer c on (c.shop_id,c.id)=(r.shop_id,r.customer_id) join customer_person cp on(cp.shop_id,cp.id)=(c.shop_id,c.person_id)
    join customer pc on (pc.shop_id,pc.id)=(r.shop_id,r.payer_id) join customer_person pp on(pp.shop_id,pp.id)=(pc.shop_id,pc.person_id)`;
  const receipt = (r: Record<string, unknown>) =>
    paymentReceiptSchema.parse({
      id: r.root_id,
      customerId: r.customer_id,
      payerId: r.payer_id,
      orderId: r.order_id,
      bookingId: r.booking_id,
      customerLabel: r.customer_label,
      payerLabel: r.payer_label,
      createdAt: new Date(r.root_created as string).toISOString(),
      current: event(r),
    });
  return {
    lockIdentity: () => lock(`aarili:contact-merge:${shopId}`),
    lockReceipt: (id) => lock(`aarili:payment:${shopId}:${id}`),
    async identity(id) {
      return !!(
        await tx.execute(sql`select 1 from customer c join customer_person p on (p.shop_id,p.id)=(c.shop_id,c.person_id) join consent_record s on (s.shop_id,s.person_id)=(p.shop_id,p.id)
        where c.shop_id=${shopId}::uuid and c.id=${id}::uuid and p.synthetic and not exists(select 1 from (select mode from customer_merge_event where shop_id=c.shop_id and source_id=c.id order by version desc limit 1)m where m.mode='merge')`)
      ).rowCount;
    },
    async scope(customerId, orderId, bookingId) {
      if (bookingId) await lock(`booking:${shopId}:${bookingId}`);
      if (orderId) await lock(`order:${shopId}:${orderId}`);
      await lock(`aarili:customer:${shopId}:${customerId}`);
      if (!(await this.identity(customerId))) return false;
      if (
        bookingId &&
        !(
          await tx.execute(
            sql`select 1 from booking where shop_id=${shopId}::uuid and id=${bookingId}::uuid and customer_id=${customerId}::uuid`,
          )
        ).rowCount
      )
        return false;
      if (
        orderId &&
        !(
          await tx.execute(
            sql`select 1 from garment_order o where o.shop_id=${shopId}::uuid and o.id=${orderId}::uuid and coalesce((select current_customer_id from customer_order_attribution a where (a.shop_id,a.order_id)=(o.shop_id,o.id) order by version desc limit 1),o.customer_id)=${customerId}::uuid and (${bookingId}::uuid is null or exists(select 1 from booking_member where shop_id=o.shop_id and order_id=o.id and booking_id=${bookingId}::uuid))`,
          )
        ).rowCount
      )
        return false;
      return true;
    },
    async read(id) {
      const r = (
        await tx.execute(
          sql`${select} where r.shop_id=${shopId}::uuid and r.id=coalesce((select e.receipt_id from payment_result p join payment_event e on(e.shop_id,e.id)=(p.shop_id,p.event_id) where p.shop_id=${shopId}::uuid and p.draft_id=${id}::uuid),${id}::uuid)`,
        )
      ).rows[0];
      return r ? receipt(r) : undefined;
    },
    async list(customerId, before) {
      return (
        await tx.execute(
          sql`${select} where r.shop_id=${shopId}::uuid and (${customerId ?? null}::uuid is null or r.customer_id=${customerId ?? null}::uuid) and (${before ?? null}::uuid is null or r.id<${before ?? null}::uuid) order by r.id desc limit 26`,
        )
      ).rows.map(receipt);
    },
    async history(id, before) {
      return (
        await tx.execute(
          sql`select ${eventColumns} from payment_event e ${eventJoins} where e.shop_id=${shopId}::uuid and e.receipt_id=${id}::uuid and (${before ?? null}::integer is null or e.version<${before ?? null}) order by e.version desc limit 26`,
        )
      ).rows.map(event);
    },
    async totals(customerId) {
      const r = (
        await tx.execute(
          sql`select coalesce(sum(e.amount_paise) filter(where e.status='pending'),0)::text as "pendingPaise",coalesce(sum(e.amount_paise) filter(where e.status='confirmed'),0)::text as "confirmedPaise",count(*)::integer as receipts from payment_receipt r join lateral(select amount_paise,status from payment_event where shop_id=r.shop_id and receipt_id=r.id order by version desc limit 1)e on true where r.shop_id=${shopId}::uuid and r.customer_id=${customerId}::uuid`,
        )
      ).rows[0];
      return {
        pendingPaise: String(r?.pendingPaise ?? "0"),
        confirmedPaise: String(r?.confirmedPaise ?? "0"),
        receipts: Number(r?.receipts ?? 0),
      };
    },
    async eventId() {
      return String((await tx.execute(sql`select uuidv7() as id`)).rows[0]?.id);
    },
    async claim(reference, id) {
      await tx.execute(
        sql`insert into payment_reference_claim(shop_id,upi_reference_key,receipt_id) values(${shopId}::uuid,${reference},${id}::uuid) on conflict(shop_id,upi_reference_key) do nothing`,
      );
      return !!(
        await tx.execute(
          sql`select 1 from payment_reference_claim where shop_id=${shopId}::uuid and upi_reference_key=${reference} and receipt_id=${id}::uuid`,
        )
      ).rowCount;
    },
    async referenceReceipt(reference) {
      const r = (
        await tx.execute(
          sql`select receipt_id from payment_reference_claim where shop_id=${shopId}::uuid and upi_reference_key=${reference}`,
        )
      ).rows[0];
      return r ? String(r.receipt_id) : undefined;
    },
    async append(w) {
      const v = w.input;
      if (w.version === 1)
        await tx.execute(
          sql`insert into payment_receipt(shop_id,id,customer_id,payer_id,order_id,booking_id,origin_draft_id) values(${shopId}::uuid,${w.receiptId}::uuid,${v.customerId}::uuid,${v.payerId}::uuid,${v.orderId}::uuid,${v.bookingId}::uuid,${w.draftId}::uuid)`,
        );
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,reason,changes) values(${shopId}::uuid,${w.eventId}::uuid,'user',${w.actorId}::uuid,${`payment.${w.status}`},'payment_receipt',${w.receiptId}::uuid,${w.requestId}::uuid,${w.key}::uuid,${w.version > 1 ? "Owner payment transition" : "Payment recorded"},${JSON.stringify({ version: w.version, status: w.status })}::jsonb)`,
      );
      await tx.execute(sql`insert into payment_event(shop_id,id,receipt_id,version,previous_id,status,amount_paise,method,payment_date,account_id,account_revision_id,profile_id,reference,reason,attestation,restore_epoch,actor_id,origin_draft_id,command_key,audit_id,journal_id)
        values(${shopId}::uuid,${w.eventId}::uuid,${w.receiptId}::uuid,${w.version},${w.previousId}::uuid,${w.status},${toPostgresBigint(w.amountPaise)}::bigint,${v.method},${v.paymentDate}::date,${v.accountId}::uuid,${v.accountRevisionId}::uuid,${v.profileId}::uuid,${v.reference},${v.reason},${w.status === "confirmed" ? v.action : "none"},${v.restoreEpoch}::uuid,${w.actorId}::uuid,${w.draftId}::uuid,${w.key}::uuid,${w.eventId}::uuid,${w.journalId}::uuid)`);
    },
    async result(draftId, eventId) {
      await tx.execute(
        sql`insert into payment_result(shop_id,draft_id,event_id) values(${shopId}::uuid,${draftId}::uuid,${eventId}::uuid)`,
      );
    },
    async resultReceipt(draftId, resultId) {
      return (
        draftId === resultId &&
        !!(
          await tx.execute(
            sql`select 1 from payment_result where shop_id=${shopId}::uuid and draft_id=${draftId}::uuid`,
          )
        ).rowCount
      );
    },
  };
}
