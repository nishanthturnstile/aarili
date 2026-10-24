-- #176 / 1.4.1d. Additive, no live numbering/template activation or postings.
CREATE TABLE quotation_counter(shop_id uuid PRIMARY KEY REFERENCES shop(shop_id),last_number bigint NOT NULL CHECK(last_number>=0 AND last_number<=999999999999));
CREATE TABLE quotation_issue(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),doc_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),family_id uuid NOT NULL,proposal_id uuid NOT NULL,
 number text NOT NULL CHECK(number ~ '^QT-[0-9]{6,}$'),model_hash text NOT NULL CHECK(model_hash ~ '^[a-f0-9]{64}$'),command_hash text NOT NULL CHECK(command_hash ~ '^[a-f0-9]{64}$'),
 profile_id uuid NOT NULL,validity_policy_id uuid NOT NULL,validity_kind text NOT NULL DEFAULT 'quoteValidity' CHECK(validity_kind='quoteValidity'),reason text CHECK(length(reason)<=1000),actor_id uuid NOT NULL,request_key uuid NOT NULL,revoked boolean NOT NULL DEFAULT false,revocation_audit_id uuid,
 PRIMARY KEY(shop_id,doc_id,revision),UNIQUE(shop_id,proposal_id),UNIQUE(shop_id,number),UNIQUE(shop_id,request_key),UNIQUE(shop_id,doc_id,revision,model_hash),
 FOREIGN KEY(shop_id,profile_id) REFERENCES shop_profile_revision(shop_id,id),FOREIGN KEY(shop_id,validity_kind,validity_policy_id) REFERENCES quotation_policy_binding(shop_id,kind,id),
 CHECK(doc_id=family_id),CHECK(revoked=(revocation_audit_id IS NOT NULL)),
 FOREIGN KEY(shop_id,family_id,proposal_id) REFERENCES booking_quotation_revision(shop_id,family_id,id),
 FOREIGN KEY(shop_id,doc_id,revision) REFERENCES document_revision(shop_id,doc_id,revision) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,revocation_audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE quotation_response(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL,model_hash text NOT NULL,previous_id uuid,
 sequence integer NOT NULL CHECK(sequence BETWEEN 1 AND 100),actor_id uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),request_key uuid NOT NULL,command_hash text NOT NULL CHECK(command_hash ~ '^[a-f0-9]{64}$'),value jsonb,respondent_customer_id uuid GENERATED ALWAYS AS ((value->>'respondentCustomerId')::uuid) STORED,audit_id uuid NOT NULL,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,doc_id,revision,id),UNIQUE(shop_id,doc_id,revision,sequence),UNIQUE(shop_id,request_key),
 FOREIGN KEY(shop_id,doc_id,revision,model_hash) REFERENCES quotation_issue(shop_id,doc_id,revision,model_hash),
 FOREIGN KEY(shop_id,doc_id,revision,previous_id) REFERENCES quotation_response(shop_id,doc_id,revision,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,respondent_customer_id) REFERENCES customer(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE quotation_purge(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL,audit_id uuid NOT NULL,initiator_id uuid NOT NULL,restore_epoch uuid NOT NULL,object_keys jsonb NOT NULL CHECK(jsonb_typeof(object_keys)='array'),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,doc_id,revision,restore_epoch),FOREIGN KEY(shop_id,doc_id,revision) REFERENCES quotation_issue(shop_id,doc_id,revision),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),FOREIGN KEY(shop_id,initiator_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE quotation_purge_receipt(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),purge_id uuid NOT NULL,object_key text NOT NULL,audit_id uuid NOT NULL,PRIMARY KEY(shop_id,purge_id,object_key),FOREIGN KEY(shop_id,purge_id) REFERENCES quotation_purge(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['quotation_counter','quotation_issue','quotation_response','quotation_purge','quotation_purge_receipt'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY privacy_context ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 END LOOP;
END $policies$;
GRANT UPDATE(last_number) ON quotation_counter TO app_user;
REVOKE INSERT ON quotation_purge FROM app_user;
CREATE POLICY quotation_document_privacy ON document_revision FOR ALL TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM quotation_issue q WHERE (q.shop_id,q.doc_id,q.revision)=(document_revision.shop_id,document_revision.doc_id,document_revision.revision))) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY quotation_output_privacy ON document_output FOR SELECT TO app_owner USING(shop_context_allows(shop_id) AND EXISTS(SELECT 1 FROM quotation_issue q WHERE (q.shop_id,q.doc_id,q.revision)=(document_output.shop_id,document_output.doc_id,document_output.revision)));
CREATE FUNCTION quotation_issue_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE b public.quotation_issue; prior public.quotation_response; p public.quotation_purge;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Quotation history protected' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||NEW.shop_id::text,0));
 IF TG_TABLE_NAME='quotation_counter' THEN
  IF TG_OP='INSERT' THEN IF NEW.last_number<>0 THEN RAISE EXCEPTION 'Counter starts at zero';END IF;
  ELSIF NEW.shop_id<>OLD.shop_id OR NEW.last_number<>OLD.last_number+1 THEN RAISE EXCEPTION 'Monotonic quotation counter required' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='quotation_issue' THEN
  IF TG_OP='UPDATE' THEN
   IF current_user<>'app_owner' OR OLD.revoked OR NOT NEW.revoked OR NEW.revocation_audit_id IS NULL OR NEW.reason IS NOT NULL OR (to_jsonb(NEW)-ARRAY['revoked','revocation_audit_id','reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revoked','revocation_audit_id','reason']) OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.revocation_audit_id AND a.action='privacy.quotation' AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Audited quotation revocation required' USING ERRCODE='42501';END IF;
  ELSE
   IF NEW.revoked OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NEW.revision<>(SELECT count(*)+1 FROM quotation_issue WHERE shop_id=NEW.shop_id AND family_id=NEW.family_id) OR NEW.number IS DISTINCT FROM (SELECT 'QT-'||lpad(last_number::text,greatest(6,length(last_number::text)),'0') FROM quotation_counter WHERE shop_id=NEW.shop_id) THEN RAISE EXCEPTION 'Exact quotation sequence required' USING ERRCODE='23514';END IF;
  END IF;
 ELSIF TG_TABLE_NAME='quotation_response' THEN
  IF TG_OP='UPDATE' THEN
   IF current_user<>'app_owner' OR NEW.value IS NOT NULL OR (to_jsonb(NEW)-ARRAY['value','respondent_customer_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['value','respondent_customer_id']) OR NOT EXISTS(SELECT 1 FROM quotation_issue q WHERE q.shop_id=NEW.shop_id AND q.doc_id=NEW.doc_id AND q.revision=NEW.revision AND q.revoked) THEN RAISE EXCEPTION 'Response history protected' USING ERRCODE='42501';END IF;
  ELSE
   SELECT * INTO b FROM quotation_issue WHERE shop_id=NEW.shop_id AND doc_id=NEW.doc_id AND revision=NEW.revision;
   SELECT * INTO prior FROM quotation_response WHERE shop_id=NEW.shop_id AND doc_id=NEW.doc_id AND revision=NEW.revision ORDER BY sequence DESC LIMIT 1;
   IF b.revoked OR NEW.previous_id IS DISTINCT FROM prior.id OR NEW.sequence<>coalesce(prior.sequence,0)+1 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NEW.value IS NULL OR NOT(NEW.value ?& ARRAY['kind','respondentCustomerId','reportedAt','channel','evidence','reason']) OR (NEW.value->>'respondentCustomerId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM booking_quotation_scope s WHERE s.shop_id=NEW.shop_id AND s.revision_id=b.proposal_id AND s.customer_id=(NEW.value->>'respondentCustomerId')::uuid)) OR jsonb_typeof(NEW.value)<>'object' OR (NEW.value-ARRAY['kind','respondentCustomerId','reportedAt','channel','evidence','reason'])<>'{}'::jsonb OR NEW.value->>'kind' NOT IN ('approved','rejected','withdrawn','issue-withdrawn') OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.action='quotation.response' AND a.actor_id=NEW.actor_id AND (a.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Exact audited quotation response required' USING ERRCODE='23514';END IF;
   NEW.recorded_at=clock_timestamp();
  END IF;
 ELSIF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Purge history protected' USING ERRCODE='42501';
 ELSIF TG_TABLE_NAME='quotation_purge' THEN
  IF current_user<>'app_owner' OR NOT EXISTS(SELECT 1 FROM quotation_issue q WHERE q.shop_id=NEW.shop_id AND q.doc_id=NEW.doc_id AND q.revision=NEW.revision AND q.revoked AND q.revocation_audit_id=NEW.audit_id) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.object_keys) k WHERE NOT EXISTS(SELECT 1 FROM document_output o WHERE o.shop_id=NEW.shop_id AND o.doc_id=NEW.doc_id AND o.revision=NEW.revision AND o.object_key=k)) THEN RAISE EXCEPTION 'Audited quotation purge required' USING ERRCODE='42501';END IF;
 ELSE
  SELECT * INTO p FROM quotation_purge WHERE shop_id=NEW.shop_id AND id=NEW.purge_id;
  IF p.id IS NULL OR NOT(p.object_keys ? NEW.object_key) OR NOT EXISTS(SELECT 1 FROM system_state WHERE singleton AND side_effects_enabled AND restore_epoch=p.restore_epoch) OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.action='quotation.purge' AND a.actor_id=p.initiator_id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND (a.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Current purge receipt required' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $fn$;
DO $guards$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['quotation_counter','quotation_issue','quotation_response','quotation_purge','quotation_purge_receipt'] LOOP EXECUTE format('CREATE TRIGGER quotation_history BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION quotation_issue_guard()',t);END LOOP;END $guards$;
REVOKE ALL ON FUNCTION quotation_issue_guard() FROM PUBLIC;
-- A bind cannot commit without the exact canonical document/model and attempt.
CREATE FUNCTION quotation_document_binding_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.document_revision;BEGIN
 IF NEW.revoked THEN RETURN NULL;END IF;
 SELECT * INTO d FROM document_revision WHERE shop_id=NEW.shop_id AND doc_id=NEW.doc_id AND revision=NEW.revision;
 IF d.doc_id IS NULL OR d.template<>'quotation' OR d.template_revision<>1 OR d.paper<>'A4' OR d.model_hash<>NEW.model_hash OR d.request_key<>NEW.request_key OR d.creator_id<>NEW.actor_id OR d.model->>'proposalId'<>NEW.proposal_id::text OR d.model->>'number'<>NEW.number OR d.model->>'profileId'<>NEW.profile_id::text OR d.model->>'validityPolicyId'<>NEW.validity_policy_id::text OR d.model->>'kind'<>'quotation.v1' OR d.model->'proposal' IS DISTINCT FROM (SELECT content->'customer' FROM booking_quotation_revision WHERE shop_id=NEW.shop_id AND id=NEW.proposal_id) OR (d.model-ARRAY['kind','language','number','docId','revision','proposalId','previousRevision','issuedAt','issueDate','expiryDate','pricingDates','profileId','validityPolicyId','shop','customerLabel','scope','proposal','estimates','terms'])<>'{}'::jsonb OR NOT EXISTS(SELECT 1 FROM document_attempt a WHERE a.shop_id=NEW.shop_id AND a.doc_id=NEW.doc_id AND a.revision=NEW.revision) THEN RAISE EXCEPTION 'Exact quotation document required' USING ERRCODE='23514';END IF;RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER quotation_document_binding AFTER INSERT ON quotation_issue DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION quotation_document_binding_guard();
REVOKE ALL ON FUNCTION quotation_document_binding_guard() FROM PUBLIC;
DO $document_privacy$ DECLARE body text;BEGIN
 body=pg_get_functiondef('document_history_guard()'::regprocedure);
 body=replace(body,'IF TG_OP=''DELETE'' THEN','IF TG_TABLE_NAME=''document_revision'' AND TG_OP=''UPDATE'' THEN IF current_user=''app_owner'' AND NEW.model=''{}''::jsonb AND (to_jsonb(NEW)-''model'')=(to_jsonb(OLD)-''model'') AND EXISTS(SELECT 1 FROM quotation_issue q WHERE q.shop_id=NEW.shop_id AND q.doc_id=NEW.doc_id AND q.revision=NEW.revision AND q.revoked) THEN RETURN NEW;END IF; END IF; IF TG_OP=''DELETE'' THEN');EXECUTE body;
END $document_privacy$;
CREATE FUNCTION redact_quotation(s uuid,d uuid,r integer,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE b public.quotation_issue;a uuid=uuidv7();actor uuid;epoch uuid;intent uuid=uuidv7();keys jsonb;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 SELECT * INTO b FROM quotation_issue WHERE shop_id=s AND doc_id=d AND revision=r;
 IF b.doc_id IS NULL THEN RAISE EXCEPTION 'Quotation unavailable' USING ERRCODE='P0002';END IF;IF b.revoked THEN RETURN;END IF;
 actor=NULLIF(current_setting('app.actor_id',true),'')::uuid;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',actor,'privacy.quotation','document',d,request,request,'{"redacted":true}');
 UPDATE quotation_issue SET revoked=true,revocation_audit_id=a,reason=NULL WHERE shop_id=s AND doc_id=d AND revision=r;
 UPDATE document_revision SET model='{}'::jsonb WHERE shop_id=s AND doc_id=d AND revision=r;
 UPDATE quotation_response SET value=NULL WHERE shop_id=s AND doc_id=d AND revision=r;
 PERFORM pg_advisory_xact_lock_shared(120036);SELECT restore_epoch INTO epoch FROM system_state WHERE singleton;
 SELECT coalesce(jsonb_agg(object_key),'[]'::jsonb) INTO keys FROM document_output WHERE shop_id=s AND doc_id=d AND revision=r;
 INSERT INTO quotation_purge(shop_id,id,doc_id,revision,audit_id,initiator_id,restore_epoch,object_keys) VALUES(s,intent,d,r,a,actor,epoch,keys);
 INSERT INTO pgboss.job(id,name,data,retry_limit,retry_delay,retry_backoff) SELECT intent,'media.process',jsonb_build_object('kind','quotation-purge','shopId',s,'purgeId',intent,'initiatorId',actor,'epoch',epoch),retry_limit,retry_delay,retry_backoff FROM pgboss.queue WHERE name='media.process';
 IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed media queue missing';END IF;
END $fn$;
REVOKE ALL ON FUNCTION redact_quotation(uuid,uuid,integer,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_quotation(uuid,uuid,integer,uuid) TO app_privacy;
ALTER FUNCTION redact_measurements(uuid,uuid,uuid) RENAME TO redact_measurements_before_quotations;
REVOKE ALL ON FUNCTION redact_measurements_before_quotations(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_measurements(s uuid,w uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE q record;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 FOR q IN SELECT DISTINCT i.doc_id,i.revision FROM quotation_issue i JOIN booking_quotation_scope b ON b.shop_id=i.shop_id AND b.revision_id=i.proposal_id JOIN garment_order o ON o.shop_id=b.shop_id AND o.id=b.order_id WHERE i.shop_id=s AND NOT i.revoked AND o.wearer_id=w LOOP PERFORM redact_quotation(s,q.doc_id,q.revision,request);END LOOP;
 PERFORM redact_measurements_before_quotations(s,w,request);
END $fn$;
REVOKE ALL ON FUNCTION redact_measurements(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_measurements(uuid,uuid,uuid) TO app_privacy;

CREATE POLICY quotation_privacy_audit ON audit_event FOR INSERT TO app_owner WITH CHECK(shop_context_allows(shop_id) AND action='privacy.quotation' AND entity_type='document');
-- A quoted design is only a customer-safe source pointer, but erasure of that
-- source must also fence and purge any issued dependent quotation snapshot.
ALTER FUNCTION redact_design_specification(uuid,uuid,uuid) RENAME TO redact_design_specification_before_quotations;
REVOKE ALL ON FUNCTION redact_design_specification_before_quotations(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_design_specification(s uuid,e uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE q record;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:job-slips:'||s::text,0));
 FOR q IN SELECT DISTINCT i.doc_id,i.revision FROM quotation_issue i JOIN booking_quotation_scope b ON b.shop_id=i.shop_id AND b.revision_id=i.proposal_id WHERE i.shop_id=s AND NOT i.revoked AND b.specification_id=e LOOP PERFORM redact_quotation(s,q.doc_id,q.revision,request);END LOOP;
 PERFORM redact_design_specification_before_quotations(s,e,request);
END $fn$;
REVOKE ALL ON FUNCTION redact_design_specification(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_design_specification(uuid,uuid,uuid) TO app_privacy;
