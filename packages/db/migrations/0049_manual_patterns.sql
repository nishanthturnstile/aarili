-- #164 / 1.3.3a. Additive, synthetic-only until existing activation gates close.
-- Keep this schema and pattern-aware privacy/readers on rollback; no down migration.
CREATE TABLE pattern_capability (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,
 manifest_entry_id uuid NOT NULL,manifest_id uuid NOT NULL,scope_key text NOT NULL,
 version integer NOT NULL CHECK(version>0),previous_id uuid,payload jsonb NOT NULL CHECK(octet_length(payload::text)<=16384),
 actor_id uuid NOT NULL,origin_draft_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,manifest_id,scope_key,version),UNIQUE(shop_id,manifest_id,scope_key,id),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,manifest_entry_id,manifest_id) REFERENCES service_template_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,manifest_id,scope_key,previous_id) REFERENCES pattern_capability(shop_id,manifest_id,scope_key,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE pattern_scope (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),order_id uuid NOT NULL,scope_key uuid NOT NULL,piece_id uuid,
 customer_id uuid NOT NULL,wearer_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 latest_saved_id uuid,current_id uuid,method text NOT NULL CHECK(method IN('manual','external')),event_id uuid NOT NULL,
 PRIMARY KEY(shop_id,order_id,scope_key),UNIQUE NULLS NOT DISTINCT(shop_id,order_id,piece_id),
 CHECK(scope_key=coalesce(piece_id,order_id)),FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id)
);
CREATE TABLE pattern_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,order_id uuid NOT NULL,scope_key uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),operation text NOT NULL CHECK(operation IN('prepare','save','review','select')),
 method text NOT NULL CHECK(method IN('manual','external')),capability_id uuid NOT NULL,reference_id uuid,saved_id uuid,current_id uuid,previous_saved_id uuid,previous_current_id uuid,
 review_state text CHECK(review_state IN('reviewed','changes-required','withdrawn')),use_mode text NOT NULL CHECK(use_mode IN('reference-only','inputs-reviewed')),
 digest text,context_digest text NOT NULL CHECK(context_digest ~ '^[a-f0-9]{64}$'),
 design_context_version integer NOT NULL DEFAULT 0,measurement_context_version integer NOT NULL DEFAULT 0,
 actor_id uuid NOT NULL,origin_draft_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,order_id,scope_key,version),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,order_id,scope_key) REFERENCES pattern_scope(shop_id,order_id,scope_key) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,capability_id) REFERENCES pattern_capability(shop_id,id),FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((operation='review')=(review_state IS NOT NULL)),CHECK(operation NOT IN('review','select') OR (reference_id IS NOT NULL AND digest ~ '^[a-f0-9]{64}$'))
);
CREATE TABLE pattern_version (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,order_id uuid NOT NULL,scope_key uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),previous_id uuid,design_id uuid,measurement_id uuid,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,order_id,scope_key,id),UNIQUE(shop_id,order_id,scope_key,version),
 FOREIGN KEY(shop_id,id) REFERENCES pattern_event(shop_id,id),
 FOREIGN KEY(shop_id,order_id,scope_key,previous_id) REFERENCES pattern_version(shop_id,order_id,scope_key,id),
 FOREIGN KEY(shop_id,order_id,scope_key,design_id) REFERENCES design_spec_version(shop_id,order_id,scope_key,id),
 FOREIGN KEY(shop_id,measurement_id) REFERENCES measurement_version(shop_id,id),CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE pattern_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),event_id uuid NOT NULL,payload jsonb,
 redacted_at timestamptz,redaction_audit_id uuid,PRIMARY KEY(shop_id,event_id),
 FOREIGN KEY(shop_id,event_id) REFERENCES pattern_event(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL AND redaction_audit_id IS NULL AND payload IS NOT NULL AND octet_length(payload::text)<=65536) OR (redacted_at IS NOT NULL AND redaction_audit_id IS NOT NULL AND payload IS NULL))
);
CREATE TABLE pattern_draft_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),draft_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 order_id uuid NOT NULL,customer_id uuid NOT NULL,wearer_id uuid NOT NULL,payload jsonb NOT NULL,
 audit_id uuid NOT NULL,command_key uuid NOT NULL,redacted_at timestamptz,redaction_audit_id uuid,
 PRIMARY KEY(shop_id,draft_id,version),FOREIGN KEY(shop_id,draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redacted_at IS NULL)=(redaction_audit_id IS NULL)),CHECK(octet_length(payload::text)<=65536)
);
CREATE INDEX pattern_private_wearer ON pattern_draft_value(shop_id,wearer_id);
CREATE INDEX pattern_scope_wearer ON pattern_scope(shop_id,wearer_id,order_id);
CREATE INDEX pattern_reference_reviews ON pattern_event(shop_id,reference_id,version DESC);
ALTER TABLE pattern_scope ADD FOREIGN KEY(shop_id,event_id) REFERENCES pattern_event(shop_id,id);
ALTER TABLE pattern_scope ADD FOREIGN KEY(shop_id,order_id,scope_key,latest_saved_id) REFERENCES pattern_version(shop_id,order_id,scope_key,id);
ALTER TABLE pattern_scope ADD FOREIGN KEY(shop_id,order_id,scope_key,current_id) REFERENCES pattern_version(shop_id,order_id,scope_key,id);
ALTER TABLE pattern_event ADD FOREIGN KEY(shop_id,order_id,scope_key,reference_id) REFERENCES pattern_version(shop_id,order_id,scope_key,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE pattern_event ADD FOREIGN KEY(shop_id,order_id,scope_key,saved_id) REFERENCES pattern_version(shop_id,order_id,scope_key,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE pattern_event ADD FOREIGN KEY(shop_id,order_id,scope_key,current_id) REFERENCES pattern_version(shop_id,order_id,scope_key,id) DEFERRABLE INITIALLY DEFERRED;
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['pattern_capability','pattern_scope','pattern_event','pattern_version','pattern_value','pattern_draft_value'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY pattern_privacy ON %I FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 END LOOP;
END $policies$;
GRANT UPDATE(version,latest_saved_id,current_id,method,event_id) ON pattern_scope TO app_user;
CREATE FUNCTION pattern_capability_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;head public.pattern_capability;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pattern capabilities immutable' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('patternCapability:'||NEW.shop_id::text||':'||NEW.manifest_id::text||':'||coalesce(nullif(NEW.scope_key,''),'order'),0));
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO head FROM pattern_capability WHERE shop_id=NEW.shop_id AND manifest_id=NEW.manifest_id AND scope_key=NEW.scope_key ORDER BY version DESC LIMIT 1;
 IF d.id IS NULL OR d.workflow<>'pattern.capability' OR d.schema_version<>1 OR d.lifecycle<>'active' OR d.payload IS DISTINCT FROM NEW.payload OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NEW.version<>coalesce(head.version,0)+1 OR NEW.previous_id IS DISTINCT FROM head.id
 OR (NEW.payload->>'baseVersion')::integer IS DISTINCT FROM NEW.version-1 OR NEW.payload->>'reviewed' IS DISTINCT FROM 'true' OR nullif(btrim(NEW.payload->>'reason'),'') IS NULL
 OR (NEW.payload#>>'{binding,manifest,entryId}')::uuid IS DISTINCT FROM NEW.manifest_entry_id OR (NEW.payload#>>'{binding,manifest,revisionId}')::uuid IS DISTINCT FROM NEW.manifest_id OR coalesce(NEW.payload#>>'{binding,pieceKey}','') IS DISTINCT FROM NEW.scope_key
 OR NEW.payload->>'manual' NOT IN('not-recorded','available','unavailable') OR NEW.payload->>'external' NOT IN('not-recorded','available','unavailable')
 OR NOT EXISTS(SELECT 1 FROM service_template_revision m WHERE m.shop_id=NEW.shop_id AND m.id=NEW.manifest_id AND (NEW.scope_key='' OR EXISTS(SELECT 1 FROM jsonb_array_elements(m.content->'pieces') p WHERE p->>'key'=NEW.scope_key AND p->>'applicability'='applicable')))
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.action='pattern.capability' AND a.actor_id=NEW.actor_id AND a.entity_id=NEW.id AND a.idempotency_key=NEW.command_key)
 THEN RAISE EXCEPTION 'Pattern capability provenance denied' USING ERRCODE='23514';END IF;
 NEW.created_xid=pg_current_xact_id();NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_capability_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_capability FOR EACH ROW EXECUTE FUNCTION pattern_capability_guard();
CREATE FUNCTION pattern_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;c public.pattern_scope;cap public.pattern_capability;ref public.pattern_version;review public.pattern_event;p jsonb;o public.garment_order;piece text;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pattern events immutable' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('order:'||NEW.shop_id::text||':'||NEW.order_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('patternScope:'||NEW.shop_id::text||':'||NEW.order_id::text||':'||CASE WHEN NEW.scope_key=NEW.order_id THEN 'order' ELSE NEW.scope_key::text END,0));
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;p=d.payload;
 SELECT * INTO c FROM pattern_scope WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 SELECT source_key INTO piece FROM order_piece WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND id=NEW.scope_key;
 SELECT * INTO cap FROM pattern_capability WHERE shop_id=NEW.shop_id AND id=NEW.capability_id;
 IF d.id IS NULL OR d.workflow<>'pattern.reference' OR d.schema_version<>1 OR d.lifecycle<>'active' OR p->>'erased' IS DISTINCT FROM 'false'
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR o.id IS NULL OR o.intake_kind<>'custom'
 OR NOT measurement_authority(NEW.shop_id,o.customer_id,o.wearer_id)
 OR o.customer_id IS DISTINCT FROM (p->>'customerId')::uuid OR o.wearer_id IS DISTINCT FROM (p->>'wearerId')::uuid
 OR NEW.order_id IS DISTINCT FROM (p->>'orderId')::uuid OR NEW.scope_key IS DISTINCT FROM coalesce((p->>'pieceId')::uuid,NEW.order_id)
 OR NEW.operation IS DISTINCT FROM p->>'operation' OR NEW.method IS DISTINCT FROM p->>'method' OR NEW.use_mode IS DISTINCT FROM p->>'use'
 OR NEW.version<>coalesce(c.version,0)+1 OR (p->>'baseVersion')::integer IS DISTINCT FROM coalesce(c.version,0) OR (p->>'baseSavedId')::uuid IS DISTINCT FROM c.latest_saved_id
 OR NEW.previous_saved_id IS DISTINCT FROM c.latest_saved_id OR NEW.previous_current_id IS DISTINCT FROM c.current_id
 OR cap.id IS NULL OR cap.payload->>NEW.method IS DISTINCT FROM 'available' OR cap.scope_key IS DISTINCT FROM coalesce(piece,'')
 OR NOT EXISTS(SELECT 1 FROM order_acceptance_snapshot a WHERE a.shop_id=NEW.shop_id AND a.order_id=NEW.order_id AND a.definition_id=cap.manifest_id)
 OR EXISTS(SELECT 1 FROM pattern_capability newer WHERE newer.shop_id=cap.shop_id AND newer.manifest_id=cap.manifest_id AND newer.scope_key=cap.scope_key AND newer.version>cap.version)
 OR NEW.saved_id IS DISTINCT FROM (CASE WHEN NEW.operation='save' THEN NEW.id ELSE c.latest_saved_id END)
 OR NEW.current_id IS DISTINCT FROM (CASE WHEN NEW.operation='select' THEN (p->>'referenceId')::uuid ELSE c.current_id END)
 OR NEW.reference_id IS DISTINCT FROM (CASE WHEN NEW.operation='save' THEN NEW.id ELSE (p->>'referenceId')::uuid END)
 OR NEW.review_state IS DISTINCT FROM (CASE WHEN NEW.operation='review' THEN p->>'reviewState' ELSE NULL END)
 OR NEW.digest IS DISTINCT FROM p->>'digest'
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.action='pattern.'||NEW.operation AND a.entity_id=NEW.id AND a.idempotency_key=NEW.command_key)
 THEN RAISE EXCEPTION 'Exact pattern event provenance denied' USING ERRCODE='23514';END IF;
 SELECT coalesce(max(version),0) INTO NEW.design_context_version FROM design_spec_scope WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key;
 SELECT coalesce(max(version),0) INTO NEW.measurement_context_version FROM measurement_selection WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key;
 IF NEW.operation IN('review','select') THEN
  IF p->>'acknowledged' IS DISTINCT FROM 'true' OR nullif(btrim(p->>'reason'),'') IS NULL THEN RAISE EXCEPTION 'Explicit pattern review required' USING ERRCODE='23514';END IF;
  SELECT * INTO ref FROM pattern_version WHERE shop_id=NEW.shop_id AND id=NEW.reference_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key;
  IF ref.id IS NULL OR NOT EXISTS(SELECT 1 FROM pattern_value x JOIN pattern_event original ON(original.shop_id,original.id)=(x.shop_id,x.event_id) WHERE x.shop_id=NEW.shop_id AND x.event_id=ref.id AND x.redacted_at IS NULL AND original.method=NEW.method) THEN RAISE EXCEPTION 'Pattern reference unavailable' USING ERRCODE='23514';END IF;
  IF NEW.operation='select' THEN
   SELECT * INTO review FROM pattern_event WHERE shop_id=NEW.shop_id AND reference_id=ref.id AND operation='review' ORDER BY version DESC LIMIT 1;
   IF review.review_state IN('changes-required','withdrawn') THEN RAISE EXCEPTION 'Pattern reference review blocks selection' USING ERRCODE='23514';END IF;
   IF NEW.use_mode='inputs-reviewed' AND (review.id IS NULL OR review.review_state<>'reviewed' OR review.context_digest<>NEW.context_digest OR review.capability_id<>NEW.capability_id OR review.design_context_version<>NEW.design_context_version OR review.measurement_context_version<>NEW.measurement_context_version
    OR NOT EXISTS(SELECT 1 FROM pattern_value x WHERE x.shop_id=NEW.shop_id AND x.event_id=ref.id AND x.payload#>>'{content,design,state}' IN('known','not-applicable') AND x.payload#>>'{content,measurement,state}' IN('known','not-applicable'))
    OR ref.design_id IS DISTINCT FROM (SELECT current_id FROM design_spec_scope WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key)
    OR ref.measurement_id IS DISTINCT FROM (SELECT selected_id FROM measurement_selection WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key ORDER BY version DESC LIMIT 1))
    THEN RAISE EXCEPTION 'Current exact input review required' USING ERRCODE='23514';END IF;
  END IF;
 END IF;
 NEW.created_xid=pg_current_xact_id();NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_event_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_event FOR EACH ROW EXECUTE FUNCTION pattern_event_guard();
CREATE FUNCTION pattern_version_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.pattern_event;d public.durable_draft;o public.garment_order;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pattern versions immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM pattern_event WHERE shop_id=NEW.shop_id AND id=NEW.id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=e.origin_draft_id;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 IF e.id IS NULL OR e.created_xid<>pg_current_xact_id() OR e.operation<>'save' OR e.order_id<>NEW.order_id OR e.scope_key<>NEW.scope_key
 OR NEW.previous_id IS DISTINCT FROM e.previous_saved_id OR NEW.version<>coalesce((SELECT version FROM pattern_version WHERE shop_id=NEW.shop_id AND id=NEW.previous_id),0)+1
 OR nullif(btrim(d.payload#>>'{content,locator}'),'') IS NULL
 OR NEW.design_id IS DISTINCT FROM (CASE WHEN d.payload#>>'{content,design,state}'='known' THEN (d.payload#>>'{content,design,versionId}')::uuid ELSE NULL END)
 OR NEW.measurement_id IS DISTINCT FROM (CASE WHEN d.payload#>>'{content,measurement,state}'='known' THEN (d.payload#>>'{content,measurement,versionId}')::uuid ELSE NULL END)
 OR (d.payload#>>'{content,design,state}'='known' AND NEW.design_id IS NULL) OR (d.payload#>>'{content,measurement,state}'='known' AND NEW.measurement_id IS NULL)
 OR (NEW.measurement_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM measurement_event m JOIN measurement_private x ON(x.shop_id,x.event_id)=(m.shop_id,m.id) JOIN measurement_version mv ON(mv.shop_id,mv.id)=(m.shop_id,m.id) JOIN order_acceptance_snapshot accepted ON accepted.shop_id=m.shop_id AND accepted.order_id=NEW.order_id JOIN service_template_form binding ON binding.shop_id=accepted.shop_id AND binding.definition_id=accepted.definition_id AND binding.form_entry_id=mv.form_entry_id AND binding.form_revision_id=mv.form_id WHERE m.shop_id=NEW.shop_id AND m.id=NEW.measurement_id AND m.customer_id=o.customer_id AND m.wearer_id=o.wearer_id AND x.redacted_at IS NULL AND binding.piece_key IS NOT DISTINCT FROM (SELECT source_key FROM order_piece WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND id=NEW.scope_key)))
 THEN RAISE EXCEPTION 'Pattern version source denied' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_version_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_version FOR EACH ROW EXECUTE FUNCTION pattern_version_guard();
CREATE FUNCTION pattern_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.pattern_event;o public.garment_order;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain pattern scope' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM pattern_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 IF e.id IS NULL OR e.created_xid<>pg_current_xact_id() OR e.order_id<>NEW.order_id OR e.scope_key<>NEW.scope_key OR e.version<>NEW.version OR e.saved_id IS DISTINCT FROM NEW.latest_saved_id OR e.current_id IS DISTINCT FROM NEW.current_id OR e.method<>NEW.method OR o.customer_id<>NEW.customer_id OR o.wearer_id<>NEW.wearer_id
 OR (TG_OP='INSERT' AND NEW.version<>1)
 OR (TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['version','latest_saved_id','current_id','method','event_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['version','latest_saved_id','current_id','method','event_id']) OR NEW.version<>OLD.version+1 OR e.previous_saved_id IS DISTINCT FROM OLD.latest_saved_id OR e.previous_current_id IS DISTINCT FROM OLD.current_id))
 THEN RAISE EXCEPTION 'Pattern scope CAS denied' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_scope_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_scope FOR EACH ROW EXECUTE FUNCTION pattern_scope_guard();
CREATE FUNCTION pattern_private_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.pattern_event;d public.durable_draft;w uuid;BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.redacted_at IS NOT NULL OR NEW.redaction_audit_id IS NOT NULL THEN RAISE EXCEPTION 'No forged pattern erasure' USING ERRCODE='23514';END IF;
  IF TG_TABLE_NAME='pattern_value' THEN
   SELECT * INTO e FROM pattern_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=e.origin_draft_id;
   IF e.id IS NULL OR e.created_xid<>pg_current_xact_id() OR NEW.payload IS DISTINCT FROM d.payload THEN RAISE EXCEPTION 'Exact private pattern values required' USING ERRCODE='23514';END IF;
  ELSE
   SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;
   IF d.workflow IS DISTINCT FROM 'pattern.reference' OR d.version<>NEW.version OR d.payload IS DISTINCT FROM NEW.payload OR NEW.order_id IS DISTINCT FROM (d.payload->>'orderId')::uuid OR NEW.customer_id IS DISTINCT FROM (d.payload->>'customerId')::uuid OR NEW.wearer_id IS DISTINCT FROM (d.payload->>'wearerId')::uuid
   OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.entity_type='durable_draft' AND a.entity_id=NEW.draft_id AND a.idempotency_key=NEW.command_key AND (a.xmin::text)::xid8=pg_current_xact_id()) THEN RAISE EXCEPTION 'Exact private pattern replay required' USING ERRCODE='23514';END IF;
  END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='pattern_value' THEN SELECT s.wearer_id INTO w FROM pattern_event pe JOIN pattern_scope s ON(s.shop_id,s.order_id,s.scope_key)=(pe.shop_id,pe.order_id,pe.scope_key) WHERE pe.shop_id=OLD.shop_id AND pe.id=OLD.event_id;
  ELSE w=OLD.wearer_id;END IF;
  IF current_user<>'app_owner' OR OLD.redacted_at IS NOT NULL OR NEW.redacted_at IS NULL OR (to_jsonb(NEW)-ARRAY['payload','redacted_at','redaction_audit_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload','redacted_at','redaction_audit_id'])
  OR NOT EXISTS(SELECT 1 FROM measurement_erasure er JOIN audit_event a ON(a.shop_id,a.id)=(er.shop_id,er.audit_id) WHERE er.shop_id=NEW.shop_id AND er.wearer_id=w AND a.id=NEW.redaction_audit_id AND a.action='privacy.measurements' AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid)
  THEN RAISE EXCEPTION 'Audited pattern erasure required' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='pattern_value' THEN IF NEW.payload IS NOT NULL THEN RAISE EXCEPTION 'Redact private pattern payload' USING ERRCODE='42501';END IF;
  ELSE IF NEW.payload IS DISTINCT FROM pattern_redacted_payload(OLD.payload) THEN RAISE EXCEPTION 'Redact exact pattern replay' USING ERRCODE='42501';END IF;END IF;
 ELSE RAISE EXCEPTION 'Retain pattern provenance' USING ERRCODE='42501';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_value_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_value FOR EACH ROW EXECUTE FUNCTION pattern_private_guard();
CREATE TRIGGER pattern_draft_write BEFORE INSERT OR UPDATE OR DELETE ON pattern_draft_value FOR EACH ROW EXECUTE FUNCTION pattern_private_guard();
CREATE FUNCTION pattern_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;kind text;BEGIN
 kind=CASE WHEN TG_TABLE_NAME='pattern_capability' THEN 'pattern.capability' ELSE 'pattern.reference' END;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM kind OR d.result_id IS DISTINCT FROM NEW.id
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_id=NEW.actor_id AND k.action='draft.promote' AND k.status=200 AND k.response#>>'{draft,result,type}'=kind AND (k.response#>>'{draft,result,id}')::uuid=NEW.id)
 THEN RAISE EXCEPTION 'Atomic pattern command required' USING ERRCODE='23514';END IF;
 IF kind='pattern.reference' THEN
  IF NOT EXISTS(SELECT 1 FROM pattern_draft_value WHERE shop_id=NEW.shop_id AND draft_id=d.id AND version=d.version) OR NOT EXISTS(SELECT 1 FROM pattern_value WHERE shop_id=NEW.shop_id AND event_id=NEW.id) OR NOT EXISTS(SELECT 1 FROM pattern_scope WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND scope_key=NEW.scope_key AND version>=NEW.version) THEN RAISE EXCEPTION 'Complete private pattern command required' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER pattern_capability_commit AFTER INSERT ON pattern_capability DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pattern_commit_guard();
CREATE CONSTRAINT TRIGGER pattern_event_commit AFTER INSERT ON pattern_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pattern_commit_guard();
CREATE FUNCTION pattern_redacted_payload(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $fn$
 SELECT p||jsonb_build_object('content',jsonb_build_object('locator','','sourceKind','unknown','source','','sourceDate',null,'sourceVersion','','notes','','rights','unknown','rightsEvidence','','design',jsonb_build_object('state','unknown','reason',''),'measurement',jsonb_build_object('state','unknown','reason',''),'declaredUnits','unknown','declaredScale','','assumptions','','checks',''),'reason','','evidence','','digest',null,'acknowledged',false,'erased',true)
$fn$;
CREATE POLICY pattern_durable_privacy ON durable_draft FOR ALL TO app_owner USING(shop_context_allows(shop_id) AND workflow='pattern.reference') WITH CHECK(shop_context_allows(shop_id) AND workflow='pattern.reference');
DO $draft_guard$ DECLARE body text;pos integer;BEGIN
 body=pg_get_functiondef('durable_draft_guard()'::regprocedure);pos=position(E'BEGIN\n' IN body);
 IF pos=0 THEN RAISE EXCEPTION 'Durable draft guard entry changed';END IF;
 body=substring(body,1,pos+5)||$branch$
 IF TG_OP='UPDATE' AND current_user='app_owner' AND OLD.workflow='pattern.reference'
 AND (to_jsonb(NEW)-ARRAY['payload','version','updated_at'])=(to_jsonb(OLD)-ARRAY['payload','version','updated_at']) AND NEW.version=OLD.version+1 AND NEW.updated_at>=OLD.updated_at AND NEW.payload=pattern_redacted_payload(OLD.payload)
 AND EXISTS(SELECT 1 FROM measurement_erasure e JOIN audit_event a ON(a.shop_id,a.id)=(e.shop_id,e.audit_id) WHERE e.shop_id=OLD.shop_id AND e.wearer_id=(OLD.payload->>'wearerId')::uuid AND a.action='privacy.measurements' AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid) THEN RETURN NEW;END IF;
$branch$||substring(body,pos+6);EXECUTE body;
END $draft_guard$;
CREATE FUNCTION pattern_draft_authority_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.workflow='pattern.reference' AND NOT(current_user='app_owner' AND NEW.payload->>'erased'='true') THEN
  IF NEW.payload->>'erased' IS DISTINCT FROM 'false' OR NOT measurement_authority(NEW.shop_id,(NEW.payload->>'customerId')::uuid,(NEW.payload->>'wearerId')::uuid) THEN RAISE EXCEPTION 'Pattern wearer authority required' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_draft_authority BEFORE INSERT OR UPDATE ON durable_draft FOR EACH ROW EXECUTE FUNCTION pattern_draft_authority_guard();
ALTER FUNCTION redact_measurements(uuid,uuid,uuid) RENAME TO redact_measurements_before_pattern;
REVOKE ALL ON FUNCTION redact_measurements_before_pattern(uuid,uuid,uuid) FROM PUBLIC,app_user,app_privacy;
CREATE FUNCTION redact_measurements(s uuid,w uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE d uuid;known_drafts uuid[]='{}'::uuid[];a uuid;BEGIN
 IF NOT coalesce(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 FOR d IN SELECT id FROM durable_draft WHERE shop_id=s AND workflow='pattern.reference' AND payload->>'wearerId'=w::text ORDER BY id LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:draft:'||s::text||':'||d::text,0));known_drafts=array_append(known_drafts,d);
 END LOOP;
 PERFORM redact_measurements_before_pattern(s,w,request);
 IF EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=s AND workflow='pattern.reference' AND payload->>'wearerId'=w::text AND NOT(id=ANY(known_drafts))) THEN RAISE EXCEPTION 'Retry pattern privacy discovery' USING ERRCODE='40001';END IF;
 SELECT audit_id INTO a FROM measurement_erasure WHERE shop_id=s AND wearer_id=w;
 IF a IS NULL THEN RAISE EXCEPTION 'Pattern erasure provenance missing' USING ERRCODE='42501';END IF;
 UPDATE durable_draft SET payload=pattern_redacted_payload(payload),version=version+1,updated_at=greatest(updated_at,clock_timestamp()) WHERE shop_id=s AND workflow='pattern.reference' AND payload->>'wearerId'=w::text AND payload->>'erased'='false';
 UPDATE pattern_draft_value SET payload=pattern_redacted_payload(payload),redacted_at=transaction_timestamp(),redaction_audit_id=a WHERE shop_id=s AND wearer_id=w AND redacted_at IS NULL;
 UPDATE pattern_value x SET payload=NULL,redacted_at=transaction_timestamp(),redaction_audit_id=a FROM pattern_event e JOIN pattern_scope scope ON(scope.shop_id,scope.order_id,scope.scope_key)=(e.shop_id,e.order_id,e.scope_key) WHERE scope.shop_id=s AND scope.wearer_id=w AND (x.shop_id,x.event_id)=(e.shop_id,e.id) AND x.redacted_at IS NULL;
END $fn$;
REVOKE ALL ON FUNCTION redact_measurements(uuid,uuid,uuid) FROM PUBLIC,app_user;GRANT EXECUTE ON FUNCTION redact_measurements(uuid,uuid,uuid) TO app_privacy;
CREATE FUNCTION pattern_merge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM pattern_scope WHERE shop_id=NEW.shop_id AND customer_id IN(NEW.source_id,NEW.survivor_id)) OR EXISTS(SELECT 1 FROM pattern_draft_value WHERE shop_id=NEW.shop_id AND customer_id IN(NEW.source_id,NEW.survivor_id)) THEN RAISE EXCEPTION 'Pattern associations require reviewed wearer relink' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER pattern_contact_merge BEFORE INSERT ON customer_merge_event FOR EACH ROW EXECUTE FUNCTION pattern_merge_guard();
REVOKE ALL ON FUNCTION pattern_capability_guard(),pattern_event_guard(),pattern_version_guard(),pattern_scope_guard(),pattern_private_guard(),pattern_commit_guard(),pattern_redacted_payload(jsonb),pattern_draft_authority_guard(),pattern_merge_guard() FROM PUBLIC;
-- Pure transformation only; the draft guard may plan this expression for app_user.
GRANT EXECUTE ON FUNCTION pattern_redacted_payload(jsonb) TO app_user;
