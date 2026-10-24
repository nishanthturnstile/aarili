-- #170 / 1.3.4b. Additive minimal label provenance; keep privacy readers on rollback.
CREATE TABLE material_label_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),doc_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),
 selection_hash text NOT NULL CHECK(selection_hash ~ '^[0-9a-f]{64}$'),source_digest text NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 command_hash text NOT NULL CHECK(command_hash ~ '^[0-9a-f]{64}$'),model_hash text NOT NULL CHECK(model_hash ~ '^[0-9a-f]{64}$'),revoked boolean NOT NULL DEFAULT false,revocation_audit_id uuid,
 PRIMARY KEY(shop_id,doc_id,revision),UNIQUE(shop_id,selection_hash,revision),CHECK(revoked=(revocation_audit_id IS NOT NULL)),
 FOREIGN KEY(shop_id,doc_id,revision) REFERENCES document_revision(shop_id,doc_id,revision) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,revocation_audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE material_label_member (
 shop_id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL,position integer NOT NULL CHECK(position BETWEEN 0 AND 31),order_id uuid NOT NULL,piece_id uuid,customer_id uuid NOT NULL,wearer_id uuid,copies integer NOT NULL CHECK(copies BETWEEN 1 AND 64),source_digest text NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(shop_id,doc_id,revision,position),
 FOREIGN KEY(shop_id,doc_id,revision) REFERENCES material_label_revision(shop_id,doc_id,revision),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id)
);
CREATE INDEX material_label_wearer ON material_label_member(shop_id,wearer_id,doc_id,revision);
CREATE INDEX material_label_order ON material_label_member(shop_id,order_id,piece_id);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['material_label_revision','material_label_member'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY privacy_context ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 END LOOP;
END $policies$;
CREATE FUNCTION material_label_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE prior public.material_label_revision;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Label history protected' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||NEW.shop_id::text,0));
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME<>'material_label_revision' OR current_user<>'app_owner' OR OLD.revoked OR NOT NEW.revoked OR (to_jsonb(NEW)-ARRAY['revoked','revocation_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revoked','revocation_audit_id']) OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.revocation_audit_id AND a.action='privacy.material-labels' AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Audited label revocation required' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='material_label_revision' THEN
  SELECT * INTO prior FROM material_label_revision WHERE shop_id=NEW.shop_id AND selection_hash=NEW.selection_hash ORDER BY revision DESC LIMIT 1;
  IF NEW.revoked OR NEW.revision<>coalesce(prior.revision,0)+1 OR (prior.doc_id IS NOT NULL AND prior.doc_id<>NEW.doc_id) THEN RAISE EXCEPTION 'Consecutive label revision required' USING ERRCODE='23514';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM document_revision WHERE shop_id=NEW.shop_id AND doc_id=NEW.doc_id AND revision=NEW.revision) OR NOT EXISTS(SELECT 1 FROM garment_order o JOIN order_acceptance_snapshot s ON (s.shop_id,s.order_id)=(o.shop_id,o.id) WHERE o.shop_id=NEW.shop_id AND o.id=NEW.order_id AND o.customer_id=NEW.customer_id AND o.wearer_id IS NOT DISTINCT FROM NEW.wearer_id AND s.digest=NEW.source_digest) THEN RAISE EXCEPTION 'Exact label member required' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER material_label_history BEFORE INSERT OR UPDATE OR DELETE ON material_label_revision FOR EACH ROW EXECUTE FUNCTION material_label_guard();
CREATE TRIGGER material_label_history BEFORE INSERT OR UPDATE OR DELETE ON material_label_member FOR EACH ROW EXECUTE FUNCTION material_label_guard();
REVOKE ALL ON FUNCTION material_label_guard() FROM PUBLIC;
CREATE POLICY material_label_privacy ON document_revision FOR ALL TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM material_label_revision j WHERE (j.shop_id,j.doc_id,j.revision)=(document_revision.shop_id,document_revision.doc_id,document_revision.revision))) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY material_label_output_privacy ON document_output FOR SELECT TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM material_label_revision j WHERE (j.shop_id,j.doc_id,j.revision)=(document_output.shop_id,document_output.doc_id,document_output.revision)));
-- Shared exact-key purge storage remains one engine, with a document-wide FK and typed revocation check.
ALTER TABLE job_slip_purge DROP CONSTRAINT job_slip_purge_shop_id_doc_id_revision_fkey;
ALTER TABLE job_slip_purge ADD FOREIGN KEY(shop_id,doc_id,revision) REFERENCES document_revision(shop_id,doc_id,revision);
DO $guards$ DECLARE body text;old text;replacement text;BEGIN
 body=pg_get_functiondef('job_slip_guard()'::regprocedure);
 old='NOT EXISTS(SELECT 1 FROM job_slip_revision j WHERE j.shop_id=NEW.shop_id AND j.doc_id=NEW.doc_id AND j.revision=NEW.revision AND j.revoked AND j.revocation_audit_id=NEW.audit_id)';
 replacement='NOT (EXISTS(SELECT 1 FROM job_slip_revision j WHERE j.shop_id=NEW.shop_id AND j.doc_id=NEW.doc_id AND j.revision=NEW.revision AND j.revoked AND j.revocation_audit_id=NEW.audit_id) OR EXISTS(SELECT 1 FROM material_label_revision j WHERE j.shop_id=NEW.shop_id AND j.doc_id=NEW.doc_id AND j.revision=NEW.revision AND j.revoked AND j.revocation_audit_id=NEW.audit_id))';
 IF position(old in body)=0 THEN RAISE EXCEPTION 'Expected purge guard absent';END IF;EXECUTE replace(body,old,replacement);
 body=pg_get_functiondef('document_history_guard()'::regprocedure);
 old='EXISTS(SELECT 1 FROM job_slip_revision j WHERE j.shop_id=NEW.shop_id AND j.doc_id=NEW.doc_id AND j.revision=NEW.revision AND j.revoked AND j.revocation_audit_id IS NOT NULL)';
 replacement='(EXISTS(SELECT 1 FROM job_slip_revision j WHERE j.shop_id=NEW.shop_id AND j.doc_id=NEW.doc_id AND j.revision=NEW.revision AND j.revoked AND j.revocation_audit_id IS NOT NULL) OR EXISTS(SELECT 1 FROM material_label_revision j WHERE j.shop_id=NEW.shop_id AND j.doc_id=NEW.doc_id AND j.revision=NEW.revision AND j.revoked AND j.revocation_audit_id IS NOT NULL))';
 IF position(old in body)=0 THEN RAISE EXCEPTION 'Expected document privacy guard absent';END IF;EXECUTE replace(body,old,replacement);
END $guards$;
CREATE FUNCTION redact_material_labels(s uuid,d uuid,r integer,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE b public.material_label_revision;a uuid=uuidv7();actor uuid;epoch uuid;intent uuid=uuidv7();keys jsonb;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 SELECT * INTO b FROM material_label_revision WHERE shop_id=s AND doc_id=d AND revision=r;
 IF b.doc_id IS NULL THEN RAISE EXCEPTION 'Material labels unavailable' USING ERRCODE='P0002';END IF;
 IF b.revoked THEN RETURN;END IF;
 actor=NULLIF(current_setting('app.actor_id',true),'')::uuid;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',actor,'privacy.material-labels','document',d,request,request,'{"redacted":true}');
 UPDATE material_label_revision SET revoked=true,revocation_audit_id=a WHERE shop_id=s AND doc_id=d AND revision=r;
 UPDATE document_revision SET model='{}'::jsonb WHERE shop_id=s AND doc_id=d AND revision=r;
 PERFORM pg_advisory_xact_lock_shared(120036);SELECT restore_epoch INTO epoch FROM system_state WHERE singleton;
 SELECT coalesce(jsonb_agg(object_key),'[]'::jsonb) INTO keys FROM document_output WHERE shop_id=s AND doc_id=d AND revision=r;
 INSERT INTO job_slip_purge(shop_id,id,doc_id,revision,wearer_id,audit_id,initiator_id,restore_epoch,object_keys) VALUES(s,intent,d,r,NULL,a,actor,epoch,keys);
 INSERT INTO pgboss.job(id,name,data,retry_limit,retry_delay,retry_backoff) SELECT intent,'media.process',jsonb_build_object('kind','job-slip-purge','shopId',s,'purgeId',intent,'initiatorId',actor,'epoch',epoch),retry_limit,retry_delay,retry_backoff FROM pgboss.queue WHERE name='media.process';
 IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed media queue missing';END IF;
END $fn$;
REVOKE ALL ON FUNCTION redact_material_labels(uuid,uuid,integer,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_material_labels(uuid,uuid,integer,uuid) TO app_privacy;
CREATE POLICY material_label_privacy_audit ON audit_event FOR INSERT TO app_owner WITH CHECK(shop_context_allows(shop_id) AND action='privacy.material-labels' AND entity_type='document');
ALTER FUNCTION redact_measurements(uuid,uuid,uuid) RENAME TO redact_measurements_before_material_labels;
REVOKE ALL ON FUNCTION redact_measurements_before_material_labels(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_measurements(s uuid,w uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE j record;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 PERFORM redact_measurements_before_material_labels(s,w,request);
 FOR j IN SELECT DISTINCT r.doc_id,r.revision FROM material_label_revision r JOIN material_label_member m ON (m.shop_id,m.doc_id,m.revision)=(r.shop_id,r.doc_id,r.revision) WHERE r.shop_id=s AND m.wearer_id=w AND NOT r.revoked LOOP
  PERFORM redact_material_labels(s,j.doc_id,j.revision,uuidv7());
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION redact_measurements(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_measurements(uuid,uuid,uuid) TO app_privacy;

-- Persist only a bounded cell/field identifier, never raw renderer errors or source values.
ALTER TABLE document_attempt ADD COLUMN layout_failure text CHECK(layout_failure IS NULL OR (state='failed' AND layout_failure ~ '^label-([1-9]|[1-5][0-9]|6[0-4])$'));
DO $layout_guard$ DECLARE body text;old text;BEGIN
 body=pg_get_functiondef('document_history_guard()'::regprocedure);
 old='ARRAY[''state'',''version'',''fence'',''lease_until'',''job_id'',''restore_epoch'']';
 IF position(old in body)=0 THEN RAISE EXCEPTION 'Expected attempt guard absent';END IF;
 body=replace(body,old,'ARRAY[''state'',''version'',''fence'',''lease_until'',''job_id'',''restore_epoch'',''layout_failure'']');
 body=replace(body,'IF TG_TABLE_NAME=''document_attempt'' THEN','IF TG_TABLE_NAME=''document_attempt'' THEN IF NEW.layout_failure IS NOT NULL AND (TG_OP<>''UPDATE'' OR OLD.state<>''rendering'' OR NEW.state<>''failed'' OR NOT EXISTS(SELECT 1 FROM document_revision d WHERE d.shop_id=NEW.shop_id AND d.doc_id=NEW.doc_id AND d.revision=NEW.revision AND d.template=''material-labels'')) THEN RAISE EXCEPTION ''Bounded label failure required'' USING ERRCODE=''42501'';END IF;');
 EXECUTE body;
END $layout_guard$;
