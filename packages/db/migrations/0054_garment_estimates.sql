-- #174 / 1.4.1b. Expand only. No price/cost seed and no financial or order writes.
CREATE TABLE garment_estimate_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,estimate_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),previous_id uuid,
 origin_draft_id uuid NOT NULL,actor_id uuid NOT NULL,audit_id uuid NOT NULL,
 order_id uuid,piece_id uuid,customer_id uuid,wearer_id uuid,specification_id uuid,booking_id uuid,commercial_id uuid,service_subject_id uuid,
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,estimate_id,id),UNIQUE(shop_id,estimate_id,version),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,estimate_id,previous_id) REFERENCES garment_estimate_revision(shop_id,estimate_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),FOREIGN KEY(shop_id,specification_id) REFERENCES design_spec_version(shop_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,booking_id) REFERENCES booking(shop_id,id),FOREIGN KEY(shop_id,commercial_id) REFERENCES booking_commercial_revision(shop_id,id),
 FOREIGN KEY(shop_id,service_subject_id) REFERENCES service_property_subject(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL)),CHECK(piece_id IS NULL OR order_id IS NOT NULL),CHECK(wearer_id IS NULL OR customer_id IS NOT NULL)
);
CREATE INDEX estimate_subject ON garment_estimate_revision(shop_id,order_id,piece_id,id);
CREATE INDEX estimate_person ON garment_estimate_revision(shop_id,customer_id,wearer_id);
CREATE TABLE garment_estimate (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,current_revision_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,id),FOREIGN KEY(shop_id,id,current_revision_id) REFERENCES garment_estimate_revision(shop_id,estimate_id,id)
);
ALTER TABLE garment_estimate_revision ADD FOREIGN KEY(shop_id,estimate_id) REFERENCES garment_estimate(shop_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE garment_estimate_line (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),revision_id uuid NOT NULL,line_id uuid NOT NULL,position integer NOT NULL CHECK(position BETWEEN 0 AND 63),
 rate_revision_id uuid,rate_entry_id uuid,service_line_id uuid,addition_line_id uuid,
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,revision_id,line_id),UNIQUE(shop_id,revision_id,position),
 FOREIGN KEY(shop_id,revision_id) REFERENCES garment_estimate_revision(shop_id,id),
 FOREIGN KEY(shop_id,rate_revision_id,rate_entry_id) REFERENCES quotation_rate_entry(shop_id,revision_id,entry_id),
 FOREIGN KEY(shop_id,service_line_id) REFERENCES service_order_line(shop_id,id),
 FOREIGN KEY(shop_id,addition_line_id) REFERENCES order_service_change_line(shop_id,id),
 CHECK((rate_revision_id IS NULL)=(rate_entry_id IS NULL))
);
CREATE INDEX estimate_line_rate ON garment_estimate_line(shop_id,rate_revision_id,rate_entry_id);
CREATE TABLE garment_estimate_cost (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),revision_id uuid NOT NULL,line_id uuid NOT NULL,position integer NOT NULL,
 amount_paise bigint CHECK(amount_paise BETWEEN 0 AND 9007199254740991),amount_text text NOT NULL,reason text NOT NULL,created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,revision_id,line_id),UNIQUE(shop_id,revision_id,position),
 FOREIGN KEY(shop_id,revision_id,line_id) REFERENCES garment_estimate_line(shop_id,revision_id,line_id)
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['garment_estimate','garment_estimate_revision','garment_estimate_line','garment_estimate_cost'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT TO app_user USING(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT TO app_user WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $rls$;
GRANT UPDATE(current_revision_id,version) ON garment_estimate TO app_user;
CREATE FUNCTION garment_estimate_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;a public.audit_event;r public.garment_estimate_revision;l jsonb;k text;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Estimate history protected' USING ERRCODE='42501';END IF;
 NEW.created_xid=pg_current_xact_id();
 IF TG_TABLE_NAME<>'garment_estimate_revision' THEN
  SELECT * INTO r FROM garment_estimate_revision WHERE shop_id=NEW.shop_id AND id=NEW.revision_id;
  IF r.created_xid IS DISTINCT FROM pg_current_xact_id() THEN RAISE EXCEPTION 'Estimate sealed' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO a FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id;
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.lifecycle IS DISTINCT FROM 'active' OR d.workflow IS DISTINCT FROM 'pricing.estimate' OR d.schema_version<>1 OR a.actor_id IS DISTINCT FROM NEW.actor_id OR a.action IS DISTINCT FROM 'pricing.estimate.save' OR a.entity_id IS DISTINCT FROM NEW.id OR a.entity_type IS DISTINCT FROM 'garment_estimate'
  OR NEW.content->'input' IS DISTINCT FROM d.payload-'privateCosts' OR d.payload->>'estimateId' IS DISTINCT FROM NEW.estimate_id::text
  OR d.payload->>'baseVersion' IS DISTINCT FROM (NEW.version-1)::text OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id
  OR NEW.content->'source'->>'orderId' IS DISTINCT FROM NEW.order_id::text OR NEW.content->'source'->>'pieceId' IS DISTINCT FROM NEW.piece_id::text OR NEW.content->'source'->>'customerId' IS DISTINCT FROM NEW.customer_id::text OR NEW.content->'source'->>'wearerId' IS DISTINCT FROM NEW.wearer_id::text OR NEW.content->'source'->>'specificationId' IS DISTINCT FROM NEW.specification_id::text
  OR NEW.content ?| ARRAY['costs','privateCosts','costSubtotalPaise','estimatedMarginPaise']
  OR NEW.content->>'actualCost' IS DISTINCT FROM 'unavailable'
  OR NEW.content->'source'->>'bookingId' IS DISTINCT FROM NEW.booking_id::text OR NEW.content->'source'->>'commercialId' IS DISTINCT FROM NEW.commercial_id::text
  OR NEW.content->'source'->>'serviceSubjectId' IS DISTINCT FROM NEW.service_subject_id::text
  THEN RAISE EXCEPTION 'Estimate provenance denied' USING ERRCODE='23514';END IF;
 IF NEW.version>1 AND NOT EXISTS(SELECT 1 FROM garment_estimate_revision p WHERE p.shop_id=NEW.shop_id AND p.id=NEW.previous_id AND p.estimate_id=NEW.estimate_id AND p.version=NEW.version-1) THEN RAISE EXCEPTION 'Estimate lineage denied' USING ERRCODE='23514';END IF;
 FOR k IN SELECT jsonb_object_keys(NEW.content->'customer') LOOP
  IF k<>ALL(ARRAY['kind','estimateId','pricingDate','lines','knownSubtotalPaise','unknownCount','complete','totalPaise','assumptions']) THEN RAISE EXCEPTION 'Private customer projection denied' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR l IN SELECT * FROM jsonb_array_elements(NEW.content->'customer'->'lines') LOOP
  FOR k IN SELECT jsonb_object_keys(l) LOOP
   IF k<>ALL(ARRAY['id','sequence','subjectId','sourceKey','labelEn','labelTa','component','material','state','quantity','unit','basisQuantity','ratePaise','amountPaise','coveringLineId','assumptions','reason','issues']) THEN RAISE EXCEPTION 'Private customer line denied' USING ERRCODE='23514';END IF;
  END LOOP;
  IF l->>'material'='customer' AND l->>'component' IN('fabric','lining','trims') AND l->>'state' NOT IN('unknown','excluded') THEN RAISE EXCEPTION 'Customer property cannot be charged as stock' USING ERRCODE='23514';END IF;
 END LOOP;
 NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());NEW.content_hash=encode(sha256(convert_to(NEW.content::text,'UTF8')),'hex');RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION garment_estimate_guard() FROM PUBLIC;
CREATE TRIGGER estimate_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON garment_estimate_revision FOR EACH ROW EXECUTE FUNCTION garment_estimate_guard();
CREATE TRIGGER estimate_line_guard BEFORE INSERT OR UPDATE OR DELETE ON garment_estimate_line FOR EACH ROW EXECUTE FUNCTION garment_estimate_guard();
CREATE TRIGGER estimate_cost_guard BEFORE INSERT OR UPDATE OR DELETE ON garment_estimate_cost FOR EACH ROW EXECUTE FUNCTION garment_estimate_guard();
CREATE FUNCTION garment_estimate_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.garment_estimate_revision;BEGIN
 SELECT * INTO r FROM garment_estimate_revision WHERE shop_id=NEW.shop_id AND id=NEW.current_revision_id;
 IF r.created_xid IS DISTINCT FROM pg_current_xact_id() OR r.estimate_id IS DISTINCT FROM NEW.id OR r.version IS DISTINCT FROM NEW.version THEN RAISE EXCEPTION 'Estimate pointer denied' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' THEN IF NEW.version<>1 THEN RAISE EXCEPTION 'Estimate first version denied';END IF;
 ELSE IF NEW.shop_id<>OLD.shop_id OR NEW.id<>OLD.id OR NEW.version<>OLD.version+1 OR r.previous_id<>OLD.current_revision_id THEN RAISE EXCEPTION 'Estimate pointer CAS denied' USING ERRCODE='23514';END IF;END IF;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION garment_estimate_pointer_guard() FROM PUBLIC;
CREATE TRIGGER estimate_pointer_guard BEFORE INSERT OR UPDATE ON garment_estimate FOR EACH ROW EXECUTE FUNCTION garment_estimate_pointer_guard();
CREATE FUNCTION garment_estimate_complete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;l public.garment_estimate_line;c public.garment_estimate_cost;x jsonb;BEGIN
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM 'pricing.estimate' OR d.result_id IS DISTINCT FROM NEW.id OR NOT EXISTS(SELECT 1 FROM garment_estimate i WHERE i.shop_id=NEW.shop_id AND i.id=NEW.estimate_id AND i.current_revision_id=NEW.id)
  OR (SELECT count(*) FROM garment_estimate_line WHERE shop_id=NEW.shop_id AND revision_id=NEW.id)<>jsonb_array_length(d.payload->'lines')
  OR (SELECT count(*) FROM garment_estimate_cost WHERE shop_id=NEW.shop_id AND revision_id=NEW.id)<>jsonb_array_length(d.payload->'lines') THEN RAISE EXCEPTION 'Incomplete estimate transaction' USING ERRCODE='23514';END IF;
 FOR l IN SELECT * FROM garment_estimate_line WHERE shop_id=NEW.shop_id AND revision_id=NEW.id LOOP
  IF l.content IS DISTINCT FROM NEW.content->'customer'->'lines'->l.position OR (l.content->>'id')::uuid IS DISTINCT FROM l.line_id THEN RAISE EXCEPTION 'Estimate line projection denied' USING ERRCODE='23514';END IF;
  x=d.payload->'lines'->l.position;
  IF (x->'rate'->>'revisionId')::uuid IS DISTINCT FROM l.rate_revision_id OR (x->'rate'->>'entryId')::uuid IS DISTINCT FROM l.rate_entry_id THEN RAISE EXCEPTION 'Estimate rate source denied' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR c IN SELECT * FROM garment_estimate_cost WHERE shop_id=NEW.shop_id AND revision_id=NEW.id LOOP
  SELECT p INTO x FROM jsonb_array_elements(d.payload->'privateCosts') p WHERE p->>'lineId'=c.line_id::text;
  IF c.amount_text IS DISTINCT FROM COALESCE(x->>'amountText','') OR c.reason IS DISTINCT FROM COALESCE(x->>'reason','') OR (trim(c.amount_text)<>'' AND trim(c.amount_text) !~ '^[0-9]+(\.[0-9]{1,2})?$') OR NULLIF(trim(c.amount_text),'')::numeric*100 IS DISTINCT FROM c.amount_paise::numeric THEN RAISE EXCEPTION 'Estimate private cost denied' USING ERRCODE='23514';END IF;
 END LOOP;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION garment_estimate_complete() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER estimate_complete AFTER INSERT ON garment_estimate_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION garment_estimate_complete();
