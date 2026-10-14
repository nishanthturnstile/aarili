-- W0 0.2.3 infrastructure only. Synthetic records are installed by fixtures.
CREATE TABLE idempotency_key (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), key uuid NOT NULL,
 actor_type text NOT NULL CHECK(actor_type IN ('user','system','import','support')),
 actor_id uuid NOT NULL, action text NOT NULL CHECK(length(action) BETWEEN 1 AND 120),
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 status integer NOT NULL CHECK(status BETWEEN 200 AND 299), response jsonb NOT NULL,
 created_at timestamptz(3) NOT NULL DEFAULT now(), PRIMARY KEY(shop_id,key)
);
CREATE INDEX idempotency_key_cutoff ON idempotency_key(shop_id,created_at,key);
CREATE TABLE audit_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL DEFAULT uuidv7(),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 actor_type text NOT NULL CHECK(actor_type IN ('user','system','import','support')),
 actor_id uuid NOT NULL, action text NOT NULL CHECK(length(action) BETWEEN 1 AND 120),
 entity_type text NOT NULL, entity_id uuid NOT NULL, request_id uuid NOT NULL,
 idempotency_key uuid NOT NULL, reason text, changes jsonb NOT NULL,
 source_event_id uuid, PRIMARY KEY(shop_id,id),
 FOREIGN KEY(shop_id,source_event_id) REFERENCES audit_event(shop_id,id)
);
CREATE INDEX audit_event_entity ON audit_event(shop_id,entity_type,entity_id,occurred_at);
-- Audit retains the key as provenance, without an FK to short-lived keys.
-- Durable entity/reference constraints must outlive 30-day key retention.
ALTER TABLE idempotency_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_key FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON idempotency_key AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON idempotency_key FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_context ON audit_event AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON audit_event FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON idempotency_key,audit_event FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT ON idempotency_key,audit_event TO app_user;

-- Invoker-rights safeguards: no role bypass, no SECURITY DEFINER erasure path.
-- Future privacy functions must audit scoped redaction and retain tombstones.
CREATE FUNCTION command_provenance() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.actor_type <> 'user' OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
  OR NOT COALESCE(public.shop_context_allows(NEW.shop_id),false) THEN
  RAISE EXCEPTION 'Command provenance denied' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='audit_event' THEN NEW.occurred_at=now(); ELSE NEW.created_at=now(); END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION reject_history_change() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN RAISE EXCEPTION 'History is append-only' USING ERRCODE='42501'; END $fn$;
REVOKE ALL ON FUNCTION command_provenance(),reject_history_change() FROM PUBLIC;
CREATE TRIGGER audit_provenance BEFORE INSERT ON audit_event FOR EACH ROW EXECUTE FUNCTION command_provenance();
CREATE TRIGGER key_provenance BEFORE INSERT ON idempotency_key FOR EACH ROW EXECUTE FUNCTION command_provenance();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION reject_history_change();
-- Keys can only be selected/inserted by runtime. A later explicitly scoped
-- retention operation owns purging; no active worker or erasure role is added.
CREATE TRIGGER key_immutable BEFORE UPDATE ON idempotency_key FOR EACH ROW EXECUTE FUNCTION reject_history_change();
