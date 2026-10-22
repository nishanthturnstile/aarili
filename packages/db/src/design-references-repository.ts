import {
  designMediaSubjectSchema,
  designReferenceSnapshotSchema,
} from "@aarili/contracts/design-references";
import { mediaRecordSchema } from "@aarili/contracts/media";
import { sql, type Transaction } from "./index.js";
import type { DesignReferencesRepository } from "./repositories/design-references.js";

export function designReferencesRepository(
  tx: Transaction,
  shopId: string,
): DesignReferencesRepository {
  shopId = shopId.toLowerCase();
  let installed: Promise<boolean> | undefined;
  const available = () =>
    (installed ??= (async () =>
      !!(
        await tx.execute(
          sql`select to_regclass('public.design_media_subject') as present`,
        )
      ).rows[0]?.present)());
  const select = sql`select s.id,s.kind,s.actor_id as "actorId",s.recorded_at as "recordedAt",o.order_id as "orderId",o.piece_id as "pieceId",case when l.subject_id is null then null else jsonb_build_object('entryId',l.category_entry_id,'revisionId',l.category_revision_id) end as category,l.previous_id as "previousId",v.source_kind as "sourceKind",coalesce(v.source_text,'') as "sourceText",v.source_date::text as "sourceDate",case when v.redacted_at is not null then 'unknown' else v.rights_basis end as "rightsBasis",coalesce(v.rights_evidence,'') as "rightsEvidence",coalesce(v.reason,'') as reason,(v.redacted_at is not null) as redacted from design_media_subject s join design_media_value v on (v.shop_id,v.subject_id)=(s.shop_id,s.id) left join design_media_order_subject o on (o.shop_id,o.subject_id)=(s.shop_id,s.id) left join design_media_library_subject l on (l.shop_id,l.subject_id)=(s.shop_id,s.id)`;
  const subjectRow = (r: Record<string, unknown>) =>
    designMediaSubjectSchema.parse({
      ...r,
      recordedAt: new Date(r.recordedAt as string).toISOString(),
    });
  const repo: DesignReferencesRepository = {
    async subject(id) {
      if (!(await available())) return undefined;
      const r = (
        await tx.execute(
          sql`${select} where s.shop_id=${shopId}::uuid and s.id=${id}::uuid`,
        )
      ).rows[0];
      return r ? subjectRow(r) : undefined;
    },
    async subjectForAsset(id) {
      if (!(await available())) return undefined;
      const r = (
        await tx.execute<{ subject_id: string }>(
          sql`select subject_id from design_media_asset where shop_id=${shopId}::uuid and asset_id=${id}::uuid`,
        )
      ).rows[0];
      return r ? repo.subject(r.subject_id) : undefined;
    },
    async lockSubject(_id) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`designMedia:${shopId}`},0))`,
      );
    },
    async scope(id) {
      return (
        await tx.execute<{
          customerId: string;
          wearerId: string;
          kind: string;
        }>(
          sql`select customer_id as "customerId",wearer_id as "wearerId",intake_kind as kind from garment_order where shop_id=${shopId}::uuid and id=${id}::uuid`,
        )
      ).rows[0];
    },
    async referenceOrderIds(orderId, pieceId) {
      if (!(await available())) return [];
      return (
        await tx.execute<{ id: string }>(
          sql`select distinct o.order_id as id from design_spec_reference r join design_spec_version v on (v.shop_id,v.id)=(r.shop_id,r.version_id) join design_media_asset a on (a.shop_id,a.asset_id)=(r.shop_id,r.asset_id) join design_media_order_subject o on (o.shop_id,o.subject_id)=(a.shop_id,a.subject_id) where v.shop_id=${shopId}::uuid and v.order_id=${orderId}::uuid and v.scope_key=${pieceId ?? orderId}::uuid`,
        )
      ).rows.map((r) => r.id);
    },
    async latest(id) {
      return (
        await tx.execute<{ id: string }>(
          sql`select subject_id as id from design_media_library_subject where shop_id=${shopId}::uuid and entry_id=(select entry_id from design_media_library_subject where shop_id=${shopId}::uuid and subject_id=${id}::uuid) order by version desc limit 1`,
        )
      ).rows[0]?.id;
    },
    async library(before) {
      const rows = (
        await tx.execute(
          sql`${select} where s.shop_id=${shopId}::uuid and s.id in(select distinct on(entry_id) subject_id from design_media_library_subject where shop_id=${shopId}::uuid order by entry_id,version desc) and (${before ?? null}::uuid is null or s.id<${before ?? null}::uuid) order by s.id desc limit 26`,
        )
      ).rows;
      const subjects = rows.slice(0, 25).map(subjectRow);
      return {
        subjects,
        next: rows.length > 25 ? (subjects.at(-1)?.id ?? null) : null,
      };
    },
    async privateSubjects(orderId, pieceId, before) {
      const rows = (
        await tx.execute(
          sql`${select} where s.shop_id=${shopId}::uuid and o.order_id=${orderId}::uuid and o.scope_key=${pieceId ?? orderId}::uuid and (${before ?? null}::uuid is null or s.id<${before ?? null}::uuid) order by s.id desc limit 26`,
        )
      ).rows;
      const subjects = rows.slice(0, 25).map(subjectRow);
      return {
        subjects,
        next: rows.length > 25 ? (subjects.at(-1)?.id ?? null) : null,
      };
    },
    async assets(subjectId, before) {
      const rows = (
        await tx.execute(
          sql`select a.id,a.subject_id as "subjectId",a.purpose,a.content_type as "contentType",a.declared_bytes as size,a.status,a.version,a.created_at as "createdAt" from media_asset a join design_media_asset m on (m.shop_id,m.asset_id)=(a.shop_id,a.id) where a.shop_id=${shopId}::uuid and m.subject_id=${subjectId}::uuid and (${before ?? null}::uuid is null or a.id<${before ?? null}::uuid) order by a.id desc limit 26`,
        )
      ).rows;
      const assets = rows.slice(0, 25).map((r) =>
        mediaRecordSchema.parse({
          ...r,
          createdAt: new Date(r.createdAt as string).toISOString(),
        }),
      );
      return {
        assets,
        next: rows.length > 25 ? (assets.at(-1)?.id ?? null) : null,
      };
    },
    async writeSubject(v, draftId, actorId, key, requestId) {
      const ids = (
        await tx.execute<{ id: string; audit: string }>(
          sql`select uuidv7() as id,uuidv7() as audit`,
        )
      ).rows[0];
      if (!ids) throw Error("Design media identity unavailable");
      await tx.execute(
        sql`insert into audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) values(${shopId}::uuid,${ids.audit}::uuid,'user',${actorId}::uuid,'design.reference.subject','design-media-subject',${ids.id}::uuid,${requestId}::uuid,${key}::uuid,'{}'::jsonb)`,
      );
      await tx.execute(
        sql`insert into design_media_subject(shop_id,id,kind,actor_id,origin_draft_id,audit_id,command_key) values(${shopId}::uuid,${ids.id}::uuid,${v.kind},${actorId}::uuid,${draftId}::uuid,${ids.audit}::uuid,${key}::uuid)`,
      );
      if (v.kind === "private") {
        const scope = v.orderId ? await repo.scope(v.orderId) : undefined;
        if (!scope) throw Error("Design scope unavailable");
        await tx.execute(
          sql`insert into design_media_order_subject(shop_id,subject_id,order_id,piece_id,scope_key,customer_id,wearer_id) values(${shopId}::uuid,${ids.id}::uuid,${v.orderId}::uuid,${v.pieceId}::uuid,${v.pieceId ?? v.orderId}::uuid,${scope.customerId}::uuid,${scope.wearerId}::uuid)`,
        );
      } else {
        await tx.execute(
          sql`insert into design_media_library_subject(shop_id,subject_id,entry_id,version,previous_id,category_entry_id,category_revision_id) select ${shopId}::uuid,${ids.id}::uuid,coalesce(p.entry_id,${ids.id}::uuid),coalesce(p.version,0)+1,${v.previousId}::uuid,${v.category?.entryId}::uuid,${v.category?.revisionId}::uuid from (select 1) singleton left join design_media_library_subject p on p.shop_id=${shopId}::uuid and p.subject_id=${v.previousId}::uuid`,
        );
      }
      await tx.execute(
        sql`insert into design_media_value(shop_id,subject_id,source_kind,source_text,source_date,rights_basis,rights_evidence,reason) values(${shopId}::uuid,${ids.id}::uuid,${v.sourceKind},${v.sourceText},${v.sourceDate}::date,${v.rightsBasis},${v.rightsEvidence},${v.reason})`,
      );
      return ids.id;
    },
    async subjectOrigin(id, draftId) {
      return !!(
        await tx.execute(
          sql`select id from design_media_subject where shop_id=${shopId}::uuid and id=${id}::uuid and origin_draft_id=${draftId}::uuid`,
        )
      ).rowCount;
    },
    async references(id) {
      if (!(await available())) return [];
      const rows = (
        await tx.execute(
          sql`select r.id,r.asset_id as "assetId",r.question_id as "questionId",r.intent,r.replaces_id as "replacesId",r.geometry_reviewed as "geometryReviewed",r.sha256,r.display,r.content_type as "contentType",r.purpose,r.uploader_id as "uploaderId",r.uploaded_at as "uploadedAt",coalesce(v.caption,'') as caption,v.notes,(v.redacted_at is not null) as redacted,coalesce((select jsonb_agg(n.anchor order by n.position) from design_reference_annotation n where n.shop_id=r.shop_id and n.reference_id=r.id),'[]'::jsonb) as anchors from design_spec_reference r join design_reference_value v on (v.shop_id,v.reference_id)=(r.shop_id,r.id) where r.shop_id=${shopId}::uuid and r.version_id=${id}::uuid order by r.position`,
        )
      ).rows;
      const result = [];
      for (const r of rows) {
        const subject = await repo.subjectForAsset(String(r.assetId));
        if (!subject) throw Error("Design reference provenance unavailable");
        const redacted = r.redacted === true || subject.redacted;
        const { notes: rawNotes, anchors: rawAnchors, ...fields } = r;
        const notes = (rawNotes ?? []) as string[],
          anchors = rawAnchors as Record<string, unknown>[];
        result.push(
          designReferenceSnapshotSchema.parse({
            ...fields,
            subject,
            uploadedAt: new Date(r.uploadedAt as string).toISOString(),
            caption: redacted ? "" : r.caption,
            annotations: redacted
              ? []
              : anchors.map((anchor, i) => ({ anchor, note: notes[i] })),
            redacted,
          }),
        );
      }
      return result;
    },
    async writeReferences(versionId, items) {
      for (const [position, r] of items.entries()) {
        await tx.execute(
          sql`insert into design_spec_reference(shop_id,id,version_id,asset_id,question_id,position,intent,replaces_id,geometry_reviewed,sha256,display,content_type,purpose,uploader_id,uploaded_at) select ${shopId}::uuid,${r.id}::uuid,${versionId}::uuid,a.id,${r.questionId}::uuid,${position},${r.intent},${r.replacesId}::uuid,${r.geometryReviewed},a.sha256,(select jsonb_build_object('sha256',d.sha256,'width',d.width,'height',d.height) from media_derivative d where d.shop_id=a.shop_id and d.asset_id=a.id and d.variant='display'),a.content_type,a.purpose,a.creator_id,a.created_at from media_asset a where a.shop_id=${shopId}::uuid and a.id=${r.assetId}::uuid and a.status='ready'`,
        );
        await tx.execute(
          sql`insert into design_reference_value(shop_id,reference_id,caption,notes) values(${shopId}::uuid,${r.id}::uuid,${r.caption},${JSON.stringify(r.annotations.map((a) => a.note))}::jsonb)`,
        );
        for (const [i, n] of r.annotations.entries())
          await tx.execute(
            sql`insert into design_reference_annotation(shop_id,reference_id,position,anchor) values(${shopId}::uuid,${r.id}::uuid,${i},${JSON.stringify(n.anchor)}::jsonb)`,
          );
        await tx.execute(
          sql`insert into media_reference(shop_id,asset_id,reference_id) values(${shopId}::uuid,${r.assetId}::uuid,${r.id}::uuid)`,
        );
      }
    },
    async hasReadableAssociation(id) {
      return !!(
        await tx.execute(
          sql`select 1 from design_spec_reference r join design_reference_value v on (v.shop_id,v.reference_id)=(r.shop_id,r.id) join design_spec_version s on (s.shop_id,s.id)=(r.shop_id,r.version_id) join design_spec_value sv on (sv.shop_id,sv.event_id)=(s.shop_id,s.event_id) where r.shop_id=${shopId}::uuid and r.asset_id=${id}::uuid and v.redacted_at is null and sv.redacted_at is null limit 1`,
        )
      ).rowCount;
    },
    async retainDraft(r, auditId, key) {
      await tx.execute(
        sql`insert into design_reference_draft_value(shop_id,draft_id,version,payload,audit_id,command_key) values(${shopId}::uuid,${r.id}::uuid,${r.version},${JSON.stringify(r.payload)}::jsonb,${auditId}::uuid,${key}::uuid)`,
      );
    },
    async replayDraft(id, version) {
      const r = (
        await tx.execute(
          sql`select payload from design_reference_draft_value where shop_id=${shopId}::uuid and draft_id=${id}::uuid and version=${version}`,
        )
      ).rows[0];
      if (!r) throw Error("Private source response unavailable");
      return r.payload as Record<string, unknown>;
    },
  };
  return repo;
}
