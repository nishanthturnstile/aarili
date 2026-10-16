import {
  type UsageEvent,
  type UsageReadout,
  usageEventSchema,
} from "@aarili/contracts/usage";
import { sql, type Transaction } from "./index.js";
import type { UsageRepository } from "./repositories/usage.js";

type Row = {
  actionId: string;
  subjectId: string;
  name: string;
  schemaVersion: number | null;
  bytes: string | null;
  category: string | null;
  durationSeconds: number | null;
  occurredAt: string;
};
function event(row: Row): UsageEvent {
  return usageEventSchema.parse({
    actionId: row.actionId,
    subjectId: row.subjectId,
    name: row.name,
    ...(row.schemaVersion === null ? {} : { schemaVersion: row.schemaVersion }),
    ...(row.bytes === null ? {} : { bytes: Number(row.bytes) }),
    ...(row.category === null ? {} : { category: row.category }),
    ...(row.durationSeconds === null
      ? {}
      : { durationSeconds: row.durationSeconds }),
  });
}
const columns = sql`action_id as "actionId",subject_id as "subjectId",name,schema_version as "schemaVersion",bytes::text,category,duration_seconds as "durationSeconds",to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "occurredAt"`;
export function usageRepository(
  tx: Transaction,
  shopId: string,
): UsageRepository {
  return {
    async append(input) {
      const e = usageEventSchema.parse(input);
      const fields = {
        schemaVersion: "schemaVersion" in e ? e.schemaVersion : null,
        bytes: "bytes" in e ? String(e.bytes) : null,
        category: "category" in e ? e.category : null,
        seconds: "durationSeconds" in e ? e.durationSeconds : null,
      };
      await tx.execute(
        sql`insert into product_event(shop_id,action_id,name,subject_id,schema_version,bytes,category,duration_seconds) values(${shopId}::uuid,${e.actionId}::uuid,${e.name},${e.subjectId}::uuid,${fields.schemaVersion},${fields.bytes}::bigint,${fields.category},${fields.seconds}) on conflict(shop_id,action_id) do nothing`,
      );
      const prior = (
        await tx.execute<Row>(
          sql`select ${columns} from product_event where shop_id=${shopId}::uuid and action_id=${e.actionId}::uuid`,
        )
      ).rows[0];
      if (!prior || JSON.stringify(event(prior)) !== JSON.stringify(e))
        throw new Error("Usage action binding mismatch");
    },
    async read(p) {
      const period = sql`shop_id=${shopId}::uuid and occurred_at>=${p.from}::timestamptz and occurred_at<${p.to}::timestamptz`;
      const cursor = p.after
        ? sql` and (occurred_at,action_id)> (${p.after.occurredAt}::timestamptz,${p.after.actionId}::uuid)`
        : sql``;
      // One statement gives aggregates and drilldown the same MVCC snapshot.
      const result = (
        await tx.execute<{ totals: UsageReadout["totals"]; rows: Row[] }>(sql`
        with matching as materialized (select * from product_event where ${period}),
        totals as (select count(*)::text as events,coalesce(sum(bytes),0)::text as "mediaBytes",coalesce(sum(duration_seconds),0)::text as "supportSeconds",count(*) filter(where name='draft.saved')::text as "draftsSaved",count(*) filter(where name='draft.promoted')::text as "draftsPromoted",count(*) filter(where name='draft.abandoned')::text as "draftsAbandoned",count(*) filter(where name='pdf.rendered')::text as "pdfsRendered" from matching),
        page as (select ${columns} from matching where true ${cursor} order by occurred_at,action_id limit 101)
        select to_jsonb(totals) as totals,coalesce((select jsonb_agg(to_jsonb(page) order by page."occurredAt",page."actionId") from page),'[]'::jsonb) as rows from totals
      `)
      ).rows[0];
      if (!result) throw new Error("Usage readout unavailable");
      const { totals, rows } = result;
      const last = rows.length > 100 ? rows[99] : undefined;
      return {
        totals,
        sources: rows.slice(0, 100).map((r) => ({
          event: event(r),
          occurredAt: r.occurredAt,
        })),
        truncated: rows.length > 100,
        next: last
          ? {
              occurredAt: last.occurredAt,
              actionId: last.actionId,
            }
          : null,
        messaging: null,
        ai: null,
      };
    },
  };
}
