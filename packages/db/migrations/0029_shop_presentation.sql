-- 1.1.2d / ST-05/06/07/10-12. No business work or production policy is seeded.
-- Retain both tables and immutable history on application rollback.
CREATE TABLE shop_presentation_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid,
 mode text NOT NULL CHECK(mode IN ('simple','detailed')),
 reason text NOT NULL CHECK(length(trim(reason))>0 AND length(reason)<=1000),
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,previous_id) REFERENCES shop_presentation_revision(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE shop_presentation (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), current_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), PRIMARY KEY(shop_id),
 FOREIGN KEY(shop_id,current_id) REFERENCES shop_presentation_revision(shop_id,id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['shop_presentation_revision','shop_presentation'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(current_id,version) ON shop_presentation TO app_user;
CREATE FUNCTION shop_presentation_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; prior public.shop_presentation_revision;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Presentation history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.id IS NULL OR d.workflow<>'shop.presentation' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR d.payload->>'mode' IS DISTINCT FROM NEW.mode OR d.payload->>'reason' IS DISTINCT FROM NEW.reason
 OR (d.payload->>'baseVersion')::integer IS DISTINCT FROM NEW.version-1
 OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_id=NEW.actor_id AND actor_type='user' AND action='shop-presentation.publish' AND entity_type='shop_presentation_revision' AND entity_id=NEW.id) THEN
 RAISE EXCEPTION 'Presentation provenance denied' USING ERRCODE='23514'; END IF;
 IF NEW.version>1 THEN
  SELECT * INTO prior FROM shop_presentation_revision WHERE shop_id=NEW.shop_id AND id=NEW.previous_id;
  IF prior.version::bigint+1 IS DISTINCT FROM NEW.version OR prior.mode=NEW.mode THEN RAISE EXCEPTION 'Presentation predecessor denied' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER shop_presentation_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON shop_presentation_revision FOR EACH ROW EXECUTE FUNCTION shop_presentation_revision_guard();
CREATE FUNCTION shop_presentation_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.shop_presentation_revision;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Presentation pointer protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM shop_presentation_revision WHERE shop_id=NEW.shop_id AND id=NEW.current_id;
 IF r.id IS NULL OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Presentation pointer denied' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Presentation first version denied' USING ERRCODE='23514'; END IF;
 ELSIF NEW.shop_id<>OLD.shop_id OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_id THEN
  RAISE EXCEPTION 'Presentation pointer version denied' USING ERRCODE='23514';
 END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER shop_presentation_pointer_guard BEFORE INSERT OR UPDATE OR DELETE ON shop_presentation FOR EACH ROW EXECUTE FUNCTION shop_presentation_pointer_guard();
CREATE FUNCTION shop_presentation_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='shop.presentation' AND lifecycle='promoted' AND result_type='shop.presentation.revision' AND result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM shop_presentation WHERE shop_id=NEW.shop_id AND version>=NEW.version) THEN RAISE EXCEPTION 'Presentation promotion incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER shop_presentation_commit_guard AFTER INSERT ON shop_presentation_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shop_presentation_commit_guard();
REVOKE ALL ON FUNCTION shop_presentation_revision_guard(),shop_presentation_pointer_guard(),shop_presentation_commit_guard() FROM PUBLIC;
