-- 1.2.4b / #135. Additive, synthetic-only. Gate repeat writes before rollback;
-- retain these records and a reader compatible with order.repeat-service v1.
ALTER TABLE order_service_change_line ADD UNIQUE(shop_id,order_id,id);
CREATE TABLE service_repeat_origin (
 shop_id uuid NOT NULL,draft_id uuid NOT NULL,source_order_id uuid NOT NULL,source_subject_id uuid,
 source jsonb NOT NULL,initial_payload jsonb NOT NULL,command_key uuid NOT NULL,actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,draft_id),UNIQUE(shop_id,draft_id,source_order_id),UNIQUE(shop_id,command_key),
 FOREIGN KEY(shop_id,draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,source_order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,source_order_id,source_subject_id) REFERENCES service_property_subject(shop_id,order_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE INDEX service_repeat_source ON service_repeat_origin(shop_id,source_order_id,draft_id);
CREATE FUNCTION service_repeat_identity(ref jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $fn$
 SELECT (ref-ARRAY['sourceVersion','scopeDigest','selections'])||jsonb_build_object('selections',(SELECT jsonb_agg(value-'lineVersion' ORDER BY ordinality) FROM jsonb_array_elements(ref->'selections') WITH ORDINALITY))
$fn$;
REVOKE ALL ON FUNCTION service_repeat_identity(jsonb) FROM PUBLIC;GRANT EXECUTE ON FUNCTION service_repeat_identity(jsonb) TO app_user;
CREATE TABLE service_repeat_selection (
 shop_id uuid NOT NULL,draft_id uuid NOT NULL,position integer NOT NULL CHECK(position BETWEEN 0 AND 31),
 source_order_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('standalone','addition','original-addon')),
 standalone_line_id uuid,addition_line_id uuid,change_id uuid,piece_id uuid,addon_key text,
 catalogue_entry_id uuid NOT NULL,catalogue_revision_id uuid NOT NULL,target_line_id uuid NOT NULL,content jsonb NOT NULL,
 PRIMARY KEY(shop_id,draft_id,position),UNIQUE(shop_id,target_line_id),
 FOREIGN KEY(shop_id,draft_id,source_order_id) REFERENCES service_repeat_origin(shop_id,draft_id,source_order_id),
 FOREIGN KEY(shop_id,source_order_id,standalone_line_id) REFERENCES service_order_line(shop_id,order_id,id),
 FOREIGN KEY(shop_id,source_order_id,addition_line_id) REFERENCES order_service_change_line(shop_id,order_id,id),
 FOREIGN KEY(shop_id,source_order_id,change_id) REFERENCES order_service_change(shop_id,order_id,id),
 FOREIGN KEY(shop_id,source_order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,catalogue_entry_id,catalogue_revision_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id),
 CHECK((kind='standalone' AND standalone_line_id IS NOT NULL AND addition_line_id IS NULL AND change_id IS NULL AND addon_key IS NULL)
 OR(kind='addition' AND standalone_line_id IS NULL AND addition_line_id IS NOT NULL AND change_id IS NOT NULL AND addon_key IS NULL)
 OR(kind='original-addon' AND standalone_line_id IS NULL AND addition_line_id IS NULL AND change_id IS NULL AND addon_key IS NOT NULL))
);
CREATE TABLE service_repeat_target (
 shop_id uuid NOT NULL,draft_id uuid NOT NULL,order_id uuid NOT NULL,
 PRIMARY KEY(shop_id,draft_id),UNIQUE(shop_id,order_id),
 FOREIGN KEY(shop_id,draft_id) REFERENCES service_repeat_origin(shop_id,draft_id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id)
);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['service_repeat_origin','service_repeat_selection','service_repeat_target'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION order_immutable_guard()',t||'_immutable',t);
 END LOOP;
END $policies$;
CREATE FUNCTION service_repeat_base(d public.durable_draft) RETURNS public.durable_draft LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $fn$
BEGIN IF d.workflow='order.repeat-service' THEN d.workflow='order.service';d.payload=d.payload-'repeat';END IF;RETURN d;END $fn$;
REVOKE ALL ON FUNCTION service_repeat_base(public.durable_draft) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_repeat_base(public.durable_draft) TO app_user;
CREATE FUNCTION service_repeat_catalogue_ref(profile_id uuid,source_key text) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $fn$
 SELECT CASE WHEN m->>'addonKey' IS NULL THEN t.content->'service' ELSE (SELECT a FROM jsonb_array_elements(t.content->'addons') a WHERE a->>'key'=m->>'addonKey') END
 FROM service_intake_profile_revision p JOIN service_template_revision t ON (t.shop_id,t.id)=(p.shop_id,p.definition_id),jsonb_array_elements(p.content->'lines') m
 WHERE p.shop_id=NULLIF(current_setting('app.shop_id',true),'')::uuid AND p.id=profile_id AND m->>'key'=source_key
$fn$;
REVOKE ALL ON FUNCTION service_repeat_catalogue_ref(uuid,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION service_repeat_catalogue_ref(uuid,text) TO app_user;
DO $adapter$ DECLARE body text;needle text;BEGIN
 body=pg_get_functiondef('garment_order_guard()'::regprocedure);
 needle='SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Service repeat insert predecessor changed';END IF;
 EXECUTE replace(body,needle,needle||'d=service_repeat_base(d);');
 body=pg_get_functiondef('service_order_acceptance_valid(uuid,uuid)'::regprocedure);
 needle='SELECT * INTO d FROM durable_draft WHERE shop_id=tenant AND id=o.origin_draft_id;p=d.payload;';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Service repeat acceptance predecessor changed';END IF;
 EXECUTE replace(body,needle,'SELECT * INTO d FROM durable_draft WHERE shop_id=tenant AND id=o.origin_draft_id;d=service_repeat_base(d);p=d.payload;');
END $adapter$;
CREATE FUNCTION service_repeat_insert_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;o public.garment_order;s public.order_acceptance_snapshot;p jsonb;line jsonb;r public.service_repeat_origin;src jsonb;ref jsonb;template public.service_template_revision;
BEGIN
 IF TG_TABLE_NAME='service_repeat_origin' THEN
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;p=d.payload;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.source_order_id;
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=o.shop_id AND order_id=o.id;
 NEW.source_subject_id=(NEW.source->>'subjectId')::uuid;NEW.recorded_at=clock_timestamp();
 IF d.workflow IS DISTINCT FROM 'order.repeat-service' OR d.schema_version<>1 OR d.version<>1 OR d.lifecycle<>'active'
 OR p IS DISTINCT FROM NEW.initial_payload OR p->'repeat' IS DISTINCT FROM NEW.source
 OR NEW.source->>'sourceId' IS DISTINCT FROM o.id::text OR (NEW.source->>'sourceVersion')::integer IS DISTINCT FROM o.version
 OR NEW.source->>'snapshotDigest' IS DISTINCT FROM s.digest OR NEW.source->>'scopeDigest' IS NULL OR NEW.source->>'scopeDigest' !~ '^[a-f0-9]{64}$'
 OR NEW.source_subject_id IS DISTINCT FROM (s.content->'intake'->>'subjectId')::uuid
 OR (p->>'customerId')::uuid IS DISTINCT FROM o.customer_id OR (p->>'wearerId')::uuid IS DISTINCT FROM o.wearer_id
 OR (p->>'sourceOrderId')::uuid IS DISTINCT FROM o.id OR (p->>'subjectId')::uuid IS NOT DISTINCT FROM NEW.source_subject_id
 OR jsonb_array_length(p->'lines')<>jsonb_array_length(NEW.source->'selections') OR jsonb_array_length(p->'lines') NOT BETWEEN 1 AND 32
 OR (p-ARRAY['customerId','wearerId','sourceOrderId','sourcePieceId','subjectId','subjectDescription','profile','lines','instructions','repeat']) IS DISTINCT FROM
 '{"deliveryDate":"","deliveryTime":"","requestedDate":"","eventDate":"","occasion":"","orderDate":"","historicalReason":"","priority":"normal","propertyReference":"","intakeContext":"","presentation":"simple","presentationRevisionId":null,"commitmentReview":null}'::jsonb
 OR p->>'instructions' IS DISTINCT FROM (CASE WHEN NEW.source->>'reuseInstructions'='true' THEN s.content->'intake'->>'instructions' ELSE '' END)
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.creator_id IS DISTINCT FROM NEW.actor_id
 OR EXISTS(SELECT 1 FROM service_property_subject x WHERE x.shop_id=NEW.shop_id AND x.id=(p->>'subjectId')::uuid)
 THEN RAISE EXCEPTION 'Service repeat reset denied' USING ERRCODE='23514';END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p->'lines') LOOP
  IF (line-ARRAY['id','key','requestedWork']) IS DISTINCT FROM '{"priceState":"to-be-quoted","priceText":"","notRequired":false,"notRequiredReason":""}'::jsonb
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.source->'selections') x WHERE x->>'targetLineId'=line->>'id')
  OR EXISTS(SELECT 1 FROM service_order_line x WHERE x.shop_id=NEW.shop_id AND x.id=(line->>'id')::uuid)
  OR EXISTS(SELECT 1 FROM order_service_change_line x WHERE x.shop_id=NEW.shop_id AND x.id=(line->>'id')::uuid)
  THEN RAISE EXCEPTION 'Service repeat fresh line denied' USING ERRCODE='23514';END IF;
 END LOOP;
 ELSE
 SELECT * INTO r FROM service_repeat_origin WHERE shop_id=NEW.shop_id AND draft_id=NEW.draft_id;
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.source_order_id;
 IF NEW.content IS DISTINCT FROM r.source->'selections'->NEW.position
 OR NEW.target_line_id::text IS DISTINCT FROM NEW.content->>'targetLineId' OR NEW.kind IS DISTINCT FROM NEW.content->>'kind'
 OR NEW.piece_id IS DISTINCT FROM (NEW.content->>'pieceId')::uuid OR NEW.catalogue_entry_id IS DISTINCT FROM (NEW.content->>'catalogueEntryId')::uuid OR NEW.catalogue_revision_id IS DISTINCT FROM (NEW.content->>'catalogueRevisionId')::uuid
 THEN RAISE EXCEPTION 'Service repeat selection denied' USING ERRCODE='23514';END IF;
 IF NEW.kind='original-addon' THEN
 SELECT * INTO template FROM service_template_revision WHERE shop_id=s.shop_id AND id=s.definition_id;
 SELECT value INTO ref FROM jsonb_array_elements(template.content->'addons') WHERE value->>'key'=NEW.addon_key;
 IF NEW.addon_key IS DISTINCT FROM NEW.content->>'addonKey' OR NEW.content->>'lineId' IS NOT NULL OR NEW.content->>'sourceDigest' IS DISTINCT FROM s.digest OR NEW.content->>'sourceId' IS DISTINCT FROM s.order_id::text
 OR ref->>'entryId' IS DISTINCT FROM NEW.catalogue_entry_id::text OR ref->>'revisionId' IS DISTINCT FROM NEW.catalogue_revision_id::text OR ref IS NULL
 OR (NEW.piece_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM order_requirement_scope x WHERE x.shop_id=NEW.shop_id AND x.order_id=NEW.source_order_id AND x.piece_id=NEW.piece_id AND x.addon_key=NEW.addon_key))
 THEN RAISE EXCEPTION 'Original add-on source denied' USING ERRCODE='23514';END IF;
 ELSE
 src=service_line_source(NEW.shop_id,NEW.source_order_id,COALESCE(NEW.standalone_line_id,NEW.addition_line_id));
 ref=service_repeat_catalogue_ref((src->'line'->>'sourceRevisionId')::uuid,src->'line'->>'key');
 IF src IS NULL OR src->>'kind' IS DISTINCT FROM (CASE NEW.kind WHEN 'standalone' THEN 'standalone' ELSE 'addition' END)
 OR src->'line'->>'id' IS DISTINCT FROM NEW.content->>'lineId' OR src->>'sourceId' IS DISTINCT FROM NEW.content->>'sourceId' OR src->>'sourceDigest' IS DISTINCT FROM NEW.content->>'sourceDigest'
 OR (src->>'pieceId')::uuid IS DISTINCT FROM NEW.piece_id OR (NEW.kind='addition' AND NEW.change_id::text IS DISTINCT FROM src->>'sourceId')
 OR ref->>'entryId' IS DISTINCT FROM NEW.catalogue_entry_id::text OR ref->>'revisionId' IS DISTINCT FROM NEW.catalogue_revision_id::text
 THEN RAISE EXCEPTION 'Exact service line source denied' USING ERRCODE='23514';END IF;
 END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER service_repeat_origin_insert BEFORE INSERT ON service_repeat_origin FOR EACH ROW EXECUTE FUNCTION service_repeat_insert_guard();
CREATE TRIGGER service_repeat_selection_insert BEFORE INSERT ON service_repeat_selection FOR EACH ROW EXECUTE FUNCTION service_repeat_insert_guard();
CREATE FUNCTION service_repeat_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;r public.service_repeat_origin;t public.service_repeat_target;o public.garment_order;s public.order_acceptance_snapshot;x public.service_repeat_selection;line jsonb;
BEGIN
 IF TG_TABLE_NAME='durable_draft' THEN IF NEW.workflow<>'order.repeat-service' THEN RETURN NEW;END IF;SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.id;
 ELSE SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;END IF;
 SELECT * INTO r FROM service_repeat_origin WHERE shop_id=d.shop_id AND draft_id=d.id;
 IF r.draft_id IS NULL OR d.workflow IS DISTINCT FROM 'order.repeat-service' OR d.schema_version<>1 OR service_repeat_identity(d.payload->'repeat') IS DISTINCT FROM service_repeat_identity(r.source)
 OR (d.payload->>'customerId')::uuid IS DISTINCT FROM (r.initial_payload->>'customerId')::uuid OR (d.payload->>'wearerId')::uuid IS DISTINCT FROM (r.initial_payload->>'wearerId')::uuid
 OR d.payload->'subjectId' IS DISTINCT FROM r.initial_payload->'subjectId' OR d.payload->'sourceOrderId' IS DISTINCT FROM r.initial_payload->'sourceOrderId' OR d.payload->'sourcePieceId' IS DISTINCT FROM r.initial_payload->'sourcePieceId'
 OR jsonb_array_length(d.payload->'lines')<>jsonb_array_length(r.source->'selections')
 OR (SELECT count(*) FROM service_repeat_selection q WHERE q.shop_id=d.shop_id AND q.draft_id=d.id)<>jsonb_array_length(r.source->'selections')
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=d.shop_id AND a.entity_id=d.id AND a.action='draft.save' AND a.idempotency_key=r.command_key AND a.actor_id=r.actor_id)
 THEN RAISE EXCEPTION 'Service repeat provenance incomplete' USING ERRCODE='23514';END IF;
 FOR x IN SELECT * FROM service_repeat_selection WHERE shop_id=d.shop_id AND draft_id=d.id LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.payload->'lines') q WHERE q->>'id'=x.target_line_id::text) THEN RAISE EXCEPTION 'Repeat target line identity changed' USING ERRCODE='23514';END IF;
 END LOOP;
 SELECT * INTO t FROM service_repeat_target WHERE shop_id=d.shop_id AND draft_id=d.id;
 IF d.lifecycle='promoted' THEN
 FOR x IN SELECT * FROM service_repeat_selection WHERE shop_id=d.shop_id AND draft_id=d.id LOOP
 SELECT value INTO line FROM jsonb_array_elements(d.payload->'lines') q WHERE q->>'id'=x.target_line_id::text;
 IF service_change_catalogue_source((d.payload->'profile'->>'revisionId')::uuid,line->>'key') IS DISTINCT FROM x.catalogue_entry_id
 OR (x.piece_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM order_piece piece JOIN service_intake_profile_revision p ON p.shop_id=piece.shop_id JOIN service_template_revision template ON (template.shop_id,template.id)=(p.shop_id,p.definition_id),jsonb_array_elements(template.content->'pieces') def WHERE piece.shop_id=x.shop_id AND piece.order_id=x.source_order_id AND piece.id=x.piece_id AND p.id=(d.payload->'profile'->>'revisionId')::uuid AND def->>'entryId'=piece.entry_id::text))
 OR NOT EXISTS(SELECT 1 FROM service_intake_profile_revision p,jsonb_array_elements(p.content->'lines') m WHERE p.shop_id=d.shop_id AND p.id=(d.payload->'profile'->>'revisionId')::uuid AND m->>'key'=line->>'key' AND m->>'taskKey' IS NULL)
 THEN RAISE EXCEPTION 'Repeat current work mapping denied' USING ERRCODE='23514';END IF;
 END LOOP;
 SELECT * INTO o FROM garment_order WHERE shop_id=t.shop_id AND id=t.order_id;SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=t.shop_id AND order_id=t.order_id;
 IF t.order_id IS NULL OR d.result_type IS DISTINCT FROM 'service-order.accepted' OR d.result_id IS DISTINCT FROM t.order_id OR o.origin_draft_id IS DISTINCT FROM d.id OR o.intake_kind IS DISTINCT FROM 'service' OR o.id=r.source_order_id
 OR s.content->'intake' IS DISTINCT FROM d.payload-'repeat' OR s.content->'snapshot'->'repeatService' IS DISTINCT FROM d.payload->'repeat'
 THEN RAISE EXCEPTION 'Service repeat acceptance incomplete' USING ERRCODE='23514';END IF;
 ELSIF t.order_id IS NOT NULL THEN RAISE EXCEPTION 'Unaccepted service repeat' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER service_repeat_draft_commit AFTER INSERT OR UPDATE ON durable_draft DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_repeat_commit_guard();
DO $guards$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['service_repeat_origin','service_repeat_selection','service_repeat_target'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_repeat_commit_guard()',t||'_commit',t);END LOOP;END $guards$;
REVOKE ALL ON FUNCTION service_repeat_insert_guard(),service_repeat_commit_guard() FROM PUBLIC;
