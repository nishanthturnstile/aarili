-- Dev/test-only exemplar. Never installed by product migrations.
SELECT pgboss.create_queue('foundation.synthetic', '{"policy":"standard","retryLimit":2,"retryDelay":0,"retryBackoff":false,"expireInSeconds":60,"deadLetter":"foundation.dead"}'::jsonb);

CREATE TABLE synthetic_job_request (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 initiator_id uuid NOT NULL, entity_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 command_key uuid NOT NULL, command_request_id uuid NOT NULL,
 restore_epoch uuid NOT NULL DEFAULT current_restore_epoch(),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(shop_id,id),
 UNIQUE(shop_id,entity_id,version),
 FOREIGN KEY(shop_id,id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,entity_id) REFERENCES synthetic_record(shop_id,id)
);
CREATE TABLE synthetic_job_effect (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), request_id uuid NOT NULL, audit_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(shop_id,request_id), UNIQUE(shop_id,audit_id),
 FOREIGN KEY(shop_id,request_id) REFERENCES synthetic_job_request(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE synthetic_job_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_job_request FORCE ROW LEVEL SECURITY;
ALTER TABLE synthetic_job_effect ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_job_effect FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON synthetic_job_request AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON synthetic_job_request FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_context ON synthetic_job_effect AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON synthetic_job_effect FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON synthetic_job_request,synthetic_job_effect FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT ON synthetic_job_request,synthetic_job_effect TO app_user;
CREATE FUNCTION synthetic_job_provenance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE source public.audit_event; request public.synthetic_job_request;
BEGIN
 IF NOT COALESCE(public.shop_context_allows(NEW.shop_id),false) THEN
  RAISE EXCEPTION 'Job context denied' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='synthetic_job_request' THEN
  PERFORM pg_advisory_xact_lock_shared(120036);
  IF NEW.restore_epoch IS DISTINCT FROM public.current_restore_epoch() THEN
   RAISE EXCEPTION 'Job epoch denied' USING ERRCODE='23514';
  END IF;
  SELECT * INTO source FROM public.audit_event WHERE shop_id=NEW.shop_id AND id=NEW.id;
  IF NOT FOUND OR source.actor_type<>'user' OR source.actor_id<>NEW.initiator_id
   OR source.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
   OR source.entity_id<>NEW.entity_id OR source.entity_type<>'synthetic_record'
   OR source.idempotency_key<>NEW.command_key OR source.request_id<>NEW.command_request_id
   OR (source.changes->>'version')::integer IS DISTINCT FROM NEW.version
   OR NOT EXISTS(SELECT 1 FROM public.synthetic_record r WHERE r.shop_id=NEW.shop_id AND r.id=NEW.entity_id AND r.version=NEW.version AND r.event_id=NEW.id) THEN
   RAISE EXCEPTION 'Job provenance denied' USING ERRCODE='42501';
  END IF;
  NEW.created_at=now();
 ELSE
  SELECT * INTO request FROM public.synthetic_job_request WHERE shop_id=NEW.shop_id AND id=NEW.request_id;
  PERFORM pg_advisory_xact_lock_shared(120036);
  IF request.restore_epoch IS DISTINCT FROM public.current_restore_epoch()
   OR EXISTS(SELECT 1 FROM public.synthetic_job_quarantine WHERE shop_id=NEW.shop_id AND request_id=NEW.request_id) THEN
   RAISE EXCEPTION 'Obsolete epoch effect denied' USING ERRCODE='23514';
  END IF;
  IF NOT FOUND OR request.initiator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
   RAISE EXCEPTION 'Effect provenance denied' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.synthetic_record r WHERE r.shop_id=NEW.shop_id AND r.id=request.entity_id
    AND r.version=request.version AND r.event_id=request.id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Obsolete effect denied' USING ERRCODE='23514'; END IF;
  NEW.occurred_at=now();
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION synthetic_job_provenance() FROM PUBLIC;
CREATE TRIGGER synthetic_job_request_provenance BEFORE INSERT ON synthetic_job_request FOR EACH ROW EXECUTE FUNCTION synthetic_job_provenance();
CREATE TRIGGER synthetic_job_effect_provenance BEFORE INSERT ON synthetic_job_effect FOR EACH ROW EXECUTE FUNCTION synthetic_job_provenance();
CREATE TRIGGER synthetic_job_request_immutable BEFORE UPDATE OR DELETE ON synthetic_job_request FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER synthetic_job_effect_immutable BEFORE UPDATE OR DELETE ON synthetic_job_effect FOR EACH ROW EXECUTE FUNCTION reject_history_change();
-- Effect precedes its audit in core, but no incomplete effect can commit.
CREATE FUNCTION synthetic_effect_audit() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE request public.synthetic_job_request; event public.audit_event;
BEGIN
 SELECT * INTO request FROM public.synthetic_job_request WHERE shop_id=NEW.shop_id AND id=NEW.request_id;
 SELECT * INTO event FROM public.audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id;
 IF NOT FOUND OR event.actor_type<>'user' OR event.actor_id<>request.initiator_id
  OR event.action<>'synthetic.job.consume' OR event.entity_type<>'synthetic_record'
  OR event.entity_id<>request.entity_id OR event.source_event_id IS DISTINCT FROM request.id
  OR event.request_id<>request.command_request_id OR event.idempotency_key<>request.command_key
  OR (event.changes->>'version')::integer IS DISTINCT FROM request.version THEN
  RAISE EXCEPTION 'Incomplete effect audit denied' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION synthetic_effect_audit() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER synthetic_effect_complete AFTER INSERT ON synthetic_job_effect DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION synthetic_effect_audit();
-- No key FK: request/effect identity outlives the 30-day replay-key lifetime.

CREATE TABLE synthetic_job_quarantine (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), request_id uuid NOT NULL,
 request_epoch uuid NOT NULL, observed_epoch uuid NOT NULL,
 reason text NOT NULL CHECK(reason IN ('old_epoch','missing_epoch')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(shop_id,request_id),
 FOREIGN KEY(shop_id,request_id) REFERENCES synthetic_job_request(shop_id,id)
);
ALTER TABLE synthetic_job_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_job_quarantine FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON synthetic_job_quarantine AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON synthetic_job_quarantine FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON synthetic_job_quarantine FROM PUBLIC,app_user,app_privacy,app_restore_operator;
GRANT SELECT,INSERT ON synthetic_job_quarantine TO app_user;
CREATE TRIGGER synthetic_job_quarantine_immutable BEFORE UPDATE OR DELETE ON synthetic_job_quarantine
 FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE FUNCTION synthetic_quarantine_provenance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE request public.synthetic_job_request;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(120036);
 SELECT * INTO request FROM public.synthetic_job_request WHERE shop_id=NEW.shop_id AND id=NEW.request_id;
 IF NOT FOUND OR request.initiator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
  OR NEW.request_epoch IS DISTINCT FROM request.restore_epoch
  OR NEW.observed_epoch IS DISTINCT FROM public.current_restore_epoch()
  OR (NEW.reason='old_epoch' AND NEW.request_epoch=NEW.observed_epoch) THEN
  RAISE EXCEPTION 'Quarantine provenance denied' USING ERRCODE='42501';
 END IF;
 NEW.occurred_at=clock_timestamp();
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION synthetic_quarantine_provenance() FROM PUBLIC;
CREATE TRIGGER synthetic_job_quarantine_provenance BEFORE INSERT ON synthetic_job_quarantine
 FOR EACH ROW EXECUTE FUNCTION synthetic_quarantine_provenance();
