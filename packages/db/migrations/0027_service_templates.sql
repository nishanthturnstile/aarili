-- 1.1.2c / ST-03/04/07/10: additive, no production definitions or policies seeded.
-- Back up before non-disposable application. Retain schema/history on rollback.
CREATE TABLE service_template_revision (
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
CREATE TABLE service_template_availability (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, entry_id uuid NOT NULL, definition_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid,
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 operation text NOT NULL CHECK(operation IN ('definition','availability')),
 available boolean NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0),
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,entry_id,id), UNIQUE(shop_id,entry_id,version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,entry_id,definition_id) REFERENCES service_template_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,entry_id,previous_id) REFERENCES service_template_availability(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE service_template_entry (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), entry_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind='service-template'),
 code text NOT NULL CHECK(code ~ '^[a-z][a-z0-9-]{0,79}$'),
 current_change_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,entry_id), UNIQUE(shop_id,kind,code),
 FOREIGN KEY(shop_id,entry_id,current_change_id) REFERENCES service_template_availability(shop_id,entry_id,id)
);
ALTER TABLE service_template_revision ADD FOREIGN KEY(shop_id,entry_id) REFERENCES service_template_entry(shop_id,entry_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE service_template_reference (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), definition_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('service','piece','addon')), position integer NOT NULL CHECK(position>=0 AND position<33),
 target_entry_id uuid NOT NULL, target_revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,definition_id,role,position), UNIQUE(shop_id,definition_id,target_entry_id),
 FOREIGN KEY(shop_id,definition_id) REFERENCES service_template_revision(shop_id,id),
 FOREIGN KEY(shop_id,target_entry_id,target_revision_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id)
);
CREATE INDEX service_template_reference_target ON service_template_reference(shop_id,target_entry_id,target_revision_id);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['service_template_revision','service_template_entry','service_template_availability','service_template_reference'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(current_change_id,version) ON service_template_entry TO app_user;
CREATE FUNCTION service_template_definition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Service template history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF NOT FOUND OR d.workflow<>'service.templates' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR d.payload->>'operation'<>'definition' OR d.payload->'content' IS DISTINCT FROM NEW.content
 OR (d.payload->>'entryId')::uuid<>NEW.entry_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Service template definition provenance denied' USING ERRCODE='23514'; END IF;

 NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER service_template_definition_guard BEFORE INSERT OR UPDATE OR DELETE ON service_template_revision FOR EACH ROW EXECUTE FUNCTION service_template_definition_guard();
CREATE FUNCTION service_template_reference_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE source public.service_template_revision; target public.service_catalogue_revision; item jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Service template reference history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO source FROM service_template_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 SELECT * INTO target FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.target_entry_id AND id=NEW.target_revision_id;
 IF source.created_xid<>pg_current_xact_id() OR source.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Service template reference denied' USING ERRCODE='23514'; END IF;
 item=CASE WHEN NEW.role='service' THEN source.content->'service' ELSE source.content->(NEW.role||'s')->NEW.position END;
 IF item IS NULL OR (item->>'entryId')::uuid IS DISTINCT FROM NEW.target_entry_id OR (item->>'revisionId')::uuid IS DISTINCT FROM NEW.target_revision_id OR target.id IS NULL OR target.content->>'kind'<>NEW.role THEN RAISE EXCEPTION 'Form reference content or kind denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER service_template_reference_guard BEFORE INSERT OR UPDATE OR DELETE ON service_template_reference FOR EACH ROW EXECUTE FUNCTION service_template_reference_guard();
CREATE FUNCTION service_template_change_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; def public.service_template_revision; prior public.service_template_availability; prior_def public.service_template_revision;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Service template availability history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO def FROM service_template_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.definition_id;
 IF d.id IS NULL OR def.id IS NULL OR d.workflow<>'service.templates' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR (d.payload->>'entryId')::uuid IS DISTINCT FROM NEW.entry_id OR d.payload->>'operation' IS DISTINCT FROM NEW.operation
 OR d.payload->'content' IS DISTINCT FROM def.content OR (d.payload->>'available')::boolean IS DISTINCT FROM NEW.available
 OR d.payload->>'reason' IS DISTINCT FROM NEW.reason OR (d.payload->>'baseVersion')::integer IS DISTINCT FROM NEW.version-1
 OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_id=NEW.actor_id AND actor_type='user' AND action='service-templates.publish' AND entity_type='service_template_availability' AND entity_id=NEW.id) THEN
  RAISE EXCEPTION 'Service template change provenance denied' USING ERRCODE='23514'; END IF;
 IF NEW.version>1 THEN
  SELECT * INTO prior FROM service_template_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.previous_id;
  SELECT * INTO prior_def FROM service_template_revision WHERE shop_id=NEW.shop_id AND id=prior.definition_id;
  IF prior.version::bigint+1 IS DISTINCT FROM NEW.version OR def.content->>'kind' IS DISTINCT FROM prior_def.content->>'kind' OR def.content->>'code' IS DISTINCT FROM prior_def.content->>'code' THEN RAISE EXCEPTION 'Service template predecessor denied' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.operation='definition' THEN
  IF def.created_xid<>pg_current_xact_id() OR def.origin_draft_id<>NEW.origin_draft_id THEN RAISE EXCEPTION 'Service template definition link denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.version=1 OR prior.definition_id IS DISTINCT FROM NEW.definition_id OR prior.available=NEW.available THEN RAISE EXCEPTION 'Service template availability link denied' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER service_template_change_guard BEFORE INSERT OR UPDATE OR DELETE ON service_template_availability FOR EACH ROW EXECUTE FUNCTION service_template_change_guard();
CREATE FUNCTION service_template_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.service_template_availability; d public.service_template_revision;
BEGIN
 SELECT * INTO r FROM service_template_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.current_change_id;
 SELECT * INTO d FROM service_template_revision WHERE shop_id=NEW.shop_id AND id=r.definition_id;
 IF r.id IS NULL OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.content->>'kind'<>NEW.kind OR d.content->>'code'<>NEW.code THEN RAISE EXCEPTION 'Service template pointer denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Service template first publication denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.entry_id<>OLD.entry_id OR NEW.kind<>OLD.kind OR NEW.code<>OLD.code OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_change_id THEN RAISE EXCEPTION 'Service template version denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER service_template_pointer_guard BEFORE INSERT OR UPDATE ON service_template_entry FOR EACH ROW EXECUTE FUNCTION service_template_pointer_guard();
CREATE FUNCTION service_template_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.service_template_revision; expected integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='service.templates' AND lifecycle='promoted' AND result_type='service.templates.revision' AND result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM service_template_entry WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND version>=NEW.version) THEN RAISE EXCEPTION 'Service template promotion incomplete' USING ERRCODE='23514'; END IF;
 SELECT * INTO d FROM service_template_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 expected=1+jsonb_array_length(d.content->'pieces')+jsonb_array_length(d.content->'addons');
 IF (SELECT count(*) FROM service_template_reference WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>expected
 OR (SELECT count(*) FROM service_template_form WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>jsonb_array_length(d.content->'forms')
 OR (SELECT count(*) FROM service_template_item WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>(SELECT count(*) FROM jsonb_each(d.content) s CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN s.key IN ('materials','tasks','quality','instructions','confirmation','construction','decoration','method') THEN s.value ELSE '[]'::jsonb END) i)
 OR (SELECT count(*) FROM service_template_edge WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>(SELECT count(*) FROM jsonb_array_elements(d.content->'tasks') t CROSS JOIN LATERAL jsonb_array_elements(t->'predecessors') p)
 OR (SELECT count(*) FROM service_template_quality_task WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>(SELECT count(*) FROM jsonb_array_elements(d.content->'quality') q CROSS JOIN LATERAL jsonb_array_elements(q->'taskKeys') k)
 THEN RAISE EXCEPTION 'Service manifest children incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER service_template_commit_guard AFTER INSERT ON service_template_availability DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_template_commit_guard();
CREATE FUNCTION service_template_definition_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM service_template_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND definition_id=NEW.id AND operation='definition' AND origin_draft_id=NEW.origin_draft_id AND created_xid=NEW.created_xid) THEN RAISE EXCEPTION 'Service template definition publication incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER service_template_definition_commit_guard AFTER INSERT ON service_template_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_template_definition_commit_guard();
REVOKE ALL ON FUNCTION service_template_definition_commit_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION service_template_definition_guard(), service_template_reference_guard(), service_template_change_guard(), service_template_pointer_guard(), service_template_commit_guard() FROM PUBLIC;


-- Each manifest is itself the exact immutable operating-template revision. Its child
-- rows and edges freeze local stable keys; no current/latest alias resolves history.
CREATE TABLE service_template_form (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), definition_id uuid NOT NULL,
 position integer NOT NULL CHECK(position>=0 AND position<33), piece_key text,
 form_entry_id uuid NOT NULL, form_revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,definition_id,position),
 UNIQUE NULLS NOT DISTINCT(shop_id,definition_id,piece_key),
 FOREIGN KEY(shop_id,definition_id) REFERENCES service_template_revision(shop_id,id),
 FOREIGN KEY(shop_id,form_entry_id,form_revision_id) REFERENCES measurement_form_revision(shop_id,entry_id,id)
);
CREATE INDEX service_template_form_target ON service_template_form(shop_id,form_entry_id,form_revision_id);
CREATE TABLE service_template_item (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), definition_id uuid NOT NULL,
 section text NOT NULL CHECK(section IN ('materials','tasks','quality','instructions','confirmation','construction','decoration','method')),
 item_key text NOT NULL CHECK(item_key ~ '^[a-z][a-z0-9-]{0,79}$'), position integer NOT NULL CHECK(position>=0 AND position<100), content jsonb NOT NULL,
 PRIMARY KEY(shop_id,definition_id,item_key), UNIQUE(shop_id,definition_id,section,position),
 FOREIGN KEY(shop_id,definition_id) REFERENCES service_template_revision(shop_id,id)
);
CREATE TABLE service_template_edge (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), definition_id uuid NOT NULL, task_key text NOT NULL, predecessor_key text NOT NULL,
 PRIMARY KEY(shop_id,definition_id,task_key,predecessor_key), CHECK(task_key<>predecessor_key),
 FOREIGN KEY(shop_id,definition_id,task_key) REFERENCES service_template_item(shop_id,definition_id,item_key),
 FOREIGN KEY(shop_id,definition_id,predecessor_key) REFERENCES service_template_item(shop_id,definition_id,item_key)
);
CREATE TABLE service_template_quality_task (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), definition_id uuid NOT NULL, quality_key text NOT NULL, task_key text NOT NULL,
 PRIMARY KEY(shop_id,definition_id,quality_key,task_key),
 FOREIGN KEY(shop_id,definition_id,quality_key) REFERENCES service_template_item(shop_id,definition_id,item_key),
 FOREIGN KEY(shop_id,definition_id,task_key) REFERENCES service_template_item(shop_id,definition_id,item_key)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['service_template_form','service_template_item','service_template_edge','service_template_quality_task'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
CREATE FUNCTION service_template_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE source public.service_template_revision; item jsonb; predecessor jsonb; target public.measurement_form_revision;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Service template history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO source FROM service_template_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 IF source.created_xid<>pg_current_xact_id() OR source.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Service template child provenance denied' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='service_template_form' THEN
  item=source.content->'forms'->NEW.position;
  SELECT * INTO target FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.form_entry_id AND id=NEW.form_revision_id;
  IF item IS NULL OR (item->>'entryId')::uuid IS DISTINCT FROM NEW.form_entry_id OR (item->>'revisionId')::uuid IS DISTINCT FROM NEW.form_revision_id OR item->>'pieceKey' IS DISTINCT FROM NEW.piece_key OR target.content->'service' IS DISTINCT FROM source.content->'service' THEN RAISE EXCEPTION 'Manifest form reference denied' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='service_template_item' THEN
  IF source.content->NEW.section->NEW.position IS DISTINCT FROM NEW.content OR NEW.content->>'key' IS DISTINCT FROM NEW.item_key THEN RAISE EXCEPTION 'Template item mismatch' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='service_template_edge' THEN
  SELECT content INTO item FROM service_template_item WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id AND item_key=NEW.task_key AND section='tasks';
  SELECT content INTO predecessor FROM service_template_item WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id AND item_key=NEW.predecessor_key AND section='tasks';
  IF item IS NULL OR predecessor IS NULL OR NOT (item->'predecessors' ? NEW.predecessor_key) OR ((item->>'required')::boolean AND item->>'applicability'<>'not-applicable' AND (NOT (predecessor->>'required')::boolean OR predecessor->>'applicability'='not-applicable' OR EXISTS(SELECT 1 FROM jsonb_array_elements(source.content->'pieces') p WHERE p->>'key'=predecessor->'scope'->>'pieceKey' AND p->>'applicability'='not-applicable') OR EXISTS(SELECT 1 FROM jsonb_array_elements(source.content->'addons') a WHERE a->>'key'=predecessor->'scope'->>'addonKey' AND a->>'applicability'='not-applicable'))) THEN RAISE EXCEPTION 'Task edge denied' USING ERRCODE='23514'; END IF;
  IF EXISTS(WITH RECURSIVE walk(key) AS (SELECT NEW.predecessor_key UNION SELECT e.predecessor_key FROM service_template_edge e JOIN walk w ON e.task_key=w.key WHERE e.shop_id=NEW.shop_id AND e.definition_id=NEW.definition_id) SELECT 1 FROM walk WHERE key=NEW.task_key) THEN RAISE EXCEPTION 'Task cycle denied' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT content INTO item FROM service_template_item WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id AND item_key=NEW.quality_key AND section='quality';
  IF item IS NULL OR NOT (item->'taskKeys' ? NEW.task_key) OR NOT EXISTS(SELECT 1 FROM service_template_item WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id AND item_key=NEW.task_key AND section='tasks') THEN RAISE EXCEPTION 'Quality task link denied' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
DO $guards$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['service_template_form','service_template_item','service_template_edge','service_template_quality_task'] LOOP EXECUTE format('CREATE TRIGGER service_template_child_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION service_template_child_guard()',t); END LOOP; END $guards$;
REVOKE ALL ON FUNCTION service_template_child_guard() FROM PUBLIC;
