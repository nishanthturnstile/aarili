-- C2: append-only contact aliases and reviewed current service attribution.
-- Original contacts, relationships, orders and accepted snapshots are untouched.
CREATE TABLE customer_merge_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 source_id uuid NOT NULL, survivor_id uuid NOT NULL, version integer NOT NULL CHECK(version>1),
 mode text NOT NULL CHECK(mode IN ('merge','restore')), field_sources jsonb NOT NULL CHECK(
  jsonb_typeof(field_sources)='object' AND field_sources ?& ARRAY['displayName','phone','email','aliases','notes']
  AND field_sources-ARRAY['displayName','phone','email','aliases','notes']='{}'::jsonb
  AND COALESCE(field_sources->>'displayName','') IN ('source','survivor') AND COALESCE(field_sources->>'phone','') IN ('source','survivor')
  AND COALESCE(field_sources->>'email','') IN ('source','survivor') AND COALESCE(field_sources->>'aliases','') IN ('source','survivor') AND COALESCE(field_sources->>'notes','') IN ('source','survivor')),
 actor_id uuid NOT NULL, command_key uuid NOT NULL, request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 authority_hash text NOT NULL CHECK(authority_hash ~ '^[a-f0-9]{64}$'), recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,source_id,version), UNIQUE(shop_id,command_key), CHECK(source_id<>survivor_id),
 FOREIGN KEY(shop_id,source_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,survivor_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE INDEX customer_merge_survivor ON customer_merge_event(shop_id,survivor_id,source_id,version);
CREATE TABLE customer_order_attribution (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), event_id uuid NOT NULL, order_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), original_customer_id uuid NOT NULL, current_customer_id uuid NOT NULL,
 PRIMARY KEY(shop_id,event_id,order_id), UNIQUE(shop_id,order_id,version),
 FOREIGN KEY(shop_id,event_id) REFERENCES customer_merge_event(shop_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,original_customer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,current_customer_id) REFERENCES customer(shop_id,id)
);
CREATE INDEX customer_attribution_current ON customer_order_attribution(shop_id,current_customer_id,order_id,version);
DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['customer_merge_event','customer_order_attribution'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_history_change()',t);
 END LOOP;
END $rls$;
CREATE FUNCTION active_contact_alias(s uuid,c uuid) RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT CASE WHEN mode='merge' THEN survivor_id END FROM customer_merge_event WHERE shop_id=s AND source_id=c ORDER BY version DESC LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION active_contact_alias(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION active_contact_alias(uuid,uuid) TO app_user;
CREATE FUNCTION customer_merge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE prior customer_merge_event; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:contact-merge:'||NEW.shop_id::text,0));
 SELECT * INTO prior FROM customer_merge_event WHERE shop_id=NEW.shop_id AND source_id=NEW.source_id ORDER BY version DESC LIMIT 1;
 IF NEW.version<>COALESCE(prior.version,1)+1 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE (a.shop_id,a.id)=(NEW.shop_id,NEW.id) AND a.action='customer.'||NEW.mode AND a.actor_id=NEW.actor_id AND a.idempotency_key=NEW.command_key)
 THEN RAISE EXCEPTION 'Merge provenance denied' USING ERRCODE='23514'; END IF;
 IF NEW.mode='merge' THEN
  IF active_contact_alias(NEW.shop_id,NEW.source_id) IS NOT NULL OR active_contact_alias(NEW.shop_id,NEW.survivor_id) IS NOT NULL
  OR EXISTS(SELECT 1 FROM customer c WHERE c.shop_id=NEW.shop_id AND active_contact_alias(c.shop_id,c.id) IN(NEW.source_id,NEW.survivor_id))
  THEN RAISE EXCEPTION 'Alias chain or conflicting survivor denied' USING ERRCODE='23514'; END IF;
 ELSIF prior.mode IS DISTINCT FROM 'merge' OR prior.survivor_id IS DISTINCT FROM NEW.survivor_id THEN
  RAISE EXCEPTION 'Restore must follow the original merge' USING ERRCODE='23514';
 END IF;
 NEW.recorded_at=clock_timestamp(); RETURN NEW;
END $fn$;
CREATE TRIGGER customer_merge_insert BEFORE INSERT ON customer_merge_event FOR EACH ROW EXECUTE FUNCTION customer_merge_guard();
REVOKE ALL ON FUNCTION customer_merge_guard() FROM PUBLIC;
CREATE FUNCTION customer_attribution_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE e customer_merge_event; o garment_order; previous customer_order_attribution; BEGIN
 SELECT * INTO e FROM customer_merge_event WHERE (shop_id,id)=(NEW.shop_id,NEW.event_id);
 SELECT * INTO o FROM garment_order WHERE (shop_id,id)=(NEW.shop_id,NEW.order_id);
 SELECT * INTO previous FROM customer_order_attribution WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id ORDER BY version DESC LIMIT 1;
 IF o.id IS NULL OR e.id IS NULL OR NEW.version<>COALESCE(previous.version,0)+1 OR o.customer_id<>NEW.original_customer_id OR o.customer_id<>e.source_id
 OR NEW.current_customer_id<>(CASE WHEN e.mode='merge' THEN e.survivor_id ELSE e.source_id END)
 OR (e.mode='restore' AND previous.current_customer_id IS DISTINCT FROM e.survivor_id)
 OR (e.mode='merge' AND (o.intake_kind<>'service' OR o.wearer_id IS NOT NULL
 OR EXISTS(SELECT 1 FROM booking_member WHERE shop_id=o.shop_id AND order_id=o.id)
 OR EXISTS(SELECT 1 FROM service_property_subject WHERE shop_id=o.shop_id AND order_id=o.id AND source_order_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM service_repeat_target WHERE shop_id=o.shop_id AND order_id=o.id)
 OR EXISTS(SELECT 1 FROM service_repeat_origin WHERE shop_id=o.shop_id AND source_order_id=o.id)
 OR EXISTS(SELECT 1 FROM order_service_change WHERE shop_id=o.shop_id AND order_id=o.id)
 OR NOT EXISTS(SELECT 1 FROM order_acceptance_snapshot WHERE shop_id=o.shop_id AND order_id=o.id AND content#>>'{service,profile,content,wearerRequirement}'='not-required')))
 THEN RAISE EXCEPTION 'Supported current attribution required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER customer_attribution_insert BEFORE INSERT ON customer_order_attribution FOR EACH ROW EXECUTE FUNCTION customer_attribution_guard();
REVOKE ALL ON FUNCTION customer_attribution_guard() FROM PUBLIC;
CREATE FUNCTION customer_merge_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM identity_revision_evidence e WHERE e.shop_id=NEW.shop_id AND e.audit_id=NEW.id AND e.customer_id=NEW.source_id AND e.version=NEW.version)
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_id=NEW.actor_id AND k.actor_type='user' AND k.action='customer.'||NEW.mode AND k.request_hash=NEW.request_hash AND k.status=200 AND k.response=jsonb_build_object('id',NEW.id,'version',NEW.version,'sourceId',NEW.source_id,'survivorId',NEW.survivor_id))
 THEN RAISE EXCEPTION 'Merge atomic commit denied' USING ERRCODE='23514'; END IF;
 IF NEW.mode='restore' AND EXISTS(SELECT 1 FROM customer_order_attribution a WHERE a.shop_id=NEW.shop_id AND a.original_customer_id=NEW.source_id AND a.current_customer_id=NEW.survivor_id AND a.version=(SELECT max(x.version) FROM customer_order_attribution x WHERE x.shop_id=a.shop_id AND x.order_id=a.order_id))
 THEN RAISE EXCEPTION 'Restore requires all current overlays' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER customer_merge_commit AFTER INSERT ON customer_merge_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION customer_merge_commit_guard();
REVOKE ALL ON FUNCTION customer_merge_commit_guard() FROM PUBLIC;
-- Extend the existing redactable evidence gate; no new copy of personal reasons.
CREATE OR REPLACE FUNCTION identity_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.reason IS NULL OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE (a.shop_id,a.id)=(NEW.shop_id,NEW.audit_id) AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.action IN ('customer.correct','wearer.update','customer.pair-review','customer.merge','customer.restore')) THEN RAISE EXCEPTION 'Identity evidence provenance denied' USING ERRCODE='23514'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF current_user<>'app_owner' OR (to_jsonb(NEW)-ARRAY['reason','redaction_audit_id','redacted_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['reason','redaction_audit_id','redacted_at']) OR OLD.redaction_audit_id IS NOT NULL OR NEW.reason IS NOT NULL OR NEW.redacted_at IS NULL OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.redaction_audit_id AND a.action='privacy.identity-reason' AND a.entity_id=NEW.audit_id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.occurred_at=transaction_timestamp()) THEN RAISE EXCEPTION 'Audited privacy redaction required' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'Identity history retained' USING ERRCODE='42501'; END IF; RETURN NEW;
END $fn$;
