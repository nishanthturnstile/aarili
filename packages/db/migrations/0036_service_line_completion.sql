-- 1.2.3c expand only. Accepted A/B source rows, prices and capacity remain immutable.
-- Missing current row means the accepted initial state at version 1; no backfill.
ALTER TABLE order_service_change_line ADD CONSTRAINT service_change_line_order_key UNIQUE(shop_id,order_id,id);
CREATE FUNCTION service_line_source(s uuid,o uuid,l uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE rows jsonb;BEGIN
 SELECT jsonb_agg(v) INTO rows FROM (
  SELECT jsonb_build_object('line',a.content,'sourceId',a.order_id,'sourceDigest',h.digest,'pieceId',NULL,'kind','standalone','reviewed',length(h.content->'service'->'review'->>'fingerprint')=64 AND p.content->>'wearerRequirement'<>'unresolved') v
  FROM service_order_line a JOIN order_acceptance_snapshot h ON (h.shop_id,h.order_id)=(a.shop_id,a.order_id) JOIN service_intake_profile_revision p ON (p.shop_id,p.id)=(a.shop_id,a.profile_revision_id)
  WHERE a.shop_id=s AND a.order_id=o AND a.id=l
  UNION ALL
  SELECT jsonb_build_object('line',a.content,'sourceId',a.change_id,'sourceDigest',c.digest,'pieceId',a.piece_id,'kind','addition','reviewed',length(c.content->>'fingerprint')=64 AND c.content->'input'->'review'->>'acknowledged'='true')
  FROM order_service_change_line a JOIN order_service_change c ON (c.shop_id,c.order_id,c.id)=(a.shop_id,a.order_id,a.change_id) WHERE a.shop_id=s AND a.order_id=o AND a.id=l
 ) source;
 IF jsonb_array_length(rows)>1 THEN RAISE EXCEPTION 'Ambiguous service line source' USING ERRCODE='23514';END IF;
 RETURN rows->0;
END $fn$;
REVOKE ALL ON FUNCTION service_line_source(uuid,uuid,uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION service_line_source(uuid,uuid,uuid) TO app_user;
CREATE TABLE service_line_current (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),order_id uuid NOT NULL,line_id uuid NOT NULL,
 standalone_line_id uuid,addition_line_id uuid,source_id uuid NOT NULL,source_digest text NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),version integer NOT NULL CHECK(version>=2),state text NOT NULL CHECK(state IN ('pending','completed')),last_transition_id uuid NOT NULL,
 PRIMARY KEY(shop_id,order_id,line_id),UNIQUE(shop_id,line_id),
 FOREIGN KEY(shop_id,order_id,standalone_line_id) REFERENCES service_order_line(shop_id,order_id,id),
 FOREIGN KEY(shop_id,order_id,addition_line_id) REFERENCES order_service_change_line(shop_id,order_id,id),
 CHECK(num_nonnulls(standalone_line_id,addition_line_id)=1 AND coalesce(standalone_line_id,addition_line_id)=line_id)
);
CREATE TABLE service_line_transition (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,order_id uuid NOT NULL,line_id uuid NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),version integer NOT NULL CHECK(version>=2),
 from_state text NOT NULL,to_state text NOT NULL,correction_of uuid,
 source_id uuid NOT NULL,source_digest text NOT NULL,parent_version integer NOT NULL,booking_id uuid,booking_version integer,
 actor_id uuid NOT NULL,command_id uuid NOT NULL,command_key uuid NOT NULL,request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),audit_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,order_id,line_id,id),UNIQUE(shop_id,order_id,line_id,version),UNIQUE(shop_id,command_id),UNIQUE(shop_id,command_key),
 FOREIGN KEY(shop_id,order_id,line_id) REFERENCES service_line_current(shop_id,order_id,line_id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,order_id,line_id,correction_of) REFERENCES service_line_transition(shop_id,order_id,line_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,booking_id) REFERENCES booking(shop_id,id),
 CHECK((from_state='pending' AND to_state='completed' AND correction_of IS NULL) OR (from_state='completed' AND to_state='pending' AND correction_of IS NOT NULL)),
 CHECK((booking_id IS NULL)=(booking_version IS NULL))
);
ALTER TABLE service_line_current ADD FOREIGN KEY(shop_id,order_id,line_id,last_transition_id) REFERENCES service_line_transition(shop_id,order_id,line_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX service_line_history ON service_line_transition(shop_id,order_id,line_id,version);
CREATE TABLE service_line_evidence (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),transition_id uuid NOT NULL,note text,
 redaction_audit_id uuid,redacted_at timestamptz,
 PRIMARY KEY(shop_id,transition_id),FOREIGN KEY(shop_id,transition_id) REFERENCES service_line_transition(shop_id,id),FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((redaction_audit_id IS NULL AND redacted_at IS NULL AND note IS NOT NULL AND length(trim(note)) BETWEEN 1 AND 2000) OR (redaction_audit_id IS NOT NULL AND redacted_at IS NOT NULL AND note IS NULL))
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['service_line_current','service_line_transition','service_line_evidence'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $rls$;
GRANT UPDATE ON service_line_current TO app_user;
CREATE TRIGGER service_transition_immutable BEFORE UPDATE OR DELETE ON service_line_transition FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE FUNCTION service_transition_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE src jsonb;cur service_line_current%ROWTYPE;b booking%ROWTYPE;ov integer;BEGIN
 src=service_line_source(NEW.shop_id,NEW.order_id,NEW.line_id);
 SELECT * INTO cur FROM service_line_current WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND line_id=NEW.line_id;
 SELECT version INTO ov FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 SELECT k.* INTO b FROM booking_member m JOIN booking k ON (k.shop_id,k.id)=(m.shop_id,m.booking_id) WHERE m.shop_id=NEW.shop_id AND m.order_id=NEW.order_id;
 IF NOT COALESCE(shop_context_allows(NEW.shop_id),false) OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR src IS NULL OR src->>'reviewed' IS DISTINCT FROM 'true' OR src->'line'->>'state' IS DISTINCT FROM 'pending'
 OR src->'line'->>'taskKey' IS NOT NULL OR src->'line'->>'quantity' IS NULL
 OR (src->>'sourceId')::uuid IS DISTINCT FROM NEW.source_id OR src->>'sourceDigest' IS DISTINCT FROM NEW.source_digest
 OR NEW.parent_version IS DISTINCT FROM ov OR NEW.booking_id IS DISTINCT FROM b.id OR NEW.booking_version IS DISTINCT FROM b.version
 OR NEW.version<>COALESCE(cur.version,1)+1 OR NEW.from_state IS DISTINCT FROM COALESCE(cur.state,'pending')
 OR (NEW.correction_of IS NOT NULL AND NEW.correction_of IS DISTINCT FROM cur.last_transition_id)
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_type='user' AND a.actor_id=NEW.actor_id AND a.entity_type='service-line' AND a.entity_id=NEW.line_id AND a.action='service.line.'||CASE WHEN NEW.to_state='completed' THEN 'complete' ELSE 'correct' END AND a.idempotency_key=NEW.command_key)
 THEN RAISE EXCEPTION 'Service transition provenance denied' USING ERRCODE='23514';END IF;
 NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());NEW.created_xid=pg_current_xact_id();RETURN NEW;
END $fn$;
CREATE TRIGGER service_transition_insert BEFORE INSERT ON service_line_transition FOR EACH ROW EXECUTE FUNCTION service_transition_guard();
CREATE FUNCTION service_line_current_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE src jsonb;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain service line history' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['version','state','last_transition_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['version','state','last_transition_id']) OR NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'Service line identity immutable' USING ERRCODE='23514';END IF;
 src=service_line_source(NEW.shop_id,NEW.order_id,NEW.line_id);
 IF (TG_OP='INSERT' AND NEW.version<>2) OR (src->>'kind'='standalone') IS DISTINCT FROM (NEW.standalone_line_id IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM service_line_transition t WHERE t.shop_id=NEW.shop_id AND t.id=NEW.last_transition_id AND t.order_id=NEW.order_id AND t.line_id=NEW.line_id AND t.version=NEW.version AND t.to_state=NEW.state AND t.source_id=NEW.source_id AND t.source_digest=NEW.source_digest AND t.created_xid=pg_current_xact_id()) THEN RAISE EXCEPTION 'Service current pointer denied' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER service_current_write BEFORE INSERT OR UPDATE OR DELETE ON service_line_current FOR EACH ROW EXECUTE FUNCTION service_line_current_guard();
CREATE FUNCTION service_transition_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM service_line_current c WHERE c.shop_id=NEW.shop_id AND c.order_id=NEW.order_id AND c.line_id=NEW.line_id AND c.last_transition_id=NEW.id AND c.version=NEW.version)
 OR NOT EXISTS(SELECT 1 FROM service_line_evidence e WHERE e.shop_id=NEW.shop_id AND e.transition_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_type='user' AND k.actor_id=NEW.actor_id AND k.status=200 AND k.action='service.line.'||CASE WHEN NEW.to_state='completed' THEN 'complete' ELSE 'correct' END AND k.request_hash=NEW.request_hash AND k.response=jsonb_build_object('transitionId',NEW.id,'lineId',NEW.line_id,'version',NEW.version))
 THEN RAISE EXCEPTION 'Service transition atomic commit denied' USING ERRCODE='23514';END IF;RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER service_transition_commit AFTER INSERT ON service_line_transition DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_transition_commit_guard();
-- Privileged privacy role receives EXECUTE only, never direct table access.
-- The fixed-search-path definer still obeys FORCE RLS and verified shop context.
GRANT USAGE ON SCHEMA public TO app_privacy;
CREATE POLICY service_evidence_privacy_membership ON shop_membership FOR SELECT TO app_owner USING(user_id=NULLIF(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY service_evidence_privacy_audit ON audit_event FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id) AND action='privacy.service-line-note');
CREATE POLICY service_evidence_privacy ON service_line_evidence FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE FUNCTION service_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.redaction_audit_id IS NOT NULL OR NEW.redacted_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM service_line_transition t WHERE t.shop_id=NEW.shop_id AND t.id=NEW.transition_id AND t.created_xid=pg_current_xact_id()) THEN RAISE EXCEPTION 'Evidence must commit with transition' USING ERRCODE='23514';END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF current_user<>'app_owner' OR NEW.shop_id<>OLD.shop_id OR NEW.transition_id<>OLD.transition_id OR OLD.redaction_audit_id IS NOT NULL OR NEW.note IS NOT NULL OR NEW.redacted_at IS NULL OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.redaction_audit_id AND a.action='privacy.service-line-note' AND a.entity_id=NEW.transition_id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.occurred_at=transaction_timestamp()) THEN RAISE EXCEPTION 'Audited privacy redaction required' USING ERRCODE='42501';END IF;
 ELSE RAISE EXCEPTION 'Evidence history retained' USING ERRCODE='42501';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER service_evidence_write BEFORE INSERT OR UPDATE OR DELETE ON service_line_evidence FOR EACH ROW EXECUTE FUNCTION service_evidence_guard();
CREATE FUNCTION redact_service_line_note(s uuid,t uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7();BEGIN
 IF NOT COALESCE(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM service_line_evidence WHERE shop_id=s AND transition_id=t AND redaction_audit_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evidence unavailable' USING ERRCODE='P0002';END IF;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.service-line-note','service-line-evidence',t,request,request,'{"redacted":true}');
 UPDATE service_line_evidence SET note=NULL,redaction_audit_id=a,redacted_at=transaction_timestamp() WHERE shop_id=s AND transition_id=t;
END $fn$;
REVOKE ALL ON FUNCTION redact_service_line_note(uuid,uuid,uuid) FROM PUBLIC,app_user;GRANT EXECUTE ON FUNCTION redact_service_line_note(uuid,uuid,uuid) TO app_privacy;
