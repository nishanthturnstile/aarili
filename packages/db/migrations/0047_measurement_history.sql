-- #154 / 1.3.2b. Retain all existing values and V1/order references.
-- Minimum reader: 1.3.2b for selection history and multi-version sessions.
-- Disable these writers before compatible application rollback; no down migration.
ALTER TABLE measurement_version ADD COLUMN session_id uuid, ADD COLUMN previous_id uuid,
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
-- Only structural identity is filled; no personal observation is inferred.
DROP TRIGGER measurement_version_write ON measurement_version;
-- app_owner is deliberately subject to FORCE RLS at runtime. This structural
-- initialization spans every shop under the runner's advisory/DDL transaction
-- lock; remove FORCE only for this owner UPDATE and restore it before commit.
ALTER TABLE measurement_version NO FORCE ROW LEVEL SECURITY;
UPDATE measurement_version SET session_id=id;
ALTER TABLE measurement_version FORCE ROW LEVEL SECURITY;
ALTER TABLE measurement_version ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE measurement_version ADD UNIQUE(shop_id,session_id,id),
 ADD UNIQUE(shop_id,session_id,version), ADD UNIQUE(shop_id,previous_id),
 ADD FOREIGN KEY(shop_id,session_id) REFERENCES measurement_version(shop_id,id),
 ADD FOREIGN KEY(shop_id,session_id,previous_id) REFERENCES measurement_version(shop_id,session_id,id),
 ADD CHECK((version=1 AND previous_id IS NULL AND session_id=id) OR (version>1 AND previous_id IS NOT NULL));
ALTER TABLE measurement_selection DROP CONSTRAINT measurement_selection_pkey,
 DROP CONSTRAINT measurement_selection_shop_id_selected_id_key,
 DROP CONSTRAINT measurement_selection_shop_id_order_id_piece_id_key;
ALTER TABLE measurement_selection ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0),
 ADD PRIMARY KEY(shop_id,order_id,scope_key,version);
CREATE INDEX measurement_selected_history ON measurement_selection(shop_id,selected_id,order_id);
CREATE OR REPLACE FUNCTION measurement_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.measurement_event;d public.durable_draft;f public.measurement_form_revision;a public.measurement_use_event;p jsonb;x jsonb;field jsonb;r numeric[];step numeric[];num numeric;den numeric;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Measurement history immutable' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='measurement_version' THEN
  SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=NEW.id;
 ELSE SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;p=d.payload;
 IF e.id IS NULL OR e.created_xid<>pg_current_xact_id() THEN RAISE EXCEPTION 'Measurement child provenance denied' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='measurement_version' THEN
  SELECT * INTO f FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND id=NEW.form_id;
  SELECT * INTO a FROM measurement_use_event WHERE shop_id=NEW.shop_id AND id=NEW.approval_id;
  IF e.operation<>'save' OR f.id IS NULL OR a.id IS NULL OR a.form_id<>f.id OR a.payload->>'operation'<>'approve' OR NEW.form_entry_id IS DISTINCT FROM (p#>>'{form,entryId}')::uuid OR NEW.form_id IS DISTINCT FROM (p#>>'{form,revisionId}')::uuid OR NEW.approval_id IS DISTINCT FROM (p->>'approvalId')::uuid
  OR NEW.frozen IS DISTINCT FROM jsonb_build_object('id',f.id,'entryId',f.entry_id,'content',f.content,'authority',f.authority,'contentHash',f.content_hash)
  THEN RAISE EXCEPTION 'Exact form approval required' USING ERRCODE='23514';END IF;
 ELSE
  IF e.operation<>'select' OR (p#>>'{target,orderId}')::uuid IS DISTINCT FROM NEW.order_id OR (p#>>'{target,pieceId}')::uuid IS DISTINCT FROM NEW.piece_id OR (p->>'selectedId')::uuid IS DISTINCT FROM NEW.selected_id OR (p->>'baseVersion')::integer IS DISTINCT FROM NEW.version-1
  OR NOT EXISTS(SELECT 1 FROM measurement_version mv JOIN measurement_private private ON (private.shop_id,private.event_id)=(mv.shop_id,mv.id)
    JOIN order_acceptance_snapshot accepted ON accepted.shop_id=mv.shop_id AND accepted.order_id=NEW.order_id
    JOIN service_template_form binding ON binding.shop_id=accepted.shop_id AND binding.definition_id=accepted.definition_id AND binding.form_entry_id=mv.form_entry_id AND binding.form_revision_id=mv.form_id
    JOIN measurement_form_entry fe ON (fe.shop_id,fe.entry_id)=(mv.shop_id,mv.form_entry_id)
    JOIN measurement_form_availability availability ON (availability.shop_id,availability.id)=(fe.shop_id,fe.current_change_id)
    WHERE mv.shop_id=NEW.shop_id AND mv.id=NEW.selected_id AND private.redacted_at IS NULL
    AND availability.available AND availability.definition_id=mv.form_id
    AND binding.piece_key IS NOT DISTINCT FROM (SELECT source_key FROM order_piece WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND id=NEW.piece_id)
    AND mv.approval_id=(SELECT approval.id FROM measurement_use_event approval WHERE approval.shop_id=mv.shop_id AND approval.form_id=mv.form_id AND NOT EXISTS(SELECT 1 FROM measurement_use_event successor WHERE successor.shop_id=approval.shop_id AND successor.form_id=approval.form_id AND successor.previous_id=approval.id)))
  OR NOT EXISTS(SELECT 1 FROM garment_order o JOIN measurement_event source ON source.shop_id=o.shop_id AND source.id=NEW.selected_id WHERE o.shop_id=NEW.shop_id AND o.id=NEW.order_id AND o.intake_kind='custom' AND o.customer_id=e.customer_id AND o.wearer_id=e.wearer_id AND source.customer_id=e.customer_id AND source.wearer_id=e.wearer_id)
  THEN RAISE EXCEPTION 'Exact first selection required' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_version_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_version FOR EACH ROW EXECUTE FUNCTION measurement_child_guard();
CREATE FUNCTION measurement_history_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE prior public.measurement_version;head public.measurement_version;d public.durable_draft;p jsonb;e public.measurement_event;state integer;
BEGIN
 IF TG_TABLE_NAME='measurement_version' THEN
  SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=NEW.id;
  SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;p=d.payload;
  PERFORM pg_advisory_xact_lock(hashtextextended('measurementSession:'||NEW.shop_id::text||':'||NEW.session_id::text,0));
  IF NEW.previous_id IS NULL THEN
   IF NEW.version<>1 OR NEW.session_id<>NEW.id OR nullif(p->>'correctionId','') IS NOT NULL THEN RAISE EXCEPTION 'New observation lineage denied' USING ERRCODE='23514';END IF;
  ELSE
   SELECT * INTO prior FROM measurement_version WHERE shop_id=NEW.shop_id AND id=NEW.previous_id;
   SELECT * INTO head FROM measurement_version WHERE shop_id=NEW.shop_id AND session_id=NEW.session_id ORDER BY version DESC LIMIT 1;
   IF prior.id IS NULL OR head.id IS DISTINCT FROM prior.id OR NEW.version<>prior.version+1 OR NEW.session_id<>prior.session_id
   OR (p->>'correctionId')::uuid IS DISTINCT FROM prior.id OR NEW.form_id<>prior.form_id
   OR NOT EXISTS(SELECT 1 FROM measurement_event pe JOIN measurement_private pv ON (pv.shop_id,pv.event_id)=(pe.shop_id,pe.id)
     WHERE pe.shop_id=e.shop_id AND pe.id=prior.id AND pe.wearer_id=e.wearer_id AND pe.customer_id=e.customer_id AND pv.redacted_at IS NULL
     AND pv.source->>'date'=p#>>'{source,date}' AND pv.source->>'kind'=p#>>'{source,kind}')
   THEN RAISE EXCEPTION 'Expected correction head and observation required' USING ERRCODE='23514';END IF;
  END IF;
 ELSE
  SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;
  SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;p=d.payload;
  PERFORM pg_advisory_xact_lock(hashtextextended('order:'||NEW.shop_id::text||':'||NEW.order_id::text,0));
  SELECT coalesce(max(version),0) INTO state FROM measurement_selection WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key;
  IF NEW.version<>state+1 THEN RAISE EXCEPTION 'Expected selection head required' USING ERRCODE='23514';END IF;
  IF state>0 OR EXISTS(SELECT 1 FROM measurement_selection WHERE shop_id=NEW.shop_id AND selected_id=NEW.selected_id) THEN
   IF p#>>'{reuseReview,digest}' IS NULL OR p#>>'{reuseReview,digest}' !~ '^[a-f0-9]{64}$'
   OR p#>>'{reuseReview,impact,physical}' IS DISTINCT FROM 'not-started' OR p#>>'{reuseReview,impact,commercial}' IS DISTINCT FROM 'none'
   THEN RAISE EXCEPTION 'Explicit supported reuse review required' USING ERRCODE='23514';END IF;
  END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_lineage BEFORE INSERT ON measurement_version FOR EACH ROW EXECUTE FUNCTION measurement_history_guard();
CREATE TRIGGER measurement_selection_head BEFORE INSERT ON measurement_selection FOR EACH ROW EXECUTE FUNCTION measurement_history_guard();
REVOKE ALL ON FUNCTION measurement_history_guard() FROM PUBLIC;

-- Versioned repeat carries references only, never personal values or approvals.
DO $repeat_adapter$ DECLARE body text;needle text;BEGIN
 body=pg_get_functiondef('service_intake_base(public.durable_draft,text)'::regprocedure);
 needle='d.payload=d.payload-''repeat'';';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Repeat intake adapter changed';END IF;
 EXECUTE replace(body,needle,'d.payload=d.payload-ARRAY[''repeat'',''measurementReuse''];d.schema_version=1;');
 body=pg_get_functiondef('order_repeat_origin_guard()'::regprocedure);
 IF position('d.schema_version<>1' in body)=0 OR position('d.payload IS DISTINCT FROM expected' in body)=0 THEN RAISE EXCEPTION 'Repeat origin predecessor changed';END IF;
 body=replace(body,'d.schema_version<>1','d.schema_version NOT IN (1,2)');
 body=replace(body,'d.payload IS DISTINCT FROM expected','(d.payload-''measurementReuse'') IS DISTINCT FROM expected');
 EXECUTE body;
 body=pg_get_functiondef('order_repeat_commit_guard()'::regprocedure);
 needle='d.payload-''repeat''';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Repeat acceptance predecessor changed';END IF;
 EXECUTE replace(body,needle,'d.payload-ARRAY[''repeat'',''measurementReuse'']');
END $repeat_adapter$;
CREATE FUNCTION measurement_repeat_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE p jsonb;ref jsonb;v public.measurement_version;e public.measurement_event;BEGIN
 IF NEW.workflow<>'order.repeat' THEN RETURN NEW;END IF;
 p=NEW.payload;ref=p->'measurementReuse';
 IF NEW.schema_version=1 THEN
  IF ref IS NOT NULL THEN RAISE EXCEPTION 'Old repeat cannot carry measurements' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 IF NEW.schema_version<>2 OR ref IS NULL OR ref->>'reviewed' IS DISTINCT FROM 'true'
 OR ref-ARRAY['selectedId','sourcePieceId','pieceKey','reviewed']<>'{}'::jsonb
 OR NOT(ref ?& ARRAY['selectedId','sourcePieceId','pieceKey','reviewed'])
 THEN RAISE EXCEPTION 'Versioned measurement repeat review required' USING ERRCODE='23514';END IF;
 SELECT * INTO v FROM measurement_version WHERE shop_id=NEW.shop_id AND id=(ref->>'selectedId')::uuid;
 SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=v.id;
 IF e.id IS NULL OR e.customer_id IS DISTINCT FROM (p->>'customerId')::uuid OR e.wearer_id IS DISTINCT FROM (p->>'wearerId')::uuid
 OR NOT measurement_authority(NEW.shop_id,e.customer_id,e.wearer_id)
 OR EXISTS(SELECT 1 FROM measurement_private WHERE shop_id=NEW.shop_id AND event_id=e.id AND redacted_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Measurement repeat authority unavailable' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM measurement_selection s WHERE s.shop_id=NEW.shop_id AND s.order_id=(p#>>'{repeat,sourceId}')::uuid
 AND s.scope_key=coalesce((ref->>'sourcePieceId')::uuid,s.order_id) AND s.selected_id=v.id
 AND NOT EXISTS(SELECT 1 FROM measurement_selection later WHERE later.shop_id=s.shop_id AND later.order_id=s.order_id AND later.scope_key=s.scope_key AND later.version>s.version))
 OR NOT EXISTS(SELECT 1 FROM service_template_form b WHERE b.shop_id=NEW.shop_id AND b.definition_id=(p#>>'{manifest,definitionId}')::uuid AND b.form_revision_id=v.form_id AND b.form_entry_id=v.form_entry_id AND b.piece_key IS NOT DISTINCT FROM ref->>'pieceKey')
 THEN RAISE EXCEPTION 'Exact reviewed repeat reference unavailable' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND OLD.payload->'measurementReuse' IS DISTINCT FROM ref THEN RAISE EXCEPTION 'Repeat measurement origin immutable' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_repeat BEFORE INSERT OR UPDATE ON durable_draft FOR EACH ROW EXECUTE FUNCTION measurement_repeat_guard();
REVOKE ALL ON FUNCTION measurement_repeat_guard() FROM PUBLIC;

-- A reader treated every saved observation/selection as V1 and made an unordered
-- single-row selection query. Fail closed on that binary after this migration;
-- the marker is transaction-local compatibility, never tenant authorisation.
CREATE FUNCTION measurement_history_reader(s uuid) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RETURN false;END IF;
 IF current_setting('app.measurement_history_reader',true) IS DISTINCT FROM '1.3.2b' THEN
  RAISE EXCEPTION 'Compatible measurement history reader required' USING ERRCODE='42501';
 END IF;RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION measurement_history_reader(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION measurement_history_reader(uuid) TO app_user;
CREATE POLICY measurement_history_reader ON measurement_version AS RESTRICTIVE FOR ALL TO app_user USING(measurement_history_reader(shop_id)) WITH CHECK(measurement_history_reader(shop_id));
CREATE POLICY measurement_history_reader ON measurement_selection AS RESTRICTIVE FOR ALL TO app_user USING(measurement_history_reader(shop_id)) WITH CHECK(measurement_history_reader(shop_id));
