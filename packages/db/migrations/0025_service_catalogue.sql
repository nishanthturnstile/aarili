-- 1.1.2a / ST-01/07/10: additive, no production definitions or policies seeded.
-- Back up before non-disposable application. Retain schema/history on rollback.
CREATE TABLE service_catalogue_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, entry_id uuid NOT NULL,
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
 authority text NOT NULL CHECK(authority IN ('owner-proposal','synthetic-fixture')),
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'), search_keys text[] NOT NULL,
 actor_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,entry_id,id), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id)
);
CREATE TABLE service_catalogue_availability (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, entry_id uuid NOT NULL, definition_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid,
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 operation text NOT NULL CHECK(operation IN ('definition','availability')),
 available boolean NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0),
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,entry_id,id), UNIQUE(shop_id,entry_id,version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,entry_id,definition_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,entry_id,previous_id) REFERENCES service_catalogue_availability(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE service_catalogue_entry (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), entry_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('category','subcategory','service','piece','addon')),
 code text NOT NULL CHECK(code ~ '^[a-z][a-z0-9-]{0,79}$'),
 current_change_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,entry_id), UNIQUE(shop_id,kind,code),
 FOREIGN KEY(shop_id,entry_id,current_change_id) REFERENCES service_catalogue_availability(shop_id,entry_id,id)
);
ALTER TABLE service_catalogue_revision ADD FOREIGN KEY(shop_id,entry_id) REFERENCES service_catalogue_entry(shop_id,entry_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE service_catalogue_reference (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), definition_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('parent','piece','addon')), position integer NOT NULL CHECK(position>=0 AND position<32),
 target_entry_id uuid NOT NULL, target_revision_id uuid NOT NULL, optional boolean NOT NULL,
 PRIMARY KEY(shop_id,definition_id,role,position), UNIQUE(shop_id,definition_id,target_entry_id),
 FOREIGN KEY(shop_id,definition_id) REFERENCES service_catalogue_revision(shop_id,id),
 FOREIGN KEY(shop_id,target_entry_id,target_revision_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id),
 CHECK(role<>'parent' OR (position=0 AND NOT optional))
);
CREATE INDEX service_catalogue_reference_target ON service_catalogue_reference(shop_id,target_entry_id,target_revision_id);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['service_catalogue_revision','service_catalogue_entry','service_catalogue_availability','service_catalogue_reference'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(current_change_id,version) ON service_catalogue_entry TO app_user;
CREATE FUNCTION service_catalogue_definition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Catalogue history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF NOT FOUND OR d.workflow<>'service.catalogue' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR d.payload->>'operation'<>'definition' OR d.payload->'content' IS DISTINCT FROM NEW.content
 OR (d.payload->>'entryId')::uuid<>NEW.entry_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Catalogue definition provenance denied' USING ERRCODE='23514'; END IF;
 NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER service_catalogue_definition_guard BEFORE INSERT OR UPDATE OR DELETE ON service_catalogue_revision FOR EACH ROW EXECUTE FUNCTION service_catalogue_definition_guard();
CREATE FUNCTION service_catalogue_reference_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE source public.service_catalogue_revision; target public.service_catalogue_revision; item jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Catalogue reference history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO source FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 SELECT * INTO target FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.target_entry_id AND id=NEW.target_revision_id;
 IF source.created_xid<>pg_current_xact_id() OR source.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR source.entry_id=NEW.target_entry_id THEN RAISE EXCEPTION 'Catalogue reference denied' USING ERRCODE='23514'; END IF;
 item=CASE NEW.role WHEN 'parent' THEN source.content->'parent' WHEN 'piece' THEN source.content->'pieces'->NEW.position ELSE source.content->'addons'->NEW.position END;
 IF item IS NULL OR (item->>'entryId')::uuid IS DISTINCT FROM NEW.target_entry_id OR (item->>'revisionId')::uuid IS DISTINCT FROM NEW.target_revision_id
 OR (NEW.role<>'parent' AND (item->>'optional')::boolean IS DISTINCT FROM NEW.optional) THEN RAISE EXCEPTION 'Catalogue reference content denied' USING ERRCODE='23514'; END IF;
 IF (NEW.role='parent' AND NOT ((source.content->>'kind'='subcategory' AND target.content->>'kind'='category') OR (source.content->>'kind'='service' AND target.content->>'kind' IN ('category','subcategory'))))
 OR (NEW.role<>'parent' AND (source.content->>'kind'<>'service' OR target.content->>'kind'<>NEW.role)) THEN RAISE EXCEPTION 'Catalogue reference kind denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER service_catalogue_reference_guard BEFORE INSERT OR UPDATE OR DELETE ON service_catalogue_reference FOR EACH ROW EXECUTE FUNCTION service_catalogue_reference_guard();
CREATE FUNCTION service_catalogue_change_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; def public.service_catalogue_revision; prior public.service_catalogue_availability; prior_def public.service_catalogue_revision;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Catalogue availability history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO def FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.definition_id;
 IF d.id IS NULL OR def.id IS NULL OR d.workflow<>'service.catalogue' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR (d.payload->>'entryId')::uuid IS DISTINCT FROM NEW.entry_id OR d.payload->>'operation' IS DISTINCT FROM NEW.operation
 OR d.payload->'content' IS DISTINCT FROM def.content OR (d.payload->>'available')::boolean IS DISTINCT FROM NEW.available
 OR d.payload->>'reason' IS DISTINCT FROM NEW.reason OR (d.payload->>'baseVersion')::integer IS DISTINCT FROM NEW.version-1
 OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_id=NEW.actor_id AND actor_type='user' AND action='service-catalogue.publish' AND entity_type='service_catalogue_availability' AND entity_id=NEW.id) THEN
  RAISE EXCEPTION 'Catalogue change provenance denied' USING ERRCODE='23514'; END IF;
 IF NEW.version>1 THEN
  SELECT * INTO prior FROM service_catalogue_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.previous_id;
  SELECT * INTO prior_def FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND id=prior.definition_id;
  IF prior.version::bigint+1 IS DISTINCT FROM NEW.version OR def.content->>'kind' IS DISTINCT FROM prior_def.content->>'kind' OR def.content->>'code' IS DISTINCT FROM prior_def.content->>'code' THEN RAISE EXCEPTION 'Catalogue predecessor denied' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.operation='definition' THEN
  IF def.created_xid<>pg_current_xact_id() OR def.origin_draft_id<>NEW.origin_draft_id THEN RAISE EXCEPTION 'Catalogue definition link denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.version=1 OR prior.definition_id IS DISTINCT FROM NEW.definition_id OR prior.available=NEW.available THEN RAISE EXCEPTION 'Catalogue availability link denied' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER service_catalogue_change_guard BEFORE INSERT OR UPDATE OR DELETE ON service_catalogue_availability FOR EACH ROW EXECUTE FUNCTION service_catalogue_change_guard();
CREATE FUNCTION service_catalogue_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.service_catalogue_availability; d public.service_catalogue_revision;
BEGIN
 SELECT * INTO r FROM service_catalogue_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.current_change_id;
 SELECT * INTO d FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND id=r.definition_id;
 IF r.id IS NULL OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.content->>'kind'<>NEW.kind OR d.content->>'code'<>NEW.code THEN RAISE EXCEPTION 'Catalogue pointer denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Catalogue first publication denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.entry_id<>OLD.entry_id OR NEW.kind<>OLD.kind OR NEW.code<>OLD.code OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_change_id THEN RAISE EXCEPTION 'Catalogue version denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER service_catalogue_pointer_guard BEFORE INSERT OR UPDATE ON service_catalogue_entry FOR EACH ROW EXECUTE FUNCTION service_catalogue_pointer_guard();
CREATE FUNCTION service_catalogue_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.service_catalogue_revision; expected integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='service.catalogue' AND lifecycle='promoted' AND result_type='service.catalogue.revision' AND result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM service_catalogue_entry WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND version>=NEW.version) THEN RAISE EXCEPTION 'Catalogue promotion incomplete' USING ERRCODE='23514'; END IF;
 SELECT * INTO d FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 expected=jsonb_array_length(d.content->'pieces')+jsonb_array_length(d.content->'addons')+CASE WHEN d.content->'parent'='null'::jsonb THEN 0 ELSE 1 END;
 IF (SELECT count(*) FROM service_catalogue_reference WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>expected THEN RAISE EXCEPTION 'Catalogue references incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER service_catalogue_commit_guard AFTER INSERT ON service_catalogue_availability DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_catalogue_commit_guard();
CREATE FUNCTION service_catalogue_definition_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM service_catalogue_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND definition_id=NEW.id AND operation='definition' AND origin_draft_id=NEW.origin_draft_id AND created_xid=NEW.created_xid) THEN RAISE EXCEPTION 'Catalogue definition publication incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER service_catalogue_definition_commit_guard AFTER INSERT ON service_catalogue_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_catalogue_definition_commit_guard();
REVOKE ALL ON FUNCTION service_catalogue_definition_commit_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION service_catalogue_definition_guard(), service_catalogue_reference_guard(), service_catalogue_change_guard(), service_catalogue_pointer_guard(), service_catalogue_commit_guard() FROM PUBLIC;
