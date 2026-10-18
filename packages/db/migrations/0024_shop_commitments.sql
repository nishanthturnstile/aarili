-- W1 1.1.1e additive unbound commitment history. No defaults or production authority.
-- Back up before non-disposable application; retain additive schema on rollback.
CREATE TABLE shop_commitments_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid,
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 schema_version integer NOT NULL CHECK(schema_version=1),
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 authority_scope text NOT NULL DEFAULT 'unbound-preview' CHECK(authority_scope='unbound-preview'),
 configuration jsonb NOT NULL CHECK(jsonb_typeof(configuration)='object'),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,previous_id) REFERENCES shop_commitments_revision(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE shop_commitments (
 shop_id uuid NOT NULL PRIMARY KEY REFERENCES shop(shop_id),
 current_revision_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 FOREIGN KEY(shop_id,current_revision_id) REFERENCES shop_commitments_revision(shop_id,id)
);
DO $commitments$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['shop_commitments','shop_commitments_revision'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $commitments$;
GRANT UPDATE(current_revision_id,version) ON shop_commitments TO app_user;
CREATE FUNCTION shop_commitments_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Commitment history protected' USING ERRCODE='42501'; END IF;
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NOT EXISTS(
  SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_type='user' AND actor_id=NEW.actor_id
  AND entity_type='shop_commitments_revision' AND entity_id=NEW.id AND action='shop-commitments.publish'
 ) THEN RAISE EXCEPTION 'Commitment provenance denied' USING ERRCODE='42501'; END IF;
 IF NEW.version>1 AND NOT EXISTS(SELECT 1 FROM shop_commitments_revision WHERE shop_id=NEW.shop_id AND id=NEW.previous_id AND version::bigint+1=NEW.version) THEN
  RAISE EXCEPTION 'Commitment predecessor denied' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='shop.commitments' AND lifecycle='active' AND schema_version=1 AND payload->>'baseVersion'=(NEW.version-1)::text AND (payload->>'baseRevisionId')::uuid IS NOT DISTINCT FROM NEW.previous_id) THEN
  RAISE EXCEPTION 'Commitment draft origin denied' USING ERRCODE='23514'; END IF;
 SELECT payload->'configuration' INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d IS DISTINCT FROM NEW.configuration OR NEW.authority_scope<>'unbound-preview' THEN
  RAISE EXCEPTION 'Commitment draft content denied' USING ERRCODE='23514'; END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_commitments_revision_guard() FROM PUBLIC;
CREATE TRIGGER shop_commitments_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON shop_commitments_revision FOR EACH ROW EXECUTE FUNCTION shop_commitments_revision_guard();
CREATE FUNCTION shop_commitments_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.shop_commitments_revision;
BEGIN
 SELECT * INTO r FROM shop_commitments_revision WHERE shop_id=NEW.shop_id AND id=NEW.current_revision_id;
 IF NOT FOUND OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Commitment pointer denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Commitment first publication denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_revision_id THEN RAISE EXCEPTION 'Commitment version denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_commitments_pointer_guard() FROM PUBLIC;
CREATE TRIGGER shop_commitments_pointer_guard BEFORE INSERT OR UPDATE ON shop_commitments FOR EACH ROW EXECUTE FUNCTION shop_commitments_pointer_guard();
-- The outer draft command marks promotion after the adapter writes the revision.
-- Verify that link at commit, without permitting an orphan authoritative revision.
CREATE FUNCTION shop_commitments_origin_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='shop.commitments' AND lifecycle='promoted' AND result_type='shop.commitments.revision' AND result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM shop_commitments WHERE shop_id=NEW.shop_id AND version>=NEW.version) THEN
  RAISE EXCEPTION 'Commitment promotion incomplete' USING ERRCODE='23514'; END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_commitments_origin_guard() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER shop_commitments_origin_guard AFTER INSERT ON shop_commitments_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shop_commitments_origin_guard();
