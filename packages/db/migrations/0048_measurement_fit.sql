-- #155 / 1.3.2c. Synthetic-only private fitting references. Retain on rollback.
-- Deploy compatible web/worker readers together. No public sharing or retention
-- schedule is activated. Purge uses the existing media queue and an explicit,
-- separately composed erasure-storage capability; backups/processors stay gated.
CREATE TABLE measurement_fit_subject (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,session_id uuid NOT NULL,
 customer_id uuid NOT NULL,wearer_id uuid NOT NULL,anchor_version_id uuid NOT NULL,
 origin_draft_id uuid NOT NULL,actor_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,session_id),UNIQUE(shop_id,id,session_id),UNIQUE(shop_id,origin_draft_id),CHECK(id=session_id),
 FOREIGN KEY(shop_id,session_id,anchor_version_id) REFERENCES measurement_version(shop_id,session_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE INDEX measurement_fit_wearer ON measurement_fit_subject(shop_id,wearer_id,customer_id,id);
CREATE TABLE measurement_fit_asset (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),asset_id uuid NOT NULL,subject_id uuid NOT NULL,
 PRIMARY KEY(shop_id,asset_id),UNIQUE(shop_id,subject_id,asset_id),
 FOREIGN KEY(shop_id,asset_id) REFERENCES media_asset(shop_id,id),FOREIGN KEY(shop_id,subject_id) REFERENCES measurement_fit_subject(shop_id,id)
);
CREATE INDEX measurement_fit_assets ON measurement_fit_asset(shop_id,subject_id,asset_id DESC);
CREATE TABLE measurement_fit_reference (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,measurement_version_id uuid NOT NULL,session_id uuid NOT NULL,
 subject_id uuid NOT NULL,asset_id uuid NOT NULL,root_id uuid NOT NULL,previous_id uuid,version integer NOT NULL CHECK(version>0),
 actor_id uuid NOT NULL,origin_draft_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 original_sha256 text NOT NULL CHECK(original_sha256 ~ '^[a-f0-9]{64}$'),display jsonb NOT NULL,
 thumbnail_sha256 text NOT NULL CHECK(thumbnail_sha256 ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,origin_draft_id),UNIQUE(shop_id,measurement_version_id,id),
 UNIQUE(shop_id,root_id,id),UNIQUE(shop_id,root_id,version),UNIQUE(shop_id,previous_id),
 FOREIGN KEY(shop_id,session_id,measurement_version_id) REFERENCES measurement_version(shop_id,session_id,id),
 FOREIGN KEY(shop_id,subject_id,session_id) REFERENCES measurement_fit_subject(shop_id,id,session_id),
 FOREIGN KEY(shop_id,subject_id,asset_id) REFERENCES measurement_fit_asset(shop_id,subject_id,asset_id),
 FOREIGN KEY(shop_id,root_id) REFERENCES measurement_fit_reference(shop_id,id),
 FOREIGN KEY(shop_id,root_id,previous_id) REFERENCES measurement_fit_reference(shop_id,root_id,id),
 FOREIGN KEY(shop_id,measurement_version_id,previous_id) REFERENCES measurement_fit_reference(shop_id,measurement_version_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((previous_id IS NULL AND version=1 AND root_id=id) OR (previous_id IS NOT NULL AND version>1))
);
CREATE INDEX measurement_fit_history ON measurement_fit_reference(shop_id,measurement_version_id,id DESC);
CREATE TABLE measurement_fit_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),reference_id uuid NOT NULL,caption text,reason text,redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,reference_id),FOREIGN KEY(shop_id,reference_id) REFERENCES measurement_fit_reference(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL AND redaction_audit_id IS NULL AND caption IS NOT NULL AND reason IS NOT NULL) OR (redacted_at IS NOT NULL AND redaction_audit_id IS NOT NULL AND caption IS NULL AND reason IS NULL))
);
CREATE TABLE measurement_fit_draft_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),draft_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),customer_id uuid NOT NULL,wearer_id uuid NOT NULL,
 payload jsonb NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,draft_id,version),FOREIGN KEY(shop_id,draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL)=(redaction_audit_id IS NULL))
);
CREATE INDEX measurement_fit_draft_wearer ON measurement_fit_draft_value(shop_id,wearer_id,draft_id);
CREATE TABLE measurement_fit_purge (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,asset_id uuid NOT NULL,wearer_id uuid NOT NULL,
 audit_id uuid NOT NULL,request_id uuid NOT NULL,initiator_id uuid NOT NULL,restore_epoch uuid NOT NULL,
 phase text NOT NULL CHECK(phase IN ('retained','staging')),
 manifest jsonb NOT NULL,not_before timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,asset_id,restore_epoch,phase),
 FOREIGN KEY(shop_id,asset_id) REFERENCES measurement_fit_asset(shop_id,asset_id),
 FOREIGN KEY(shop_id,wearer_id) REFERENCES measurement_erasure(shop_id,wearer_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),FOREIGN KEY(shop_id,initiator_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE measurement_fit_purge_receipt (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),purge_id uuid NOT NULL,object_key text NOT NULL,audit_id uuid NOT NULL,
 removed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,purge_id,object_key),FOREIGN KEY(shop_id,purge_id) REFERENCES measurement_fit_purge(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['measurement_fit_subject','measurement_fit_asset','measurement_fit_reference','measurement_fit_value','measurement_fit_draft_value','measurement_fit_purge','measurement_fit_purge_receipt'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY measurement_fit_privacy ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 END LOOP;
END $policies$;
REVOKE INSERT ON measurement_fit_purge FROM app_user;
CREATE FUNCTION measurement_photo_authority(s uuid,c uuid,w uuid) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE person public.wearer;p public.wearer_purpose_event;a public.guardian_authority;v public.guardian_verification_event;g public.guardian_purpose_event;BEGIN
 IF NOT measurement_authority(s,c,w) THEN RETURN false;END IF;
 SELECT * INTO person FROM wearer WHERE shop_id=s AND id=w;
 IF person.age='adult' THEN
  SELECT * INTO p FROM wearer_purpose_event WHERE shop_id=s AND wearer_id=w AND purpose='private-media' ORDER BY wearer_version DESC LIMIT 1;
  RETURN coalesce(p.decision='grant' AND p.authority_epoch=person.authority_epoch,false);
 END IF;
 SELECT * INTO a FROM guardian_authority WHERE shop_id=s AND wearer_id=w ORDER BY wearer_version DESC LIMIT 1;
 SELECT * INTO v FROM guardian_verification_event WHERE shop_id=s AND wearer_id=w AND authority_id=a.id ORDER BY wearer_version DESC LIMIT 1;
 SELECT * INTO g FROM guardian_purpose_event WHERE shop_id=s AND wearer_id=w AND authority_id=a.id AND purpose='private-photo' ORDER BY wearer_version DESC LIMIT 1;
 RETURN coalesce(a.scope='measurement-and-private-photo' AND v.scope='measurement-and-private-photo' AND v.status='confirmed' AND v.authority_epoch=person.authority_epoch AND g.decision='grant' AND g.verification_id=v.id AND g.authority_epoch=person.authority_epoch,false);
END $fn$;
CREATE FUNCTION measurement_fit_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;p jsonb;s public.measurement_fit_subject;prior public.measurement_fit_reference;a public.media_asset;expected text;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Fitting reference history immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;p=d.payload;
 expected=CASE WHEN TG_TABLE_NAME='measurement_fit_subject' THEN 'measurement.fit-subject' ELSE 'measurement.fit-reference' END;
 IF d.id IS NULL OR d.workflow<>expected OR d.schema_version<>1 OR d.lifecycle<>'active' OR p->>'erased' IS DISTINCT FROM 'false'
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event aud WHERE aud.shop_id=NEW.shop_id AND aud.id=NEW.audit_id AND aud.action=expected AND aud.entity_id=NEW.id AND aud.actor_id=NEW.actor_id AND aud.idempotency_key=NEW.command_key AND (aud.xmin::text)::xid8=pg_current_xact_id())
 THEN RAISE EXCEPTION 'Fitting provenance denied' USING ERRCODE='23514';END IF;
 IF NOT measurement_photo_authority(NEW.shop_id,(p->>'customerId')::uuid,(p->>'wearerId')::uuid) THEN RAISE EXCEPTION 'Current separate photo authority required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('measurementSession:'||NEW.shop_id::text||':'||NEW.session_id::text,0));
 NEW.created_xid=pg_current_xact_id();NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());
 IF TG_TABLE_NAME='measurement_fit_subject' THEN
  IF NEW.customer_id IS DISTINCT FROM (p->>'customerId')::uuid OR NEW.wearer_id IS DISTINCT FROM (p->>'wearerId')::uuid OR NEW.anchor_version_id IS DISTINCT FROM (p->>'measurementVersionId')::uuid
  OR NOT EXISTS(SELECT 1 FROM measurement_event e JOIN measurement_version mv ON (mv.shop_id,mv.id)=(e.shop_id,e.id) JOIN measurement_private pv ON (pv.shop_id,pv.event_id)=(e.shop_id,e.id) WHERE e.shop_id=NEW.shop_id AND e.id=NEW.anchor_version_id AND mv.session_id=NEW.session_id AND e.customer_id=NEW.customer_id AND e.wearer_id=NEW.wearer_id AND pv.redacted_at IS NULL)
  THEN RAISE EXCEPTION 'Exact measurement session ownership required' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO s FROM measurement_fit_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
  SELECT * INTO a FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.asset_id;
  IF s.id IS NULL OR a.id IS NULL OR s.customer_id IS DISTINCT FROM (p->>'customerId')::uuid OR s.wearer_id IS DISTINCT FROM (p->>'wearerId')::uuid OR NEW.measurement_version_id IS DISTINCT FROM (p->>'measurementVersionId')::uuid
  OR NEW.asset_id IS DISTINCT FROM (p->>'assetId')::uuid OR NEW.previous_id IS DISTINCT FROM (p->>'previousId')::uuid OR NEW.version IS DISTINCT FROM (p->>'baseVersion')::integer+1
  OR a.status<>'ready' OR a.subject_id<>s.id OR a.purpose<>'private-fitting' OR a.content_type NOT IN ('image/jpeg','image/png','image/webp') OR NEW.original_sha256 IS DISTINCT FROM a.sha256
  OR NOT EXISTS(SELECT 1 FROM media_derivative md WHERE md.shop_id=a.shop_id AND md.asset_id=a.id AND md.variant='display' AND NEW.display=jsonb_build_object('sha256',md.sha256,'width',md.width,'height',md.height))
  OR NOT EXISTS(SELECT 1 FROM media_derivative md WHERE md.shop_id=a.shop_id AND md.asset_id=a.id AND md.variant='thumbnail' AND NEW.thumbnail_sha256=md.sha256)
  OR NOT EXISTS(SELECT 1 FROM measurement_event e WHERE e.shop_id=NEW.shop_id AND e.id=NEW.measurement_version_id AND e.customer_id=s.customer_id AND e.wearer_id=s.wearer_id)
  THEN RAISE EXCEPTION 'Exact ready fitting association required' USING ERRCODE='23514';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:media:'||NEW.shop_id::text||':'||NEW.asset_id::text,0));
  IF NEW.previous_id IS NOT NULL THEN
   SELECT * INTO prior FROM measurement_fit_reference WHERE shop_id=NEW.shop_id AND root_id=NEW.root_id ORDER BY version DESC LIMIT 1;
   IF prior.id IS DISTINCT FROM NEW.previous_id OR prior.version+1<>NEW.version THEN RAISE EXCEPTION 'Expected fitting reference head required' USING ERRCODE='23514';END IF;
  END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_fit_subject_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_fit_subject FOR EACH ROW EXECUTE FUNCTION measurement_fit_event_guard();
CREATE TRIGGER measurement_fit_reference_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_fit_reference FOR EACH ROW EXECUTE FUNCTION measurement_fit_event_guard();
CREATE FUNCTION measurement_fit_asset_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE a public.media_asset;s public.measurement_fit_subject;BEGIN
 IF TG_TABLE_NAME='media_asset' THEN
  SELECT * INTO s FROM measurement_fit_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
  IF s.id IS NULL THEN RETURN NEW;END IF;
  IF TG_OP='INSERT' THEN INSERT INTO measurement_fit_asset(shop_id,asset_id,subject_id) VALUES(NEW.shop_id,NEW.id,s.id);
  ELSIF NOT measurement_photo_authority(s.shop_id,s.customer_id,s.wearer_id) THEN RAISE EXCEPTION 'Current fitting photo authority required' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Fitting asset ownership immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.asset_id;
 SELECT * INTO s FROM measurement_fit_subject WHERE shop_id=NEW.shop_id AND id=NEW.subject_id;
 IF a.id IS NULL OR s.id IS NULL OR a.subject_id<>s.id OR (a.xmin::text)::xid8<>pg_current_xact_id() OR a.status<>'pending_upload' OR a.purpose<>'private-fitting' OR a.content_type NOT IN ('image/jpeg','image/png','image/webp') OR a.visibility<>'private'
 OR a.creator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NOT measurement_photo_authority(s.shop_id,s.customer_id,s.wearer_id)
 OR a.minor IS DISTINCT FROM (SELECT age='minor' FROM wearer WHERE shop_id=s.shop_id AND id=s.wearer_id)
 THEN RAISE EXCEPTION 'Private fitting asset ownership denied' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_fit_asset_ownership AFTER INSERT OR UPDATE ON media_asset FOR EACH ROW EXECUTE FUNCTION measurement_fit_asset_guard();
CREATE TRIGGER measurement_fit_asset_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_fit_asset FOR EACH ROW EXECUTE FUNCTION measurement_fit_asset_guard();
CREATE FUNCTION measurement_fit_redacted_payload(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$
 SELECT (p-ARRAY['caption','reason'])||jsonb_build_object('erased',true)||CASE WHEN p ? 'caption' THEN '{"caption":"","reason":""}'::jsonb ELSE '{}'::jsonb END
$fn$;
CREATE FUNCTION measurement_fit_private_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.measurement_fit_reference;d public.durable_draft;a public.audit_event;w uuid;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Fitting private history protected' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  SELECT * INTO a FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.redaction_audit_id;
  IF TG_TABLE_NAME='measurement_fit_value' THEN
   SELECT s.wearer_id INTO w FROM measurement_fit_reference ref JOIN measurement_fit_subject s ON (s.shop_id,s.id)=(ref.shop_id,ref.subject_id) WHERE ref.shop_id=NEW.shop_id AND ref.id=NEW.reference_id;
  ELSE w=OLD.wearer_id;END IF;
  IF current_user<>'app_owner' OR OLD.redacted_at IS NOT NULL OR NEW.redacted_at IS NULL OR a.action IS DISTINCT FROM 'privacy.measurements' OR a.entity_id IS DISTINCT FROM w OR a.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
  THEN RAISE EXCEPTION 'Audited fitting erasure required' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='measurement_fit_value' THEN
   IF NEW.caption IS NOT NULL OR NEW.reason IS NOT NULL OR (to_jsonb(NEW)-ARRAY['caption','reason','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['caption','reason','redacted_at','redaction_audit_id']) THEN RAISE EXCEPTION 'Fitting caption erasure scope denied' USING ERRCODE='42501';END IF;
  ELSE
   IF NEW.payload IS DISTINCT FROM measurement_fit_redacted_payload(OLD.payload) OR (to_jsonb(NEW)-ARRAY['payload','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload','redacted_at','redaction_audit_id']) THEN RAISE EXCEPTION 'Fitting replay erasure scope denied' USING ERRCODE='42501';END IF;
  END IF;RETURN NEW;
 END IF;
 IF NEW.redacted_at IS NOT NULL OR NEW.redaction_audit_id IS NOT NULL THEN RAISE EXCEPTION 'No forged fitting erasure' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='measurement_fit_value' THEN
  SELECT * INTO r FROM measurement_fit_reference WHERE shop_id=NEW.shop_id AND id=NEW.reference_id;
  SELECT * INTO d FROM durable_draft WHERE shop_id=r.shop_id AND id=r.origin_draft_id;
  IF r.id IS NULL OR r.created_xid<>pg_current_xact_id() OR NEW.caption IS DISTINCT FROM d.payload->>'caption' OR NEW.reason IS DISTINCT FROM d.payload->>'reason' THEN RAISE EXCEPTION 'Exact fitting caption provenance required' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;
  IF d.workflow NOT IN ('measurement.fit-subject','measurement.fit-reference') OR d.version IS DISTINCT FROM NEW.version OR d.payload IS DISTINCT FROM NEW.payload OR (d.payload->>'customerId')::uuid IS DISTINCT FROM NEW.customer_id OR (d.payload->>'wearerId')::uuid IS DISTINCT FROM NEW.wearer_id
  OR NOT EXISTS(SELECT 1 FROM audit_event aud WHERE aud.shop_id=NEW.shop_id AND aud.id=NEW.audit_id AND aud.entity_type='durable_draft' AND aud.entity_id=NEW.draft_id AND aud.idempotency_key=NEW.command_key AND (aud.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Exact fitting replay provenance required' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_fit_value_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_fit_value FOR EACH ROW EXECUTE FUNCTION measurement_fit_private_guard();
CREATE TRIGGER measurement_fit_draft_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_fit_draft_value FOR EACH ROW EXECUTE FUNCTION measurement_fit_private_guard();
CREATE FUNCTION measurement_fit_draft_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.workflow IN ('measurement.fit-subject','measurement.fit-reference') AND NOT(current_user='app_owner' AND NEW.payload->>'erased'='true') THEN
  IF NOT measurement_photo_authority(NEW.shop_id,(NEW.payload->>'customerId')::uuid,(NEW.payload->>'wearerId')::uuid) THEN RAISE EXCEPTION 'Separate fitting photo authority required' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_fit_draft_authority BEFORE INSERT OR UPDATE ON durable_draft FOR EACH ROW EXECUTE FUNCTION measurement_fit_draft_guard();
CREATE FUNCTION measurement_fit_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;kind text;BEGIN
 IF TG_TABLE_NAME='media_reference' THEN
  IF EXISTS(SELECT 1 FROM measurement_fit_asset WHERE shop_id=NEW.shop_id AND asset_id=NEW.asset_id)
  AND NOT EXISTS(SELECT 1 FROM measurement_fit_reference r WHERE r.shop_id=NEW.shop_id AND r.id=NEW.reference_id AND r.asset_id=NEW.asset_id AND r.created_xid=pg_current_xact_id()) THEN RAISE EXCEPTION 'Fitting assets require an exact private reference' USING ERRCODE='23514';END IF;RETURN NEW;
 END IF;
 kind=CASE WHEN TG_TABLE_NAME='measurement_fit_subject' THEN 'measurement.fit-subject' ELSE 'measurement.fit-reference' END;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM kind OR d.result_id IS DISTINCT FROM NEW.id
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_id=NEW.actor_id AND k.action='draft.promote' AND k.response#>>'{draft,result,type}'=kind AND (k.response#>>'{draft,result,id}')::uuid=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM measurement_fit_draft_value WHERE shop_id=NEW.shop_id AND draft_id=d.id AND version=d.version)
 THEN RAISE EXCEPTION 'Atomic fitting promotion required' USING ERRCODE='23514';END IF;
 IF kind='measurement.fit-reference' THEN
  IF NOT EXISTS(SELECT 1 FROM measurement_fit_value WHERE shop_id=NEW.shop_id AND reference_id=NEW.id) OR NOT EXISTS(SELECT 1 FROM media_reference WHERE shop_id=NEW.shop_id AND asset_id=NEW.asset_id AND reference_id=NEW.id) THEN RAISE EXCEPTION 'Complete fitting reference required' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $fn$;
CREATE TRIGGER measurement_fit_media_reference BEFORE INSERT ON media_reference FOR EACH ROW EXECUTE FUNCTION measurement_fit_commit_guard();
CREATE CONSTRAINT TRIGGER measurement_fit_subject_commit AFTER INSERT ON measurement_fit_subject DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION measurement_fit_commit_guard();
CREATE CONSTRAINT TRIGGER measurement_fit_reference_commit AFTER INSERT ON measurement_fit_reference DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION measurement_fit_commit_guard();
REVOKE ALL ON FUNCTION measurement_photo_authority(uuid,uuid,uuid),measurement_fit_event_guard(),measurement_fit_asset_guard(),measurement_fit_private_guard(),measurement_fit_draft_guard(),measurement_fit_commit_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION measurement_photo_authority(uuid,uuid,uuid) TO app_user;

-- Retained-object erasure has its own audited manifest, not orphan cleanup.
CREATE POLICY measurement_fit_privacy_draft ON durable_draft FOR ALL TO app_owner
 USING(shop_context_allows(shop_id) AND workflow IN ('measurement.fit-subject','measurement.fit-reference'))
 WITH CHECK(shop_context_allows(shop_id) AND workflow IN ('measurement.fit-subject','measurement.fit-reference'));
CREATE POLICY measurement_fit_privacy_media ON media_asset FOR SELECT TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM measurement_fit_asset f WHERE f.shop_id=media_asset.shop_id AND f.asset_id=media_asset.id));
CREATE POLICY measurement_fit_privacy_derivative ON media_derivative FOR SELECT TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM measurement_fit_asset f WHERE f.shop_id=media_derivative.shop_id AND f.asset_id=media_derivative.asset_id));
CREATE POLICY measurement_fit_privacy_attempt ON media_attempt FOR SELECT TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM measurement_fit_asset f WHERE f.shop_id=media_attempt.shop_id AND f.asset_id=media_attempt.asset_id));
DO $draft_redaction$ DECLARE body text;BEGIN
 body=pg_get_functiondef('durable_draft_guard()'::regprocedure);
 IF position('BEGIN' in body)=0 THEN RAISE EXCEPTION 'Draft guard predecessor changed';END IF;
 body=replace(body,'BEGIN', $guard$BEGIN
 IF TG_OP='UPDATE' AND current_user='app_owner' AND OLD.workflow IN ('measurement.fit-subject','measurement.fit-reference')
 AND (to_jsonb(NEW)-ARRAY['payload','version','updated_at'])=(to_jsonb(OLD)-ARRAY['payload','version','updated_at']) AND NEW.version=OLD.version+1 AND NEW.updated_at>=OLD.updated_at
 AND NEW.payload=measurement_fit_redacted_payload(OLD.payload)
 AND EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=OLD.shop_id AND a.action='privacy.measurements' AND a.entity_id=(OLD.payload->>'wearerId')::uuid AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid)
 THEN RETURN NEW;END IF;
$guard$);
 EXECUTE body;
END $draft_redaction$;
ALTER FUNCTION redact_measurements(uuid,uuid,uuid) RENAME TO redact_measurements_before_fit;
REVOKE ALL ON FUNCTION redact_measurements_before_fit(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_measurements(s uuid,w uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid;d uuid;known_drafts uuid[]='{}'::uuid[];session uuid;asset public.media_asset;intent uuid;epoch uuid;actor uuid;not_before timestamptz;manifest jsonb;phase text;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 FOR d IN SELECT id FROM durable_draft WHERE shop_id=s AND workflow IN ('measurement.fit-subject','measurement.fit-reference') AND payload->>'wearerId'=w::text ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||d::text,0));known_drafts=array_append(known_drafts,d);
 END LOOP;
 PERFORM redact_measurements_before_fit(s,w,request);
 IF EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=s AND workflow IN ('measurement.fit-subject','measurement.fit-reference') AND payload->>'wearerId'=w::text AND NOT(id=ANY(known_drafts))) THEN RAISE EXCEPTION 'Retry fitting privacy discovery' USING ERRCODE='40001';END IF;
 SELECT audit_id INTO a FROM measurement_erasure WHERE shop_id=s AND wearer_id=w;
 actor=NULLIF(current_setting('app.actor_id',true),'')::uuid;
 IF a IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Measurement erasure provenance missing' USING ERRCODE='42501';END IF;
 FOR session IN SELECT session_id FROM measurement_fit_subject WHERE shop_id=s AND wearer_id=w ORDER BY session_id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('measurementSession:'||s::text||':'||session::text,0));
 END LOOP;
 UPDATE durable_draft SET payload=measurement_fit_redacted_payload(payload),version=version+1,updated_at=greatest(updated_at,clock_timestamp()) WHERE shop_id=s AND workflow IN ('measurement.fit-subject','measurement.fit-reference') AND payload->>'wearerId'=w::text AND payload->>'erased'='false';
 UPDATE measurement_fit_draft_value SET payload=measurement_fit_redacted_payload(payload),redacted_at=transaction_timestamp(),redaction_audit_id=a WHERE shop_id=s AND wearer_id=w AND redacted_at IS NULL;
 UPDATE measurement_fit_value v SET caption=NULL,reason=NULL,redacted_at=transaction_timestamp(),redaction_audit_id=a FROM measurement_fit_reference r JOIN measurement_fit_subject subject ON (subject.shop_id,subject.id)=(r.shop_id,r.subject_id) WHERE subject.shop_id=s AND subject.wearer_id=w AND (v.shop_id,v.reference_id)=(r.shop_id,r.id) AND v.redacted_at IS NULL;
 PERFORM pg_advisory_xact_lock_shared(120036);
 SELECT restore_epoch INTO epoch FROM system_state WHERE singleton;
 FOR asset IN SELECT m.* FROM media_asset m JOIN measurement_fit_asset f ON (f.shop_id,f.asset_id)=(m.shop_id,m.id) JOIN measurement_fit_subject subject ON (subject.shop_id,subject.id)=(f.shop_id,f.subject_id) WHERE subject.shop_id=s AND subject.wearer_id=w ORDER BY m.id LOOP
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
   INSERT INTO measurement_fit_purge(shop_id,id,asset_id,wearer_id,audit_id,request_id,initiator_id,restore_epoch,phase,manifest,not_before) VALUES(s,intent,asset.id,w,a,request,actor,epoch,phase,manifest,not_before) ON CONFLICT DO NOTHING;
   IF FOUND THEN
    INSERT INTO pgboss.job(id,name,data,start_after,retry_limit,retry_delay,retry_backoff) SELECT intent,'media.process',jsonb_build_object('kind','measurement-fit-purge','shopId',s,'purgeId',intent,'initiatorId',actor,'epoch',epoch),not_before,retry_limit,retry_delay,retry_backoff FROM pgboss.queue WHERE name='media.process';
    IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed media queue missing';END IF;
   END IF;
  END LOOP;
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION redact_measurements(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_measurements(uuid,uuid,uuid) TO app_privacy;
CREATE FUNCTION measurement_fit_purge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE p public.measurement_fit_purge;control public.system_state;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Fitting purge provenance immutable' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='measurement_fit_purge' THEN
  IF current_user<>'app_owner' OR NOT EXISTS(SELECT 1 FROM measurement_erasure e JOIN audit_event a ON (a.shop_id,a.id)=(e.shop_id,e.audit_id) JOIN measurement_fit_subject s ON s.shop_id=e.shop_id AND s.wearer_id=e.wearer_id JOIN measurement_fit_asset f ON (f.shop_id,f.subject_id)=(s.shop_id,s.id) WHERE e.shop_id=NEW.shop_id AND e.wearer_id=NEW.wearer_id AND e.audit_id=NEW.audit_id AND f.asset_id=NEW.asset_id AND a.action='privacy.measurements') THEN RAISE EXCEPTION 'Audited fitting purge intent required' USING ERRCODE='42501';END IF;
 ELSE
  SELECT * INTO p FROM measurement_fit_purge WHERE shop_id=NEW.shop_id AND id=NEW.purge_id;
  PERFORM pg_advisory_xact_lock_shared(120036);SELECT * INTO control FROM system_state WHERE singleton;
  IF p.id IS NULL OR NOT control.side_effects_enabled OR control.restore_epoch<>p.restore_epoch OR clock_timestamp()<p.not_before
  OR NOT EXISTS(SELECT 1 FROM measurement_erasure WHERE shop_id=p.shop_id AND wearer_id=p.wearer_id AND audit_id=p.audit_id)
  OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.action='measurement.fit-purge' AND a.entity_id=p.id AND a.actor_id=p.initiator_id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id())
  OR NOT (p.manifest->'keys' ? NEW.object_key OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.manifest->'prefixes') prefix WHERE NEW.object_key ~ ('^'||prefix||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
  THEN RAISE EXCEPTION 'Current fitting purge receipt denied' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_fit_purge_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_fit_purge FOR EACH ROW EXECUTE FUNCTION measurement_fit_purge_guard();
CREATE TRIGGER measurement_fit_purge_receipt_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_fit_purge_receipt FOR EACH ROW EXECUTE FUNCTION measurement_fit_purge_guard();
REVOKE ALL ON FUNCTION measurement_fit_purge_guard() FROM PUBLIC;
