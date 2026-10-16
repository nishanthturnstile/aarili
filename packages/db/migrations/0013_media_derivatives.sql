-- Additive immutable accepted derivatives; backup first, migration advisory lock.
-- Compatible rollback retains this table and the accepted objects.
CREATE TABLE media_derivative (
 shop_id uuid NOT NULL,asset_id uuid NOT NULL,
 variant text NOT NULL CHECK(variant IN ('display','thumbnail')),
 object_key text NOT NULL,sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 accepted_bytes integer NOT NULL CHECK(accepted_bytes>0 AND accepted_bytes<=20971520),
 width integer NOT NULL CHECK(width>0 AND width<=1600),height integer NOT NULL CHECK(height>0 AND height<=1600),
 content_type text NOT NULL CHECK(content_type='image/webp'),
 PRIMARY KEY(shop_id,asset_id,variant),UNIQUE(shop_id,object_key),
 FOREIGN KEY(shop_id,asset_id) REFERENCES media_asset(shop_id,id),
 CHECK(object_key LIKE 'shops/'||shop_id::text||'/private/'||asset_id::text||'/%'),
 CHECK(variant<>'thumbnail' OR (width<=320 AND height<=320))
);
CREATE FUNCTION media_derivative_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Media derivative history protected' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:media:'||NEW.shop_id::text||':'||NEW.asset_id::text,0));
 PERFORM 1 FROM media_asset a JOIN media_attempt p ON p.shop_id=a.shop_id AND p.id=a.attempt_id
 WHERE a.shop_id=NEW.shop_id AND a.id=NEW.asset_id AND a.status='ready' AND a.content_type LIKE 'image/%'
 -- xmin is the exact transaction that created this ready row version. Match
 -- xid8's low 32 bits to heap xmin (including after transaction-id wraparound).
 -- A later transaction cannot append a previously missing accepted variant.
 AND a.xmin=((pg_current_xact_id()::text::numeric % 4294967296)::text::xid)
 AND p.state='accepted' AND p.initiator_id=NULLIF(current_setting('app.actor_id',true),'')::uuid
 AND NEW.object_key LIKE 'shops/'||a.shop_id::text||'/private/'||a.id::text||'/'||p.fence::text||'/%';
 IF NOT FOUND THEN RAISE EXCEPTION 'Media derivative provenance denied' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION media_derivative_guard() FROM PUBLIC;
CREATE TRIGGER media_derivative_provenance BEFORE INSERT OR UPDATE OR DELETE ON media_derivative FOR EACH ROW EXECUTE FUNCTION media_derivative_guard();
ALTER TABLE media_derivative ENABLE ROW LEVEL SECURITY;ALTER TABLE media_derivative FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON media_derivative AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON media_derivative FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON media_derivative FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT ON media_derivative TO app_user;
GRANT SELECT ON media_derivative TO app_backup;

-- Explicit operator-only unaccepted-output reconciliation. An intent and its
-- audit commit before storage deletion. This is not retained-media erasure.
CREATE TABLE media_cleanup_intent (
 shop_id uuid NOT NULL,id uuid NOT NULL,asset_id uuid NOT NULL,object_key text NOT NULL,claim_fence uuid NOT NULL,
 restore_epoch uuid NOT NULL,actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,completion_action_id uuid,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,asset_id,object_key,restore_epoch),
 FOREIGN KEY(shop_id,asset_id) REFERENCES media_asset(shop_id,id),
 FOREIGN KEY(shop_id,claim_fence) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,completion_action_id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 CHECK((completed_at IS NULL)=(completion_action_id IS NULL))
);
CREATE INDEX media_cleanup_pending ON media_cleanup_intent(shop_id,asset_id,created_at,id) WHERE completed_at IS NULL;
CREATE FUNCTION media_cleanup_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Media cleanup history protected' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:media:'||NEW.shop_id::text||':'||NEW.asset_id::text,0));
 IF TG_OP='INSERT' THEN
  IF NEW.completed_at IS NOT NULL OR NEW.completion_action_id IS NOT NULL OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Media cleanup provenance denied' USING ERRCODE='42501'; END IF;
  NEW.created_at=clock_timestamp();
 ELSIF OLD.completed_at IS NOT NULL OR NEW.completed_at IS NULL OR NEW.completion_action_id IS NULL OR (to_jsonb(NEW)-ARRAY['completed_at','completion_action_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['completed_at','completion_action_id']) THEN
  RAISE EXCEPTION 'Media cleanup history protected' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM media_asset a JOIN audit_event e ON e.shop_id=a.shop_id AND e.entity_id=a.id
 JOIN system_state s ON s.singleton=true
 WHERE a.shop_id=NEW.shop_id AND a.id=NEW.asset_id AND e.id=NEW.claim_fence AND e.entity_type='media_asset' AND e.action='media.claim'
 AND e.occurred_at<=clock_timestamp()-interval '300 seconds' AND s.side_effects_enabled AND s.restore_epoch=NEW.restore_epoch
 AND NEW.object_key ~ ('^shops/'||a.shop_id::text||'/private/'||a.id::text||'/'||NEW.claim_fence::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 AND NEW.object_key IS DISTINCT FROM a.accepted_key
 AND NOT EXISTS(SELECT 1 FROM media_derivative d WHERE d.shop_id=a.shop_id AND d.asset_id=a.id AND d.object_key=NEW.object_key)
 AND NOT EXISTS(SELECT 1 FROM media_reference r WHERE r.shop_id=a.shop_id AND r.asset_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM media_attempt p WHERE p.shop_id=a.shop_id AND p.asset_id=a.id AND p.fence=NEW.claim_fence AND p.state='processing' AND p.lease_until>clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION 'Media cleanup candidate denied' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION media_cleanup_guard() FROM PUBLIC;
CREATE TRIGGER media_cleanup_provenance BEFORE INSERT OR UPDATE OR DELETE ON media_cleanup_intent FOR EACH ROW EXECUTE FUNCTION media_cleanup_guard();
ALTER TABLE media_cleanup_intent ENABLE ROW LEVEL SECURITY;ALTER TABLE media_cleanup_intent FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON media_cleanup_intent AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON media_cleanup_intent FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON media_cleanup_intent FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT,UPDATE ON media_cleanup_intent TO app_user;
GRANT SELECT ON media_cleanup_intent TO app_backup;
