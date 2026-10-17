-- W1 1.1.1d additive commercial policy history. No defaults or production authority.
-- Back up before non-disposable application; retain additive schema on rollback.
CREATE TABLE shop_policies_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid,
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 schema_version integer NOT NULL CHECK(schema_version=1),
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 authority_scope text NOT NULL DEFAULT 'synthetic-only' CHECK(authority_scope='synthetic-only'),
 policies jsonb NOT NULL CHECK(jsonb_typeof(policies)='array'),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,previous_id) REFERENCES shop_policies_revision(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE shop_policies (
 shop_id uuid NOT NULL PRIMARY KEY REFERENCES shop(shop_id),
 current_revision_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 FOREIGN KEY(shop_id,current_revision_id) REFERENCES shop_policies_revision(shop_id,id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['shop_policies','shop_policies_revision'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(current_revision_id,version) ON shop_policies TO app_user;
CREATE FUNCTION shop_policies_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d jsonb; prior jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Policies history protected' USING ERRCODE='42501'; END IF;
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NOT EXISTS(
  SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_type='user' AND actor_id=NEW.actor_id
  AND entity_type='shop_policies_revision' AND entity_id=NEW.id AND action='shop-policies.publish'
 ) THEN RAISE EXCEPTION 'Policies provenance denied' USING ERRCODE='42501'; END IF;
 IF NEW.version>1 AND NOT EXISTS(SELECT 1 FROM shop_policies_revision WHERE shop_id=NEW.shop_id AND id=NEW.previous_id AND version::bigint+1=NEW.version) THEN
  RAISE EXCEPTION 'Policies predecessor denied' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='shop.policies' AND lifecycle='active' AND schema_version=1 AND payload->>'baseVersion'=(NEW.version-1)::text AND (payload->>'baseRevisionId')::uuid IS NOT DISTINCT FROM NEW.previous_id) THEN
  RAISE EXCEPTION 'Policies draft origin denied' USING ERRCODE='23514'; END IF;
 SELECT payload->'policy' INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d IS NULL OR d->>'state' NOT IN ('reviewed','not-applicable') OR d->'authority'->>'kind' IS DISTINCT FROM 'synthetic-fixture' OR length(btrim(d->'authority'->>'label'))=0
 OR (d->>'state'='reviewed' AND (length(btrim(d->'terms'->>'en'))=0 OR length(btrim(d->'terms'->>'ta'))=0))
 OR (d->>'state'='not-applicable' AND length(btrim(d->>'reason'))=0)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.policies) p WHERE p=d)
 OR (SELECT count(*) FROM jsonb_array_elements(NEW.policies))<>(SELECT count(DISTINCT p->>'kind') FROM jsonb_array_elements(NEW.policies) p)
 THEN RAISE EXCEPTION 'Policy fixture authority denied' USING ERRCODE='23514'; END IF;
 SELECT policies INTO prior FROM shop_policies_revision WHERE shop_id=NEW.shop_id AND id=NEW.previous_id;
 IF COALESCE((SELECT jsonb_agg(p ORDER BY p->>'kind') FROM jsonb_array_elements(COALESCE(prior,'[]'::jsonb)) p WHERE p->>'kind'<>d->>'kind'),'[]'::jsonb)
 IS DISTINCT FROM COALESCE((SELECT jsonb_agg(p ORDER BY p->>'kind') FROM jsonb_array_elements(NEW.policies) p WHERE p->>'kind'<>d->>'kind'),'[]'::jsonb)
 THEN RAISE EXCEPTION 'Policy snapshot mutation denied' USING ERRCODE='23514'; END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_policies_revision_guard() FROM PUBLIC;
CREATE TRIGGER shop_policies_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON shop_policies_revision FOR EACH ROW EXECUTE FUNCTION shop_policies_revision_guard();
CREATE FUNCTION shop_policies_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.shop_policies_revision;
BEGIN
 SELECT * INTO r FROM shop_policies_revision WHERE shop_id=NEW.shop_id AND id=NEW.current_revision_id;
 IF NOT FOUND OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Policies pointer denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Policies first publication denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_revision_id THEN RAISE EXCEPTION 'Policies version denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_policies_pointer_guard() FROM PUBLIC;
CREATE TRIGGER shop_policies_pointer_guard BEFORE INSERT OR UPDATE ON shop_policies FOR EACH ROW EXECUTE FUNCTION shop_policies_pointer_guard();
-- The outer draft command marks promotion after the adapter writes the revision.
-- Verify that link at commit, without permitting an orphan authoritative revision.
CREATE FUNCTION shop_policies_origin_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='shop.policies' AND lifecycle='promoted' AND result_type='shop.policies.revision' AND result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM shop_policies WHERE shop_id=NEW.shop_id AND version>=NEW.version) THEN
  RAISE EXCEPTION 'Policies promotion incomplete' USING ERRCODE='23514'; END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_policies_origin_guard() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER shop_policies_origin_guard AFTER INSERT ON shop_policies_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shop_policies_origin_guard();
