-- 1.3.1a / #146 / DS-A1-01–06: additive, no production definitions or policies seeded.
-- Back up before non-disposable application. Retain schema/history on rollback.
CREATE TABLE design_config_revision (
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
CREATE TABLE design_config_availability (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, entry_id uuid NOT NULL, definition_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid,
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 operation text NOT NULL CHECK(operation IN ('definition','availability')),
 available boolean NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0),
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,entry_id,id), UNIQUE(shop_id,entry_id,version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,entry_id,definition_id) REFERENCES design_config_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,entry_id,previous_id) REFERENCES design_config_availability(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE design_config_entry (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), entry_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('choice','profile')),
 code text NOT NULL CHECK(code ~ '^[a-z][a-z0-9-]{0,79}$'),
 current_change_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,entry_id), UNIQUE(shop_id,kind,code),
 FOREIGN KEY(shop_id,entry_id,current_change_id) REFERENCES design_config_availability(shop_id,entry_id,id)
);
ALTER TABLE design_config_revision ADD FOREIGN KEY(shop_id,entry_id) REFERENCES design_config_entry(shop_id,entry_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE design_config_reference (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), definition_id uuid NOT NULL,
 role text NOT NULL CHECK(role='category'), position integer NOT NULL CHECK(position>=0 AND position<32),
 target_entry_id uuid NOT NULL, target_revision_id uuid NOT NULL, optional boolean NOT NULL,
 PRIMARY KEY(shop_id,definition_id,role,position), UNIQUE(shop_id,definition_id,target_entry_id),
 FOREIGN KEY(shop_id,definition_id) REFERENCES design_config_revision(shop_id,id),
 FOREIGN KEY(shop_id,target_entry_id,target_revision_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id),
 CHECK(role='category' AND position=0 AND NOT optional)
);
CREATE INDEX design_config_reference_target ON design_config_reference(shop_id,target_entry_id,target_revision_id);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['design_config_revision','design_config_entry','design_config_availability','design_config_reference'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(current_change_id,version) ON design_config_entry TO app_user;
CREATE FUNCTION design_config_definition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Design configuration history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF NOT FOUND OR d.workflow<>'design.choices' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR d.payload->>'operation'<>'definition' OR d.payload->'content' IS DISTINCT FROM NEW.content
 OR (d.payload->>'entryId')::uuid<>NEW.entry_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Design configuration definition provenance denied' USING ERRCODE='23514'; END IF;
 NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER design_config_definition_guard BEFORE INSERT OR UPDATE OR DELETE ON design_config_revision FOR EACH ROW EXECUTE FUNCTION design_config_definition_guard();
CREATE FUNCTION design_config_reference_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE source public.design_config_revision; target public.service_catalogue_revision; item jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Design reference history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO source FROM design_config_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 SELECT * INTO target FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.target_entry_id AND id=NEW.target_revision_id;
 item=source.content->'category';
 IF source.id IS NULL OR source.created_xid<>pg_current_xact_id() OR source.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR target.content->>'kind' IS DISTINCT FROM 'category' OR item IS NULL OR (item->>'entryId')::uuid IS DISTINCT FROM NEW.target_entry_id OR (item->>'revisionId')::uuid IS DISTINCT FROM NEW.target_revision_id THEN RAISE EXCEPTION 'Design category reference denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER design_config_reference_guard BEFORE INSERT OR UPDATE OR DELETE ON design_config_reference FOR EACH ROW EXECUTE FUNCTION design_config_reference_guard();
CREATE FUNCTION design_config_change_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; def public.design_config_revision; prior public.design_config_availability; prior_def public.design_config_revision;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Design configuration availability history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO def FROM design_config_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.definition_id;
 IF d.id IS NULL OR def.id IS NULL OR d.workflow<>'design.choices' OR d.lifecycle<>'active' OR d.schema_version<>1
 OR (d.payload->>'entryId')::uuid IS DISTINCT FROM NEW.entry_id OR d.payload->>'operation' IS DISTINCT FROM NEW.operation
 OR d.payload->'content' IS DISTINCT FROM def.content OR (d.payload->>'available')::boolean IS DISTINCT FROM NEW.available
 OR d.payload->>'reason' IS DISTINCT FROM NEW.reason OR (d.payload->>'baseVersion')::integer IS DISTINCT FROM NEW.version-1
 OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_id=NEW.actor_id AND actor_type='user' AND action='design-choices.publish' AND entity_type='design_config_availability' AND entity_id=NEW.id) THEN
  RAISE EXCEPTION 'Design configuration change provenance denied' USING ERRCODE='23514'; END IF;
 IF NEW.version>1 THEN
  SELECT * INTO prior FROM design_config_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.previous_id;
  SELECT * INTO prior_def FROM design_config_revision WHERE shop_id=NEW.shop_id AND id=prior.definition_id;
  IF prior.version::bigint+1 IS DISTINCT FROM NEW.version OR def.content->>'kind' IS DISTINCT FROM prior_def.content->>'kind' OR def.content->>'code' IS DISTINCT FROM prior_def.content->>'code' THEN RAISE EXCEPTION 'Design configuration predecessor denied' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.version>1 AND def.content->>'kind'='choice' AND (def.content->'dimension' IS DISTINCT FROM prior_def.content->'dimension' OR def.content->'meaning' IS DISTINCT FROM prior_def.content->'meaning' OR def.content->'none' IS DISTINCT FROM prior_def.content->'none' OR def.content->'category'->>'entryId' IS DISTINCT FROM prior_def.content->'category'->>'entryId') THEN RAISE EXCEPTION 'Choice meaning immutable; use a new identity' USING ERRCODE='23514'; END IF;
 IF NEW.operation='definition' THEN
  IF def.created_xid<>pg_current_xact_id() OR def.origin_draft_id<>NEW.origin_draft_id THEN RAISE EXCEPTION 'Design configuration definition link denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.version=1 OR prior.definition_id IS DISTINCT FROM NEW.definition_id OR prior.available=NEW.available THEN RAISE EXCEPTION 'Design configuration availability link denied' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER design_config_change_guard BEFORE INSERT OR UPDATE OR DELETE ON design_config_availability FOR EACH ROW EXECUTE FUNCTION design_config_change_guard();
CREATE FUNCTION design_config_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.design_config_availability; d public.design_config_revision;
BEGIN
 SELECT * INTO r FROM design_config_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.current_change_id;
 SELECT * INTO d FROM design_config_revision WHERE shop_id=NEW.shop_id AND id=r.definition_id;
 IF r.id IS NULL OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.content->>'kind'<>NEW.kind OR d.content->>'code'<>NEW.code THEN RAISE EXCEPTION 'Design configuration pointer denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Design configuration first publication denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.entry_id<>OLD.entry_id OR NEW.kind<>OLD.kind OR NEW.code<>OLD.code OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_change_id THEN RAISE EXCEPTION 'Design configuration version denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER design_config_pointer_guard BEFORE INSERT OR UPDATE ON design_config_entry FOR EACH ROW EXECUTE FUNCTION design_config_pointer_guard();
CREATE FUNCTION design_config_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.design_config_revision; expected integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='design.choices' AND lifecycle='promoted' AND result_type='design.choices.revision' AND result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM design_config_entry WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND version>=NEW.version) THEN RAISE EXCEPTION 'Design configuration promotion incomplete' USING ERRCODE='23514'; END IF;
 SELECT * INTO d FROM design_config_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 expected=1;
 IF (SELECT count(*) FROM design_config_reference WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id)<>expected THEN RAISE EXCEPTION 'Design configuration references incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER design_config_commit_guard AFTER INSERT ON design_config_availability DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION design_config_commit_guard();
CREATE FUNCTION design_config_definition_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM design_config_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND definition_id=NEW.id AND operation='definition' AND origin_draft_id=NEW.origin_draft_id AND created_xid=NEW.created_xid) THEN RAISE EXCEPTION 'Design configuration definition publication incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER design_config_definition_commit_guard AFTER INSERT ON design_config_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION design_config_definition_commit_guard();
REVOKE ALL ON FUNCTION design_config_definition_commit_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION design_config_definition_guard(), design_config_reference_guard(), design_config_change_guard(), design_config_pointer_guard(), design_config_commit_guard() FROM PUBLIC;


CREATE TABLE design_manifest_reference (
 shop_id uuid NOT NULL,definition_id uuid NOT NULL,entry_id uuid NOT NULL,revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,definition_id),UNIQUE(shop_id,definition_id,revision_id),
 FOREIGN KEY(shop_id,definition_id) REFERENCES design_config_revision(shop_id,id),
 FOREIGN KEY(shop_id,entry_id,revision_id) REFERENCES service_template_revision(shop_id,entry_id,id)
);
CREATE TABLE design_question (
 shop_id uuid NOT NULL,definition_id uuid NOT NULL,id uuid NOT NULL,position integer NOT NULL CHECK(position>=0 AND position<40),content jsonb NOT NULL,
 PRIMARY KEY(shop_id,definition_id,id),UNIQUE(shop_id,definition_id,position),
 FOREIGN KEY(shop_id,definition_id) REFERENCES design_config_revision(shop_id,id)
);
CREATE INDEX design_question_identity ON design_question(shop_id,id);
CREATE TABLE design_choice_link (
 shop_id uuid NOT NULL,definition_id uuid NOT NULL,question_id uuid NOT NULL,position integer NOT NULL CHECK(position>=0 AND position<30),entry_id uuid NOT NULL,revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,definition_id,question_id,position),UNIQUE(shop_id,definition_id,question_id,entry_id,revision_id),
 FOREIGN KEY(shop_id,definition_id,question_id) REFERENCES design_question(shop_id,definition_id,id),
 FOREIGN KEY(shop_id,entry_id,revision_id) REFERENCES design_config_revision(shop_id,entry_id,id)
);
CREATE TABLE design_question_dependency (
 shop_id uuid NOT NULL,definition_id uuid NOT NULL,question_id uuid NOT NULL,position integer NOT NULL CHECK(position>=0 AND position<8),parent_id uuid NOT NULL,entry_id uuid NOT NULL,revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,definition_id,question_id,position),CHECK(question_id<>parent_id),
 FOREIGN KEY(shop_id,definition_id,question_id) REFERENCES design_question(shop_id,definition_id,id),
 FOREIGN KEY(shop_id,definition_id,parent_id,entry_id,revision_id) REFERENCES design_choice_link(shop_id,definition_id,question_id,entry_id,revision_id)
);
CREATE TABLE design_template_link (
 shop_id uuid NOT NULL,definition_id uuid NOT NULL,position integer NOT NULL CHECK(position>=0 AND position<60),manifest_id uuid NOT NULL,item_key text NOT NULL,
 PRIMARY KEY(shop_id,definition_id,position),UNIQUE(shop_id,definition_id,item_key),
 FOREIGN KEY(shop_id,definition_id,manifest_id) REFERENCES design_manifest_reference(shop_id,definition_id,revision_id),
 FOREIGN KEY(shop_id,manifest_id,item_key) REFERENCES service_template_item(shop_id,definition_id,item_key)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['design_manifest_reference','design_question','design_choice_link','design_question_dependency','design_template_link'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
CREATE FUNCTION design_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE source public.design_config_revision; target public.design_config_revision; q jsonb; item jsonb; prior jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Design child history protected' USING ERRCODE='42501'; END IF;
 SELECT * INTO source FROM design_config_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 IF source.id IS NULL OR source.created_xid<>pg_current_xact_id() OR source.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR source.content->>'kind'<>'profile' THEN RAISE EXCEPTION 'Design child provenance denied' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='design_manifest_reference' THEN
  IF (source.content->'manifest'->>'entryId')::uuid IS DISTINCT FROM NEW.entry_id OR (source.content->'manifest'->>'revisionId')::uuid IS DISTINCT FROM NEW.revision_id THEN RAISE EXCEPTION 'Manifest mismatch' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='design_question' THEN
  IF source.content->'questions'->NEW.position IS DISTINCT FROM NEW.content OR (NEW.content->>'id')::uuid IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'Question mismatch' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('designChoices:'||NEW.shop_id::text,0));
  FOR prior IN SELECT content FROM design_question WHERE shop_id=NEW.shop_id AND id=NEW.id LOOP
   IF prior->'key' IS DISTINCT FROM NEW.content->'key' OR prior->'kind' IS DISTINCT FROM NEW.content->'kind' OR prior->'meaning' IS DISTINCT FROM NEW.content->'meaning' OR prior->'units' IS DISTINCT FROM NEW.content->'units' THEN RAISE EXCEPTION 'Question meaning changed' USING ERRCODE='23514'; END IF;
  END LOOP;
 ELSIF TG_TABLE_NAME='design_template_link' THEN
  IF source.content->'templateKeys'->>NEW.position IS DISTINCT FROM NEW.item_key THEN RAISE EXCEPTION 'Template item mismatch' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT content INTO q FROM design_question WHERE shop_id=NEW.shop_id AND definition_id=NEW.definition_id AND id=NEW.question_id;
  IF TG_TABLE_NAME='design_choice_link' THEN
   item=q->'choices'->NEW.position;
   SELECT * INTO target FROM design_config_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id AND id=NEW.revision_id;
   IF target.content->>'kind' IS DISTINCT FROM 'choice' OR target.content->>'dimension' IS DISTINCT FROM q->>'key' OR target.content->'category' IS DISTINCT FROM source.content->'category' THEN RAISE EXCEPTION 'Choice applicability denied' USING ERRCODE='23514'; END IF;
  ELSE
   item=q->'when'->NEW.position;
   IF (item->>'questionId')::uuid IS DISTINCT FROM NEW.parent_id THEN RAISE EXCEPTION 'Dependency parent mismatch' USING ERRCODE='23514'; END IF;
   item=item->'choice';
   IF EXISTS(WITH RECURSIVE walk(id) AS (SELECT NEW.parent_id UNION SELECT e.parent_id FROM design_question_dependency e JOIN walk w ON e.question_id=w.id WHERE e.shop_id=NEW.shop_id AND e.definition_id=NEW.definition_id) SELECT 1 FROM walk WHERE id=NEW.question_id) THEN RAISE EXCEPTION 'Question dependency cycle' USING ERRCODE='23514'; END IF;
  END IF;
  IF item IS NULL OR (item->>'entryId')::uuid IS DISTINCT FROM NEW.entry_id OR (item->>'revisionId')::uuid IS DISTINCT FROM NEW.revision_id THEN RAISE EXCEPTION 'Choice reference mismatch' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
DO $guards$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['design_manifest_reference','design_question','design_choice_link','design_question_dependency','design_template_link'] LOOP EXECUTE format('CREATE TRIGGER design_child_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION design_child_guard()',t);END LOOP;END $guards$;
CREATE FUNCTION design_profile_complete_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.design_config_revision; q jsonb; choices integer:=0; dependencies integer:=0;
BEGIN
 SELECT * INTO d FROM design_config_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 IF d.content->>'kind'='profile' THEN
  FOR q IN SELECT value FROM jsonb_array_elements(d.content->'questions') LOOP choices=choices+jsonb_array_length(q->'choices');dependencies=dependencies+jsonb_array_length(q->'when');END LOOP;
  IF (SELECT count(*) FROM design_manifest_reference WHERE shop_id=NEW.shop_id AND definition_id=d.id)<>1 OR (SELECT count(*) FROM design_question WHERE shop_id=NEW.shop_id AND definition_id=d.id)<>jsonb_array_length(d.content->'questions') OR (SELECT count(*) FROM design_choice_link WHERE shop_id=NEW.shop_id AND definition_id=d.id)<>choices OR (SELECT count(*) FROM design_question_dependency WHERE shop_id=NEW.shop_id AND definition_id=d.id)<>dependencies OR (SELECT count(*) FROM design_template_link WHERE shop_id=NEW.shop_id AND definition_id=d.id)<>jsonb_array_length(d.content->'templateKeys') THEN RAISE EXCEPTION 'Design profile references incomplete' USING ERRCODE='23514'; END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER design_profile_complete_guard AFTER INSERT ON design_config_availability DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION design_profile_complete_guard();
REVOKE ALL ON FUNCTION design_child_guard(),design_profile_complete_guard() FROM PUBLIC;
