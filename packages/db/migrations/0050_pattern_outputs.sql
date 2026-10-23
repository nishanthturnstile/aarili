-- #165 / 1.3.3b. Expand only. Keep B-aware readers/privacy/worker on rollback.
-- No production consent, retention period, automated drafting or cutting release.
CREATE TABLE pattern_media_subject (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,order_id uuid NOT NULL,scope_key uuid NOT NULL,piece_id uuid,
 customer_id uuid NOT NULL,wearer_id uuid NOT NULL,actor_id uuid NOT NULL,origin_draft_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,order_id,scope_key),UNIQUE(shop_id,origin_draft_id),
 CHECK(scope_key=coalesce(piece_id,order_id)),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE INDEX pattern_media_wearer ON pattern_media_subject(shop_id,wearer_id,customer_id,id);
CREATE TABLE pattern_media_asset (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),asset_id uuid NOT NULL,subject_id uuid NOT NULL,
 PRIMARY KEY(shop_id,asset_id),UNIQUE(shop_id,subject_id,asset_id),
 FOREIGN KEY(shop_id,asset_id) REFERENCES media_asset(shop_id,id),FOREIGN KEY(shop_id,subject_id) REFERENCES pattern_media_subject(shop_id,id)
);
CREATE INDEX pattern_media_candidates ON pattern_media_asset(shop_id,subject_id,asset_id DESC);
CREATE TABLE pattern_output (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),version_id uuid NOT NULL,subject_id uuid NOT NULL,asset_id uuid NOT NULL,evidence jsonb NOT NULL,
 PRIMARY KEY(shop_id,version_id),FOREIGN KEY(shop_id,version_id) REFERENCES pattern_version(shop_id,id),
 FOREIGN KEY(shop_id,subject_id,asset_id) REFERENCES pattern_media_asset(shop_id,subject_id,asset_id),CHECK(octet_length(evidence::text)<=2048)
);
CREATE INDEX pattern_output_assets ON pattern_output(shop_id,asset_id,version_id);
CREATE TABLE pattern_reuse (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),version_id uuid NOT NULL,source_id uuid NOT NULL,source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(shop_id,version_id),FOREIGN KEY(shop_id,version_id) REFERENCES pattern_version(shop_id,id),FOREIGN KEY(shop_id,source_id) REFERENCES pattern_version(shop_id,id),CHECK(version_id<>source_id)
);
CREATE INDEX pattern_reuse_sources ON pattern_reuse(shop_id,source_id,version_id);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['pattern_media_subject','pattern_media_asset','pattern_output','pattern_reuse'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY pattern_output_privacy ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 END LOOP;
END $policies$;

CREATE FUNCTION pattern_reference_depends_on_wearer(s uuid,ref uuid,w uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $fn$
 WITH RECURSIVE sources(id) AS (
 SELECT coalesce((SELECT reference_id FROM pattern_event WHERE shop_id=s AND id=ref),ref)
 UNION SELECT r.source_id FROM pattern_reuse r JOIN sources src ON src.id=r.version_id WHERE r.shop_id=s
 ) SELECT EXISTS(SELECT 1 FROM sources src JOIN pattern_version v ON v.shop_id=s AND v.id=src.id JOIN pattern_scope scope ON(scope.shop_id,scope.order_id,scope.scope_key)=(v.shop_id,v.order_id,v.scope_key) WHERE scope.wearer_id=w)
$fn$;
CREATE FUNCTION pattern_payload_depends_on_wearer(s uuid,p jsonb,w uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $fn$
 SELECT (p->>'wearerId')::uuid=w OR pattern_reference_depends_on_wearer(s,coalesce((p#>>'{reuse,referenceId}')::uuid,(p->>'referenceId')::uuid),w)
$fn$;
-- Private access is current, transitive and scoped; no user text is duplicated in history.
CREATE FUNCTION pattern_reference_access(s uuid,ref uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $fn$
 WITH RECURSIVE sources(id) AS (SELECT ref UNION SELECT r.source_id FROM pattern_reuse r JOIN sources src ON src.id=r.version_id WHERE r.shop_id=s)
 SELECT EXISTS(SELECT 1 FROM pattern_version WHERE shop_id=s AND id=ref) AND NOT EXISTS(
 SELECT 1 FROM sources src JOIN pattern_version v ON v.shop_id=s AND v.id=src.id JOIN pattern_scope scope ON(scope.shop_id,scope.order_id,scope.scope_key)=(v.shop_id,v.order_id,v.scope_key)
 JOIN pattern_value x ON(x.shop_id,x.event_id)=(v.shop_id,v.id)
 WHERE x.redacted_at IS NOT NULL OR NOT measurement_authority(s,scope.customer_id,scope.wearer_id)
 OR (EXISTS(SELECT 1 FROM pattern_output o WHERE o.shop_id=s AND o.version_id=v.id) AND NOT measurement_photo_authority(s,scope.customer_id,scope.wearer_id))
 OR (v.design_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM design_spec_value d WHERE d.shop_id=s AND d.event_id=v.design_id AND d.redacted_at IS NULL))
 OR (v.measurement_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM measurement_private m WHERE m.shop_id=s AND m.event_id=v.measurement_id AND m.redacted_at IS NULL))
 )
$fn$;
REVOKE ALL ON FUNCTION pattern_reference_depends_on_wearer(uuid,uuid,uuid),pattern_payload_depends_on_wearer(uuid,jsonb,uuid),pattern_reference_access(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pattern_reference_depends_on_wearer(uuid,uuid,uuid),pattern_payload_depends_on_wearer(uuid,jsonb,uuid),pattern_reference_access(uuid,uuid) TO app_user;

CREATE FUNCTION pattern_subject_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;o public.garment_order;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pattern subjects immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 IF d.workflow IS DISTINCT FROM 'pattern.subject' OR d.schema_version<>1 OR d.lifecycle<>'active' OR d.payload->>'erased' IS DISTINCT FROM 'false'
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR o.intake_kind IS DISTINCT FROM 'custom'
 OR NEW.order_id IS DISTINCT FROM (d.payload->>'orderId')::uuid OR NEW.piece_id IS DISTINCT FROM (d.payload->>'pieceId')::uuid
 OR NEW.customer_id IS DISTINCT FROM (d.payload->>'customerId')::uuid OR NEW.wearer_id IS DISTINCT FROM (d.payload->>'wearerId')::uuid
 OR o.customer_id IS DISTINCT FROM NEW.customer_id OR o.wearer_id IS DISTINCT FROM NEW.wearer_id OR NOT measurement_photo_authority(NEW.shop_id,NEW.customer_id,NEW.wearer_id)
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.action='pattern.subject' AND a.actor_id=NEW.actor_id AND a.entity_id=NEW.id AND a.idempotency_key=NEW.command_key AND (a.xmin::text)::xid8=pg_current_xact_id())
 THEN RAISE EXCEPTION 'Exact private pattern subject required' USING ERRCODE='23514';END IF;
 NEW.created_xid=pg_current_xact_id();RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_subject_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_media_subject FOR EACH ROW EXECUTE FUNCTION pattern_subject_guard();
CREATE FUNCTION pattern_media_asset_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE a public.media_asset;s public.pattern_media_subject;BEGIN
 IF TG_TABLE_NAME='media_asset' THEN
  SELECT * INTO s FROM pattern_media_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
  IF s.id IS NULL THEN RETURN NEW;END IF;
  IF TG_OP='INSERT' THEN INSERT INTO pattern_media_asset(shop_id,asset_id,subject_id) VALUES(NEW.shop_id,NEW.id,s.id);
  ELSIF NOT measurement_photo_authority(s.shop_id,s.customer_id,s.wearer_id) THEN RAISE EXCEPTION 'Current pattern media authority required' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pattern media ownership immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.asset_id;
 SELECT * INTO s FROM pattern_media_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
 IF a.id IS NULL OR s.id IS NULL OR a.subject_id<>s.id OR (a.xmin::text)::xid8<>pg_current_xact_id() OR a.status<>'pending_upload' OR a.purpose<>'manual-pattern' OR a.content_type NOT IN('image/jpeg','image/png','image/webp','application/pdf') OR a.visibility<>'private'
 OR a.creator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NOT measurement_photo_authority(s.shop_id,s.customer_id,s.wearer_id)
 OR a.minor IS DISTINCT FROM (SELECT age='minor' FROM wearer WHERE shop_id=s.shop_id AND id=s.wearer_id)
 THEN RAISE EXCEPTION 'Private pattern asset ownership denied' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_media_ownership AFTER INSERT OR UPDATE ON media_asset FOR EACH ROW EXECUTE FUNCTION pattern_media_asset_guard();
CREATE TRIGGER pattern_media_asset_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_media_asset FOR EACH ROW EXECUTE FUNCTION pattern_media_asset_guard();
CREATE FUNCTION pattern_output_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.pattern_event;d public.durable_draft;target public.pattern_scope;s public.pattern_media_subject;a public.media_asset;source public.pattern_version;p jsonb;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pattern output and lineage immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM pattern_event WHERE shop_id=NEW.shop_id AND id=NEW.version_id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;p=d.payload;
 SELECT * INTO target FROM pattern_scope WHERE shop_id=e.shop_id AND order_id=e.order_id AND scope_key=e.scope_key;
 IF e.created_xid IS DISTINCT FROM pg_current_xact_id() OR e.operation<>'save' OR d.schema_version<>2 OR p->>'erased' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Exact output command required' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='pattern_reuse' THEN
  SELECT * INTO source FROM pattern_version WHERE shop_id=NEW.shop_id AND id=NEW.source_id;
  IF source.id IS NULL OR NEW.source_id IS DISTINCT FROM (p#>>'{reuse,referenceId}')::uuid OR NEW.source_digest IS DISTINCT FROM p#>>'{reuse,digest}'
  OR NOT pattern_reference_access(NEW.shop_id,NEW.source_id)
  OR EXISTS(WITH RECURSIVE sources(id,depth) AS (SELECT NEW.source_id,1 UNION ALL SELECT r.source_id,src.depth+1 FROM sources src JOIN pattern_reuse r ON r.shop_id=NEW.shop_id AND r.version_id=src.id WHERE src.depth<17)
   SELECT 1 FROM sources src JOIN pattern_version v ON v.shop_id=NEW.shop_id AND v.id=src.id JOIN pattern_scope sc ON(sc.shop_id,sc.order_id,sc.scope_key)=(v.shop_id,v.order_id,v.scope_key) JOIN pattern_value x ON(x.shop_id,x.event_id)=(v.shop_id,v.id)
   WHERE src.id=NEW.version_id OR src.depth>=16 OR x.payload#>>'{content,rights}' NOT IN('private-fulfilment','shop-owned','licensed-reuse')
   OR (sc.wearer_id<>(p->>'wearerId')::uuid AND (x.payload#>>'{content,rights}' NOT IN('shop-owned','licensed-reuse') OR nullif(btrim(x.payload#>>'{content,rightsEvidence}'),'') IS NULL))
   OR (SELECT review_state FROM pattern_event WHERE shop_id=NEW.shop_id AND reference_id=src.id AND operation='review' ORDER BY version DESC LIMIT 1) IN('changes-required','withdrawn'))
  OR p->>'acknowledged' IS DISTINCT FROM 'true' OR nullif(btrim(p->>'evidence'),'') IS NULL OR p->>'assetId' IS NOT NULL
  THEN RAISE EXCEPTION 'Current exact source and distinct reuse rights required' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO a FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.asset_id;
  SELECT * INTO s FROM pattern_media_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
  IF a.id IS NULL OR s.id IS NULL OR a.status<>'ready' OR a.purpose<>'manual-pattern' OR a.content_type NOT IN('image/jpeg','image/png','image/webp','application/pdf') OR a.subject_id<>s.id
  OR NOT measurement_photo_authority(s.shop_id,s.customer_id,s.wearer_id)
  OR NOT measurement_photo_authority(NEW.shop_id,(p->>'customerId')::uuid,(p->>'wearerId')::uuid)
  OR (p->>'assetId' IS NOT NULL AND (NEW.asset_id IS DISTINCT FROM (p->>'assetId')::uuid OR s.order_id<>e.order_id OR s.scope_key<>e.scope_key OR s.wearer_id<>(p->>'wearerId')::uuid OR s.customer_id<>(p->>'customerId')::uuid))
  OR (p->>'assetId' IS NULL AND NOT EXISTS(SELECT 1 FROM pattern_reuse r JOIN pattern_output prior_output ON(prior_output.shop_id,prior_output.version_id)=(r.shop_id,r.source_id) WHERE r.shop_id=NEW.shop_id AND r.version_id=NEW.version_id AND prior_output.asset_id=NEW.asset_id AND prior_output.subject_id=NEW.subject_id AND prior_output.evidence=NEW.evidence))
  OR NEW.evidence IS DISTINCT FROM jsonb_build_object('assetId',a.id,'subjectId',s.id,'contentType',a.content_type,'originalSha256',a.sha256,'display',(SELECT jsonb_build_object('sha256',md.sha256,'width',md.width,'height',md.height) FROM media_derivative md WHERE md.shop_id=a.shop_id AND md.asset_id=a.id AND md.variant='display'),'thumbnailSha256',(SELECT sha256 FROM media_derivative md WHERE md.shop_id=a.shop_id AND md.asset_id=a.id AND md.variant='thumbnail'))
  OR (a.content_type<>'application/pdf' AND (NEW.evidence->'display'='null'::jsonb OR NEW.evidence->'thumbnailSha256'='null'::jsonb))
  THEN RAISE EXCEPTION 'Accepted owned output evidence required' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_output_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_output FOR EACH ROW EXECUTE FUNCTION pattern_output_guard();
CREATE TRIGGER pattern_reuse_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_reuse FOR EACH ROW EXECUTE FUNCTION pattern_output_guard();

CREATE FUNCTION pattern_output_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;BEGIN
 IF TG_TABLE_NAME='media_reference' THEN
  IF EXISTS(SELECT 1 FROM pattern_media_asset WHERE shop_id=NEW.shop_id AND asset_id=NEW.asset_id)
  AND NOT EXISTS(SELECT 1 FROM pattern_output o JOIN pattern_event e ON(e.shop_id,e.id)=(o.shop_id,o.version_id) WHERE o.shop_id=NEW.shop_id AND o.version_id=NEW.reference_id AND o.asset_id=NEW.asset_id AND e.created_xid=pg_current_xact_id()) THEN RAISE EXCEPTION 'Pattern assets require exact references' USING ERRCODE='23514';END IF;RETURN NEW;
 END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF TG_TABLE_NAME='pattern_media_subject' THEN
  IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM 'pattern.subject' OR d.result_id IS DISTINCT FROM NEW.id
  OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_id=NEW.actor_id AND k.action='draft.promote' AND k.status=200 AND k.response#>>'{draft,result,type}'='pattern.subject' AND (k.response#>>'{draft,result,id}')::uuid=NEW.id)
  OR NOT EXISTS(SELECT 1 FROM pattern_draft_value WHERE shop_id=NEW.shop_id AND draft_id=d.id AND version=d.version) THEN RAISE EXCEPTION 'Atomic pattern subject required' USING ERRCODE='23514';END IF;
 ELSIF d.schema_version=2 AND NEW.operation='save' THEN
  IF ((d.payload->>'assetId' IS NOT NULL OR EXISTS(SELECT 1 FROM pattern_output WHERE shop_id=NEW.shop_id AND version_id=(d.payload#>>'{reuse,referenceId}')::uuid)) IS DISTINCT FROM EXISTS(SELECT 1 FROM pattern_output WHERE shop_id=NEW.shop_id AND version_id=NEW.id))
  OR ((d.payload#>>'{reuse,referenceId}' IS NOT NULL) IS DISTINCT FROM EXISTS(SELECT 1 FROM pattern_reuse WHERE shop_id=NEW.shop_id AND version_id=NEW.id))
  OR EXISTS(SELECT 1 FROM pattern_output o WHERE o.shop_id=NEW.shop_id AND o.version_id=NEW.id AND NOT EXISTS(SELECT 1 FROM media_reference r WHERE r.shop_id=o.shop_id AND r.asset_id=o.asset_id AND r.reference_id=o.version_id))
  THEN RAISE EXCEPTION 'Atomic output and lineage evidence required' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $fn$;
CREATE TRIGGER pattern_exact_media_reference BEFORE INSERT ON media_reference FOR EACH ROW EXECUTE FUNCTION pattern_output_commit_guard();
CREATE CONSTRAINT TRIGGER pattern_subject_commit AFTER INSERT ON pattern_media_subject DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pattern_output_commit_guard();
CREATE CONSTRAINT TRIGGER pattern_output_commit AFTER INSERT ON pattern_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pattern_output_commit_guard();

-- Preserve A's strict schema and historical rows. Only schema 2 admits outputs.
DO $extend$ DECLARE body text;BEGIN
 body=pg_get_functiondef('pattern_event_guard()'::regprocedure);
 IF position('d.schema_version<>1' IN body)=0 THEN RAISE EXCEPTION 'Pattern event predecessor changed';END IF;
 EXECUTE replace(body,'d.schema_version<>1','d.schema_version NOT IN(1,2)');
 body=pg_get_functiondef('pattern_version_guard()'::regprocedure);
 IF position('OR nullif(btrim(d.payload#>>''{content,locator}''),'''') IS NULL' IN body)=0 THEN RAISE EXCEPTION 'Pattern version predecessor changed';END IF;
 EXECUTE replace(body,'OR nullif(btrim(d.payload#>>''{content,locator}''),'''') IS NULL','OR (nullif(btrim(d.payload#>>''{content,locator}''),'''') IS NULL AND NOT(d.schema_version=2 AND (d.payload->>''assetId'' IS NOT NULL OR d.payload#>>''{reuse,referenceId}'' IS NOT NULL)))');
 body=pg_get_functiondef('pattern_private_guard()'::regprocedure);
 body=replace(body,'d.workflow IS DISTINCT FROM ''pattern.reference''','d.workflow NOT IN(''pattern.reference'',''pattern.subject'')');
 body=replace(body,'er.wearer_id=w','(er.wearer_id=w OR (TG_TABLE_NAME=''pattern_value'' AND pattern_reference_depends_on_wearer(NEW.shop_id,(to_jsonb(OLD)->>''event_id'')::uuid,er.wearer_id)) OR (TG_TABLE_NAME=''pattern_draft_value'' AND pattern_payload_depends_on_wearer(NEW.shop_id,OLD.payload,er.wearer_id)))');
 EXECUTE body;
END $extend$;
CREATE OR REPLACE FUNCTION pattern_redacted_payload(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$
 SELECT p||jsonb_build_object('erased',true)||CASE WHEN p ? 'content' THEN jsonb_build_object('content',jsonb_build_object('locator','','sourceKind','unknown','source','','sourceDate',null,'sourceVersion','','notes','','rights','unknown','rightsEvidence','','design',jsonb_build_object('state','unknown','reason',''),'measurement',jsonb_build_object('state','unknown','reason',''),'declaredUnits','unknown','declaredScale','','assumptions','','checks',''),'reason','','evidence','','digest',null,'acknowledged',false) ELSE '{}'::jsonb END||CASE WHEN p ? 'assetId' THEN '{"assetId":null,"reuse":null}'::jsonb ELSE '{}'::jsonb END
$fn$;
CREATE POLICY pattern_subject_durable_privacy ON durable_draft FOR ALL TO app_owner USING(shop_context_allows(shop_id) AND workflow='pattern.subject') WITH CHECK(shop_context_allows(shop_id) AND workflow='pattern.subject');
DO $draft$ DECLARE body text;BEGIN
 body=pg_get_functiondef('durable_draft_guard()'::regprocedure);
 body=replace(body,'OLD.workflow=''pattern.reference''','OLD.workflow IN(''pattern.reference'',''pattern.subject'')');
 body=replace(body,'e.wearer_id=(OLD.payload->>''wearerId'')::uuid AND a.action=''privacy.measurements''','pattern_payload_depends_on_wearer(OLD.shop_id,OLD.payload,e.wearer_id) AND a.action=''privacy.measurements''');
 EXECUTE body;
END $draft$;
CREATE OR REPLACE FUNCTION pattern_draft_authority_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.workflow IN('pattern.reference','pattern.subject') AND NOT(current_user='app_owner' AND NEW.payload->>'erased'='true') THEN
  IF NEW.payload->>'erased' IS DISTINCT FROM 'false' OR NOT measurement_authority(NEW.shop_id,(NEW.payload->>'customerId')::uuid,(NEW.payload->>'wearerId')::uuid)
  OR (NEW.workflow='pattern.subject' AND NOT measurement_photo_authority(NEW.shop_id,(NEW.payload->>'customerId')::uuid,(NEW.payload->>'wearerId')::uuid))
  OR (NEW.payload#>>'{reuse,referenceId}' IS NOT NULL AND NOT pattern_reference_access(NEW.shop_id,(NEW.payload#>>'{reuse,referenceId}')::uuid))
  OR ((NEW.payload->>'assetId' IS NOT NULL OR EXISTS(SELECT 1 FROM pattern_output po WHERE po.shop_id=NEW.shop_id AND po.version_id=coalesce((NEW.payload#>>'{reuse,referenceId}')::uuid,(NEW.payload->>'referenceId')::uuid))) AND NOT measurement_photo_authority(NEW.shop_id,(NEW.payload->>'customerId')::uuid,(NEW.payload->>'wearerId')::uuid))
  THEN RAISE EXCEPTION 'Current pattern source authority required' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE OR REPLACE FUNCTION pattern_merge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM pattern_scope WHERE shop_id=NEW.shop_id AND customer_id IN(NEW.source_id,NEW.survivor_id)) OR EXISTS(SELECT 1 FROM pattern_draft_value WHERE shop_id=NEW.shop_id AND customer_id IN(NEW.source_id,NEW.survivor_id)) OR EXISTS(SELECT 1 FROM pattern_media_subject WHERE shop_id=NEW.shop_id AND customer_id IN(NEW.source_id,NEW.survivor_id)) THEN RAISE EXCEPTION 'Pattern associations require reviewed wearer relink' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION pattern_subject_guard(),pattern_media_asset_guard(),pattern_output_guard(),pattern_output_commit_guard() FROM PUBLIC;

CREATE TABLE pattern_output_purge (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,asset_id uuid NOT NULL,wearer_id uuid NOT NULL,
 audit_id uuid NOT NULL,request_id uuid NOT NULL,initiator_id uuid NOT NULL,restore_epoch uuid NOT NULL,
 phase text NOT NULL CHECK(phase IN ('retained','staging')),
 manifest jsonb NOT NULL,not_before timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,asset_id,restore_epoch,phase),
 FOREIGN KEY(shop_id,asset_id) REFERENCES pattern_media_asset(shop_id,asset_id),
 FOREIGN KEY(shop_id,wearer_id) REFERENCES measurement_erasure(shop_id,wearer_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),FOREIGN KEY(shop_id,initiator_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE pattern_output_purge_receipt (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),purge_id uuid NOT NULL,object_key text NOT NULL,audit_id uuid NOT NULL,
 removed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,purge_id,object_key),FOREIGN KEY(shop_id,purge_id) REFERENCES pattern_output_purge(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);

DO $purge_policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['pattern_output_purge','pattern_output_purge_receipt'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY pattern_output_privacy ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 END LOOP;
END $purge_policies$;
REVOKE INSERT ON pattern_output_purge FROM app_user;
CREATE POLICY pattern_output_privacy_media ON media_asset FOR SELECT TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM pattern_media_asset f WHERE f.shop_id=media_asset.shop_id AND f.asset_id=media_asset.id));
CREATE POLICY pattern_output_privacy_derivative ON media_derivative FOR SELECT TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM pattern_media_asset f WHERE f.shop_id=media_derivative.shop_id AND f.asset_id=media_derivative.asset_id));
CREATE POLICY pattern_output_privacy_attempt ON media_attempt FOR SELECT TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM pattern_media_asset f WHERE f.shop_id=media_attempt.shop_id AND f.asset_id=media_attempt.asset_id));
ALTER FUNCTION redact_measurements(uuid,uuid,uuid) RENAME TO redact_measurements_before_pattern_outputs;
REVOKE ALL ON FUNCTION redact_measurements_before_pattern_outputs(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_measurements(s uuid,w uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid;d uuid;known_drafts uuid[]='{}'::uuid[];session uuid;asset public.media_asset;intent uuid;epoch uuid;actor uuid;not_before timestamptz;manifest jsonb;phase text;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 FOR d IN SELECT id FROM durable_draft WHERE shop_id=s AND workflow IN ('pattern.subject','pattern.reference') AND pattern_payload_depends_on_wearer(s,payload,w) ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||d::text,0));known_drafts=array_append(known_drafts,d);
 END LOOP;
 PERFORM redact_measurements_before_pattern_outputs(s,w,request);
 IF EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=s AND workflow IN ('pattern.subject','pattern.reference') AND pattern_payload_depends_on_wearer(s,payload,w) AND NOT(id=ANY(known_drafts))) THEN RAISE EXCEPTION 'Retry fitting privacy discovery' USING ERRCODE='40001';END IF;
 SELECT audit_id INTO a FROM measurement_erasure WHERE shop_id=s AND wearer_id=w;
 actor=NULLIF(current_setting('app.actor_id',true),'')::uuid;
 IF a IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Measurement erasure provenance missing' USING ERRCODE='42501';END IF;
 UPDATE durable_draft SET payload=pattern_redacted_payload(payload),version=version+1,updated_at=greatest(updated_at,clock_timestamp()) WHERE shop_id=s AND workflow IN ('pattern.subject','pattern.reference') AND pattern_payload_depends_on_wearer(s,payload,w) AND payload->>'erased'='false';
 UPDATE pattern_draft_value SET payload=pattern_redacted_payload(payload),redacted_at=transaction_timestamp(),redaction_audit_id=a WHERE shop_id=s AND pattern_payload_depends_on_wearer(s,payload,w) AND redacted_at IS NULL;
 UPDATE pattern_value x SET payload=NULL,redacted_at=transaction_timestamp(),redaction_audit_id=a FROM pattern_event e WHERE e.shop_id=s AND (x.shop_id,x.event_id)=(e.shop_id,e.id) AND x.redacted_at IS NULL AND pattern_reference_depends_on_wearer(s,coalesce(e.reference_id,e.id),w);
 PERFORM pg_advisory_xact_lock_shared(120036);
 SELECT restore_epoch INTO epoch FROM system_state WHERE singleton;
 FOR asset IN SELECT m.* FROM media_asset m JOIN pattern_media_asset f ON (f.shop_id,f.asset_id)=(m.shop_id,m.id) JOIN pattern_media_subject subject ON (subject.shop_id,subject.id)=(f.shop_id,f.subject_id) WHERE subject.shop_id=s AND subject.wearer_id=w ORDER BY m.id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:media:'||s::text||':'||asset.id::text,0));
  SELECT m.* INTO asset FROM media_asset m WHERE m.shop_id=s AND m.id=asset.id;
  -- Accepted writes hold the same wearer barrier through storage I/O. Once
  -- erasure holds it, no old claimant can create another retained output.
  -- Signed PUTs target staging only; stage deletion waits their existing expiry.
  FOREACH phase IN ARRAY ARRAY['retained','staging'] LOOP
   not_before=CASE WHEN phase='staging' THEN greatest(clock_timestamp(),asset.staging_expires_at) ELSE clock_timestamp() END;
   IF phase='retained' THEN
    SELECT jsonb_build_object('keys',(SELECT coalesce(jsonb_agg(key ORDER BY key),'[]'::jsonb) FROM (SELECT asset.accepted_key AS key WHERE asset.accepted_key IS NOT NULL UNION SELECT object_key FROM media_derivative WHERE shop_id=s AND asset_id=asset.id) keys),
     'prefixes',(SELECT coalesce(jsonb_agg('shops/'||s::text||'/private/'||asset.id::text||'/'||id::text ORDER BY id),'[]'::jsonb) FROM audit_event WHERE shop_id=s AND entity_id=asset.id AND entity_type='media_asset' AND action='media.claim')) INTO manifest;
   ELSE manifest=jsonb_build_object('keys',jsonb_build_array(asset.staging_key),'prefixes','[]'::jsonb);END IF;
   intent=uuidv7();
   INSERT INTO pattern_output_purge(shop_id,id,asset_id,wearer_id,audit_id,request_id,initiator_id,restore_epoch,phase,manifest,not_before) VALUES(s,intent,asset.id,w,a,request,actor,epoch,phase,manifest,not_before) ON CONFLICT DO NOTHING;
   IF FOUND THEN
    INSERT INTO pgboss.job(id,name,data,start_after,retry_limit,retry_delay,retry_backoff) SELECT intent,'media.process',jsonb_build_object('kind','pattern-output-purge','shopId',s,'purgeId',intent,'initiatorId',actor,'epoch',epoch),not_before,retry_limit,retry_delay,retry_backoff FROM pgboss.queue WHERE name='media.process';
    IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed media queue missing';END IF;
   END IF;
  END LOOP;
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION redact_measurements(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_measurements(uuid,uuid,uuid) TO app_privacy;
CREATE FUNCTION pattern_output_purge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE p public.pattern_output_purge;control public.system_state;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pattern output purge provenance immutable' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='pattern_output_purge' THEN
  IF current_user<>'app_owner' OR NOT EXISTS(SELECT 1 FROM measurement_erasure e JOIN audit_event a ON (a.shop_id,a.id)=(e.shop_id,e.audit_id) JOIN pattern_media_subject s ON s.shop_id=e.shop_id AND s.wearer_id=e.wearer_id JOIN pattern_media_asset f ON (f.shop_id,f.subject_id)=(s.shop_id,s.id) WHERE e.shop_id=NEW.shop_id AND e.wearer_id=NEW.wearer_id AND e.audit_id=NEW.audit_id AND f.asset_id=NEW.asset_id AND a.action='privacy.measurements') THEN RAISE EXCEPTION 'Audited pattern output purge intent required' USING ERRCODE='42501';END IF;
 ELSE
  SELECT * INTO p FROM pattern_output_purge WHERE shop_id=NEW.shop_id AND id=NEW.purge_id;
  PERFORM pg_advisory_xact_lock_shared(120036);SELECT * INTO control FROM system_state WHERE singleton;
  IF p.id IS NULL OR NOT control.side_effects_enabled OR control.restore_epoch<>p.restore_epoch OR clock_timestamp()<p.not_before
  OR NOT EXISTS(SELECT 1 FROM measurement_erasure WHERE shop_id=p.shop_id AND wearer_id=p.wearer_id AND audit_id=p.audit_id)
  OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.action='pattern.output-purge' AND a.entity_id=p.id AND a.actor_id=p.initiator_id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id())
  OR NOT (p.manifest->'keys' ? NEW.object_key OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.manifest->'prefixes') prefix WHERE NEW.object_key ~ ('^'||prefix||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
  THEN RAISE EXCEPTION 'Current pattern output purge receipt denied' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_output_purge_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_output_purge FOR EACH ROW EXECUTE FUNCTION pattern_output_purge_guard();
CREATE TRIGGER pattern_output_purge_receipt_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_output_purge_receipt FOR EACH ROW EXECUTE FUNCTION pattern_output_purge_guard();
REVOKE ALL ON FUNCTION pattern_output_purge_guard() FROM PUBLIC;
