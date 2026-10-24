-- #175 / 1.4.1c. Expand only: unissued proposals, no numbers/jobs/money events.
ALTER TABLE garment_estimate_revision ADD UNIQUE(shop_id,id,order_id);
ALTER TABLE booking_commercial_revision ADD UNIQUE(shop_id,booking_id,id);
CREATE TABLE booking_quotation_revision(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,family_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),previous_id uuid,
 origin_draft_id uuid NOT NULL,actor_id uuid NOT NULL,audit_id uuid NOT NULL,
 booking_id uuid,booking_revision_id uuid,commercial_id uuid,policy_id uuid,
 content jsonb NOT NULL,content_hash text NOT NULL DEFAULT '',recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,family_id,id),UNIQUE(shop_id,family_id,version),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,family_id,previous_id) REFERENCES booking_quotation_revision(shop_id,family_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,booking_id) REFERENCES booking(shop_id,id),FOREIGN KEY(shop_id,booking_id,booking_revision_id) REFERENCES booking_revision(shop_id,booking_id,id),
 FOREIGN KEY(shop_id,booking_id,commercial_id) REFERENCES booking_commercial_revision(shop_id,booking_id,id),FOREIGN KEY(shop_id,policy_id) REFERENCES quotation_policy_binding(shop_id,id),CHECK((version=1)=(previous_id IS NULL))
);
CREATE INDEX booking_quotation_parent ON booking_quotation_revision(shop_id,booking_id,id);
CREATE TABLE booking_quotation(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,current_revision_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),PRIMARY KEY(shop_id,id),
 FOREIGN KEY(shop_id,id,current_revision_id) REFERENCES booking_quotation_revision(shop_id,family_id,id)
);
ALTER TABLE booking_quotation_revision ADD FOREIGN KEY(shop_id,family_id) REFERENCES booking_quotation(shop_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE booking_quotation_scope(
 shop_id uuid NOT NULL,revision_id uuid NOT NULL,order_id uuid NOT NULL,position integer NOT NULL CHECK(position BETWEEN 0 AND 19),customer_id uuid,wearer_id uuid,specification_id uuid,estimate_revision_id uuid,predecessor_id uuid,content jsonb NOT NULL,created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,revision_id,order_id),UNIQUE(shop_id,revision_id,position),
 FOREIGN KEY(shop_id,revision_id) REFERENCES booking_quotation_revision(shop_id,id),FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),FOREIGN KEY(shop_id,specification_id) REFERENCES design_spec_version(shop_id,id),
 FOREIGN KEY(shop_id,estimate_revision_id,order_id) REFERENCES garment_estimate_revision(shop_id,id,order_id),FOREIGN KEY(shop_id,predecessor_id,order_id) REFERENCES booking_quotation_scope(shop_id,revision_id,order_id),CHECK(wearer_id IS NULL OR customer_id IS NOT NULL)
);
CREATE INDEX booking_quotation_scope_order ON booking_quotation_scope(shop_id,order_id,revision_id);
CREATE TABLE booking_quotation_selection(
 shop_id uuid NOT NULL,order_id uuid NOT NULL,revision_id uuid NOT NULL,PRIMARY KEY(shop_id,order_id),FOREIGN KEY(shop_id,revision_id,order_id) REFERENCES booking_quotation_scope(shop_id,revision_id,order_id)
);
CREATE TABLE booking_quotation_line(
 shop_id uuid NOT NULL,revision_id uuid NOT NULL,line_key text NOT NULL,position integer NOT NULL CHECK(position BETWEEN 0 AND 511),order_id uuid,piece_id uuid,parent_key text,estimate_revision_id uuid,service_line_id uuid,addition_line_id uuid,
 content jsonb NOT NULL,created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),PRIMARY KEY(shop_id,revision_id,line_key),UNIQUE(shop_id,revision_id,position),
 FOREIGN KEY(shop_id,revision_id) REFERENCES booking_quotation_revision(shop_id,id),FOREIGN KEY(shop_id,revision_id,order_id) REFERENCES booking_quotation_scope(shop_id,revision_id,order_id),
 FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),FOREIGN KEY(shop_id,revision_id,parent_key) REFERENCES booking_quotation_line(shop_id,revision_id,line_key) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,estimate_revision_id,order_id) REFERENCES garment_estimate_revision(shop_id,id,order_id),FOREIGN KEY(shop_id,service_line_id) REFERENCES service_order_line(shop_id,id),FOREIGN KEY(shop_id,addition_line_id) REFERENCES order_service_change_line(shop_id,id),CHECK(piece_id IS NULL OR order_id IS NOT NULL)
);
CREATE TABLE booking_quotation_private(
 shop_id uuid NOT NULL,revision_id uuid NOT NULL,input jsonb NOT NULL,content jsonb NOT NULL,created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),PRIMARY KEY(shop_id,revision_id),FOREIGN KEY(shop_id,revision_id) REFERENCES booking_quotation_revision(shop_id,id)
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['booking_quotation','booking_quotation_revision','booking_quotation_scope','booking_quotation_selection','booking_quotation_line','booking_quotation_private'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT TO app_user USING(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT TO app_user WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $rls$;
GRANT UPDATE(current_revision_id,version) ON booking_quotation TO app_user;
GRANT UPDATE(revision_id) ON booking_quotation_selection TO app_user;
CREATE FUNCTION booking_quotation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.booking_quotation_revision;d public.durable_draft;a public.audit_event;k text;l jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Quotation immutable' USING ERRCODE='42501';END IF;NEW.created_xid=pg_current_xact_id();
 IF TG_TABLE_NAME<>'booking_quotation_revision' THEN
  SELECT * INTO r FROM booking_quotation_revision WHERE shop_id=NEW.shop_id AND id=NEW.revision_id;
  IF r.created_xid IS DISTINCT FROM pg_current_xact_id() THEN RAISE EXCEPTION 'Quotation sealed' USING ERRCODE='23514';END IF;RETURN NEW;
 END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;SELECT * INTO a FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id;
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.lifecycle IS DISTINCT FROM 'active' OR d.workflow IS DISTINCT FROM 'pricing.quotation' OR a.action IS DISTINCT FROM 'pricing.quotation.save' OR a.entity_id IS DISTINCT FROM NEW.id OR a.actor_id IS DISTINCT FROM NEW.actor_id
  OR NEW.content->'input' IS DISTINCT FROM d.payload-'sharedCost' OR d.payload->>'familyId' IS DISTINCT FROM NEW.family_id::text OR d.payload->>'baseVersion' IS DISTINCT FROM (NEW.version-1)::text OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id
  OR NEW.content ? 'privateCosts' OR NEW.content->'input' ? 'sharedCost' OR NEW.content->'customer'->>'kind' IS DISTINCT FROM 'quotation-proposal-not-issued' OR NEW.content->'customer'->>'complete' IS DISTINCT FROM 'true'
  OR NEW.content->'customer'->>'agreementApplication' IS DISTINCT FROM 'unavailable'
  OR NEW.content->'source'->>'bookingId' IS DISTINCT FROM NEW.booking_id::text OR NEW.content->'source'->>'bookingRevisionId' IS DISTINCT FROM NEW.booking_revision_id::text OR NEW.content->'source'->>'commercialId' IS DISTINCT FROM NEW.commercial_id::text OR NEW.content->'source'->'policy'->>'id' IS DISTINCT FROM NEW.policy_id::text
 THEN RAISE EXCEPTION 'Quotation provenance denied' USING ERRCODE='23514';END IF;
 FOR k IN SELECT jsonb_object_keys(NEW.content->'customer') LOOP IF k<>ALL(ARRAY['kind','familyId','lines','grossPaise','discountPaise','knownSubtotalPaise','unknownCount','complete','totalPaise','assumptions','agreementApplication','attribution','unattributedSellingPaise']) THEN RAISE EXCEPTION 'Private quotation data denied';END IF;END LOOP;
 FOR l IN SELECT * FROM jsonb_array_elements(NEW.content->'customer'->'lines') LOOP
  FOR k IN SELECT jsonb_object_keys(l) LOOP IF k<>ALL(ARRAY['key','sequence','orderId','pieceId','labelEn','labelTa','role','parentKey','grossPaise','acceptedPaise','estimateRevisionId','serviceLineId','additionLineId','sourceId','reason','lineDiscountPaise','bookingDiscountPaise','netPaise']) THEN RAISE EXCEPTION 'Private quotation line denied';END IF;END LOOP;
  IF (l->>'role'='charge' AND (l->>'parentKey' IS NOT NULL OR (l->>'grossPaise')::bigint<0 OR (l->>'netPaise')::bigint<0 OR (l->>'lineDiscountPaise')::bigint<0 OR (l->>'bookingDiscountPaise')::bigint<0 OR (l->>'grossPaise')::numeric-(l->>'lineDiscountPaise')::numeric-(l->>'bookingDiscountPaise')::numeric IS DISTINCT FROM (l->>'netPaise')::numeric)) OR (l->>'role'='reference' AND l->>'parentKey' IS NULL) THEN RAISE EXCEPTION 'Quotation line arithmetic denied';END IF;
 END LOOP;
 NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());NEW.content_hash=encode(sha256(convert_to(NEW.content::text,'UTF8')),'hex');RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION booking_quotation_guard() FROM PUBLIC;
CREATE TRIGGER quotation_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON booking_quotation_revision FOR EACH ROW EXECUTE FUNCTION booking_quotation_guard();
CREATE TRIGGER quotation_scope_guard BEFORE INSERT OR UPDATE OR DELETE ON booking_quotation_scope FOR EACH ROW EXECUTE FUNCTION booking_quotation_guard();
CREATE TRIGGER quotation_line_guard BEFORE INSERT OR UPDATE OR DELETE ON booking_quotation_line FOR EACH ROW EXECUTE FUNCTION booking_quotation_guard();
CREATE TRIGGER quotation_private_guard BEFORE INSERT OR UPDATE OR DELETE ON booking_quotation_private FOR EACH ROW EXECUTE FUNCTION booking_quotation_guard();
CREATE FUNCTION booking_quotation_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.booking_quotation_revision;prior uuid;BEGIN
 IF TG_TABLE_NAME='booking_quotation' THEN SELECT * INTO r FROM booking_quotation_revision WHERE shop_id=NEW.shop_id AND id=NEW.current_revision_id;
 ELSE SELECT * INTO r FROM booking_quotation_revision WHERE shop_id=NEW.shop_id AND id=NEW.revision_id;END IF;
 IF r.created_xid IS DISTINCT FROM pg_current_xact_id() THEN RAISE EXCEPTION 'Quotation pointer source denied';END IF;
 IF TG_TABLE_NAME='booking_quotation' THEN
  IF r.family_id IS DISTINCT FROM NEW.id OR r.version IS DISTINCT FROM NEW.version OR (TG_OP='INSERT' AND NEW.version<>1) THEN RAISE EXCEPTION 'Quotation family denied';END IF;
  IF TG_OP='UPDATE' THEN IF NEW.shop_id<>OLD.shop_id OR NEW.id<>OLD.id OR NEW.version<>OLD.version+1 OR r.previous_id<>OLD.current_revision_id THEN RAISE EXCEPTION 'Quotation family CAS denied';END IF;END IF;
 ELSE
  IF r.content->'input'->>'selection'<>'current' THEN RAISE EXCEPTION 'Alternative cannot select scope';END IF;
  SELECT predecessor_id INTO prior FROM booking_quotation_scope WHERE shop_id=NEW.shop_id AND revision_id=NEW.revision_id AND order_id=NEW.order_id;
  IF TG_OP='INSERT' THEN IF prior IS NOT NULL AND NOT EXISTS(SELECT 1 FROM booking_quotation_selection WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND revision_id=prior) THEN RAISE EXCEPTION 'Quotation predecessor missing';END IF;
  ELSE IF NEW.shop_id<>OLD.shop_id OR NEW.order_id<>OLD.order_id OR prior IS DISTINCT FROM OLD.revision_id THEN RAISE EXCEPTION 'Quotation scope CAS denied';END IF;END IF;
 END IF;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION booking_quotation_pointer_guard() FROM PUBLIC;
CREATE TRIGGER quotation_pointer_guard BEFORE INSERT OR UPDATE ON booking_quotation FOR EACH ROW EXECUTE FUNCTION booking_quotation_pointer_guard();
CREATE TRIGGER quotation_selection_guard BEFORE INSERT OR UPDATE ON booking_quotation_selection FOR EACH ROW EXECUTE FUNCTION booking_quotation_pointer_guard();
CREATE FUNCTION booking_quotation_complete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;s public.booking_quotation_scope;l public.booking_quotation_line; p public.booking_quotation_private;BEGIN
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;SELECT * INTO p FROM booking_quotation_private WHERE shop_id=NEW.shop_id AND revision_id=NEW.id;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM 'pricing.quotation' OR d.result_id IS DISTINCT FROM NEW.id OR NOT EXISTS(SELECT 1 FROM booking_quotation WHERE shop_id=NEW.shop_id AND current_revision_id=NEW.id)
  OR p.revision_id IS NULL OR p.input IS DISTINCT FROM d.payload->'sharedCost'
  OR (SELECT count(*) FROM booking_quotation_scope WHERE shop_id=NEW.shop_id AND revision_id=NEW.id)<>jsonb_array_length(d.payload->'orderIds') OR (SELECT count(*) FROM booking_quotation_line WHERE shop_id=NEW.shop_id AND revision_id=NEW.id)<>jsonb_array_length(NEW.content->'customer'->'lines')
 THEN RAISE EXCEPTION 'Incomplete quotation transaction';END IF;
 FOR s IN SELECT * FROM booking_quotation_scope WHERE shop_id=NEW.shop_id AND revision_id=NEW.id LOOP
  IF s.order_id::text IS DISTINCT FROM d.payload->'orderIds'->>s.position OR s.content IS DISTINCT FROM NEW.content->'source'->'orders'->s.position OR s.content->>'customerId' IS DISTINCT FROM s.customer_id::text OR s.content->>'wearerId' IS DISTINCT FROM s.wearer_id::text OR s.content->>'specificationId' IS DISTINCT FROM s.specification_id::text THEN RAISE EXCEPTION 'Quotation scope provenance denied';END IF;
  IF d.payload->>'selection'='current' THEN
   IF NOT EXISTS(SELECT 1 FROM booking_quotation_selection WHERE shop_id=NEW.shop_id AND order_id=s.order_id AND revision_id=NEW.id) OR EXISTS(SELECT 1 FROM booking_quotation_scope prior_scope WHERE prior_scope.shop_id=NEW.shop_id AND prior_scope.revision_id=s.predecessor_id AND NOT EXISTS(SELECT 1 FROM booking_quotation_scope n WHERE n.shop_id=NEW.shop_id AND n.revision_id=NEW.id AND n.order_id=prior_scope.order_id)) THEN RAISE EXCEPTION 'Partial quotation supersession';END IF;
  END IF;
 END LOOP;
 FOR l IN SELECT * FROM booking_quotation_line WHERE shop_id=NEW.shop_id AND revision_id=NEW.id LOOP
  IF l.content IS DISTINCT FROM NEW.content->'customer'->'lines'->l.position OR l.line_key IS DISTINCT FROM l.content->>'key' OR l.parent_key IS DISTINCT FROM l.content->>'parentKey' OR l.order_id::text IS DISTINCT FROM l.content->>'orderId' OR l.piece_id::text IS DISTINCT FROM l.content->>'pieceId' OR l.estimate_revision_id::text IS DISTINCT FROM l.content->>'estimateRevisionId' OR l.service_line_id::text IS DISTINCT FROM l.content->>'serviceLineId' OR l.addition_line_id::text IS DISTINCT FROM l.content->>'additionLineId' THEN RAISE EXCEPTION 'Quotation line provenance denied';END IF;
 END LOOP;
 IF EXISTS(WITH RECURSIVE walk(k,parent,path,cycle) AS (
 SELECT line_key,parent_key,ARRAY[line_key],false FROM booking_quotation_line WHERE shop_id=NEW.shop_id AND revision_id=NEW.id
 UNION ALL SELECT q.line_key,q.parent_key,w.path||q.line_key,q.line_key=ANY(w.path) FROM walk w JOIN booking_quotation_line q ON q.shop_id=NEW.shop_id AND q.revision_id=NEW.id AND q.line_key=w.parent WHERE NOT w.cycle
 ) SELECT 1 FROM walk WHERE cycle) THEN RAISE EXCEPTION 'Quotation inclusion cycle';END IF;
 IF (SELECT coalesce(sum((content->>'netPaise')::numeric),0) FROM booking_quotation_line WHERE shop_id=NEW.shop_id AND revision_id=NEW.id AND content->>'role'='charge') IS DISTINCT FROM (NEW.content->'customer'->>'totalPaise')::numeric THEN RAISE EXCEPTION 'Quotation reconciliation denied';END IF;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION booking_quotation_complete() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER quotation_complete AFTER INSERT ON booking_quotation_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION booking_quotation_complete();
