-- #153 / 1.3.2a. Additive, synthetic-only writer; no seeds or legacy backfill.
-- Retain on rollback. A populated rollout needs this migration's privacy-aware reader.
CREATE TABLE measurement_use_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,form_entry_id uuid NOT NULL,form_id uuid NOT NULL,previous_id uuid,
 payload jsonb NOT NULL,actor_id uuid NOT NULL,origin_draft_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,origin_draft_id),UNIQUE(shop_id,form_id,id),UNIQUE NULLS NOT DISTINCT(shop_id,form_id,previous_id),
 FOREIGN KEY(shop_id,form_entry_id,form_id) REFERENCES measurement_form_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,form_id,previous_id) REFERENCES measurement_use_event(shop_id,form_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE INDEX measurement_use_current ON measurement_use_event(shop_id,form_id,id DESC);
CREATE TABLE measurement_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,operation text NOT NULL CHECK(operation IN ('save','select')),
 customer_id uuid NOT NULL,wearer_id uuid NOT NULL,actor_id uuid NOT NULL,origin_draft_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE INDEX measurement_wearer_history ON measurement_event(shop_id,wearer_id,customer_id,id DESC);
CREATE TABLE measurement_version (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,form_entry_id uuid NOT NULL,form_id uuid NOT NULL,approval_id uuid NOT NULL,frozen jsonb NOT NULL,
 PRIMARY KEY(shop_id,id),FOREIGN KEY(shop_id,id) REFERENCES measurement_event(shop_id,id),
 FOREIGN KEY(shop_id,form_entry_id,form_id) REFERENCES measurement_form_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,form_id,approval_id) REFERENCES measurement_use_event(shop_id,form_id,id)
);
CREATE TABLE measurement_selection (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),event_id uuid NOT NULL,order_id uuid NOT NULL,scope_key uuid NOT NULL,piece_id uuid,selected_id uuid NOT NULL,
 PRIMARY KEY(shop_id,order_id,scope_key),UNIQUE(shop_id,event_id),UNIQUE(shop_id,selected_id),UNIQUE NULLS NOT DISTINCT(shop_id,order_id,piece_id),CHECK(scope_key=coalesce(piece_id,order_id)),
 FOREIGN KEY(shop_id,event_id) REFERENCES measurement_event(shop_id,id),FOREIGN KEY(shop_id,selected_id) REFERENCES measurement_version(shop_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id)
);
CREATE TABLE measurement_private (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),event_id uuid NOT NULL,source jsonb,fit_notes text,reason text,redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,event_id),FOREIGN KEY(shop_id,event_id) REFERENCES measurement_event(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL AND redaction_audit_id IS NULL AND source IS NOT NULL AND fit_notes IS NOT NULL AND reason IS NOT NULL) OR (redacted_at IS NOT NULL AND redaction_audit_id IS NOT NULL AND source IS NULL AND fit_notes IS NULL AND reason IS NULL))
);
CREATE TABLE measurement_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),version_id uuid NOT NULL,field_id uuid NOT NULL,position integer NOT NULL CHECK(position>=0 AND position<1000),
 raw_text text,unit text CHECK(unit IN ('in','cm')),numeric_value numeric,numerator numeric,denominator numeric,source jsonb,warning_reason text,redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,version_id,field_id),UNIQUE(shop_id,version_id,position),FOREIGN KEY(shop_id,version_id) REFERENCES measurement_version(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK(numeric_value>=0 AND numerator>=0 AND denominator>0 AND numerator=trunc(numerator) AND denominator=trunc(denominator)),
 CHECK((numeric_value IS NULL)=(numerator IS NULL) AND (numerator IS NULL)=(denominator IS NULL)),
 CHECK((redacted_at IS NULL AND redaction_audit_id IS NULL AND raw_text IS NOT NULL AND warning_reason IS NOT NULL) OR (redacted_at IS NOT NULL AND redaction_audit_id IS NOT NULL AND raw_text IS NULL AND warning_reason IS NULL AND unit IS NULL AND numeric_value IS NULL AND numerator IS NULL AND denominator IS NULL AND source IS NULL))
);
CREATE TABLE measurement_draft_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),draft_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),customer_id uuid NOT NULL,wearer_id uuid NOT NULL,
 order_id uuid,piece_id uuid,
 payload jsonb NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,draft_id,version),FOREIGN KEY(shop_id,draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 CHECK(piece_id IS NULL OR order_id IS NOT NULL),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),CHECK((redacted_at IS NULL)=(redaction_audit_id IS NULL))
);
CREATE INDEX measurement_draft_wearer ON measurement_draft_value(shop_id,wearer_id,draft_id);
CREATE TABLE measurement_erasure (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),wearer_id uuid NOT NULL,audit_id uuid NOT NULL,
 PRIMARY KEY(shop_id,wearer_id),FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['measurement_use_event','measurement_event','measurement_version','measurement_selection','measurement_private','measurement_value','measurement_draft_value','measurement_erasure'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY measurement_privacy ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
REVOKE INSERT ON measurement_erasure FROM app_user;

CREATE FUNCTION measurement_authority(s uuid,c uuid,w uuid) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE person public.wearer;r public.customer_wearer_relationship;p public.wearer_purpose_event;a public.guardian_authority;v public.guardian_verification_event;g public.guardian_purpose_event;BEGIN
 -- Same wearer barrier as age, relationship and consent mutations. No read can race withdrawal.
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:wearer:'||s::text||':'||w::text,0));
 SELECT * INTO person FROM wearer WHERE shop_id=s AND id=w;
 SELECT * INTO r FROM customer_wearer_relationship WHERE shop_id=s AND customer_id=c AND wearer_id=w;
 IF person.id IS NULL OR r.id IS NULL OR NOT r.authorised OR NOT r.informed OR r.authorisation_declined OR r.informed_declined OR person.age='unknown' OR EXISTS(SELECT 1 FROM measurement_erasure WHERE shop_id=s AND wearer_id=w) THEN RETURN false;END IF;
 IF person.age='adult' THEN
  SELECT * INTO p FROM wearer_purpose_event WHERE shop_id=s AND wearer_id=w AND purpose='service' ORDER BY wearer_version DESC LIMIT 1;
  RETURN coalesce(p.decision='grant' AND p.authority_epoch=person.authority_epoch,false);
 END IF;
 SELECT * INTO a FROM guardian_authority WHERE shop_id=s AND wearer_id=w ORDER BY wearer_version DESC LIMIT 1;
 SELECT * INTO v FROM guardian_verification_event WHERE shop_id=s AND wearer_id=w AND authority_id=a.id ORDER BY wearer_version DESC LIMIT 1;
 SELECT * INTO g FROM guardian_purpose_event WHERE shop_id=s AND wearer_id=w AND authority_id=a.id AND purpose='measurement' ORDER BY wearer_version DESC LIMIT 1;
 RETURN coalesce(a.scope IN ('measurement','measurement-and-private-photo') AND v.status='confirmed' AND v.authority_epoch=person.authority_epoch AND g.decision='grant' AND g.verification_id=v.id AND g.authority_epoch=person.authority_epoch,false);
END $fn$;
CREATE FUNCTION measurement_draft_authority_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.workflow='measurement.session' AND NOT (current_user='app_owner' AND NEW.payload->>'erased'='true') THEN
  IF NOT measurement_authority(NEW.shop_id,(NEW.payload->>'customerId')::uuid,(NEW.payload->>'wearerId')::uuid) THEN RAISE EXCEPTION 'Measurement authority required before storage' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_draft_authority BEFORE INSERT OR UPDATE ON durable_draft FOR EACH ROW EXECUTE FUNCTION measurement_draft_authority_guard();

CREATE FUNCTION measurement_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;p jsonb;f public.measurement_form_revision;prior uuid;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Measurement history immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;p=d.payload;
 IF d.id IS NULL OR d.lifecycle<>'active' OR d.schema_version<>1 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.idempotency_key=NEW.command_key AND (a.xmin::text)::xid8=pg_current_xact_id())
 THEN RAISE EXCEPTION 'Measurement provenance denied' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='measurement_use_event' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('measurementForms:'||NEW.shop_id::text,0));
  SELECT candidate.id INTO prior FROM measurement_use_event candidate WHERE candidate.shop_id=NEW.shop_id AND candidate.form_id=NEW.form_id AND NOT EXISTS(SELECT 1 FROM measurement_use_event successor WHERE successor.shop_id=candidate.shop_id AND successor.form_id=candidate.form_id AND successor.previous_id=candidate.id);
  IF d.workflow<>'measurement.use' OR p IS DISTINCT FROM NEW.payload OR NEW.form_entry_id IS DISTINCT FROM (p#>>'{form,entryId}')::uuid OR NEW.form_id IS DISTINCT FROM (p#>>'{form,revisionId}')::uuid OR NEW.previous_id IS DISTINCT FROM prior OR (p->>'baseId')::uuid IS DISTINCT FROM prior OR p->>'reviewed'<>'true' THEN RAISE EXCEPTION 'Measurement approval provenance denied' USING ERRCODE='23514';END IF;
 ELSE
  IF d.workflow<>'measurement.session' OR NEW.operation IS DISTINCT FROM p->>'operation' OR NEW.customer_id IS DISTINCT FROM (p->>'customerId')::uuid OR NEW.wearer_id IS DISTINCT FROM (p->>'wearerId')::uuid OR p->>'reviewed'<>'true' OR p->>'erased'<>'false' OR NOT measurement_authority(NEW.shop_id,NEW.customer_id,NEW.wearer_id) THEN RAISE EXCEPTION 'Measurement session provenance denied' USING ERRCODE='23514';END IF;
 END IF;
 NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());NEW.created_xid=pg_current_xact_id();RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_event_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_event FOR EACH ROW EXECUTE FUNCTION measurement_event_guard();
CREATE TRIGGER measurement_use_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_use_event FOR EACH ROW EXECUTE FUNCTION measurement_event_guard();

CREATE FUNCTION measurement_rational(raw text) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $fn$
DECLARE m text[];n numeric;d numeric;BEGIN
 IF length(raw)>80 THEN RETURN NULL;END IF;
 m=regexp_match(btrim(raw),'^(\d+)(?:\.(\d+))?$');
 IF m IS NOT NULL THEN d=power(10::numeric,coalesce(length(m[2]),0));RETURN ARRAY[m[1]::numeric*d+coalesce(m[2],'0')::numeric,d];END IF;
 m=regexp_match(btrim(raw),'^(?:(\d+) )?(\d+)/(\d+)$');
 IF m IS NULL OR m[3]::numeric=0 OR (m[1] IS NOT NULL AND m[2]::numeric>=m[3]::numeric) THEN RETURN NULL;END IF;
 RETURN ARRAY[coalesce(m[1],'0')::numeric*m[3]::numeric+m[2]::numeric,m[3]::numeric];
END $fn$;
CREATE FUNCTION measurement_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.measurement_event;d public.durable_draft;f public.measurement_form_revision;a public.measurement_use_event;p jsonb;x jsonb;field jsonb;r numeric[];step numeric[];num numeric;den numeric;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Measurement history immutable' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='measurement_version' THEN
  SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=NEW.id;
 ELSE SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;p=d.payload;
 IF e.id IS NULL OR e.created_xid<>pg_current_xact_id() THEN RAISE EXCEPTION 'Measurement child provenance denied' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='measurement_version' THEN
  SELECT * INTO f FROM measurement_form_revision WHERE shop_id=NEW.shop_id AND id=NEW.form_id;
  SELECT * INTO a FROM measurement_use_event WHERE shop_id=NEW.shop_id AND id=NEW.approval_id;
  IF e.operation<>'save' OR f.id IS NULL OR a.id IS NULL OR a.form_id<>f.id OR a.payload->>'operation'<>'approve' OR NEW.form_entry_id IS DISTINCT FROM (p#>>'{form,entryId}')::uuid OR NEW.form_id IS DISTINCT FROM (p#>>'{form,revisionId}')::uuid OR NEW.approval_id IS DISTINCT FROM (p->>'approvalId')::uuid
  OR NEW.frozen IS DISTINCT FROM jsonb_build_object('id',f.id,'entryId',f.entry_id,'content',f.content,'authority',f.authority,'contentHash',f.content_hash)
  THEN RAISE EXCEPTION 'Exact form approval required' USING ERRCODE='23514';END IF;
 ELSE
  IF e.operation<>'select' OR (p#>>'{target,orderId}')::uuid IS DISTINCT FROM NEW.order_id OR (p#>>'{target,pieceId}')::uuid IS DISTINCT FROM NEW.piece_id OR (p->>'selectedId')::uuid IS DISTINCT FROM NEW.selected_id OR (p->>'baseVersion')::integer<>0
  OR NOT EXISTS(SELECT 1 FROM measurement_version mv JOIN measurement_private private ON (private.shop_id,private.event_id)=(mv.shop_id,mv.id)
    JOIN order_acceptance_snapshot accepted ON accepted.shop_id=mv.shop_id AND accepted.order_id=NEW.order_id
    JOIN service_template_form binding ON binding.shop_id=accepted.shop_id AND binding.definition_id=accepted.definition_id AND binding.form_entry_id=mv.form_entry_id AND binding.form_revision_id=mv.form_id
    JOIN measurement_form_entry fe ON (fe.shop_id,fe.entry_id)=(mv.shop_id,mv.form_entry_id)
    JOIN measurement_form_availability availability ON (availability.shop_id,availability.id)=(fe.shop_id,fe.current_change_id)
    WHERE mv.shop_id=NEW.shop_id AND mv.id=NEW.selected_id AND private.redacted_at IS NULL
    AND availability.available AND availability.definition_id=mv.form_id
    AND binding.piece_key IS NOT DISTINCT FROM (SELECT source_key FROM order_piece WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND id=NEW.piece_id)
    AND mv.approval_id=(SELECT approval.id FROM measurement_use_event approval WHERE approval.shop_id=mv.shop_id AND approval.form_id=mv.form_id AND NOT EXISTS(SELECT 1 FROM measurement_use_event successor WHERE successor.shop_id=approval.shop_id AND successor.form_id=approval.form_id AND successor.previous_id=approval.id)))
  OR NOT EXISTS(SELECT 1 FROM garment_order o JOIN measurement_event source ON source.shop_id=o.shop_id AND source.id=NEW.selected_id WHERE o.shop_id=NEW.shop_id AND o.id=NEW.order_id AND o.intake_kind='custom' AND o.customer_id=e.customer_id AND o.wearer_id=e.wearer_id AND source.customer_id=e.customer_id AND source.wearer_id=e.wearer_id)
  THEN RAISE EXCEPTION 'Exact first selection required' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_version_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_version FOR EACH ROW EXECUTE FUNCTION measurement_child_guard();
CREATE TRIGGER measurement_selection_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_selection FOR EACH ROW EXECUTE FUNCTION measurement_child_guard();

CREATE FUNCTION measurement_redacted_payload(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$
 SELECT p||jsonb_build_object('source',jsonb_build_object('kind','unknown','date','','measurer','','method',''),'values','[]'::jsonb,'fitNotes','','reason','','reviewed',false,'erased',true)
$fn$;
CREATE FUNCTION measurement_private_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.measurement_event;d public.durable_draft;p jsonb;x jsonb;f jsonb;r numeric[];step numeric[];n numeric;den numeric;aud public.audit_event;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain measurement tombstones' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  SELECT * INTO aud FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.redaction_audit_id;
  IF current_user<>'app_owner' OR OLD.redacted_at IS NOT NULL OR NEW.redacted_at IS NULL OR aud.id IS NULL OR aud.action<>'privacy.measurements' OR aud.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR aud.occurred_at<>transaction_timestamp() THEN RAISE EXCEPTION 'Audited measurement redaction required' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='measurement_draft_value' THEN
   IF aud.entity_id<>OLD.wearer_id OR NEW.payload IS DISTINCT FROM measurement_redacted_payload(OLD.payload) OR (to_jsonb(NEW)-ARRAY['payload','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload','redacted_at','redaction_audit_id']) THEN RAISE EXCEPTION 'Draft redaction scope denied' USING ERRCODE='42501';END IF;
  ELSE
   IF TG_TABLE_NAME='measurement_private' THEN
    SELECT * INTO e FROM measurement_event WHERE shop_id=OLD.shop_id AND id=OLD.event_id;
    IF NEW.source IS NOT NULL OR NEW.fit_notes IS NOT NULL OR NEW.reason IS NOT NULL OR (to_jsonb(NEW)-ARRAY['source','fit_notes','reason','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['source','fit_notes','reason','redacted_at','redaction_audit_id']) THEN RAISE EXCEPTION 'Context redaction scope denied' USING ERRCODE='42501';END IF;
   ELSE
    SELECT * INTO e FROM measurement_event WHERE shop_id=OLD.shop_id AND id=OLD.version_id;
    IF NEW.raw_text IS NOT NULL OR NEW.unit IS NOT NULL OR NEW.numeric_value IS NOT NULL OR NEW.numerator IS NOT NULL OR NEW.denominator IS NOT NULL OR NEW.source IS NOT NULL OR NEW.warning_reason IS NOT NULL OR (to_jsonb(NEW)-ARRAY['raw_text','unit','numeric_value','numerator','denominator','source','warning_reason','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['raw_text','unit','numeric_value','numerator','denominator','source','warning_reason','redacted_at','redaction_audit_id']) THEN RAISE EXCEPTION 'Value redaction scope denied' USING ERRCODE='42501';END IF;
   END IF;
   IF e.wearer_id IS DISTINCT FROM aud.entity_id THEN RAISE EXCEPTION 'Wearer redaction scope denied' USING ERRCODE='42501';END IF;
  END IF;RETURN NEW;
 END IF;
 IF NEW.redacted_at IS NOT NULL OR NEW.redaction_audit_id IS NOT NULL THEN RAISE EXCEPTION 'No forged privacy facts' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='measurement_draft_value' THEN
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;
  IF d.workflow IS DISTINCT FROM 'measurement.session' OR d.version IS DISTINCT FROM NEW.version OR d.payload IS DISTINCT FROM NEW.payload OR (d.payload->>'customerId')::uuid IS DISTINCT FROM NEW.customer_id OR (d.payload->>'wearerId')::uuid IS DISTINCT FROM NEW.wearer_id
  OR (d.payload#>>'{target,orderId}')::uuid IS DISTINCT FROM NEW.order_id OR (d.payload#>>'{target,pieceId}')::uuid IS DISTINCT FROM NEW.piece_id
  OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.entity_type='durable_draft' AND a.entity_id=NEW.draft_id AND a.idempotency_key=NEW.command_key AND (a.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Private replay provenance denied' USING ERRCODE='23514';END IF;
 ELSE
  IF TG_TABLE_NAME='measurement_private' THEN
   SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;
  ELSE SELECT * INTO e FROM measurement_event WHERE shop_id=NEW.shop_id AND id=NEW.version_id;END IF;
  SELECT * INTO d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;p=d.payload;
  IF e.id IS NULL OR e.created_xid<>pg_current_xact_id() THEN RAISE EXCEPTION 'Private measurement provenance denied' USING ERRCODE='23514';END IF;
  IF TG_TABLE_NAME='measurement_private' THEN
   IF NEW.source IS DISTINCT FROM p->'source' OR NEW.fit_notes IS DISTINCT FROM p->>'fitNotes' OR NEW.reason IS DISTINCT FROM p->>'reason' THEN RAISE EXCEPTION 'Private context differs from draft' USING ERRCODE='23514';END IF;
  ELSE
   x=p->'values'->NEW.position;
   SELECT field INTO f FROM measurement_version v CROSS JOIN jsonb_array_elements(v.frozen#>'{content,groups}') g CROSS JOIN jsonb_array_elements(g->'fields') field WHERE v.shop_id=NEW.shop_id AND v.id=NEW.version_id AND (field->>'id')::uuid=NEW.field_id;
   IF x IS NULL OR f IS NULL OR (x->>'fieldId')::uuid IS DISTINCT FROM NEW.field_id OR x->>'rawText' IS DISTINCT FROM NEW.raw_text OR x->>'unit' IS DISTINCT FROM NEW.unit OR nullif(x->'source','null'::jsonb) IS DISTINCT FROM NEW.source OR x->>'warningReason' IS DISTINCT FROM NEW.warning_reason THEN RAISE EXCEPTION 'Exact field provenance denied' USING ERRCODE='23514';END IF;
   r=measurement_rational(NEW.raw_text);step=measurement_rational(f#>>'{precision,increment}');
   IF btrim(NEW.raw_text)='' THEN
    IF (f->>'required')::boolean OR NEW.numeric_value IS NOT NULL OR NEW.unit IS NOT NULL THEN RAISE EXCEPTION 'Required measurement unknown' USING ERRCODE='23514';END IF;
   ELSE
    n=r[1];den=r[2];
    IF r IS NULL OR NEW.numeric_value IS NULL OR NEW.numeric_value*den<>n OR NEW.numerator*den<>n*NEW.denominator OR NEW.unit IS NULL OR NOT (f->'units' ? NEW.unit) OR step IS NULL OR step[1]<=0 THEN RAISE EXCEPTION 'Exact numeric representation required' USING ERRCODE='23514';END IF;
    IF NEW.unit IS DISTINCT FROM f#>>'{precision,unit}' THEN IF NEW.unit='in' THEN n=n*127;den=den*50;ELSE n=n*50;den=den*127;END IF;END IF;
    IF mod(n*step[2],den*step[1])<>0 THEN RAISE EXCEPTION 'Approved precision required' USING ERRCODE='23514';END IF;
   END IF;
  END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_private_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_private FOR EACH ROW EXECUTE FUNCTION measurement_private_guard();
CREATE TRIGGER measurement_value_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_value FOR EACH ROW EXECUTE FUNCTION measurement_private_guard();
CREATE TRIGGER measurement_draft_value_write BEFORE INSERT OR UPDATE OR DELETE ON measurement_draft_value FOR EACH ROW EXECUTE FUNCTION measurement_private_guard();

CREATE FUNCTION measurement_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;kind text;BEGIN
 kind=CASE WHEN TG_TABLE_NAME='measurement_use_event' THEN 'measurement.use' ELSE 'measurement.session' END;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM kind OR d.result_id IS DISTINCT FROM NEW.id
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_id=NEW.actor_id AND k.action='draft.promote' AND k.response#>>'{draft,result,type}'=kind AND (k.response#>>'{draft,result,id}')::uuid=NEW.id)
 THEN RAISE EXCEPTION 'Atomic measurement promotion required' USING ERRCODE='23514';END IF;
 IF kind='measurement.session' THEN
  IF NOT EXISTS(SELECT 1 FROM measurement_private WHERE shop_id=NEW.shop_id AND event_id=NEW.id) OR NOT EXISTS(SELECT 1 FROM measurement_draft_value WHERE shop_id=NEW.shop_id AND draft_id=d.id AND version=d.version)
  OR (NEW.operation='save' AND (NOT EXISTS(SELECT 1 FROM measurement_version WHERE shop_id=NEW.shop_id AND id=NEW.id) OR (SELECT count(*) FROM measurement_value WHERE shop_id=NEW.shop_id AND version_id=NEW.id)<>jsonb_array_length(d.payload->'values')))
  OR (NEW.operation='select' AND NOT EXISTS(SELECT 1 FROM measurement_selection WHERE shop_id=NEW.shop_id AND event_id=NEW.id)) THEN RAISE EXCEPTION 'Complete measurement promotion required' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER measurement_commit AFTER INSERT ON measurement_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION measurement_commit_guard();
CREATE CONSTRAINT TRIGGER measurement_use_commit AFTER INSERT ON measurement_use_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION measurement_commit_guard();

CREATE POLICY measurement_privacy_audit ON audit_event FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id) AND action='privacy.measurements');
CREATE POLICY measurement_draft_privacy ON durable_draft FOR ALL TO app_owner USING(shop_context_allows(shop_id) AND workflow='measurement.session') WITH CHECK(shop_context_allows(shop_id) AND workflow='measurement.session');
CREATE FUNCTION redact_measurements(s uuid,w uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7();d uuid;locked_drafts uuid[];BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 -- Draft locks precede wearer barrier, matching save/promote. Recheck discovery
 -- after the barrier: a newly committed draft makes this attempt retry safely.
 SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO locked_drafts FROM durable_draft WHERE shop_id=s AND workflow='measurement.session' AND payload->>'wearerId'=w::text;
 FOREACH d IN ARRAY locked_drafts LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||d::text,0));
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:wearer:'||s::text||':'||w::text,0));
 IF EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=s AND workflow='measurement.session' AND payload->>'wearerId'=w::text AND NOT(id=ANY(locked_drafts))) THEN RAISE EXCEPTION 'Retry measurement privacy discovery' USING ERRCODE='40001';END IF;
 IF EXISTS(SELECT 1 FROM measurement_erasure WHERE shop_id=s AND wearer_id=w) THEN RETURN;END IF;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.measurements','wearer',w,request,request,'{"redacted":true}');
 INSERT INTO measurement_erasure(shop_id,wearer_id,audit_id) VALUES(s,w,a);
 UPDATE durable_draft SET payload=measurement_redacted_payload(payload),version=version+1,updated_at=greatest(updated_at,clock_timestamp()) WHERE shop_id=s AND workflow='measurement.session' AND payload->>'wearerId'=w::text AND payload->>'erased'='false';
 UPDATE measurement_draft_value SET payload=measurement_redacted_payload(payload),redacted_at=transaction_timestamp(),redaction_audit_id=a WHERE shop_id=s AND wearer_id=w AND redacted_at IS NULL;
 UPDATE measurement_value x SET raw_text=NULL,unit=NULL,numeric_value=NULL,numerator=NULL,denominator=NULL,source=NULL,warning_reason=NULL,redacted_at=transaction_timestamp(),redaction_audit_id=a FROM measurement_event e WHERE e.shop_id=s AND e.wearer_id=w AND (x.shop_id,x.version_id)=(e.shop_id,e.id) AND x.redacted_at IS NULL;
 UPDATE measurement_private x SET source=NULL,fit_notes=NULL,reason=NULL,redacted_at=transaction_timestamp(),redaction_audit_id=a FROM measurement_event e WHERE e.shop_id=s AND e.wearer_id=w AND (x.shop_id,x.event_id)=(e.shop_id,e.id) AND x.redacted_at IS NULL;
END $fn$;
REVOKE ALL ON FUNCTION redact_measurements(uuid,uuid,uuid) FROM PUBLIC,app_user;GRANT EXECUTE ON FUNCTION redact_measurements(uuid,uuid,uuid) TO app_privacy;
REVOKE ALL ON FUNCTION measurement_authority(uuid,uuid,uuid),measurement_draft_authority_guard(),measurement_event_guard(),measurement_child_guard(),measurement_private_guard(),measurement_commit_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION measurement_authority(uuid,uuid,uuid) TO app_user;

-- Preserve all existing private-draft readers while adding audited measurement erasure.
CREATE OR REPLACE FUNCTION durable_draft_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND current_user='app_owner' AND OLD.workflow='measurement.session'
 AND (to_jsonb(NEW)-ARRAY['payload','version','updated_at'])=(to_jsonb(OLD)-ARRAY['payload','version','updated_at']) AND NEW.version=OLD.version+1 AND NEW.updated_at>=OLD.updated_at
 AND NEW.payload=measurement_redacted_payload(OLD.payload)
 AND EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=OLD.shop_id AND a.action='privacy.measurements' AND a.entity_id=(OLD.payload->>'wearerId')::uuid AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.occurred_at=transaction_timestamp()) THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND current_user='app_owner' AND OLD.workflow='design.reference'
 AND (to_jsonb(NEW)-ARRAY['payload','version','updated_at'])=(to_jsonb(OLD)-ARRAY['payload','version','updated_at']) AND NEW.version=OLD.version+1 AND NEW.updated_at>=OLD.updated_at
 AND NEW.payload=design_redacted_source_payload(OLD.payload)
 AND EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=OLD.shop_id AND a.action='privacy.design-reference-draft' AND a.entity_type='design-reference-draft' AND a.entity_id=OLD.id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.occurred_at=transaction_timestamp()) THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND current_user='app_owner' AND OLD.workflow='design.specification'
 AND (to_jsonb(NEW)-ARRAY['payload','version','updated_at'])=(to_jsonb(OLD)-ARRAY['payload','version','updated_at']) AND NEW.version=OLD.version+1 AND NEW.updated_at>=OLD.updated_at
 AND NEW.payload=design_redacted_spec_payload(OLD.payload)
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

CREATE FUNCTION measurement_contact_merge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM measurement_event WHERE shop_id=NEW.shop_id AND customer_id IN(NEW.source_id,NEW.survivor_id)) OR EXISTS(SELECT 1 FROM measurement_draft_value WHERE shop_id=NEW.shop_id AND customer_id IN(NEW.source_id,NEW.survivor_id)) THEN RAISE EXCEPTION 'Measurement associations cannot be relinked by contact merge' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER measurement_contact_merge BEFORE INSERT ON customer_merge_event FOR EACH ROW EXECUTE FUNCTION measurement_contact_merge_guard();
REVOKE ALL ON FUNCTION measurement_contact_merge_guard() FROM PUBLIC;
