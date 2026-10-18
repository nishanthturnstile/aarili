-- 1.1.2b / ST-02/07/10: additive, no production definitions or policies seeded.
-- Back up before non-disposable application. Retain schema/history on rollback.
CREATE TABLE measurement_form_revision (
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
CREATE TABLE measurement_form_availability (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, entry_id uuid NOT NULL, definition_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid,
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 operation text NOT NULL CHECK(operation IN ('definition','availability')),
 available boolean NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0),
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,entry_id,id), UNIQUE(shop_id,entry_id,version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,entry_id,definition_id) REFERENCES measurement_form_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,entry_id,previous_id) REFERENCES measurement_form_availability(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE measurement_form_entry (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), entry_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind='measurement-form'),
 code text NOT NULL CHECK(code ~ '^[a-z][a-z0-9-]{0,79}$'),
 current_change_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,entry_id), UNIQUE(shop_id,kind,code),
 FOREIGN KEY(shop_id,entry_id,current_change_id) REFERENCES measurement_form_availability(shop_id,entry_id,id)
);
ALTER TABLE measurement_form_revision ADD FOREIGN KEY(shop_id,entry_id) REFERENCES measurement_form_entry(shop_id,entry_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE measurement_form_reference (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), definition_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('service','piece')), position integer NOT NULL CHECK(position=0),
 target_entry_id uuid NOT NULL, target_revision_id uuid NOT NULL, optional boolean NOT NULL,
 PRIMARY KEY(shop_id,definition_id,role,position), UNIQUE(shop_id,definition_id,target_entry_id),
 FOREIGN KEY(shop_id,definition_id) REFERENCES measurement_form_revision(shop_id,id),
 FOREIGN KEY(shop_id,target_entry_id,target_revision_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id),
 CHECK(NOT optional)
);
CREATE INDEX measurement_form_reference_target ON measurement_form_reference(shop_id,target_entry_id,target_revision_id);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['measurement_form_revision','measurement_form_entry','measurement_form_availability','measurement_form_reference'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(current_change_id,version) ON measurement_form_entry TO app_user;
CREATE FUNCTION measurement_form_definition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Measurement form history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF NOT FOUND OR d.workflow<>'measurement.forms' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR d.payload->>'operation'<>'definition' OR d.payload->'content' IS DISTINCT FROM NEW.content
 OR (d.payload->>'entryId')::uuid<>NEW.entry_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Measurement form definition provenance denied' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM measurement_form_revision r CROSS JOIN LATERAL jsonb_array_elements(r.content->'groups') og CROSS JOIN LATERAL jsonb_array_elements(og->'fields') oldf CROSS JOIN LATERAL jsonb_array_elements(NEW.content->'groups') ng CROSS JOIN LATERAL jsonb_array_elements(ng->'fields') nf WHERE r.shop_id=NEW.shop_id AND r.entry_id=NEW.entry_id AND ((oldf->>'id'=nf->>'id' AND (oldf->>'key' IS DISTINCT FROM nf->>'key' OR oldf->>'meaning' IS DISTINCT FROM nf->>'meaning' OR oldf->>'kind' IS DISTINCT FROM nf->>'kind')) OR (oldf->>'key'=nf->>'key' AND oldf->>'id'<>nf->>'id'))) THEN RAISE EXCEPTION 'Form field meaning requires new identity and key' USING ERRCODE='23514'; END IF;
 NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_form_definition_guard BEFORE INSERT OR UPDATE OR DELETE ON measurement_form_revision FOR EACH ROW EXECUTE FUNCTION measurement_form_definition_guard();
CREATE FUNCTION measurement_form_reference_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE source public.measurement_form_revision; target public.service_catalogue_revision; item jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Measurement form reference history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO source FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 SELECT * INTO target FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.target_entry_id AND id=NEW.target_revision_id;
 IF source.created_xid<>pg_current_xact_id() OR source.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Measurement form reference denied' USING ERRCODE='23514'; END IF;
 item=source.content->NEW.role;
 IF item IS NULL OR (item->>'entryId')::uuid IS DISTINCT FROM NEW.target_entry_id OR (item->>'revisionId')::uuid IS DISTINCT FROM NEW.target_revision_id OR target.id IS NULL OR target.content->>'kind'<>NEW.role THEN RAISE EXCEPTION 'Form reference content or kind denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_form_reference_guard BEFORE INSERT OR UPDATE OR DELETE ON measurement_form_reference FOR EACH ROW EXECUTE FUNCTION measurement_form_reference_guard();
CREATE FUNCTION measurement_form_change_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; def public.measurement_form_revision; prior public.measurement_form_availability; prior_def public.measurement_form_revision;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Measurement form availability history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO def FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.definition_id;
 IF d.id IS NULL OR def.id IS NULL OR d.workflow<>'measurement.forms' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR (d.payload->>'entryId')::uuid IS DISTINCT FROM NEW.entry_id OR d.payload->>'operation' IS DISTINCT FROM NEW.operation
 OR d.payload->'content' IS DISTINCT FROM def.content OR (d.payload->>'available')::boolean IS DISTINCT FROM NEW.available
 OR d.payload->>'reason' IS DISTINCT FROM NEW.reason OR (d.payload->>'baseVersion')::integer IS DISTINCT FROM NEW.version-1
 OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_id=NEW.actor_id AND actor_type='user' AND action='measurement-forms.publish' AND entity_type='measurement_form_availability' AND entity_id=NEW.id) THEN
  RAISE EXCEPTION 'Measurement form change provenance denied' USING ERRCODE='23514'; END IF;
 IF NEW.version>1 THEN
  SELECT * INTO prior FROM measurement_form_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.previous_id;
  SELECT * INTO prior_def FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND id=prior.definition_id;
  IF prior.version::bigint+1 IS DISTINCT FROM NEW.version OR def.content->>'kind' IS DISTINCT FROM prior_def.content->>'kind' OR def.content->>'code' IS DISTINCT FROM prior_def.content->>'code' THEN RAISE EXCEPTION 'Measurement form predecessor denied' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.operation='definition' THEN
  IF def.created_xid<>pg_current_xact_id() OR def.origin_draft_id<>NEW.origin_draft_id THEN RAISE EXCEPTION 'Measurement form definition link denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.version=1 OR prior.definition_id IS DISTINCT FROM NEW.definition_id OR prior.available=NEW.available THEN RAISE EXCEPTION 'Measurement form availability link denied' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_form_change_guard BEFORE INSERT OR UPDATE OR DELETE ON measurement_form_availability FOR EACH ROW EXECUTE FUNCTION measurement_form_change_guard();
CREATE FUNCTION measurement_form_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.measurement_form_availability; d public.measurement_form_revision;
BEGIN
 SELECT * INTO r FROM measurement_form_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.current_change_id;
 SELECT * INTO d FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND id=r.definition_id;
 IF r.id IS NULL OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.content->>'kind'<>NEW.kind OR d.content->>'code'<>NEW.code THEN RAISE EXCEPTION 'Measurement form pointer denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Measurement form first publication denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.entry_id<>OLD.entry_id OR NEW.kind<>OLD.kind OR NEW.code<>OLD.code OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_change_id THEN RAISE EXCEPTION 'Measurement form version denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_form_pointer_guard BEFORE INSERT OR UPDATE ON measurement_form_entry FOR EACH ROW EXECUTE FUNCTION measurement_form_pointer_guard();
CREATE FUNCTION measurement_form_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.measurement_form_revision; expected integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='measurement.forms' AND lifecycle='promoted' AND result_type='measurement.forms.revision' AND result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM measurement_form_entry WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND version>=NEW.version) THEN RAISE EXCEPTION 'Measurement form promotion incomplete' USING ERRCODE='23514'; END IF;
 SELECT * INTO d FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 IF (SELECT count(*) FROM measurement_form_illustration WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>(SELECT count(*) FROM jsonb_array_elements(d.content->'groups') g CROSS JOIN LATERAL jsonb_array_elements(g->'fields') f WHERE f->'illustration' IS NOT NULL AND f->'illustration'<>'null'::jsonb) THEN RAISE EXCEPTION 'Illustrations incomplete' USING ERRCODE='23514'; END IF;
 expected=1+CASE WHEN d.content->'piece'='null'::jsonb THEN 0 ELSE 1 END;
 IF (SELECT count(*) FROM measurement_form_reference WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>expected THEN RAISE EXCEPTION 'Measurement form references incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER measurement_form_commit_guard AFTER INSERT ON measurement_form_availability DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION measurement_form_commit_guard();
CREATE FUNCTION measurement_form_definition_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM measurement_form_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND definition_id=NEW.id AND operation='definition' AND origin_draft_id=NEW.origin_draft_id AND created_xid=NEW.created_xid) THEN RAISE EXCEPTION 'Measurement form definition publication incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER measurement_form_definition_commit_guard AFTER INSERT ON measurement_form_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION measurement_form_definition_commit_guard();
REVOKE ALL ON FUNCTION measurement_form_definition_commit_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION measurement_form_definition_guard(), measurement_form_reference_guard(), measurement_form_change_guard(), measurement_form_pointer_guard(), measurement_form_commit_guard() FROM PUBLIC;

-- Optional method images remain private; pin ready immutable accepted media, never wearer/fitting/minor images.
CREATE TABLE measurement_form_illustration (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),definition_id uuid NOT NULL,field_id uuid NOT NULL,
 asset_id uuid NOT NULL,asset_version integer NOT NULL CHECK(asset_version>0),
 PRIMARY KEY(shop_id,definition_id,field_id),
 FOREIGN KEY(shop_id,definition_id) REFERENCES measurement_form_revision(shop_id,id),
 FOREIGN KEY(shop_id,asset_id) REFERENCES media_asset(shop_id,id)
);
CREATE INDEX measurement_form_illustration_asset ON measurement_form_illustration(shop_id,asset_id);
ALTER TABLE measurement_form_illustration ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_form_illustration FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON measurement_form_illustration AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON measurement_form_illustration FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON measurement_form_illustration FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT ON measurement_form_illustration TO app_user;
CREATE FUNCTION measurement_form_illustration_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.measurement_form_revision;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Illustration history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 IF d.id IS NULL OR d.created_xid<>pg_current_xact_id() OR d.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.content->'groups') g CROSS JOIN LATERAL jsonb_array_elements(g->'fields') f WHERE (f->>'id')::uuid=NEW.field_id AND (f->'illustration'->>'assetId')::uuid=NEW.asset_id AND (f->'illustration'->>'version')::integer=NEW.asset_version) OR NOT EXISTS(SELECT 1 FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.asset_id AND version=NEW.asset_version AND status='ready' AND purpose='manual-pattern' AND NOT minor AND content_type IN ('image/png','image/jpeg','image/webp')) THEN RAISE EXCEPTION 'Illustration reference denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_form_illustration_guard BEFORE INSERT OR UPDATE OR DELETE ON measurement_form_illustration FOR EACH ROW EXECUTE FUNCTION measurement_form_illustration_guard();
REVOKE ALL ON FUNCTION measurement_form_illustration_guard() FROM PUBLIC;
