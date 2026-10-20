-- 1.2.2b additive grouping. No acceptance/demand/finance writes or backfill.
-- Compatible rollback retains all links and revisions; disable unsupported writes.
CREATE TABLE booking (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 code_number bigint NOT NULL CHECK(code_number>0), code text NOT NULL,
 customer_id uuid NOT NULL,origin_draft_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),current_revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,code),UNIQUE(shop_id,code_number),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id)
);
CREATE TABLE booking_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,
 booking_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),origin_draft_id uuid NOT NULL,
 context jsonb NOT NULL CHECK(jsonb_typeof(context)='object' AND octet_length(context::text)<=16384),
 sources jsonb NOT NULL CHECK(jsonb_typeof(sources)='array' AND jsonb_array_length(sources) BETWEEN 2 AND 50),
 payer_id uuid,actor_id uuid NOT NULL,audit_id uuid NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,booking_id,version),UNIQUE(shop_id,booking_id,id),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,booking_id) REFERENCES booking(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,payer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
ALTER TABLE booking ADD CONSTRAINT booking_current FOREIGN KEY(shop_id,id,current_revision_id) REFERENCES booking_revision(shop_id,booking_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE booking_member (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),booking_id uuid NOT NULL,order_id uuid NOT NULL,
 source_version integer NOT NULL CHECK(source_version>0),source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,order_id),UNIQUE(shop_id,booking_id,order_id),
 FOREIGN KEY(shop_id,booking_id,revision_id) REFERENCES booking_revision(shop_id,booking_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id)
);
CREATE INDEX booking_members ON booking_member(shop_id,booking_id,order_id);
CREATE TABLE booking_membership_history (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),booking_id uuid NOT NULL,order_id uuid NOT NULL,revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,booking_id,order_id),
 FOREIGN KEY(shop_id,booking_id,order_id) REFERENCES booking_member(shop_id,booking_id,order_id),
 FOREIGN KEY(shop_id,booking_id,revision_id) REFERENCES booking_revision(shop_id,booking_id,id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['booking','booking_revision','booking_member','booking_membership_history'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 IF t<>'booking' THEN EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION order_immutable_guard()',t||'_immutable',t); END IF;
 END LOOP;
END $policies$;
GRANT UPDATE(version,current_revision_id) ON booking TO app_user;
CREATE FUNCTION booking_update_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='DELETE' OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.origin_draft_id IS DISTINCT FROM OLD.origin_draft_id OR NEW.code IS DISTINCT FROM OLD.code OR NEW.code_number IS DISTINCT FROM OLD.code_number OR NEW.version<>OLD.version+1 OR NEW.current_revision_id=OLD.current_revision_id
 THEN RAISE EXCEPTION 'Booking pointer protected' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER booking_update BEFORE UPDATE OR DELETE ON booking FOR EACH ROW EXECUTE FUNCTION booking_update_guard();
CREATE FUNCTION booking_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE b public.booking;d public.durable_draft;s jsonb;o public.garment_order;prior jsonb;expected jsonb;
BEGIN
 SELECT * INTO b FROM booking WHERE shop_id=NEW.shop_id AND id=NEW.booking_id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.lifecycle IS DISTINCT FROM 'active' OR d.workflow IS DISTINCT FROM 'booking.group' OR d.schema_version<>1
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NEW.context IS DISTINCT FROM d.payload->'context' OR NEW.reason IS DISTINCT FROM d.payload->>'reason'
 OR NEW.payer_id IS DISTINCT FROM (NEW.context->>'payerId')::uuid
 OR b.customer_id::text IS DISTINCT FROM d.payload->>'customerId'
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.entity_id=NEW.booking_id AND a.action='booking.revise' AND a.reason=NEW.reason)
 THEN RAISE EXCEPTION 'Booking provenance denied' USING ERRCODE='23514';END IF;
 IF NEW.version=1 THEN
  IF b.version<>1 OR b.origin_draft_id<>d.id OR b.current_revision_id<>NEW.id OR d.payload->'target'<>'null'::jsonb THEN RAISE EXCEPTION 'Booking origin denied' USING ERRCODE='23514';END IF;
  prior='[]'::jsonb;
 ELSE
  IF b.version+1<>NEW.version OR d.payload->'target'->>'id' IS DISTINCT FROM b.id::text OR (d.payload->'target'->>'version')::integer IS DISTINCT FROM b.version THEN RAISE EXCEPTION 'Stale booking' USING ERRCODE='23514';END IF;
  SELECT sources INTO prior FROM booking_revision WHERE shop_id=b.shop_id AND id=b.current_revision_id;
 END IF;
 expected=prior||(d.payload->'orders');
 IF NEW.sources IS DISTINCT FROM expected OR (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.sources))<>jsonb_array_length(NEW.sources) THEN RAISE EXCEPTION 'Booking source mismatch' USING ERRCODE='23514';END IF;
 IF NEW.context->>'payerId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer WHERE shop_id=NEW.shop_id AND id=(NEW.context->>'payerId')::uuid) THEN RAISE EXCEPTION 'Payer denied' USING ERRCODE='23503';END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(d.payload->'orders') LOOP
  SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=(s->>'id')::uuid;
  IF o.customer_id IS DISTINCT FROM b.customer_id OR o.version IS DISTINCT FROM (s->>'version')::integer OR NOT EXISTS(SELECT 1 FROM order_acceptance_snapshot x WHERE x.shop_id=NEW.shop_id AND x.order_id=o.id AND x.digest=s->>'snapshotDigest') OR EXISTS(SELECT 1 FROM booking_member m WHERE m.shop_id=NEW.shop_id AND m.order_id=o.id) THEN RAISE EXCEPTION 'Garment link denied' USING ERRCODE='23514';END IF;
 END LOOP;
 RETURN NEW;
END $fn$;
CREATE TRIGGER booking_revision_insert BEFORE INSERT ON booking_revision FOR EACH ROW EXECUTE FUNCTION booking_revision_guard();
CREATE FUNCTION booking_member_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.booking_revision;
BEGIN
 SELECT * INTO r FROM booking_revision WHERE shop_id=NEW.shop_id AND id=NEW.revision_id AND booking_id=NEW.booking_id;
 IF r.created_xid IS DISTINCT FROM pg_current_xact_id() THEN RAISE EXCEPTION 'Membership command denied' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='booking_member' THEN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.sources) s WHERE (s->>'id')::uuid=NEW.order_id AND (s->>'version')::integer=NEW.source_version AND s->>'snapshotDigest'=NEW.source_digest) THEN RAISE EXCEPTION 'Membership source denied' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER booking_member_insert BEFORE INSERT ON booking_member FOR EACH ROW EXECUTE FUNCTION booking_member_guard();
CREATE TRIGGER booking_history_insert BEFORE INSERT ON booking_membership_history FOR EACH ROW EXECUTE FUNCTION booking_member_guard();
CREATE FUNCTION booking_complete_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE b public.booking;d public.durable_draft;
BEGIN
 SELECT * INTO b FROM booking WHERE shop_id=NEW.shop_id AND id=NEW.booking_id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF b.version IS DISTINCT FROM NEW.version OR b.current_revision_id IS DISTINCT FROM NEW.id
 OR d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM 'booking.revision' OR d.result_id IS DISTINCT FROM NEW.id
 OR (SELECT count(*) FROM booking_member m WHERE m.shop_id=NEW.shop_id AND m.booking_id=NEW.booking_id)<>jsonb_array_length(NEW.sources)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.sources) s WHERE NOT EXISTS(SELECT 1 FROM booking_member m JOIN booking_membership_history h ON h.shop_id=m.shop_id AND h.booking_id=m.booking_id AND h.order_id=m.order_id AND h.revision_id=m.revision_id WHERE m.shop_id=NEW.shop_id AND m.booking_id=NEW.booking_id AND m.order_id=(s->>'id')::uuid AND m.source_version=(s->>'version')::integer AND m.source_digest=s->>'snapshotDigest'))
 OR NOT EXISTS(SELECT 1 FROM audit_event a JOIN idempotency_key k ON k.shop_id=a.shop_id AND k.key=a.idempotency_key WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND k.actor_id=NEW.actor_id AND k.action='draft.promote')
 THEN RAISE EXCEPTION 'Incomplete booking command' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER booking_complete AFTER INSERT ON booking_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION booking_complete_guard();
CREATE FUNCTION booking_pointer_complete_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM booking_revision r WHERE r.shop_id=NEW.shop_id AND r.booking_id=NEW.id AND r.id=NEW.current_revision_id AND r.version=NEW.version AND r.created_xid=pg_current_xact_id()) THEN RAISE EXCEPTION 'Booking pointer has no command revision' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER booking_pointer_complete AFTER INSERT OR UPDATE ON booking DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION booking_pointer_complete_guard();
