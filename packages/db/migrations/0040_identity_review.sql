-- W1 1.2.4d: additive identity evidence. No backfill or accepted-record rewrite.
CREATE TABLE identity_revision_evidence (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), audit_id uuid NOT NULL,
 customer_id uuid NOT NULL, wearer_id uuid,
 previous_version integer NOT NULL CHECK(previous_version>0), version integer NOT NULL CHECK(version=previous_version+1),
 fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='array'),
 reason text CHECK(reason IS NULL OR length(btrim(reason)) BETWEEN 1 AND 1000),
 redaction_audit_id uuid, redacted_at timestamptz,
 PRIMARY KEY(shop_id,audit_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),
 FOREIGN KEY(shop_id,redaction_audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((reason IS NOT NULL AND redaction_audit_id IS NULL AND redacted_at IS NULL) OR (reason IS NULL AND redaction_audit_id IS NOT NULL AND redacted_at IS NOT NULL))
);
CREATE TABLE customer_pair_review (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 first_id uuid NOT NULL, second_id uuid NOT NULL, version integer NOT NULL CHECK(version>1),
 first_version integer NOT NULL CHECK(first_version>0), second_version integer NOT NULL CHECK(second_version>0),
 decision text NOT NULL CHECK(decision IN ('keep-separate','dismiss')),
 actor_id uuid NOT NULL, command_key uuid NOT NULL, request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,first_id,second_id,version), UNIQUE(shop_id,command_key),
 CHECK(first_id<second_id),
 FOREIGN KEY(shop_id,first_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,second_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE INDEX identity_revision_customer ON identity_revision_evidence(shop_id,customer_id,audit_id);
CREATE INDEX identity_revision_wearer ON identity_revision_evidence(shop_id,wearer_id,audit_id);
CREATE INDEX customer_pair_second ON customer_pair_review(shop_id,second_id,first_id,version);
DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['identity_revision_evidence','customer_pair_review'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $rls$;
CREATE TRIGGER customer_pair_review_immutable BEFORE UPDATE OR DELETE ON customer_pair_review FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE FUNCTION customer_pair_review_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:pair:'||NEW.shop_id::text||':'||NEW.first_id::text||':'||NEW.second_id::text,0));
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NEW.version<>COALESCE((SELECT max(version) FROM customer_pair_review WHERE shop_id=NEW.shop_id AND first_id=NEW.first_id AND second_id=NEW.second_id),1)+1
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE (a.shop_id,a.id)=(NEW.shop_id,NEW.id) AND a.action='customer.pair-review' AND a.actor_id=NEW.actor_id AND a.idempotency_key=NEW.command_key)
 THEN RAISE EXCEPTION 'Pair review provenance denied' USING ERRCODE='23514'; END IF;
 NEW.recorded_at=clock_timestamp(); RETURN NEW;
END $fn$;
CREATE TRIGGER customer_pair_review_insert BEFORE INSERT ON customer_pair_review FOR EACH ROW EXECUTE FUNCTION customer_pair_review_guard();
REVOKE ALL ON FUNCTION customer_pair_review_guard() FROM PUBLIC;
CREATE FUNCTION customer_pair_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM identity_revision_evidence e WHERE e.shop_id=NEW.shop_id AND e.audit_id=NEW.id AND e.customer_id=NEW.first_id AND e.version=NEW.version)
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_id=NEW.actor_id AND k.actor_type='user' AND k.action='customer.pair-review' AND k.request_hash=NEW.request_hash AND k.status=200 AND k.response=jsonb_build_object('id',NEW.id,'version',NEW.version))
 THEN RAISE EXCEPTION 'Pair review atomic commit denied' USING ERRCODE='23514'; END IF; RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION customer_pair_commit_guard() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER customer_pair_commit AFTER INSERT ON customer_pair_review DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION customer_pair_commit_guard();
CREATE POLICY identity_evidence_privacy ON identity_revision_evidence FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY identity_evidence_privacy_audit ON audit_event FOR ALL TO app_owner USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id) AND action='privacy.identity-reason');
CREATE FUNCTION identity_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.reason IS NULL OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE (a.shop_id,a.id)=(NEW.shop_id,NEW.audit_id) AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.action IN ('customer.correct','wearer.update','customer.pair-review')) THEN RAISE EXCEPTION 'Identity evidence provenance denied' USING ERRCODE='23514'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF current_user<>'app_owner' OR (to_jsonb(NEW)-ARRAY['reason','redaction_audit_id','redacted_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['reason','redaction_audit_id','redacted_at']) OR OLD.redaction_audit_id IS NOT NULL OR NEW.reason IS NOT NULL OR NEW.redacted_at IS NULL OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.redaction_audit_id AND a.action='privacy.identity-reason' AND a.entity_id=NEW.audit_id AND a.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid AND a.occurred_at=transaction_timestamp()) THEN RAISE EXCEPTION 'Audited privacy redaction required' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'Identity history retained' USING ERRCODE='42501'; END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER identity_evidence_write BEFORE INSERT OR UPDATE OR DELETE ON identity_revision_evidence FOR EACH ROW EXECUTE FUNCTION identity_evidence_guard();
REVOKE ALL ON FUNCTION identity_evidence_guard() FROM PUBLIC;
CREATE FUNCTION redact_identity_reason(s uuid,t uuid,request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE a uuid=uuidv7(); BEGIN
 IF NOT COALESCE(shop_context_allows(s),false) THEN RAISE EXCEPTION 'Privacy context denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM identity_revision_evidence WHERE shop_id=s AND audit_id=t AND redaction_audit_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evidence unavailable' USING ERRCODE='P0002'; END IF;
 INSERT INTO audit_event(shop_id,id,actor_type,actor_id,action,entity_type,entity_id,request_id,idempotency_key,changes) VALUES(s,a,'user',NULLIF(current_setting('app.actor_id',true),'')::uuid,'privacy.identity-reason','identity-evidence',t,request,request,'{"redacted":true}');
 UPDATE identity_revision_evidence SET reason=NULL,redaction_audit_id=a,redacted_at=transaction_timestamp() WHERE shop_id=s AND audit_id=t;
END $fn$;
REVOKE ALL ON FUNCTION redact_identity_reason(uuid,uuid,uuid) FROM PUBLIC,app_user;
GRANT EXECUTE ON FUNCTION redact_identity_reason(uuid,uuid,uuid) TO app_privacy;
