-- #169 / 1.3.4a. Additive. Retain the document-aware privacy reader on rollback.
-- No live activation or production retention period is introduced here.
CREATE TABLE job_slip_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),doc_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),
 order_id uuid NOT NULL,scope_key uuid NOT NULL,piece_id uuid,customer_id uuid NOT NULL,wearer_id uuid,
 design_id uuid,measurement_id uuid,pattern_id uuid,
 source_digest text NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 command_hash text NOT NULL CHECK(command_hash ~ '^[0-9a-f]{64}$'),model_hash text NOT NULL CHECK(model_hash ~ '^[0-9a-f]{64}$'),
 revoked boolean NOT NULL DEFAULT false,revocation_audit_id uuid,
 PRIMARY KEY(shop_id,doc_id,revision),UNIQUE(shop_id,order_id,scope_key,revision),
 CHECK(scope_key=coalesce(piece_id,order_id)),CHECK(revoked=(revocation_audit_id IS NOT NULL)),
 FOREIGN KEY(shop_id,doc_id,revision) REFERENCES document_revision(shop_id,doc_id,revision) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,order_id,scope_key,design_id) REFERENCES design_spec_version(shop_id,order_id,scope_key,id),
 FOREIGN KEY(shop_id,measurement_id) REFERENCES measurement_version(shop_id,id),
 FOREIGN KEY(shop_id,order_id,scope_key,pattern_id) REFERENCES pattern_version(shop_id,order_id,scope_key,id),
 FOREIGN KEY(shop_id,revocation_audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE INDEX job_slip_wearer ON job_slip_revision(shop_id,wearer_id,doc_id,revision);
CREATE INDEX job_slip_customer ON job_slip_revision(shop_id,customer_id,doc_id,revision);
CREATE TABLE job_slip_purge (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL,
 wearer_id uuid,audit_id uuid NOT NULL,initiator_id uuid NOT NULL,restore_epoch uuid NOT NULL,
 object_keys jsonb NOT NULL CHECK(jsonb_typeof(object_keys)='array'),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,doc_id,revision,restore_epoch),
 FOREIGN KEY(shop_id,doc_id,revision) REFERENCES job_slip_revision(shop_id,doc_id,revision),
 FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,initiator_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE job_slip_purge_receipt (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),purge_id uuid NOT NULL,object_key text NOT NULL,audit_id uuid NOT NULL,
 PRIMARY KEY(shop_id,purge_id,object_key),FOREIGN KEY(shop_id,purge_id) REFERENCES job_slip_purge(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['job_slip_revision','job_slip_purge','job_slip_purge_receipt'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY privacy_context ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 END LOOP;
END $policies$;
REVOKE INSERT ON job_slip_purge FROM app_user;
CREATE POLICY job_slip_privacy ON document_revision FOR ALL TO app_owner
 USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM job_slip_revision j WHERE (j.shop_id,j.doc_id,j.revision)=(document_revision.shop_id,document_revision.doc_id,document_revision.revision)))
 WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY job_slip_output_privacy ON document_output FOR SELECT TO app_owner
 USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM job_slip_revision j WHERE (j.shop_id,j.doc_id,j.revision)=(document_output.shop_id,document_output.doc_id,document_output.revision)));
CREATE FUNCTION job_slip_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE prior public.job_slip_revision; p public.job_slip_purge;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||NEW.shop_id::text,0));
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Job slip history protected' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='job_slip_revision' THEN
  IF TG_OP='UPDATE' THEN
   IF current_user<>'app_owner' OR OLD.revoked OR NOT NEW.revoked OR NEW.revocation_audit_id IS NULL
    OR (to_jsonb(NEW)-ARRAY['revoked','revocation_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revoked','revocation_audit_id'])
    OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.revocation_audit_id AND a.action IN ('privacy.measurements','privacy.design-specification','privacy.job-slip') AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id())
   THEN RAISE EXCEPTION 'Audited document revocation required' USING ERRCODE='42501';END IF;
  ELSE
   SELECT * INTO prior FROM job_slip_revision WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key ORDER BY revision DESC LIMIT 1;
   IF NEW.revoked OR NEW.revision<>coalesce(prior.revision,0)+1 OR (prior.doc_id IS NOT NULL AND prior.doc_id<>NEW.doc_id)
    OR NOT EXISTS(SELECT 1 FROM garment_order o WHERE o.shop_id=NEW.shop_id AND o.id=NEW.order_id AND o.customer_id=NEW.customer_id AND o.wearer_id IS NOT DISTINCT FROM NEW.wearer_id)
    OR (NEW.measurement_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM measurement_event e WHERE e.shop_id=NEW.shop_id AND e.id=NEW.measurement_id AND e.customer_id=NEW.customer_id AND e.wearer_id=NEW.wearer_id))
   THEN RAISE EXCEPTION 'Exact job slip scope required' USING ERRCODE='23514';END IF;
  END IF;
 ELSIF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Purge history protected' USING ERRCODE='42501';
 ELSIF TG_TABLE_NAME='job_slip_purge' THEN
  IF current_user<>'app_owner' OR NOT EXISTS(SELECT 1 FROM job_slip_revision j WHERE j.shop_id=NEW.shop_id AND j.doc_id=NEW.doc_id AND j.revision=NEW.revision AND j.revoked AND j.revocation_audit_id=NEW.audit_id)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.object_keys) k WHERE NOT EXISTS(SELECT 1 FROM document_output o WHERE o.shop_id=NEW.shop_id AND o.doc_id=NEW.doc_id AND o.revision=NEW.revision AND o.object_key=k))
  THEN RAISE EXCEPTION 'Audited job slip purge required' USING ERRCODE='42501';END IF;
 ELSE
  SELECT * INTO p FROM job_slip_purge WHERE shop_id=NEW.shop_id AND id=NEW.purge_id;
  IF p.id IS NULL OR NOT (p.object_keys ? NEW.object_key)
   OR NOT EXISTS(SELECT 1 FROM system_state WHERE singleton AND side_effects_enabled AND restore_epoch=p.restore_epoch)
   OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.action='job-slip.purge' AND a.entity_id=p.id AND a.actor_id=p.initiator_id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id())
  THEN RAISE EXCEPTION 'Current purge receipt required' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $fn$;
DO $guards$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['job_slip_revision','job_slip_purge','job_slip_purge_receipt'] LOOP
  EXECUTE format('CREATE TRIGGER job_slip_history BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION job_slip_guard()',t);
 END LOOP;
END $guards$;
REVOKE ALL ON FUNCTION job_slip_guard() FROM PUBLIC;
-- Narrow exception to the existing final-document guard. Runtime grants stay immutable.
DO $document_privacy$ DECLARE body text;BEGIN
 body=pg_get_functiondef('document_history_guard()'::regprocedure);
 body=replace(body,'IF TG_OP=''DELETE'' THEN',
 'IF TG_TABLE_NAME=''document_revision'' AND TG_OP=''UPDATE'' THEN IF current_user=''app_owner'' AND NEW.model=''{}''::jsonb AND (to_jsonb(NEW)-''model'')=(to_jsonb(OLD)-''model'') AND EXISTS(SELECT 1 FROM job_slip_revision j WHERE j.shop_id=NEW.shop_id AND j.doc_id=NEW.doc_id AND j.revision=NEW.revision AND j.revoked AND j.revocation_audit_id IS NOT NULL) THEN RETURN NEW;END IF; END IF; IF TG_OP=''DELETE'' THEN');
 EXECUTE body;
END $document_privacy$;
ALTER FUNCTION redact_measurements(uuid,uuid,uuid) RENAME TO redact_measurements_before_job_slips;
REVOKE ALL ON FUNCTION redact_measurements_before_job_slips(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_measurements(s uuid,w uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE docs jsonb;a uuid;actor uuid;epoch uuid;j record;intent uuid;keys jsonb;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',doc_id,'revision',revision)),'[]'::jsonb) INTO docs
 FROM job_slip_revision WHERE shop_id=s AND NOT revoked AND (wearer_id=w OR (pattern_id IS NOT NULL AND pattern_reference_depends_on_wearer(s,pattern_id,w)));
 PERFORM redact_measurements_before_job_slips(s,w,request);
 SELECT audit_id INTO a FROM measurement_erasure WHERE shop_id=s AND wearer_id=w;
 actor=NULLIF(current_setting('app.actor_id',true),'')::uuid;
 PERFORM pg_advisory_xact_lock_shared(120036);SELECT restore_epoch INTO epoch FROM system_state WHERE singleton;
 IF a IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Privacy provenance required' USING ERRCODE='42501';END IF;
 FOR j IN SELECT * FROM jsonb_to_recordset(docs) AS x(id uuid,revision integer) LOOP
  UPDATE job_slip_revision SET revoked=true,revocation_audit_id=a WHERE shop_id=s AND doc_id=j.id AND revision=j.revision;
  UPDATE document_revision SET model='{}'::jsonb WHERE shop_id=s AND doc_id=j.id AND revision=j.revision;
  SELECT coalesce(jsonb_agg(object_key),'[]'::jsonb) INTO keys FROM document_output WHERE shop_id=s AND doc_id=j.id AND revision=j.revision;
  intent=uuidv7();
  INSERT INTO job_slip_purge(shop_id,id,doc_id,revision,wearer_id,audit_id,initiator_id,restore_epoch,object_keys) VALUES(s,intent,j.id,j.revision,w,a,actor,epoch,keys);
  INSERT INTO pgboss.job(id,name,data,retry_limit,retry_delay,retry_backoff) SELECT intent,'media.process',jsonb_build_object('kind','job-slip-purge','shopId',s,'purgeId',intent,'initiatorId',actor,'epoch',epoch),retry_limit,retry_delay,retry_backoff FROM pgboss.queue WHERE name='media.process';
  IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed media queue missing';END IF;
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION redact_measurements(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_measurements(uuid,uuid,uuid) TO app_privacy;

-- Design redaction also erases its issued production snapshots. Take the same
-- outer barrier before the existing design/draft locks, including nested source
-- redaction, so a queued/in-flight renderer cannot publish after revocation.
ALTER FUNCTION redact_design_specification(uuid,uuid,uuid) RENAME TO redact_design_specification_before_job_slips;
REVOKE ALL ON FUNCTION redact_design_specification_before_job_slips(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_design_specification(s uuid,e uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid;actor uuid;epoch uuid;j record;intent uuid;keys jsonb;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 PERFORM redact_design_specification_before_job_slips(s,e,request);
 SELECT redaction_audit_id INTO a FROM design_spec_value WHERE shop_id=s AND event_id=e;
 actor=NULLIF(current_setting('app.actor_id',true),'')::uuid;
 PERFORM pg_advisory_xact_lock_shared(120036);SELECT restore_epoch INTO epoch FROM system_state WHERE singleton;
 IF a IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Privacy provenance required' USING ERRCODE='42501';END IF;
 FOR j IN SELECT r.doc_id,r.revision FROM job_slip_revision r JOIN design_spec_version v ON (v.shop_id,v.id)=(r.shop_id,r.design_id) WHERE r.shop_id=s AND v.event_id=e AND NOT r.revoked LOOP
  UPDATE job_slip_revision SET revoked=true,revocation_audit_id=a WHERE shop_id=s AND doc_id=j.doc_id AND revision=j.revision;
  UPDATE document_revision SET model='{}'::jsonb WHERE shop_id=s AND doc_id=j.doc_id AND revision=j.revision;
  SELECT coalesce(jsonb_agg(object_key),'[]'::jsonb) INTO keys FROM document_output WHERE shop_id=s AND doc_id=j.doc_id AND revision=j.revision;
  intent=uuidv7();
  INSERT INTO job_slip_purge(shop_id,id,doc_id,revision,wearer_id,audit_id,initiator_id,restore_epoch,object_keys) VALUES(s,intent,j.doc_id,j.revision,NULL,a,actor,epoch,keys);
  INSERT INTO pgboss.job(id,name,data,retry_limit,retry_delay,retry_backoff) SELECT intent,'media.process',jsonb_build_object('kind','job-slip-purge','shopId',s,'purgeId',intent,'initiatorId',actor,'epoch',epoch),retry_limit,retry_delay,retry_backoff FROM pgboss.queue WHERE name='media.process';
  IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed media queue missing';END IF;
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION redact_design_specification(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_design_specification(uuid,uuid,uuid) TO app_privacy;
ALTER FUNCTION redact_design_reference_subject(uuid,uuid,uuid) RENAME TO redact_design_reference_subject_before_job_slips;
REVOKE ALL ON FUNCTION redact_design_reference_subject_before_job_slips(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_design_reference_subject(s uuid,subject uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 PERFORM redact_design_reference_subject_before_job_slips(s,subject,request);
END $fn$;
REVOKE ALL ON FUNCTION redact_design_reference_subject(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_design_reference_subject(uuid,uuid,uuid) TO app_privacy;
-- Direct governed erasure covers wearerless service instructions as well as
-- document-specific privacy requests. It does not alter business source history.
CREATE FUNCTION redact_job_slip(s uuid,d uuid,r integer,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE b public.job_slip_revision;a uuid=uuidv7();actor uuid;epoch uuid;intent uuid=uuidv7();keys jsonb;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 SELECT * INTO b FROM job_slip_revision WHERE shop_id=s AND doc_id=d AND revision=r;
 IF b.doc_id IS NULL THEN RAISE EXCEPTION 'Job slip unavailable' USING ERRCODE='P0002';END IF;
 IF b.revoked THEN RETURN;END IF;
 actor=NULLIF(current_setting('app.actor_id',true),'')::uuid;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',actor,'privacy.job-slip','document',d,request,request,'{"redacted":true}');
 UPDATE job_slip_revision SET revoked=true,revocation_audit_id=a WHERE shop_id=s AND doc_id=d AND revision=r;
 UPDATE document_revision SET model='{}'::jsonb WHERE shop_id=s AND doc_id=d AND revision=r;
 PERFORM pg_advisory_xact_lock_shared(120036);SELECT restore_epoch INTO epoch FROM system_state WHERE singleton;
 SELECT coalesce(jsonb_agg(object_key),'[]'::jsonb) INTO keys FROM document_output WHERE shop_id=s AND doc_id=d AND revision=r;
 INSERT INTO job_slip_purge(shop_id,id,doc_id,revision,wearer_id,audit_id,initiator_id,restore_epoch,object_keys) VALUES(s,intent,d,r,b.wearer_id,a,actor,epoch,keys);
 INSERT INTO pgboss.job(id,name,data,retry_limit,retry_delay,retry_backoff) SELECT intent,'media.process',jsonb_build_object('kind','job-slip-purge','shopId',s,'purgeId',intent,'initiatorId',actor,'epoch',epoch),retry_limit,retry_delay,retry_backoff FROM pgboss.queue WHERE name='media.process';
 IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed media queue missing';END IF;
END $fn$;
REVOKE ALL ON FUNCTION redact_job_slip(uuid,uuid,integer,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_job_slip(uuid,uuid,integer,uuid) TO app_privacy;
CREATE POLICY job_slip_privacy_audit ON audit_event FOR INSERT TO app_owner
 WITH CHECK(shop_context_allows(shop_id) AND action='privacy.job-slip' AND entity_type='document');
