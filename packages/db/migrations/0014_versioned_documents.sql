-- Additive retained document history. Back up first; use advisory-locked runner.
-- Compatible rollback retains these tables, fonts/templates and accepted bytes.
CREATE TABLE document_revision (
 shop_id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),
 creator_id uuid NOT NULL,template text NOT NULL,template_revision integer NOT NULL CHECK(template_revision>0),
 font_revision text NOT NULL CHECK(font_revision ~ '^[0-9a-f]{64}$'),
 template_hash text NOT NULL CHECK(template_hash ~ '^[0-9a-f]{64}$'),
 language text NOT NULL CHECK(language IN ('en','ta')),paper text NOT NULL CHECK(paper IN ('A4','A3')),
 model jsonb NOT NULL CHECK(octet_length(model::text)<=200000),model_hash text NOT NULL CHECK(model_hash ~ '^[0-9a-f]{64}$'),
 request_key uuid NOT NULL,request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),issue_action_id uuid NOT NULL,
 PRIMARY KEY(shop_id,doc_id,revision),UNIQUE(shop_id,request_key),
 FOREIGN KEY(shop_id,creator_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,issue_action_id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE document_attempt (
 shop_id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL,job_id uuid NOT NULL,initiator_id uuid NOT NULL,
 restore_epoch uuid NOT NULL,state text NOT NULL CHECK(state IN ('pending','rendering','failed','ready')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),fence uuid,lease_until timestamptz,
 PRIMARY KEY(shop_id,doc_id,revision),UNIQUE(shop_id,job_id),
 FOREIGN KEY(shop_id,doc_id,revision) REFERENCES document_revision(shop_id,doc_id,revision),
 FOREIGN KEY(shop_id,initiator_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,fence) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED,
 CHECK((state='pending' AND fence IS NULL AND lease_until IS NULL) OR (state<>'pending' AND fence IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX document_attempt_work ON document_attempt(shop_id,state,lease_until,doc_id,revision);
-- Planned exact output identity commits BEFORE object I/O. A late writer's
-- object can still be found after a crash; only accepted artifacts are served.
CREATE TABLE document_output (
 shop_id uuid NOT NULL,id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL,fence uuid NOT NULL,
 object_key text NOT NULL,sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 bytes integer NOT NULL CHECK(bytes>0 AND bytes<=26214400),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,id,doc_id,revision),
 FOREIGN KEY(shop_id,doc_id,revision) REFERENCES document_revision(shop_id,doc_id,revision),
 FOREIGN KEY(shop_id,fence) REFERENCES audit_event(shop_id,id),
 CHECK(object_key='shops/'||shop_id::text||'/docs/'||doc_id::text||'/'||revision::text||'-'||sha256||'.pdf')
);
CREATE INDEX document_output_revision ON document_output(shop_id,doc_id,revision,id);
CREATE TABLE document_artifact (
 shop_id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL,output_id uuid NOT NULL,action_id uuid NOT NULL,
 PRIMARY KEY(shop_id,doc_id,revision),UNIQUE(shop_id,output_id),
 FOREIGN KEY(shop_id,output_id,doc_id,revision) REFERENCES document_output(shop_id,id,doc_id,revision),
 FOREIGN KEY(shop_id,action_id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE document_cleanup (
 shop_id uuid NOT NULL,id uuid NOT NULL,output_id uuid NOT NULL,restore_epoch uuid NOT NULL,
 completed_at timestamptz,completion_action_id uuid,
 PRIMARY KEY(shop_id,id),
 FOREIGN KEY(shop_id,output_id) REFERENCES document_output(shop_id,id),
 FOREIGN KEY(shop_id,id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,completion_action_id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED,
 CHECK((completed_at IS NULL)=(completion_action_id IS NULL))
);
CREATE UNIQUE INDEX document_cleanup_pending ON document_cleanup(shop_id,output_id,restore_epoch) WHERE completed_at IS NULL;
CREATE FUNCTION document_history_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE a document_attempt; o document_output;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Document history protected' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='document_cleanup' THEN
  SELECT * INTO o FROM document_output WHERE shop_id=NEW.shop_id AND id=NEW.output_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document output missing' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:document:'||o.shop_id::text||':'||o.doc_id::text||':'||o.revision::text,0));
  IF TG_OP='INSERT' THEN
   IF NEW.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Document cleanup provenance denied' USING ERRCODE='42501'; END IF;
  ELSIF OLD.completed_at IS NOT NULL OR NEW.completed_at IS NULL OR NEW.completion_action_id IS NULL OR (to_jsonb(NEW)-ARRAY['completed_at','completion_action_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['completed_at','completion_action_id']) THEN
   RAISE EXCEPTION 'Document cleanup history protected' USING ERRCODE='42501';
  END IF;
  IF o.created_at>clock_timestamp()-interval '300 seconds'
   OR NOT EXISTS(SELECT 1 FROM system_state WHERE singleton=true AND side_effects_enabled AND restore_epoch=NEW.restore_epoch)
   OR EXISTS(SELECT 1 FROM document_artifact x JOIN document_output y ON y.shop_id=x.shop_id AND y.id=x.output_id WHERE x.shop_id=o.shop_id AND x.doc_id=o.doc_id AND x.revision=o.revision AND y.object_key=o.object_key)
   OR EXISTS(SELECT 1 FROM document_attempt p WHERE p.shop_id=o.shop_id AND p.doc_id=o.doc_id AND p.revision=o.revision AND p.state='rendering' AND p.lease_until>clock_timestamp()) THEN
   RAISE EXCEPTION 'Document cleanup candidate denied' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:document:'||NEW.shop_id::text||':'||NEW.doc_id::text||':'||NEW.revision::text,0));
 IF TG_TABLE_NAME='document_attempt' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.state<>'pending' OR NEW.version<>1 OR NEW.initiator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NOT EXISTS(SELECT 1 FROM document_revision d WHERE d.shop_id=NEW.shop_id AND d.doc_id=NEW.doc_id AND d.revision=NEW.revision AND d.creator_id=NEW.initiator_id) THEN RAISE EXCEPTION 'Document attempt provenance denied' USING ERRCODE='42501'; END IF;
  ELSE
   IF OLD.state='ready' OR NEW.version<>OLD.version+1 OR (to_jsonb(NEW)-ARRAY['state','version','fence','lease_until','job_id','restore_epoch']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','version','fence','lease_until','job_id','restore_epoch']) THEN RAISE EXCEPTION 'Document attempt history protected' USING ERRCODE='42501'; END IF;
   IF NEW.state='pending' THEN
    IF NEW.job_id=OLD.job_id OR (OLD.state='rendering' AND OLD.lease_until>clock_timestamp()) OR NOT EXISTS(SELECT 1 FROM system_state WHERE singleton=true AND side_effects_enabled AND restore_epoch=NEW.restore_epoch) THEN RAISE EXCEPTION 'Document retry denied' USING ERRCODE='42501'; END IF;
   ELSIF NEW.job_id<>OLD.job_id OR NEW.restore_epoch<>OLD.restore_epoch OR NOT ((NEW.state='rendering' AND (OLD.state IN ('pending','failed') OR OLD.lease_until<=clock_timestamp())) OR (OLD.state='rendering' AND NEW.state IN ('failed','ready') AND NEW.fence=OLD.fence)) THEN
    RAISE EXCEPTION 'Document transition denied' USING ERRCODE='42501';
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Document history protected' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='document_revision' THEN
  IF NEW.creator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Document provenance denied' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='document_output' THEN
  SELECT * INTO a FROM document_attempt WHERE shop_id=NEW.shop_id AND doc_id=NEW.doc_id AND revision=NEW.revision;
  IF NOT FOUND OR a.state<>'rendering' OR a.fence<>NEW.fence OR a.lease_until<=clock_timestamp() OR a.initiator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Document output provenance denied' USING ERRCODE='42501'; END IF;
  NEW.created_at=clock_timestamp();
 ELSIF TG_TABLE_NAME='document_artifact' THEN
  PERFORM 1 FROM document_attempt p JOIN document_output x ON x.shop_id=p.shop_id AND x.doc_id=p.doc_id AND x.revision=p.revision
   WHERE p.shop_id=NEW.shop_id AND p.doc_id=NEW.doc_id AND p.revision=NEW.revision AND x.id=NEW.output_id
   AND p.state='ready' AND p.fence=x.fence AND p.initiator_id=NULLIF(current_setting('app.actor_id',true),'')::uuid
   AND p.xmin=((pg_current_xact_id()::text::numeric % 4294967296)::text::xid);
  IF NOT FOUND THEN RAISE EXCEPTION 'Document artifact provenance denied' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION document_history_guard() FROM PUBLIC;
DO $setup$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['document_revision','document_attempt','document_output','document_artifact','document_cleanup'] LOOP
  EXECUTE format('CREATE TRIGGER document_history BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION document_history_guard()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
  EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 END LOOP;
END $setup$;
GRANT UPDATE ON document_attempt,document_cleanup TO app_user;
SELECT pgboss.create_queue('pdf.render','{"policy":"standard","retryLimit":3,"retryDelay":1}'::jsonb);
