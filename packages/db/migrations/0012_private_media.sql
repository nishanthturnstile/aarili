-- Additive private staging/immutable acceptance. Backup first; apply under the
-- existing migration advisory lock as app_owner. No destructive rollback.
CREATE TABLE media_asset (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,creator_id uuid NOT NULL,
 subject_id uuid NOT NULL,purpose text NOT NULL CHECK(purpose IN ('wearer-photo','private-fitting','manual-pattern','order-document','voice-note')),
 minor boolean NOT NULL, visibility text NOT NULL DEFAULT 'private' CHECK(visibility='private'),
 content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/mp4','audio/wav')),
 declared_bytes integer NOT NULL CHECK(declared_bytes>0 AND declared_bytes<=26214400),
 status text NOT NULL DEFAULT 'pending_upload' CHECK(status IN ('pending_upload','processing','ready','quarantined','expired','deleted')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 staging_expires_at timestamptz NOT NULL,staging_key text NOT NULL,accepted_key text,sha256 text,accepted_bytes integer,attempt_id uuid,
 PRIMARY KEY(shop_id,id),FOREIGN KEY(shop_id,creator_id) REFERENCES shop_membership(shop_id,user_id),
 UNIQUE(shop_id,staging_key),UNIQUE(shop_id,accepted_key),
 CHECK(staging_key='shops/'||shop_id::text||'/staging/'||id::text),
 CHECK(accepted_key IS NULL OR accepted_key LIKE 'shops/'||shop_id::text||'/private/'||id::text||'/%'),
 CHECK((status='ready' AND accepted_key IS NOT NULL AND sha256 IS NOT NULL AND sha256 ~ '^[0-9a-f]{64}$' AND accepted_bytes IS NOT NULL AND accepted_bytes>0) OR (status<>'ready' AND accepted_key IS NULL AND sha256 IS NULL AND accepted_bytes IS NULL)),
 CHECK(content_type NOT LIKE 'image/%' OR declared_bytes<=20971520)
);
CREATE INDEX media_asset_staging_expiry ON media_asset(shop_id,status,staging_expires_at,id);
CREATE TABLE media_attempt (
 shop_id uuid NOT NULL,id uuid NOT NULL,asset_id uuid NOT NULL,initiator_id uuid NOT NULL,restore_epoch uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('queued','processing','accepted','quarantined')),fence uuid,lease_until timestamptz,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,asset_id),UNIQUE(shop_id,id,asset_id),
 FOREIGN KEY(shop_id,asset_id) REFERENCES media_asset(shop_id,id),
 FOREIGN KEY(shop_id,initiator_id) REFERENCES shop_membership(shop_id,user_id),
 CHECK((state='queued' AND fence IS NULL AND lease_until IS NULL) OR (state<>'queued' AND fence IS NOT NULL AND lease_until IS NOT NULL))
);
ALTER TABLE media_asset ADD CONSTRAINT media_asset_attempt_fk FOREIGN KEY(shop_id,attempt_id,id) REFERENCES media_attempt(shop_id,id,asset_id);
CREATE INDEX media_attempt_work ON media_attempt(shop_id,state,lease_until,id);
-- Later domain integrations add their own concrete composite subject FKs. This
-- generic reference does not create a customer/guardian subsystem or authority.
CREATE TABLE media_reference (
 shop_id uuid NOT NULL,asset_id uuid NOT NULL,reference_id uuid NOT NULL,
 PRIMARY KEY(shop_id,asset_id,reference_id),FOREIGN KEY(shop_id,asset_id) REFERENCES media_asset(shop_id,id)
);
CREATE FUNCTION media_history_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_TABLE_NAME='media_asset' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.status<>'pending_upload' OR NEW.version<>1 OR NEW.attempt_id IS NOT NULL OR NEW.creator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Media provenance denied' USING ERRCODE='42501'; END IF;
   NEW.created_at=date_trunc('milliseconds',clock_timestamp());
  ELSE
   IF OLD.status IN ('ready','quarantined','expired','deleted') OR (to_jsonb(NEW)-ARRAY['status','version','accepted_key','sha256','accepted_bytes','attempt_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','accepted_key','sha256','accepted_bytes','attempt_id']) OR NEW.version<>OLD.version+1
    OR NOT ((OLD.status='pending_upload' AND NEW.status IN ('processing','expired')) OR (OLD.status='processing' AND NEW.status IN ('ready','quarantined'))) THEN RAISE EXCEPTION 'Media history protected' USING ERRCODE='42501'; END IF;
   IF NEW.status='processing' AND NEW.attempt_id IS NULL THEN RAISE EXCEPTION 'Media attempt required'; END IF;
   IF OLD.attempt_id IS NOT NULL AND NEW.attempt_id IS DISTINCT FROM OLD.attempt_id THEN RAISE EXCEPTION 'Media attempt immutable'; END IF;
  END IF;
 ELSE
  IF TG_OP='INSERT' AND (NEW.state<>'queued' OR NEW.fence IS NOT NULL OR NEW.lease_until IS NOT NULL) THEN RAISE EXCEPTION 'Media attempt provenance denied' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (OLD.state IN ('accepted','quarantined') OR (to_jsonb(NEW)-ARRAY['state','fence','lease_until']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','fence','lease_until']) OR NOT ((OLD.state IN ('queued','processing') AND NEW.state='processing') OR (OLD.state='processing' AND NEW.state IN ('accepted','quarantined')))) THEN RAISE EXCEPTION 'Media attempt protected' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION media_history_guard() FROM PUBLIC;
CREATE TRIGGER media_asset_guard BEFORE INSERT OR UPDATE ON media_asset FOR EACH ROW EXECUTE FUNCTION media_history_guard();
CREATE TRIGGER media_attempt_guard BEFORE INSERT OR UPDATE ON media_attempt FOR EACH ROW EXECUTE FUNCTION media_history_guard();
CREATE FUNCTION media_reference_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:media:'||NEW.shop_id::text||':'||NEW.asset_id::text,0));
 PERFORM 1 FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.asset_id AND status NOT IN ('expired','deleted','quarantined');
 IF NOT FOUND THEN RAISE EXCEPTION 'Media reference denied' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION media_reference_guard() FROM PUBLIC;
CREATE TRIGGER media_reference_guard BEFORE INSERT ON media_reference FOR EACH ROW EXECUTE FUNCTION media_reference_guard();
ALTER TABLE media_asset ENABLE ROW LEVEL SECURITY;ALTER TABLE media_asset FORCE ROW LEVEL SECURITY;
ALTER TABLE media_attempt ENABLE ROW LEVEL SECURITY;ALTER TABLE media_attempt FORCE ROW LEVEL SECURITY;
ALTER TABLE media_reference ENABLE ROW LEVEL SECURITY;ALTER TABLE media_reference FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON media_asset AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON media_asset FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_context ON media_attempt AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON media_attempt FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_context ON media_reference AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON media_reference FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON media_asset,media_attempt,media_reference FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT,UPDATE ON media_asset,media_attempt TO app_user;
GRANT SELECT,INSERT ON media_reference TO app_user;
GRANT SELECT ON media_asset,media_attempt,media_reference TO app_backup;
-- Provision only the necessary private processing queue. No runtime DDL/worker
-- activation; content validation remains disabled until the next reviewed slice.
SELECT pgboss.create_queue('media.process','{"policy":"standard","retryLimit":3,"retryDelay":1}'::jsonb);
