-- #148 / 1.3.1c. Additive private references; no approved policy seeds.
-- Preserve accepted history on compatible writer-disable rollback. Backup first
-- outside disposable development. Retained-byte purge/backup erasure is not here.
CREATE TABLE design_media_subject (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('private','library')),
 actor_id uuid NOT NULL,origin_draft_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE design_media_order_subject (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),subject_id uuid NOT NULL,order_id uuid NOT NULL,piece_id uuid,scope_key uuid NOT NULL,customer_id uuid NOT NULL,wearer_id uuid NOT NULL,
 PRIMARY KEY(shop_id,subject_id),FOREIGN KEY(shop_id,subject_id) REFERENCES design_media_subject(shop_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 CHECK(scope_key=coalesce(piece_id,order_id))
);
CREATE INDEX design_media_order_lookup ON design_media_order_subject(shop_id,order_id,scope_key);
CREATE TABLE design_media_library_subject (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),subject_id uuid NOT NULL,entry_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),previous_id uuid,
 category_entry_id uuid NOT NULL,category_revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,subject_id),UNIQUE(shop_id,entry_id,version),UNIQUE(shop_id,entry_id,subject_id),
 FOREIGN KEY(shop_id,subject_id) REFERENCES design_media_subject(shop_id,id),
 FOREIGN KEY(shop_id,entry_id,previous_id) REFERENCES design_media_library_subject(shop_id,entry_id,subject_id),
 FOREIGN KEY(shop_id,category_entry_id,category_revision_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id),
 CHECK((version=1)=(previous_id IS NULL)),CHECK(version<>1 OR entry_id=subject_id)
);
CREATE TABLE design_media_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),subject_id uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('shop-created','customer-provided','licensed','other')),
 source_text text CHECK(length(source_text)<=2000),source_date date,rights_basis text NOT NULL CHECK(rights_basis IN ('shop-owned','licensed-reuse','private-fulfilment','unknown')),
 rights_evidence text CHECK(length(rights_evidence)<=2000),reason text CHECK(length(reason)<=1000),redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,subject_id),FOREIGN KEY(shop_id,subject_id) REFERENCES design_media_subject(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL AND redaction_audit_id IS NULL AND source_text IS NOT NULL AND rights_evidence IS NOT NULL AND reason IS NOT NULL) OR (redacted_at IS NOT NULL AND redaction_audit_id IS NOT NULL AND source_text IS NULL AND rights_evidence IS NULL AND reason IS NULL AND source_date IS NULL))
);
CREATE TABLE design_media_asset (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),asset_id uuid NOT NULL,subject_id uuid NOT NULL,
 PRIMARY KEY(shop_id,asset_id),FOREIGN KEY(shop_id,asset_id) REFERENCES media_asset(shop_id,id),FOREIGN KEY(shop_id,subject_id) REFERENCES design_media_subject(shop_id,id)
);
CREATE INDEX design_media_asset_subject ON design_media_asset(shop_id,subject_id);
CREATE TABLE design_spec_reference (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,version_id uuid NOT NULL,asset_id uuid NOT NULL,profile_id uuid NOT NULL,question_id uuid,
 position integer NOT NULL CHECK(position>=0 AND position<20),intent text NOT NULL CHECK(intent IN ('inspiration','instruction')),replaces_id uuid,geometry_reviewed boolean NOT NULL,
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),display jsonb,content_type text NOT NULL,purpose text NOT NULL,uploader_id uuid NOT NULL,uploaded_at timestamptz NOT NULL,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,version_id,position),
 FOREIGN KEY(shop_id,version_id,profile_id) REFERENCES design_spec_version(shop_id,id,profile_id),
 FOREIGN KEY(shop_id,profile_id,question_id) REFERENCES design_question(shop_id,definition_id,id),
 FOREIGN KEY(shop_id,asset_id) REFERENCES design_media_asset(shop_id,asset_id),FOREIGN KEY(shop_id,replaces_id) REFERENCES design_spec_reference(shop_id,id),
 FOREIGN KEY(shop_id,uploader_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE INDEX design_reference_asset ON design_spec_reference(shop_id,asset_id,version_id);
CREATE TABLE design_reference_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),reference_id uuid NOT NULL,caption text CHECK(length(caption)<=1000),notes jsonb,redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,reference_id),FOREIGN KEY(shop_id,reference_id) REFERENCES design_spec_reference(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL AND redaction_audit_id IS NULL AND caption IS NOT NULL AND jsonb_typeof(notes)='array' AND jsonb_array_length(notes)<=20) OR (redacted_at IS NOT NULL AND redaction_audit_id IS NOT NULL AND caption IS NULL AND notes IS NULL))
);
CREATE TABLE design_reference_annotation (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),reference_id uuid NOT NULL,position integer NOT NULL CHECK(position>=0 AND position<20),anchor jsonb NOT NULL,
 PRIMARY KEY(shop_id,reference_id,position),FOREIGN KEY(shop_id,reference_id) REFERENCES design_spec_reference(shop_id,id),
 CHECK(anchor->>'kind' IN ('note','point','rectangle'))
);
CREATE TABLE design_reference_draft_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),draft_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),payload jsonb NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,draft_id,version),FOREIGN KEY(shop_id,draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL)=(redaction_audit_id IS NULL))
);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['design_media_subject','design_media_order_subject','design_media_library_subject','design_media_value','design_media_asset','design_spec_reference','design_reference_value','design_reference_annotation','design_reference_draft_value'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
  EXECUTE format('CREATE POLICY design_privacy ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 END LOOP;
END $policies$;
CREATE FUNCTION design_media_subject_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;a public.audit_event;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Retain design media provenance' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO a FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id;
 IF d.id IS NULL OR d.workflow<>'design.reference' OR d.lifecycle<>'active' OR d.payload->>'kind' IS DISTINCT FROM NEW.kind OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR a.id IS NULL OR a.action<>'design.reference.subject' OR a.entity_id<>NEW.id OR a.actor_id<>NEW.actor_id OR a.idempotency_key<>NEW.command_key OR (a.xmin::text)::xid8<>pg_current_xact_id()
 THEN RAISE EXCEPTION 'Design media source provenance denied' USING ERRCODE='23514';END IF;
 NEW.created_xid=pg_current_xact_id();NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());RETURN NEW;
END $fn$;
CREATE TRIGGER design_media_subject_write BEFORE INSERT OR UPDATE OR DELETE ON design_media_subject FOR EACH ROW EXECUTE FUNCTION design_media_subject_guard();
CREATE FUNCTION design_media_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.design_media_subject;d public.durable_draft;o public.garment_order;p public.design_media_library_subject;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Retain design media children' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM design_media_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=s.shop_id AND id=s.origin_draft_id;
 IF s.id IS NULL OR s.created_xid<>pg_current_xact_id() OR s.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Sealed design media subject' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='design_media_order_subject' THEN
  SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
  IF s.kind<>'private' OR o.id IS NULL OR o.intake_kind<>'custom' OR o.customer_id IS DISTINCT FROM NEW.customer_id OR o.wearer_id IS DISTINCT FROM NEW.wearer_id OR d.payload->>'orderId' IS DISTINCT FROM NEW.order_id::text OR NULLIF(d.payload->>'pieceId','')::uuid IS DISTINCT FROM NEW.piece_id THEN RAISE EXCEPTION 'Exact design media wearer/scope required' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO p FROM design_media_library_subject WHERE shop_id=NEW.shop_id AND subject_id=NEW.previous_id;
  IF s.kind<>'library' OR NULLIF(d.payload->>'previousId','')::uuid IS DISTINCT FROM NEW.previous_id OR (d.payload->'category'->>'entryId')::uuid IS DISTINCT FROM NEW.category_entry_id OR (d.payload->'category'->>'revisionId')::uuid IS DISTINCT FROM NEW.category_revision_id OR (NEW.previous_id IS NOT NULL AND (p.subject_id IS NULL OR p.entry_id<>NEW.entry_id OR p.version+1<>NEW.version)) THEN RAISE EXCEPTION 'Exact library revision required' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_media_order_write BEFORE INSERT OR UPDATE OR DELETE ON design_media_order_subject FOR EACH ROW EXECUTE FUNCTION design_media_child_guard();
CREATE TRIGGER design_media_library_write BEFORE INSERT OR UPDATE OR DELETE ON design_media_library_subject FOR EACH ROW EXECUTE FUNCTION design_media_child_guard();
CREATE FUNCTION design_media_asset_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE a public.media_asset;s public.design_media_subject;BEGIN
 IF TG_TABLE_NAME='media_asset' THEN
  IF EXISTS(SELECT 1 FROM design_media_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id) THEN
   INSERT INTO design_media_asset(shop_id,asset_id,subject_id) VALUES(NEW.shop_id,NEW.id,NEW.subject_id);
  END IF;RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Retain design asset ownership' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.asset_id;
 SELECT * INTO s FROM design_media_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
 IF a.id IS NULL OR s.id IS NULL OR a.subject_id<>s.id OR (a.xmin::text)::xid8<>pg_current_xact_id() OR a.status<>'pending_upload' OR a.creator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR (s.kind='library' AND a.purpose NOT IN ('manual-pattern','order-document','voice-note')) OR EXISTS(SELECT 1 FROM design_media_value v WHERE v.shop_id=s.shop_id AND v.subject_id=s.id AND v.redacted_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Exact private design asset ownership required' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_asset_ownership AFTER INSERT ON media_asset FOR EACH ROW EXECUTE FUNCTION design_media_asset_guard();
CREATE TRIGGER design_media_asset_write BEFORE INSERT OR UPDATE OR DELETE ON design_media_asset FOR EACH ROW EXECUTE FUNCTION design_media_asset_guard();
CREATE FUNCTION design_reference_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE v public.design_spec_version;e public.design_spec_event;d public.durable_draft;r public.design_spec_reference;a public.media_asset;sv public.design_media_value;s public.design_media_subject;x jsonb;pos integer;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Retain sealed design references' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='design_spec_reference' THEN
  SELECT * INTO v FROM design_spec_version WHERE shop_id=NEW.shop_id AND id=NEW.version_id;pos=NEW.position;
 ELSE
  SELECT * INTO r FROM design_spec_reference WHERE shop_id=NEW.shop_id AND id=NEW.reference_id;
  SELECT * INTO v FROM design_spec_version WHERE shop_id=r.shop_id AND id=r.version_id;pos=r.position;
 END IF;
 SELECT * INTO e FROM design_spec_event WHERE shop_id=v.shop_id AND id=v.event_id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;
 x=d.payload->'referenceItems'->pos;
 IF v.id IS NULL OR v.created_xid<>pg_current_xact_id() OR d.schema_version<>2 OR x IS NULL OR e.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Sealed exact reference set required' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='design_spec_reference' THEN
  NEW.profile_id=v.profile_id;
  SELECT * INTO a FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.asset_id;
  SELECT ms.* INTO s FROM design_media_subject ms JOIN design_media_asset ma ON (ma.shop_id,ma.subject_id)=(ms.shop_id,ms.id) WHERE ma.shop_id=NEW.shop_id AND ma.asset_id=NEW.asset_id;
  SELECT * INTO sv FROM design_media_value WHERE shop_id=s.shop_id AND subject_id=s.id;
  IF (x->>'id')::uuid IS DISTINCT FROM NEW.id OR (x->>'assetId')::uuid IS DISTINCT FROM NEW.asset_id OR (x->>'questionId')::uuid IS DISTINCT FROM NEW.question_id OR x->>'intent' IS DISTINCT FROM NEW.intent OR (x->>'replacesId')::uuid IS DISTINCT FROM NEW.replaces_id OR (x->>'geometryReviewed')::boolean IS DISTINCT FROM NEW.geometry_reviewed
  OR a.id IS NULL OR a.status<>'ready' OR s.id IS NULL OR sv.redacted_at IS NOT NULL OR NEW.sha256 IS DISTINCT FROM a.sha256 OR NEW.content_type IS DISTINCT FROM a.content_type OR NEW.purpose IS DISTINCT FROM a.purpose OR NEW.uploader_id IS DISTINCT FROM a.creator_id OR NEW.uploaded_at IS DISTINCT FROM a.created_at
  OR NEW.display IS DISTINCT FROM (SELECT jsonb_build_object('sha256',m.sha256,'width',m.width,'height',m.height) FROM media_derivative m WHERE m.shop_id=a.shop_id AND m.asset_id=a.id AND m.variant='display')
  OR (s.kind='private' AND NOT EXISTS(SELECT 1 FROM design_media_order_subject origin JOIN design_spec_scope target ON target.shop_id=origin.shop_id AND target.wearer_id=origin.wearer_id WHERE origin.shop_id=s.shop_id AND origin.subject_id=s.id AND target.order_id=v.order_id AND target.scope_key=v.scope_key))
  OR (s.kind='library' AND (sv.source_kind NOT IN ('shop-created','licensed') OR sv.rights_basis NOT IN ('shop-owned','licensed-reuse') OR length(trim(sv.rights_evidence))=0))
  OR (sv.rights_basis='unknown' AND NEW.intent<>'inspiration')
  OR (s.kind='library' AND NOT EXISTS(SELECT 1 FROM design_media_library_subject ls WHERE ls.shop_id=s.shop_id AND ls.subject_id=s.id AND ls.category_entry_id=(v.frozen#>>'{profile,content,category,entryId}')::uuid AND ls.category_revision_id=(v.frozen#>>'{profile,content,category,revisionId}')::uuid))
  OR (NEW.replaces_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM design_spec_reference prior_ref WHERE prior_ref.shop_id=NEW.shop_id AND prior_ref.id=NEW.replaces_id AND prior_ref.version_id=v.previous_id))
  THEN RAISE EXCEPTION 'Exact ready reference provenance required' USING ERRCODE='23514';END IF;
 ELSE
  IF NEW.anchor IS DISTINCT FROM x->'annotations'->NEW.position->'anchor' THEN RAISE EXCEPTION 'Exact annotation anchor required' USING ERRCODE='23514';END IF;
  IF NEW.anchor->>'kind'<>'note' AND NOT r.geometry_reviewed AND EXISTS(SELECT 1 FROM design_spec_reference prior_ref WHERE prior_ref.shop_id=r.shop_id AND prior_ref.id=r.replaces_id AND prior_ref.asset_id<>r.asset_id) THEN RAISE EXCEPTION 'Review geometry against the new bytes' USING ERRCODE='23514';END IF;
  IF NEW.anchor->>'kind'<>'note' AND (jsonb_typeof(NEW.anchor->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(NEW.anchor->'y') IS DISTINCT FROM 'number' OR r.display IS NULL OR r.content_type NOT LIKE 'image/%' OR (NEW.anchor->>'x')::integer NOT BETWEEN 0 AND 10000 OR (NEW.anchor->>'y')::integer NOT BETWEEN 0 AND 10000) THEN RAISE EXCEPTION 'Trusted image anchor required' USING ERRCODE='23514';END IF;
  IF NEW.anchor->>'kind'='rectangle' AND (jsonb_typeof(NEW.anchor->'width') IS DISTINCT FROM 'number' OR jsonb_typeof(NEW.anchor->'height') IS DISTINCT FROM 'number' OR (NEW.anchor->>'width')::integer<=0 OR (NEW.anchor->>'height')::integer<=0 OR (NEW.anchor->>'x')::integer+(NEW.anchor->>'width')::integer>10000 OR (NEW.anchor->>'y')::integer+(NEW.anchor->>'height')::integer>10000) THEN RAISE EXCEPTION 'Image rectangle outside display' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_spec_reference_write BEFORE INSERT OR UPDATE OR DELETE ON design_spec_reference FOR EACH ROW EXECUTE FUNCTION design_reference_child_guard();
CREATE TRIGGER design_reference_annotation_write BEFORE INSERT OR UPDATE OR DELETE ON design_reference_annotation FOR EACH ROW EXECUTE FUNCTION design_reference_child_guard();
CREATE FUNCTION design_media_reference_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM design_media_asset m WHERE m.shop_id=NEW.shop_id AND m.asset_id=NEW.asset_id)
 AND NOT EXISTS(SELECT 1 FROM design_spec_reference r JOIN design_spec_version v ON (v.shop_id,v.id)=(r.shop_id,r.version_id) WHERE r.shop_id=NEW.shop_id AND r.asset_id=NEW.asset_id AND r.id=NEW.reference_id AND v.created_xid=pg_current_xact_id())
 THEN RAISE EXCEPTION 'Design assets require a sealed exact design association' USING ERRCODE='42501';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_media_reference_write BEFORE INSERT ON media_reference FOR EACH ROW EXECUTE FUNCTION design_media_reference_guard();
REVOKE ALL ON FUNCTION design_media_reference_guard() FROM PUBLIC;
CREATE FUNCTION design_reference_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;n integer;BEGIN
 IF TG_TABLE_NAME='design_media_subject' THEN
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
  IF d.lifecycle<>'promoted' OR d.result_type IS DISTINCT FROM 'design.media-subject' OR d.result_id IS DISTINCT FROM NEW.id
  OR NOT EXISTS(SELECT 1 FROM design_media_value x WHERE x.shop_id=NEW.shop_id AND x.subject_id=NEW.id)
  OR (NEW.kind='private' AND NOT EXISTS(SELECT 1 FROM design_media_order_subject x WHERE x.shop_id=NEW.shop_id AND x.subject_id=NEW.id))
  OR (NEW.kind='library' AND NOT EXISTS(SELECT 1 FROM design_media_library_subject x WHERE x.shop_id=NEW.shop_id AND x.subject_id=NEW.id))
  OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.action='draft.promote' AND k.actor_id=NEW.actor_id AND k.response#>>'{draft,result,type}'='design.media-subject' AND (k.response#>>'{draft,result,id}')::uuid=NEW.id)
  OR NOT EXISTS(SELECT 1 FROM design_reference_draft_value x WHERE x.shop_id=NEW.shop_id AND x.draft_id=d.id AND x.version=d.version)
  THEN RAISE EXCEPTION 'Atomic design media subject commit required' USING ERRCODE='23514';END IF;
 ELSE
  SELECT dr.* INTO d FROM design_spec_event e JOIN durable_draft dr ON (dr.shop_id,dr.id)=(e.shop_id,e.origin_draft_id) WHERE e.shop_id=NEW.shop_id AND e.id=NEW.event_id;
  n=coalesce(jsonb_array_length(d.payload->'referenceItems'),0);
  IF (SELECT count(*) FROM design_spec_reference r WHERE r.shop_id=NEW.shop_id AND r.version_id=NEW.id)<>n
  OR (d.schema_version=1 AND EXISTS(SELECT 1 FROM design_spec_reference r WHERE r.shop_id=NEW.shop_id AND r.version_id=NEW.previous_id))
  OR EXISTS(SELECT 1 FROM design_spec_reference r WHERE r.shop_id=NEW.shop_id AND r.version_id=NEW.id AND (NOT EXISTS(SELECT 1 FROM design_reference_value x WHERE x.shop_id=r.shop_id AND x.reference_id=r.id) OR NOT EXISTS(SELECT 1 FROM media_reference m WHERE m.shop_id=r.shop_id AND m.asset_id=r.asset_id AND m.reference_id=r.id) OR (SELECT count(*) FROM design_reference_annotation a WHERE a.shop_id=r.shop_id AND a.reference_id=r.id)<>jsonb_array_length(d.payload->'referenceItems'->r.position->'annotations')))
  THEN RAISE EXCEPTION 'Atomic exact reference child set required' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER design_media_subject_commit AFTER INSERT ON design_media_subject DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION design_reference_commit_guard();
CREATE CONSTRAINT TRIGGER design_reference_commit AFTER INSERT ON design_spec_version DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION design_reference_commit_guard();

CREATE FUNCTION design_redacted_spec_payload(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$
 SELECT p||jsonb_build_object('answers','[]'::jsonb,'reason','','reuse',null,'profile',null,'selectedId',null,'operation','save','use',false)||CASE WHEN p?'referenceItems' THEN '{"referenceItems":[]}'::jsonb ELSE '{}'::jsonb END
$fn$;
CREATE FUNCTION design_redacted_source_payload(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$
 SELECT p||jsonb_build_object('sourceText','','sourceDate',null,'rightsEvidence','','rightsBasis','unknown','reason','')
$fn$;
CREATE FUNCTION design_reference_private_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.design_media_subject;r public.design_spec_reference;v public.design_spec_version;e public.design_spec_event;d public.durable_draft;a public.audit_event;x jsonb;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain design reference provenance' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  SELECT * INTO a FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.redaction_audit_id;
  IF current_user<>'app_owner' OR OLD.redacted_at IS NOT NULL OR NEW.redacted_at IS NULL OR a.id IS NULL OR a.occurred_at<>transaction_timestamp() OR a.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Audited reference erasure required' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='design_media_value' THEN
   IF a.action<>'privacy.design-reference' OR a.entity_id<>OLD.subject_id OR (to_jsonb(NEW)-ARRAY['source_text','source_date','rights_evidence','reason','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['source_text','source_date','rights_evidence','reason','redacted_at','redaction_audit_id']) OR NEW.source_text IS NOT NULL OR NEW.source_date IS NOT NULL OR NEW.rights_evidence IS NOT NULL OR NEW.reason IS NOT NULL THEN RAISE EXCEPTION 'Scoped source erasure required' USING ERRCODE='42501';END IF;
  ELSIF TG_TABLE_NAME='design_reference_value' THEN
   IF (to_jsonb(NEW)-ARRAY['caption','notes','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['caption','notes','redacted_at','redaction_audit_id']) OR NEW.caption IS NOT NULL OR NEW.notes IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM design_spec_reference rr JOIN design_spec_version vv ON (vv.shop_id,vv.id)=(rr.shop_id,rr.version_id) WHERE rr.shop_id=OLD.shop_id AND rr.id=OLD.reference_id AND a.action='privacy.design-specification' AND a.entity_id=vv.event_id)
   THEN RAISE EXCEPTION 'Scoped caption erasure required' USING ERRCODE='42501';END IF;
  ELSE
   IF a.action<>'privacy.design-reference-draft' OR a.entity_id<>OLD.draft_id OR (to_jsonb(NEW)-ARRAY['payload','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload','redacted_at','redaction_audit_id']) OR NEW.payload IS DISTINCT FROM design_redacted_source_payload(OLD.payload) THEN RAISE EXCEPTION 'Scoped draft erasure required' USING ERRCODE='42501';END IF;
  END IF;RETURN NEW;
 END IF;
 IF NEW.redacted_at IS NOT NULL OR NEW.redaction_audit_id IS NOT NULL THEN RAISE EXCEPTION 'No forged privacy facts' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='design_media_value' THEN
  SELECT * INTO s FROM design_media_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
  SELECT * INTO d FROM durable_draft WHERE shop_id=s.shop_id AND id=s.origin_draft_id;
  IF s.id IS NULL OR s.created_xid<>pg_current_xact_id() OR NEW.source_kind IS DISTINCT FROM d.payload->>'sourceKind' OR NEW.source_text IS DISTINCT FROM d.payload->>'sourceText' OR NEW.source_date IS DISTINCT FROM NULLIF(d.payload->>'sourceDate','')::date OR NEW.rights_basis IS DISTINCT FROM d.payload->>'rightsBasis' OR NEW.rights_evidence IS DISTINCT FROM d.payload->>'rightsEvidence' OR NEW.reason IS DISTINCT FROM d.payload->>'reason'
  OR (s.kind='library' AND (NEW.source_kind NOT IN ('shop-created','licensed') OR NEW.rights_basis NOT IN ('shop-owned','licensed-reuse') OR length(trim(NEW.rights_evidence))=0)) THEN RAISE EXCEPTION 'Exact source evidence required' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='design_reference_value' THEN
  SELECT * INTO r FROM design_spec_reference WHERE shop_id=NEW.shop_id AND id=NEW.reference_id;
  SELECT * INTO v FROM design_spec_version WHERE shop_id=r.shop_id AND id=r.version_id;
  SELECT * INTO e FROM design_spec_event WHERE shop_id=v.shop_id AND id=v.event_id;
  SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;
  x=d.payload->'referenceItems'->r.position;
  IF v.id IS NULL OR v.created_xid<>pg_current_xact_id() OR NEW.caption IS DISTINCT FROM x->>'caption' OR NEW.notes IS DISTINCT FROM coalesce((SELECT jsonb_agg(n->'note' ORDER BY ord) FROM jsonb_array_elements(x->'annotations') WITH ORDINALITY t(n,ord)),'[]'::jsonb)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.notes) n WHERE length(trim(n))=0 OR length(n)>2000)
  THEN RAISE EXCEPTION 'Exact caption/notes required' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;
  SELECT * INTO a FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id;
  IF d.id IS NULL OR d.workflow<>'design.reference' OR d.version<>NEW.version OR d.payload<>NEW.payload OR a.entity_type<>'durable_draft' OR a.entity_id<>d.id OR a.idempotency_key<>NEW.command_key OR a.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR (a.xmin::text)::xid8<>pg_current_xact_id() THEN RAISE EXCEPTION 'Exact private source response required' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_media_value_write BEFORE INSERT OR UPDATE OR DELETE ON design_media_value FOR EACH ROW EXECUTE FUNCTION design_reference_private_guard();
CREATE TRIGGER design_reference_value_write BEFORE INSERT OR UPDATE OR DELETE ON design_reference_value FOR EACH ROW EXECUTE FUNCTION design_reference_private_guard();
CREATE TRIGGER design_reference_draft_value_write BEFORE INSERT OR UPDATE OR DELETE ON design_reference_draft_value FOR EACH ROW EXECUTE FUNCTION design_reference_private_guard();
CREATE POLICY design_reference_privacy_audit ON audit_event FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id) AND action IN ('privacy.design-reference','privacy.design-reference-draft'));
CREATE POLICY design_reference_draft_privacy ON durable_draft FOR ALL TO app_owner USING(shop_context_allows(shop_id) AND workflow='design.reference') WITH CHECK(shop_context_allows(shop_id) AND workflow='design.reference');
CREATE POLICY design_reference_version_privacy ON design_spec_version FOR SELECT TO app_owner USING(shop_context_allows(shop_id));

CREATE FUNCTION redact_design_reference_draft(s uuid,d uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7();target public.durable_draft;BEGIN
 IF NOT COALESCE(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||d::text,0));
 SELECT * INTO target FROM durable_draft WHERE shop_id=s AND id=d AND workflow='design.reference';
 IF target.id IS NULL THEN RAISE EXCEPTION 'Private source draft unavailable' USING ERRCODE='P0002';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('designMedia:'||s::text,0));
 IF target.payload->>'orderId' IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('order:'||s::text||':'||(target.payload->>'orderId'),0));END IF;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.design-reference-draft','design-reference-draft',d,request,request,'{"redacted":true}');
 UPDATE durable_draft SET version=version+1,updated_at=greatest(updated_at,clock_timestamp()),payload=design_redacted_source_payload(payload) WHERE shop_id=s AND id=d;
 UPDATE design_reference_draft_value SET payload=design_redacted_source_payload(payload),redaction_audit_id=a,redacted_at=transaction_timestamp() WHERE shop_id=s AND draft_id=d AND redacted_at IS NULL;
END $fn$;
REVOKE ALL ON FUNCTION redact_design_reference_draft(uuid,uuid,uuid) FROM PUBLIC,app_user;GRANT EXECUTE ON FUNCTION redact_design_reference_draft(uuid,uuid,uuid) TO app_privacy;

CREATE FUNCTION redact_design_reference_subject(s uuid,subject uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7();d uuid;o uuid;e uuid;known_drafts uuid[]='{}'::uuid[];BEGIN
 IF NOT COALESCE(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM design_media_subject WHERE shop_id=s AND id=subject) THEN RAISE EXCEPTION 'Design source unavailable' USING ERRCODE='P0002';END IF;
 -- Acquire all draft locks, then the shared design-media barrier, then the
 -- discovered order class. New associations re-read after that same barrier.
 FOR d IN SELECT dr.id FROM durable_draft dr WHERE dr.shop_id=s AND dr.workflow IN ('design.reference','design.specification') ORDER BY dr.id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||d::text,0));
  known_drafts=array_append(known_drafts,d);
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('designMedia:'||s::text,0));
 IF EXISTS(SELECT 1 FROM durable_draft dr WHERE dr.shop_id=s AND dr.workflow IN ('design.reference','design.specification') AND NOT(dr.id=ANY(known_drafts))) THEN RAISE EXCEPTION 'Retry erasure after concurrent draft creation' USING ERRCODE='40001';END IF;
 FOR o IN SELECT DISTINCT order_id FROM (
  SELECT order_id FROM design_media_order_subject WHERE shop_id=s AND subject_id=subject
  UNION ALL SELECT v.order_id FROM design_spec_version v JOIN design_spec_reference r ON (r.shop_id,r.version_id)=(v.shop_id,v.id) JOIN design_media_asset m ON (m.shop_id,m.asset_id)=(r.shop_id,r.asset_id) WHERE m.shop_id=s AND m.subject_id=subject
  UNION ALL SELECT (dr.payload->>'orderId')::uuid FROM durable_draft dr WHERE dr.shop_id=s AND dr.workflow='design.specification' AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(dr.payload->'referenceItems','[]'::jsonb)) r JOIN design_media_asset m ON m.shop_id=s AND m.asset_id=(r->>'assetId')::uuid WHERE m.subject_id=subject)
 ) affected WHERE order_id IS NOT NULL ORDER BY order_id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('order:'||s::text||':'||o::text,0));
 END LOOP;
 PERFORM 1 FROM design_media_value WHERE shop_id=s AND subject_id=subject AND redacted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Design source unavailable' USING ERRCODE='P0002';END IF;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.design-reference','design-media-subject',subject,request,request,'{"redacted":true}');
 FOR e IN SELECT DISTINCT v.event_id FROM design_spec_version v JOIN design_spec_reference r ON (r.shop_id,r.version_id)=(v.shop_id,v.id) JOIN design_media_asset m ON (m.shop_id,m.asset_id)=(r.shop_id,r.asset_id) JOIN design_spec_value x ON (x.shop_id,x.event_id)=(v.shop_id,v.event_id) WHERE m.shop_id=s AND m.subject_id=subject AND x.redacted_at IS NULL ORDER BY v.event_id LOOP
  PERFORM redact_design_specification(s,e,request);
 END LOOP;
 -- Unpublished candidates have no saved event. Scrub their complete scope as
 -- well, through the audited existing draft redaction boundary.
 FOR d IN SELECT dr.id FROM durable_draft dr WHERE dr.shop_id=s AND dr.workflow='design.specification' AND EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(dr.payload->'referenceItems','[]'::jsonb)) r JOIN design_media_asset m ON m.shop_id=s AND m.asset_id=(r->>'assetId')::uuid WHERE m.subject_id=subject) ORDER BY dr.id LOOP
  PERFORM redact_design_specification_draft(s,d,request);
 END LOOP;
 FOR d IN SELECT dr.id FROM durable_draft dr WHERE dr.shop_id=s AND dr.workflow='design.reference' AND (dr.id IN(SELECT origin_draft_id FROM design_media_subject WHERE shop_id=s AND id=subject) OR dr.payload->>'previousId'=subject::text) ORDER BY dr.id LOOP
  PERFORM redact_design_reference_draft(s,d,request);
 END LOOP;
 UPDATE design_media_value SET source_text=NULL,source_date=NULL,rights_evidence=NULL,reason=NULL,redacted_at=transaction_timestamp(),redaction_audit_id=a WHERE shop_id=s AND subject_id=subject;
END $fn$;
REVOKE ALL ON FUNCTION redact_design_reference_subject(uuid,uuid,uuid) FROM PUBLIC,app_user;GRANT EXECUTE ON FUNCTION redact_design_reference_subject(uuid,uuid,uuid) TO app_privacy;
REVOKE ALL ON FUNCTION design_media_subject_guard(),design_media_child_guard(),design_media_asset_guard(),design_reference_child_guard(),design_reference_commit_guard(),design_reference_private_guard() FROM PUBLIC;

-- Version-two privacy compatibility: keep v1 payload shapes and provenance.
CREATE OR REPLACE FUNCTION design_spec_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;c public.design_spec_scope;p jsonb;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Design events immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO c FROM design_spec_scope WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key;
 p=d.payload;
 IF d.id IS NULL OR d.workflow<>'design.specification' OR d.schema_version NOT IN (1,2) OR d.lifecycle<>'active'
 OR (d.schema_version=1 AND p?'referenceItems') OR (d.schema_version=2 AND jsonb_typeof(p->'referenceItems') IS DISTINCT FROM 'array')
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR (p->>'orderId')::uuid IS DISTINCT FROM NEW.order_id OR coalesce((p->>'pieceId')::uuid,NEW.order_id) IS DISTINCT FROM NEW.scope_key
 OR NEW.operation IS DISTINCT FROM p->>'operation' OR NEW.scope_version<>coalesce(c.version,0)+1
 OR (p->>'baseVersion')::integer IS DISTINCT FROM coalesce(c.version,0) OR (p->>'baseSavedId')::uuid IS DISTINCT FROM c.latest_saved_id
 OR NEW.previous_saved_id IS DISTINCT FROM c.latest_saved_id OR NEW.previous_current_id IS DISTINCT FROM c.current_id
 OR (NEW.operation='select' AND (NEW.saved_id IS DISTINCT FROM c.latest_saved_id OR NEW.current_id IS DISTINCT FROM (p->>'selectedId')::uuid))
 OR (NEW.operation='save' AND (NEW.current_id IS DISTINCT FROM CASE WHEN (p->>'use')::boolean THEN NEW.saved_id ELSE c.current_id END))
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.action='design.specification.'||NEW.operation AND a.entity_type='garment_order' AND a.entity_id=NEW.order_id AND a.idempotency_key=NEW.command_key)
 THEN RAISE EXCEPTION 'Design event provenance denied' USING ERRCODE='23514';END IF;
 NEW.created_xid=pg_current_xact_id();NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());RETURN NEW;
END $fn$;
CREATE OR REPLACE FUNCTION design_spec_draft_value_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.redacted_at IS NOT NULL OR NEW.redaction_audit_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM durable_draft d JOIN audit_event a ON a.shop_id=d.shop_id AND a.id=NEW.audit_id WHERE d.shop_id=NEW.shop_id AND d.id=NEW.draft_id AND d.workflow='design.specification' AND d.version=NEW.version AND d.payload=NEW.payload AND (d.payload->>'orderId')::uuid=NEW.order_id AND (d.payload->>'pieceId')::uuid IS NOT DISTINCT FROM NEW.piece_id AND a.entity_id=d.id AND a.entity_type='durable_draft' AND a.idempotency_key=NEW.command_key AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Private draft response provenance denied' USING ERRCODE='23514';END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF current_user<>'app_owner' OR (to_jsonb(NEW)-ARRAY['payload','redaction_audit_id','redacted_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload','redaction_audit_id','redacted_at']) OR OLD.redacted_at IS NOT NULL OR NEW.redacted_at IS NULL
  OR NEW.payload IS DISTINCT FROM design_redacted_spec_payload(OLD.payload)
  OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.redaction_audit_id AND a.occurred_at=transaction_timestamp() AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND ((a.action='privacy.design-draft' AND a.entity_type='design-draft' AND a.entity_id=NEW.draft_id) OR (a.action='privacy.design-specification' AND EXISTS(SELECT 1 FROM design_spec_event e WHERE e.shop_id=a.shop_id AND e.id=a.entity_id AND e.order_id=NEW.order_id AND e.scope_key=NEW.scope_key)))) THEN RAISE EXCEPTION 'Audited private draft redaction required' USING ERRCODE='42501';END IF;
 ELSE RAISE EXCEPTION 'Retain private draft response provenance' USING ERRCODE='42501';END IF;RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION durable_draft_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND current_user='app_owner' AND OLD.workflow='design.reference'
 AND (to_jsonb(NEW)-ARRAY['payload','version','updated_at'])=(to_jsonb(OLD)-ARRAY['payload','version','updated_at']) AND NEW.version=OLD.version+1 AND NEW.updated_at>=OLD.updated_at
 AND NEW.payload=design_redacted_source_payload(OLD.payload)
 AND EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=OLD.shop_id AND a.action='privacy.design-reference-draft' AND a.entity_type='design-reference-draft' AND a.entity_id=OLD.id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.occurred_at=transaction_timestamp()) THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND current_user='app_owner' AND OLD.workflow='design.specification'
 AND (to_jsonb(NEW)-ARRAY['payload','version','updated_at'])=(to_jsonb(OLD)-ARRAY['payload','version','updated_at']) AND NEW.version=OLD.version+1 AND NEW.updated_at>=OLD.updated_at
 AND NEW.payload=design_redacted_spec_payload(OLD.payload)
 AND EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=OLD.shop_id AND a.occurred_at=transaction_timestamp() AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND ((a.action='privacy.design-draft' AND a.entity_type='design-draft' AND a.entity_id=OLD.id) OR (a.action='privacy.design-specification' AND EXISTS(SELECT 1 FROM design_spec_event e WHERE e.shop_id=a.shop_id AND e.id=a.entity_id AND e.order_id=(OLD.payload->>'orderId')::uuid AND e.scope_key=coalesce((OLD.payload->>'pieceId')::uuid,(OLD.payload->>'orderId')::uuid))))) THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.creator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
   OR NEW.lifecycle<>'active' OR NEW.version<>1 THEN
   RAISE EXCEPTION 'Draft provenance denied' USING ERRCODE='42501'; END IF;
  NEW.created_at=date_trunc('milliseconds',clock_timestamp()); NEW.updated_at=NEW.created_at;
 ELSE
  IF OLD.lifecycle<>'active' OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.id IS DISTINCT FROM OLD.id
   OR NEW.creator_id IS DISTINCT FROM OLD.creator_id OR NEW.workflow IS DISTINCT FROM OLD.workflow
   OR NEW.schema_version IS DISTINCT FROM OLD.schema_version OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.version<>OLD.version+1 THEN
   RAISE EXCEPTION 'Draft history protected' USING ERRCODE='42501'; END IF;
  NEW.updated_at=GREATEST(OLD.updated_at,date_trunc('milliseconds',clock_timestamp()));
 END IF;
 RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION redact_design_specification(s uuid,e uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7();target public.design_spec_event;draft_id uuid;BEGIN
 IF NOT COALESCE(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 SELECT * INTO target FROM design_spec_event WHERE shop_id=s AND id=e;
 IF target.id IS NULL THEN RAISE EXCEPTION 'Design values unavailable' USING ERRCODE='P0002';END IF;
 FOR draft_id IN SELECT id FROM durable_draft WHERE shop_id=s AND workflow='design.specification' AND (payload->>'orderId')::uuid=target.order_id AND coalesce((payload->>'pieceId')::uuid,(payload->>'orderId')::uuid)=target.scope_key ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||draft_id::text,0));
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('designMedia:'||s::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('order:'||s::text||':'||target.order_id::text,0));
 PERFORM 1 FROM design_spec_value WHERE shop_id=s AND event_id=e AND redacted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Design values unavailable' USING ERRCODE='P0002';END IF;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.design-specification','design-specification',e,request,request,'{"redacted":true}');
 UPDATE durable_draft d SET version=d.version+1,updated_at=greatest(d.updated_at,clock_timestamp()),payload=design_redacted_spec_payload(d.payload)
 FROM design_spec_event ev WHERE ev.shop_id=s AND ev.id=e AND d.shop_id=s AND d.workflow='design.specification'
 AND (d.payload->>'orderId')::uuid=ev.order_id AND coalesce((d.payload->>'pieceId')::uuid,(d.payload->>'orderId')::uuid)=ev.scope_key;
 UPDATE design_spec_draft_value x SET payload=design_redacted_spec_payload(x.payload),redaction_audit_id=a,redacted_at=transaction_timestamp()
 FROM design_spec_event ev WHERE ev.shop_id=s AND ev.id=e AND x.shop_id=s AND x.order_id=ev.order_id AND x.scope_key=ev.scope_key AND x.redacted_at IS NULL;
 UPDATE design_spec_value SET answers=NULL,reason=NULL,redaction_audit_id=a,redacted_at=transaction_timestamp() WHERE shop_id=s AND event_id=e;
 UPDATE design_reference_value rv SET caption=NULL,notes=NULL,redaction_audit_id=a,redacted_at=transaction_timestamp()
 FROM design_spec_reference r JOIN design_spec_version v ON (v.shop_id,v.id)=(r.shop_id,r.version_id)
 WHERE r.shop_id=s AND v.event_id=e AND (rv.shop_id,rv.reference_id)=(r.shop_id,r.id) AND rv.redacted_at IS NULL;
END $fn$;

CREATE OR REPLACE FUNCTION redact_design_specification_draft(s uuid,d uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7();target public.durable_draft;BEGIN
 IF NOT COALESCE(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||d::text,0));
 SELECT * INTO target FROM durable_draft WHERE shop_id=s AND id=d AND workflow='design.specification';
 IF target.id IS NULL THEN RAISE EXCEPTION 'Design draft unavailable' USING ERRCODE='P0002';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('designMedia:'||s::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('order:'||s::text||':'||(target.payload->>'orderId'),0));
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.design-draft','design-draft',d,request,request,'{"redacted":true}');
 UPDATE durable_draft SET version=version+1,updated_at=greatest(updated_at,clock_timestamp()),payload=design_redacted_spec_payload(payload) WHERE shop_id=s AND id=d;
 UPDATE design_spec_draft_value SET payload=design_redacted_spec_payload(payload),redaction_audit_id=a,redacted_at=transaction_timestamp() WHERE shop_id=s AND draft_id=d AND redacted_at IS NULL;
END $fn$;
