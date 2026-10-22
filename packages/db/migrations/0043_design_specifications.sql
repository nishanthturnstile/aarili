-- #147 / 1.3.1b. Additive; no policy seeds or accepted snapshot rewrites.
-- Retain new schema and drafts on compatible rollback. Back up non-disposable DBs.
CREATE TABLE design_spec_scope (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), order_id uuid NOT NULL, scope_key uuid NOT NULL,
 piece_id uuid, kind text NOT NULL CHECK(kind IN ('order','piece')),
 customer_id uuid NOT NULL, wearer_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), latest_saved_id uuid NOT NULL, current_id uuid, event_id uuid NOT NULL,
 PRIMARY KEY(shop_id,order_id,scope_key), UNIQUE NULLS NOT DISTINCT(shop_id,order_id,piece_id),
 CHECK((kind='order' AND piece_id IS NULL AND scope_key=order_id) OR (kind='piece' AND piece_id IS NOT NULL AND scope_key=piece_id)),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id)
);
CREATE TABLE design_spec_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, order_id uuid NOT NULL, scope_key uuid NOT NULL,
 scope_version integer NOT NULL CHECK(scope_version>0), operation text NOT NULL CHECK(operation IN ('save','select')),
 saved_id uuid NOT NULL, current_id uuid, previous_saved_id uuid, previous_current_id uuid,
 actor_id uuid NOT NULL, origin_draft_id uuid NOT NULL, audit_id uuid NOT NULL, command_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,order_id,scope_key,scope_version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,order_id,scope_key) REFERENCES design_spec_scope(shop_id,order_id,scope_key) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE design_spec_version (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, order_id uuid NOT NULL, scope_key uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid, event_id uuid NOT NULL,
 snapshot_digest text NOT NULL CHECK(snapshot_digest ~ '^[a-f0-9]{64}$'),
 profile_entry_id uuid NOT NULL, profile_id uuid NOT NULL,
 frozen jsonb NOT NULL CHECK(jsonb_typeof(frozen)='object' AND octet_length(frozen::text)<=262144),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'), reuse jsonb,reuse_version_id uuid,
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,order_id,scope_key,id), UNIQUE(shop_id,order_id,scope_key,version),
 FOREIGN KEY(shop_id,event_id) REFERENCES design_spec_event(shop_id,id),
 FOREIGN KEY(shop_id,order_id,scope_key,previous_id) REFERENCES design_spec_version(shop_id,order_id,scope_key,id),
 FOREIGN KEY(shop_id,profile_entry_id,profile_id) REFERENCES design_config_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,reuse_version_id) REFERENCES design_spec_version(shop_id,id),
 CHECK((reuse IS NULL)=(reuse_version_id IS NULL)),
 UNIQUE(shop_id,id,profile_id), CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE design_spec_answer (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), version_id uuid NOT NULL, profile_id uuid NOT NULL, question_id uuid NOT NULL,
 position integer NOT NULL CHECK(position>=0 AND position<40), state text NOT NULL CHECK(state IN ('unknown','selected','not-applicable')),
 choice_entry_id uuid,choice_id uuid,
 PRIMARY KEY(shop_id,version_id,question_id), UNIQUE(shop_id,version_id,position),
 FOREIGN KEY(shop_id,version_id,profile_id) REFERENCES design_spec_version(shop_id,id,profile_id),
 FOREIGN KEY(shop_id,profile_id,question_id) REFERENCES design_question(shop_id,definition_id,id),
 FOREIGN KEY(shop_id,profile_id,question_id,choice_entry_id,choice_id) REFERENCES design_choice_link(shop_id,definition_id,question_id,entry_id,revision_id),
 CHECK((choice_id IS NULL)=(choice_entry_id IS NULL)),CHECK(state='selected' OR choice_id IS NULL)
);
CREATE TABLE design_spec_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),event_id uuid NOT NULL,
 answers jsonb,reason text,redaction_audit_id uuid,redacted_at timestamptz,
 PRIMARY KEY(shop_id,event_id), FOREIGN KEY(shop_id,event_id) REFERENCES design_spec_event(shop_id,id),
 FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL AND redaction_audit_id IS NULL AND reason IS NOT NULL) OR (redacted_at IS NOT NULL AND redaction_audit_id IS NOT NULL AND reason IS NULL AND answers IS NULL))
);
-- Exact response payloads live in the same audited privacy boundary, rather than
-- in idempotency JSON. This preserves a lost save response after a later edit.
CREATE TABLE design_spec_draft_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),draft_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 order_id uuid NOT NULL,scope_key uuid NOT NULL,piece_id uuid,
 payload jsonb NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 redaction_audit_id uuid,redacted_at timestamptz,
 PRIMARY KEY(shop_id,draft_id,version),
 FOREIGN KEY(shop_id,draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK(scope_key=coalesce(piece_id,order_id)),CHECK((redaction_audit_id IS NULL)=(redacted_at IS NULL))
);
CREATE INDEX design_spec_draft_scope ON design_spec_draft_value(shop_id,order_id,scope_key);
ALTER TABLE design_spec_scope ADD FOREIGN KEY(shop_id,order_id,scope_key,latest_saved_id) REFERENCES design_spec_version(shop_id,order_id,scope_key,id);
ALTER TABLE design_spec_scope ADD FOREIGN KEY(shop_id,order_id,scope_key,current_id) REFERENCES design_spec_version(shop_id,order_id,scope_key,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE design_spec_scope ADD FOREIGN KEY(shop_id,event_id) REFERENCES design_spec_event(shop_id,id);
ALTER TABLE design_spec_event ADD FOREIGN KEY(shop_id,order_id,scope_key,saved_id) REFERENCES design_spec_version(shop_id,order_id,scope_key,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE design_spec_event ADD FOREIGN KEY(shop_id,order_id,scope_key,current_id) REFERENCES design_spec_version(shop_id,order_id,scope_key,id) DEFERRABLE INITIALLY DEFERRED;
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['design_spec_scope','design_spec_event','design_spec_version','design_spec_answer','design_spec_value','design_spec_draft_value'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(version,latest_saved_id,current_id,event_id) ON design_spec_scope TO app_user;
CREATE FUNCTION design_spec_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;c public.design_spec_scope;p jsonb;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Design events immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO c FROM design_spec_scope WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key;
 p=d.payload;
 IF d.id IS NULL OR d.workflow<>'design.specification' OR d.schema_version<>1 OR d.lifecycle<>'active'
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR (p->>'orderId')::uuid IS DISTINCT FROM NEW.order_id OR coalesce((p->>'pieceId')::uuid,NEW.order_id) IS DISTINCT FROM NEW.scope_key
 OR NEW.operation IS DISTINCT FROM p->>'operation' OR NEW.scope_version<>coalesce(c.version,0)+1
 OR (p->>'baseVersion')::integer IS DISTINCT FROM coalesce(c.version,0) OR (p->>'baseSavedId')::uuid IS DISTINCT FROM c.latest_saved_id
 OR NEW.previous_saved_id IS DISTINCT FROM c.latest_saved_id OR NEW.previous_current_id IS DISTINCT FROM c.current_id
 OR (NEW.operation='select' AND (NEW.saved_id IS DISTINCT FROM c.latest_saved_id OR NEW.current_id IS DISTINCT FROM (p->>'selectedId')::uuid))
 OR (NEW.operation='save' AND (NEW.current_id IS DISTINCT FROM CASE WHEN (p->>'use')::boolean THEN NEW.saved_id ELSE c.current_id END))
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.action='design.specification.'||NEW.operation AND a.entity_type='garment_order' AND a.entity_id=NEW.order_id AND a.idempotency_key=NEW.command_key)
 THEN RAISE EXCEPTION 'Design event provenance denied' USING ERRCODE='23514';END IF;
 NEW.created_xid=pg_current_xact_id();NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());RETURN NEW;
END $fn$;
CREATE TRIGGER design_spec_event_write BEFORE INSERT OR UPDATE OR DELETE ON design_spec_event FOR EACH ROW EXECUTE FUNCTION design_spec_event_guard();
CREATE FUNCTION design_spec_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.design_spec_event;v public.design_spec_version;d public.durable_draft;f public.design_config_revision;a jsonb;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Design history immutable' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='design_spec_version' THEN
  SELECT * INTO e FROM design_spec_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=e.origin_draft_id;
  SELECT * INTO f FROM design_config_revision WHERE shop_id=NEW.shop_id AND id=NEW.profile_id;
  IF e.id IS NULL OR f.id IS NULL OR d.id IS NULL OR e.id IS NULL OR e.created_xid<>pg_current_xact_id() OR e.operation<>'save' OR e.saved_id<>NEW.id OR e.order_id<>NEW.order_id OR e.scope_key<>NEW.scope_key
  OR NEW.previous_id IS DISTINCT FROM e.previous_saved_id OR NEW.version<>coalesce((SELECT version FROM design_spec_version WHERE shop_id=NEW.shop_id AND id=NEW.previous_id),0)+1
  OR f.content->>'kind'<>'profile' OR NEW.frozen->'profile' IS DISTINCT FROM jsonb_build_object('id',f.id,'entryId',f.entry_id,'content',f.content,'authority',f.authority,'contentHash',f.content_hash)
  OR (d.payload->'profile'->>'entryId')::uuid IS DISTINCT FROM NEW.profile_entry_id OR (d.payload->'profile'->>'revisionId')::uuid IS DISTINCT FROM NEW.profile_id
  OR jsonb_array_length(NEW.frozen->'choices')<>(SELECT count(*) FROM jsonb_array_elements(d.payload->'answers') picked WHERE picked->'choice'<>'null'::jsonb)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.frozen->'choices') x LEFT JOIN design_config_revision r ON r.shop_id=NEW.shop_id AND r.id=(x->>'id')::uuid WHERE r.id IS NULL OR x IS DISTINCT FROM jsonb_build_object('id',r.id,'entryId',r.entry_id,'content',r.content,'authority',r.authority,'contentHash',r.content_hash))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.frozen->'choices') x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.payload->'answers') picked WHERE picked->'choice'->>'revisionId'=x->>'id'))
  OR f.content->>'pieceKey' IS DISTINCT FROM (SELECT source_key FROM order_piece WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND id=NEW.scope_key)
  OR NEW.reuse IS DISTINCT FROM nullif(d.payload->'reuse','null'::jsonb)
  OR NEW.reuse_version_id IS DISTINCT FROM (NEW.reuse->>'versionId')::uuid
  OR NOT EXISTS(SELECT 1 FROM order_acceptance_snapshot s WHERE s.shop_id=NEW.shop_id AND s.order_id=NEW.order_id AND s.digest=NEW.snapshot_digest AND s.definition_id=(f.content->'manifest'->>'revisionId')::uuid)
  THEN RAISE EXCEPTION 'Design version provenance denied' USING ERRCODE='23514';END IF;NEW.created_xid=pg_current_xact_id();
 ELSE
  SELECT * INTO v FROM design_spec_version WHERE shop_id=NEW.shop_id AND id=NEW.version_id;
  SELECT * INTO e FROM design_spec_event WHERE shop_id=v.shop_id AND id=v.event_id;
  SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;
  a=d.payload->'answers'->NEW.position;
  IF v.id IS NULL OR e.id IS NULL OR d.id IS NULL OR v.created_xid<>pg_current_xact_id() OR e.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
  OR (a->>'questionId')::uuid IS DISTINCT FROM NEW.question_id OR a->>'state' IS DISTINCT FROM NEW.state
  OR (a->'choice'->>'entryId')::uuid IS DISTINCT FROM NEW.choice_entry_id OR (a->'choice'->>'revisionId')::uuid IS DISTINCT FROM NEW.choice_id
  THEN RAISE EXCEPTION 'Design answer provenance denied' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_spec_version_write BEFORE INSERT OR UPDATE OR DELETE ON design_spec_version FOR EACH ROW EXECUTE FUNCTION design_spec_child_guard();
CREATE TRIGGER design_spec_answer_write BEFORE INSERT OR UPDATE OR DELETE ON design_spec_answer FOR EACH ROW EXECUTE FUNCTION design_spec_child_guard();
CREATE FUNCTION design_spec_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.design_spec_event;o public.garment_order;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain design scope' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM design_spec_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 IF (TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['version','latest_saved_id','current_id','event_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['version','latest_saved_id','current_id','event_id']))
 OR (TG_OP='INSERT' AND NEW.version<>1)
 OR (TG_OP='UPDATE' AND (NEW.version<>OLD.version+1 OR e.previous_saved_id IS DISTINCT FROM OLD.latest_saved_id OR e.previous_current_id IS DISTINCT FROM OLD.current_id))
 OR e.id IS NULL OR o.id IS NULL OR e.created_xid<>pg_current_xact_id() OR e.order_id<>NEW.order_id OR e.scope_key<>NEW.scope_key OR e.scope_version<>NEW.version OR e.saved_id<>NEW.latest_saved_id OR e.current_id IS DISTINCT FROM NEW.current_id
 OR NEW.customer_id IS DISTINCT FROM o.customer_id OR NEW.wearer_id IS DISTINCT FROM o.wearer_id
 THEN RAISE EXCEPTION 'Design scope pointer denied' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_spec_scope_write BEFORE INSERT OR UPDATE OR DELETE ON design_spec_scope FOR EACH ROW EXECUTE FUNCTION design_spec_scope_guard();
CREATE FUNCTION design_spec_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;v public.design_spec_version;BEGIN
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO v FROM design_spec_version WHERE shop_id=NEW.shop_id AND id=NEW.saved_id;
 IF d.id IS NULL OR d.lifecycle<>'promoted' OR d.result_type IS DISTINCT FROM 'design.specification' OR d.result_id IS DISTINCT FROM NEW.id
 OR NOT EXISTS(SELECT 1 FROM design_spec_scope s WHERE s.shop_id=NEW.shop_id AND s.order_id=NEW.order_id AND s.scope_key=NEW.scope_key AND s.event_id=NEW.id AND s.version=NEW.scope_version)
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_id=NEW.actor_id AND k.action='draft.promote' AND k.status=200 AND k.response#>>'{draft,result,type}'='design.specification' AND (k.response#>>'{draft,result,id}')::uuid=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM design_spec_value x WHERE x.shop_id=NEW.shop_id AND x.event_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM design_spec_draft_value x WHERE x.shop_id=NEW.shop_id AND x.draft_id=NEW.origin_draft_id AND x.version=d.version)
 OR (NEW.operation='save' AND ((SELECT count(*) FROM design_spec_answer a WHERE a.shop_id=NEW.shop_id AND a.version_id=v.id)<>jsonb_array_length(v.frozen->'profile'->'content'->'questions') OR NOT EXISTS(SELECT 1 FROM design_spec_value x WHERE x.shop_id=NEW.shop_id AND x.event_id=NEW.id AND x.answers=d.payload->'answers')))
 THEN RAISE EXCEPTION 'Design atomic commit denied' USING ERRCODE='23514';END IF;RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER design_spec_commit AFTER INSERT ON design_spec_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION design_spec_commit_guard();
CREATE POLICY design_spec_event_privacy ON design_spec_event FOR SELECT TO app_owner USING(shop_context_allows(shop_id));
CREATE POLICY design_spec_draft_value_privacy ON design_spec_draft_value FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE FUNCTION design_spec_draft_value_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.redacted_at IS NOT NULL OR NEW.redaction_audit_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM durable_draft d JOIN audit_event a ON a.shop_id=d.shop_id AND a.id=NEW.audit_id WHERE d.shop_id=NEW.shop_id AND d.id=NEW.draft_id AND d.workflow='design.specification' AND d.version=NEW.version AND d.payload=NEW.payload AND (d.payload->>'orderId')::uuid=NEW.order_id AND (d.payload->>'pieceId')::uuid IS NOT DISTINCT FROM NEW.piece_id AND a.entity_id=d.id AND a.entity_type='durable_draft' AND a.idempotency_key=NEW.command_key AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Private draft response provenance denied' USING ERRCODE='23514';END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF current_user<>'app_owner' OR (to_jsonb(NEW)-ARRAY['payload','redaction_audit_id','redacted_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload','redaction_audit_id','redacted_at']) OR OLD.redacted_at IS NOT NULL OR NEW.redacted_at IS NULL
  OR NEW.payload IS DISTINCT FROM OLD.payload||jsonb_build_object('answers','[]'::jsonb,'reason','','reuse',null,'profile',null,'selectedId',null,'operation','save','use',false)
  OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.redaction_audit_id AND a.occurred_at=transaction_timestamp() AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND ((a.action='privacy.design-draft' AND a.entity_type='design-draft' AND a.entity_id=NEW.draft_id) OR (a.action='privacy.design-specification' AND EXISTS(SELECT 1 FROM design_spec_event e WHERE e.shop_id=a.shop_id AND e.id=a.entity_id AND e.order_id=NEW.order_id AND e.scope_key=NEW.scope_key)))) THEN RAISE EXCEPTION 'Audited private draft redaction required' USING ERRCODE='42501';END IF;
 ELSE RAISE EXCEPTION 'Retain private draft response provenance' USING ERRCODE='42501';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_spec_draft_value_write BEFORE INSERT OR UPDATE OR DELETE ON design_spec_draft_value FOR EACH ROW EXECUTE FUNCTION design_spec_draft_value_guard();
CREATE POLICY design_spec_value_privacy ON design_spec_value FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE FUNCTION design_spec_value_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.redacted_at IS NOT NULL OR NEW.redaction_audit_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM design_spec_event e JOIN durable_draft d ON (d.shop_id,d.id)=(e.shop_id,e.origin_draft_id) WHERE e.shop_id=NEW.shop_id AND e.id=NEW.event_id AND e.created_xid=pg_current_xact_id() AND d.payload->>'reason'=NEW.reason AND d.payload->'answers'=NEW.answers) THEN RAISE EXCEPTION 'Design values provenance denied' USING ERRCODE='23514';END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF current_user<>'app_owner' OR NEW.shop_id<>OLD.shop_id OR NEW.event_id<>OLD.event_id OR OLD.redacted_at IS NOT NULL OR NEW.answers IS NOT NULL OR NEW.reason IS NOT NULL OR NEW.redacted_at IS NULL OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.redaction_audit_id AND a.action='privacy.design-specification' AND a.entity_id=NEW.event_id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.occurred_at=transaction_timestamp()) THEN RAISE EXCEPTION 'Audited privacy redaction required' USING ERRCODE='42501';END IF;
 ELSE RAISE EXCEPTION 'Retain design values' USING ERRCODE='42501';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER design_spec_value_write BEFORE INSERT OR UPDATE OR DELETE ON design_spec_value FOR EACH ROW EXECUTE FUNCTION design_spec_value_guard();
CREATE POLICY design_spec_privacy_audit ON audit_event FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id) AND action IN ('privacy.design-specification','privacy.design-draft'));
CREATE POLICY design_spec_draft_privacy ON durable_draft FOR ALL TO app_owner USING(shop_context_allows(shop_id) AND workflow='design.specification') WITH CHECK(shop_context_allows(shop_id) AND workflow='design.specification');
CREATE OR REPLACE FUNCTION durable_draft_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND current_user='app_owner' AND OLD.workflow='design.specification'
 AND (to_jsonb(NEW)-ARRAY['payload','version','updated_at'])=(to_jsonb(OLD)-ARRAY['payload','version','updated_at']) AND NEW.version=OLD.version+1 AND NEW.updated_at>=OLD.updated_at
 AND NEW.payload=OLD.payload||jsonb_build_object('answers','[]'::jsonb,'reason','','reuse',null,'profile',null,'selectedId',null,'operation','save','use',false)
 AND EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=OLD.shop_id AND a.occurred_at=transaction_timestamp() AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND ((a.action='privacy.design-draft' AND a.entity_type='design-draft' AND a.entity_id=OLD.id) OR (a.action='privacy.design-specification' AND EXISTS(SELECT 1 FROM design_spec_event e WHERE e.shop_id=a.shop_id AND e.id=a.entity_id AND e.order_id=(OLD.payload->>'orderId')::uuid AND e.scope_key=coalesce((OLD.payload->>'pieceId')::uuid,(OLD.payload->>'orderId')::uuid))))) THEN RETURN NEW;END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.creator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
   OR NEW.lifecycle<>'active' OR NEW.version<>1 THEN
   RAISE EXCEPTION 'Draft provenance denied' USING ERRCODE='42501'; END IF;
  NEW.created_at=date_trunc('milliseconds',clock_timestamp()); NEW.updated_at=NEW.created_at;
 ELSE
  IF OLD.lifecycle<>'active' OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.id IS DISTINCT FROM OLD.id
   OR NEW.creator_id IS DISTINCT FROM OLD.creator_id OR NEW.workflow IS DISTINCT FROM OLD.workflow
   OR NEW.schema_version IS DISTINCT FROM OLD.schema_version OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.version<>OLD.version+1 THEN
   RAISE EXCEPTION 'Draft history protected' USING ERRCODE='42501'; END IF;
  NEW.updated_at=GREATEST(OLD.updated_at,date_trunc('milliseconds',clock_timestamp()));
 END IF;
 RETURN NEW;
END $fn$;

CREATE FUNCTION redact_design_specification(s uuid,e uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7();target public.design_spec_event;draft_id uuid;BEGIN
 IF NOT COALESCE(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 SELECT * INTO target FROM design_spec_event WHERE shop_id=s AND id=e;
 IF target.id IS NULL THEN RAISE EXCEPTION 'Design values unavailable' USING ERRCODE='P0002';END IF;
 FOR draft_id IN SELECT id FROM durable_draft WHERE shop_id=s AND workflow='design.specification' AND (payload->>'orderId')::uuid=target.order_id AND coalesce((payload->>'pieceId')::uuid,(payload->>'orderId')::uuid)=target.scope_key ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||draft_id::text,0));
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('order:'||s::text||':'||target.order_id::text,0));
 PERFORM 1 FROM design_spec_value WHERE shop_id=s AND event_id=e AND redacted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Design values unavailable' USING ERRCODE='P0002';END IF;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.design-specification','design-specification',e,request,request,'{"redacted":true}');
 UPDATE durable_draft d SET version=d.version+1,updated_at=greatest(d.updated_at,clock_timestamp()),payload=d.payload||jsonb_build_object('answers','[]'::jsonb,'reason','','reuse',null,'profile',null,'selectedId',null,'operation','save','use',false)
 FROM design_spec_event ev WHERE ev.shop_id=s AND ev.id=e AND d.shop_id=s AND d.workflow='design.specification'
 AND (d.payload->>'orderId')::uuid=ev.order_id AND coalesce((d.payload->>'pieceId')::uuid,(d.payload->>'orderId')::uuid)=ev.scope_key;
 UPDATE design_spec_draft_value x SET payload=x.payload||jsonb_build_object('answers','[]'::jsonb,'reason','','reuse',null,'profile',null,'selectedId',null,'operation','save','use',false),redaction_audit_id=a,redacted_at=transaction_timestamp()
 FROM design_spec_event ev WHERE ev.shop_id=s AND ev.id=e AND x.shop_id=s AND x.order_id=ev.order_id AND x.scope_key=ev.scope_key AND x.redacted_at IS NULL;
 UPDATE design_spec_value SET answers=NULL,reason=NULL,redaction_audit_id=a,redacted_at=transaction_timestamp() WHERE shop_id=s AND event_id=e;
END $fn$;
REVOKE ALL ON FUNCTION redact_design_specification(uuid,uuid,uuid) FROM PUBLIC,app_user;GRANT EXECUTE ON FUNCTION redact_design_specification(uuid,uuid,uuid) TO app_privacy;
REVOKE ALL ON FUNCTION design_spec_event_guard(),design_spec_child_guard(),design_spec_scope_guard(),design_spec_commit_guard(),design_spec_value_guard(),design_spec_draft_value_guard() FROM PUBLIC;

CREATE FUNCTION redact_design_specification_draft(s uuid,d uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7();target public.durable_draft;BEGIN
 IF NOT COALESCE(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||d::text,0));
 SELECT * INTO target FROM durable_draft WHERE shop_id=s AND id=d AND workflow='design.specification';
 IF target.id IS NULL THEN RAISE EXCEPTION 'Design draft unavailable' USING ERRCODE='P0002';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('order:'||s::text||':'||(target.payload->>'orderId'),0));
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.design-draft','design-draft',d,request,request,'{"redacted":true}');
 UPDATE durable_draft SET version=version+1,updated_at=greatest(updated_at,clock_timestamp()),payload=payload||jsonb_build_object('answers','[]'::jsonb,'reason','','reuse',null,'profile',null,'selectedId',null,'operation','save','use',false) WHERE shop_id=s AND id=d;
 UPDATE design_spec_draft_value SET payload=payload||jsonb_build_object('answers','[]'::jsonb,'reason','','reuse',null,'profile',null,'selectedId',null,'operation','save','use',false),redaction_audit_id=a,redacted_at=transaction_timestamp() WHERE shop_id=s AND draft_id=d AND redacted_at IS NULL;
END $fn$;
REVOKE ALL ON FUNCTION redact_design_specification_draft(uuid,uuid,uuid) FROM PUBLIC,app_user;GRANT EXECUTE ON FUNCTION redact_design_specification_draft(uuid,uuid,uuid) TO app_privacy;
