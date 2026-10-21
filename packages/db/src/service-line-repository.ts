import type { ServiceLineResult } from "@aarili/contracts/small-services";
import {
  serviceLineSourceSchema,
  serviceLineTransitionSchema,
} from "@aarili/contracts/small-services";
import { sql, type Transaction } from "./index.js";
import type { SmallServicesRepository } from "./repositories/small-services.js";
import { requestRepository } from "./request-repository.js";

export function serviceLineRepository(
  tx: Transaction,
  shopId: string,
): SmallServicesRepository["progress"] {
  return {
    ...requestRepository<ServiceLineResult>(tx, shopId),
    async sources(orderId) {
      const r = await tx.execute<{ source: unknown }>(
        sql`select service_line_source(${shopId}::uuid,${orderId}::uuid,id) as source from (select id from service_order_line where shop_id=${shopId}::uuid and order_id=${orderId}::uuid union select id from order_service_change_line where shop_id=${shopId}::uuid and order_id=${orderId}::uuid) lines order by id`,
      );
      return r.rows.map((r) => serviceLineSourceSchema.parse(r.source));
    },
    async current(orderId) {
      const r = await tx.execute<{
        lineId: string;
        version: number;
        state: "pending" | "completed";
        lastId: string;
        schemaVersion: number;
      }>(
        sql`select line_id as "lineId",version,state,last_transition_id as "lastId",schema_version as "schemaVersion" from service_line_current where shop_id=${shopId}::uuid and order_id=${orderId}::uuid`,
      );
      for (const row of r.rows)
        if (row.schemaVersion !== 1)
          throw new Error("Unsupported service progress version");
      return r.rows;
    },
    async history(orderId) {
      const r = await tx.execute<Record<string, unknown>>(
        sql`select t.id,t.line_id as "lineId",t.version,t.from_state as "from",t.to_state as "to",t.correction_of as "correctionOf",t.actor_id as "actorId",t.recorded_at as "recordedAt",t.schema_version as "schemaVersion",e.note,(e.redacted_at is not null) as redacted from service_line_transition t join service_line_evidence e on (e.shop_id,e.transition_id)=(t.shop_id,t.id) where t.shop_id=${shopId}::uuid and t.order_id=${orderId}::uuid order by t.line_id,t.version`,
      );
      return r.rows.map(({ schemaVersion, ...row }) => {
        if (schemaVersion !== 1)
          throw new Error("Unsupported service history version");
        return serviceLineTransitionSchema.parse({
          ...row,
          recordedAt: new Date(row.recordedAt as string).toISOString(),
        });
      });
    },
    async prior(commandId, key) {
      return (
        await tx.execute<{
          id: string;
          lineId: string;
          version: number;
          hash: string;
          actorId: string;
          key: string;
          commandId: string;
        }>(
          sql`select id,line_id as "lineId",version,request_hash as hash,actor_id as "actorId",command_key as key,command_id as "commandId" from service_line_transition where shop_id=${shopId}::uuid and (command_id=${commandId}::uuid or command_key=${key}::uuid) order by version limit 1`,
        )
      ).rows[0];
    },
    async write(v) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw new Error("Missing transition identity");
      const version = v.expected + 1,
        action = `service.line.${v.to === "completed" ? "complete" : "correct"}`;
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${v.actorId}::uuid,${action},'service-line',${v.source.line.id}::uuid,${v.requestId}::uuid,${v.key}::uuid,${JSON.stringify({ version, state: v.to, transitionId: ids.id })}::jsonb)`,
      );
      await tx.execute(
        sql`insert into service_line_transition(shop_id,id,order_id,line_id,version,from_state,to_state,correction_of,source_id,source_digest,parent_version,booking_id,booking_version,actor_id,command_id,command_key,request_hash,audit_id) values(${shopId}::uuid,${ids.id}::uuid,${v.orderId}::uuid,${v.source.line.id}::uuid,${version},${v.to === "completed" ? "pending" : "completed"},${v.to},${v.correctionOf}::uuid,${v.source.sourceId}::uuid,${v.source.sourceDigest},${v.parentVersion},${v.bookingId}::uuid,${v.bookingVersion},${v.actorId}::uuid,${v.commandId}::uuid,${v.key}::uuid,${v.hash},${ids.audit}::uuid)`,
      );
      if (v.expected === 1)
        await tx.execute(
          sql`insert into service_line_current(shop_id,order_id,line_id,standalone_line_id,addition_line_id,source_id,source_digest,version,state,last_transition_id) values(${shopId}::uuid,${v.orderId}::uuid,${v.source.line.id}::uuid,${v.source.kind === "standalone" ? v.source.line.id : null}::uuid,${v.source.kind === "addition" ? v.source.line.id : null}::uuid,${v.source.sourceId}::uuid,${v.source.sourceDigest},${version},${v.to},${ids.id}::uuid)`,
        );
      else {
        const r = await tx.execute(
          sql`update service_line_current set version=${version},state=${v.to},last_transition_id=${ids.id}::uuid where shop_id=${shopId}::uuid and order_id=${v.orderId}::uuid and line_id=${v.source.line.id}::uuid and version=${v.expected}`,
        );
        if (r.rowCount !== 1) throw new Error("Service line CAS failed");
      }
      await tx.execute(
        sql`insert into service_line_evidence(shop_id,transition_id,note) values(${shopId}::uuid,${ids.id}::uuid,${v.note})`,
      );
      return { transitionId: ids.id, lineId: v.source.line.id, version };
    },
  };
}
