-- 1.2.2c expand only; retain origin, proposal and conversion history on rollback.
ALTER TABLE garment_order ADD COLUMN origin_line_id uuid;
ALTER TABLE garment_order DROP CONSTRAINT garment_order_shop_id_origin_draft_id_key;
CREATE UNIQUE INDEX garment_order_single_origin ON garment_order(shop_id,origin_draft_id) WHERE origin_line_id IS NULL;
CREATE UNIQUE INDEX garment_order_group_origin ON garment_order(shop_id,origin_draft_id,origin_line_id) WHERE origin_line_id IS NOT NULL;
CREATE TABLE booking_commercial_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,booking_id uuid NOT NULL,origin_draft_id uuid NOT NULL,
 schema_version integer NOT NULL DEFAULT 2 CHECK(schema_version=2),version integer NOT NULL DEFAULT 1 CHECK(version=1),
 basis text NOT NULL CHECK(basis IN ('garment-prices','package-proposal')),
 package_paise bigint CHECK(package_paise>=0 AND package_paise<=9007199254740991),
 CHECK(basis='package-proposal' OR package_paise IS NULL),
 allocation text NOT NULL DEFAULT 'unresolved' CHECK(allocation='unresolved'),
 scope jsonb NOT NULL CHECK(jsonb_typeof(scope)='array' AND jsonb_array_length(scope) BETWEEN 2 AND 20),
 actor_id uuid NOT NULL,audit_id uuid NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,booking_id),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,booking_id) REFERENCES booking(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE order_draft_conversion (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),source_draft_id uuid NOT NULL,target_draft_id uuid NOT NULL,line_id uuid NOT NULL,
 actor_id uuid NOT NULL,command_key uuid NOT NULL,request_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 PRIMARY KEY(shop_id,source_draft_id),UNIQUE(shop_id,target_draft_id),
 FOREIGN KEY(shop_id,source_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,target_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['booking_commercial_revision','order_draft_conversion'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION order_immutable_guard()',t||'_immutable',t);
 END LOOP;
END $policies$;
-- Canonical included-line intake never represents the package/reference amount as a line charge.
CREATE FUNCTION group_line_intake(payload jsonb,line_id uuid,fingerprint text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $fn$
 SELECT (l->'intake') || CASE WHEN payload->'commercial'->>'basis'='package-proposal' THEN jsonb_build_object('priceState','to-be-quoted','priceText','') ELSE '{}'::jsonb END || jsonb_build_object('commitmentReview',(payload->'review')||jsonb_build_object('fingerprint',fingerprint))
 FROM jsonb_array_elements(payload->'lines') l WHERE l->>'id'=line_id::text
$fn$;
REVOKE ALL ON FUNCTION group_line_intake(jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION group_line_intake(jsonb,uuid,text) TO app_user;
CREATE FUNCTION group_commercial_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; expected jsonb;amount bigint;
BEGIN
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT jsonb_agg(jsonb_build_object('lineId',l.value->>'id','orderId',o.id) ORDER BY l.n) INTO expected FROM jsonb_array_elements(d.payload->'lines') WITH ORDINALITY l(value,n) JOIN garment_order o ON o.shop_id=d.shop_id AND o.origin_draft_id=d.id AND o.origin_line_id=(l.value->>'id')::uuid;
 IF d.payload->'commercial'->>'basis'='package-proposal' AND d.payload->'commercial'->>'packagePriceState'='quoted' THEN
  IF trim(d.payload->'commercial'->>'packagePriceText') !~ '^([0-9]+|[1-9][0-9]{0,2}(,[0-9]{3})+|[1-9][0-9]?(,[0-9]{2})*,[0-9]{3})(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Invalid package amount' USING ERRCODE='23514';END IF;
  amount=(replace(trim(d.payload->'commercial'->>'packagePriceText'),',','')::numeric*100)::bigint;
 END IF;
 IF d.workflow IS DISTINCT FROM 'order.group' OR d.lifecycle IS DISTINCT FROM 'active' OR NEW.basis IS DISTINCT FROM d.payload->'commercial'->>'basis'
 OR NEW.scope IS DISTINCT FROM expected OR jsonb_array_length(NEW.scope)<>jsonb_array_length(d.payload->'lines') OR NEW.package_paise IS DISTINCT FROM amount
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NEW.reason IS DISTINCT FROM d.payload->>'reason'
 OR NOT EXISTS(SELECT 1 FROM booking b WHERE b.shop_id=NEW.shop_id AND b.id=NEW.booking_id AND b.origin_draft_id=d.id)
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.action='booking.commercial.propose' AND a.actor_id=NEW.actor_id AND a.entity_id=NEW.booking_id)
 THEN RAISE EXCEPTION 'Commercial proposal denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER group_commercial_insert BEFORE INSERT ON booking_commercial_revision FOR EACH ROW EXECUTE FUNCTION group_commercial_guard();
CREATE FUNCTION group_order_complete_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; c public.booking_commercial_revision;s public.order_acceptance_snapshot;line jsonb;expected jsonb;reference_paise bigint;
BEGIN
 IF NEW.origin_line_id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO c FROM booking_commercial_revision WHERE shop_id=NEW.shop_id AND origin_draft_id=d.id;
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.id;
 SELECT value INTO line FROM jsonb_array_elements(d.payload->'lines') WHERE value->>'id'=NEW.origin_line_id::text;
 IF c.id IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.scope) x WHERE x->>'lineId'=NEW.origin_line_id::text AND x->>'orderId'=NEW.id::text)
 OR NOT EXISTS(SELECT 1 FROM audit_event a JOIN idempotency_key k ON k.shop_id=a.shop_id AND k.key=a.idempotency_key WHERE a.shop_id=c.shop_id AND a.id=c.audit_id AND k.actor_id=c.actor_id AND k.action='draft.promote')
 THEN RAISE EXCEPTION 'Group commercial scope incomplete' USING ERRCODE='23514';END IF;
 IF c.basis='package-proposal' THEN
  IF line->'intake'->>'priceState'='quoted' THEN reference_paise=(replace(trim(line->'intake'->>'priceText'),',','')::numeric*100)::bigint;END IF;
  expected=jsonb_build_object('schemaVersion',2,'basis','package-included','packageVersionId',c.id,'groupDraftId',d.id,'lineId',NEW.origin_line_id,'allocationPaise',NULL,'referencePaise',reference_paise);
  IF s.content->'commercial' IS DISTINCT FROM expected OR s.content->'snapshot'->'commercial' IS DISTINCT FROM expected OR NEW.price_paise IS NOT NULL THEN RAISE EXCEPTION 'Included amount is not a charge' USING ERRCODE='23514';END IF;
 ELSIF s.content ? 'commercial' OR s.content->'snapshot' ? 'commercial' THEN RAISE EXCEPTION 'Unexpected package basis' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER group_order_complete AFTER INSERT ON garment_order DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION group_order_complete_guard();
CREATE FUNCTION order_conversion_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.durable_draft;t public.durable_draft;
BEGIN
 SELECT * INTO s FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.source_draft_id;
 SELECT * INTO t FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.target_draft_id;
 IF s.workflow IS DISTINCT FROM 'order.quick' OR s.lifecycle IS DISTINCT FROM 'active' OR t.workflow IS DISTINCT FROM 'order.group' OR t.lifecycle IS DISTINCT FROM 'active' OR t.version<>1
 OR jsonb_array_length(t.payload->'lines')<>1 OR t.payload->'lines'->0->>'id' IS DISTINCT FROM NEW.line_id::text
 OR t.payload->'lines'->0->'intake' IS DISTINCT FROM (s.payload||jsonb_build_object('commitmentReview',NULL))
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 THEN RAISE EXCEPTION 'Draft conversion denied' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER order_conversion_insert BEFORE INSERT ON order_draft_conversion FOR EACH ROW EXECUTE FUNCTION order_conversion_guard();
CREATE FUNCTION order_conversion_complete_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft d WHERE d.shop_id=NEW.shop_id AND d.id=NEW.source_draft_id AND d.lifecycle='promoted' AND d.result_type='order.group-draft' AND d.result_id=NEW.target_draft_id)
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k JOIN audit_event a ON a.shop_id=k.shop_id AND a.idempotency_key=k.key WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.actor_id=NEW.actor_id AND k.action='draft.convert' AND a.action='draft.convert' AND a.entity_id=NEW.source_draft_id AND a.request_id=NEW.request_id)
 THEN RAISE EXCEPTION 'Draft conversion incomplete' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER order_conversion_complete AFTER INSERT ON order_draft_conversion DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_conversion_complete_guard();
REVOKE ALL ON FUNCTION group_commercial_guard(),group_order_complete_guard(),order_conversion_guard(),order_conversion_complete_guard() FROM PUBLIC;
CREATE OR REPLACE FUNCTION garment_order_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; p jsonb;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Order protected' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
  p=CASE WHEN d.workflow='order.group' THEN group_line_intake(d.payload,NEW.origin_line_id,NULL) ELSE d.payload END;
  IF d.id IS NULL OR d.workflow NOT IN ('order.quick','order.group') OR p IS NULL OR (d.workflow='order.quick') IS DISTINCT FROM (NEW.origin_line_id IS NULL) OR d.schema_version<>1 OR d.lifecycle<>'active'
   OR (p->>'customerId')::uuid IS DISTINCT FROM NEW.customer_id
   OR (p->>'wearerId')::uuid IS DISTINCT FROM NEW.wearer_id
   OR p->>'presentation' IS DISTINCT FROM NEW.presentation
   OR p->>'priceState' IS DISTINCT FROM NEW.price_state
   OR NEW.version<>1 OR NEW.owner_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
   OR NOT EXISTS(SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_id=NEW.owner_id AND action='order.accept' AND entity_id=NEW.id)
  THEN RAISE EXCEPTION 'Order provenance denied' USING ERRCODE='23514'; END IF;
  NEW.accepted_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id();
 ELSE
  IF (to_jsonb(NEW)-ARRAY['version','presentation']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['version','presentation'])
    OR NEW.version::bigint<>OLD.version::bigint+1 OR NOT EXISTS(SELECT 1 FROM order_presentation_event WHERE shop_id=NEW.shop_id AND order_id=NEW.id AND version=NEW.version AND mode=NEW.presentation AND created_xid=pg_current_xact_id() AND actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid)
  THEN RAISE EXCEPTION 'Order update denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION order_acceptance_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.order_acceptance_snapshot; d public.durable_draft; p jsonb; result_ok boolean;
BEGIN
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 p=CASE WHEN d.workflow='order.group' THEN group_line_intake(d.payload,NEW.origin_line_id,s.content->'review'->>'fingerprint') ELSE d.payload END;
 result_ok=CASE WHEN d.workflow='order.group' THEN d.result_type='booking.revision' AND EXISTS(SELECT 1 FROM booking_revision r JOIN booking_member m ON m.shop_id=r.shop_id AND m.booking_id=r.booking_id WHERE r.shop_id=NEW.shop_id AND r.id=d.result_id AND r.origin_draft_id=d.id AND m.order_id=NEW.id) ELSE d.result_type='order.accepted' AND d.result_id=NEW.id END;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR result_ok IS DISTINCT FROM true OR p IS NULL
 OR s.order_id IS NULL OR s.content->'intake' IS DISTINCT FROM p
 OR s.manifest_id IS DISTINCT FROM (p->'manifest'->>'revisionId')::uuid
 OR s.definition_id IS DISTINCT FROM (p->'manifest'->>'definitionId')::uuid
 OR s.content->>'synthetic' IS DISTINCT FROM 'true'
 OR (s.content->>'pricePaise')::bigint IS DISTINCT FROM NEW.price_paise
 OR NOT EXISTS(SELECT 1 FROM order_capacity_demand WHERE shop_id=NEW.shop_id AND order_id=NEW.id AND category_id=s.category_id AND delivery_date=(p->>'deliveryDate')::date)
 OR (SELECT count(*) FROM order_requirement WHERE shop_id=NEW.shop_id AND order_id=NEW.id)<>jsonb_array_length(s.content->'requirements'->'items')
 OR NOT EXISTS(SELECT 1 FROM order_presentation_event WHERE shop_id=NEW.shop_id AND order_id=NEW.id AND version=1 AND mode=NEW.presentation AND actor_id=NEW.owner_id)
 THEN RAISE EXCEPTION 'Order acceptance incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION booking_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE b public.booking;d public.durable_draft;s jsonb;o public.garment_order;prior jsonb;expected jsonb;p jsonb;
BEGIN
 SELECT * INTO b FROM booking WHERE shop_id=NEW.shop_id AND id=NEW.booking_id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 p=d.payload;
 IF d.workflow='order.group' THEN
  SELECT jsonb_build_object('customerId',d.payload->'lines'->0->'intake'->'customerId','target',NULL,'context',d.payload->'context','reason',d.payload->'reason','orders',coalesce(jsonb_agg(jsonb_build_object('id',accepted.id,'version',accepted.version,'snapshotDigest',snap.digest) ORDER BY l.n),'[]'::jsonb)) INTO p FROM jsonb_array_elements(d.payload->'lines') WITH ORDINALITY l(value,n) JOIN garment_order accepted ON accepted.shop_id=d.shop_id AND accepted.origin_draft_id=d.id AND accepted.origin_line_id=(l.value->>'id')::uuid JOIN order_acceptance_snapshot snap ON snap.shop_id=accepted.shop_id AND snap.order_id=accepted.id;
  IF jsonb_array_length(p->'orders')<>jsonb_array_length(d.payload->'lines') THEN RAISE EXCEPTION 'Partial grouped acceptance' USING ERRCODE='23514';END IF;
 END IF;
 IF d.lifecycle IS DISTINCT FROM 'active' OR d.workflow NOT IN ('booking.group','order.group') OR d.schema_version<>1
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NEW.context IS DISTINCT FROM p->'context' OR NEW.reason IS DISTINCT FROM p->>'reason'
 OR NEW.payer_id IS DISTINCT FROM (NEW.context->>'payerId')::uuid
 OR b.customer_id::text IS DISTINCT FROM p->>'customerId'
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.entity_id=NEW.booking_id AND a.action='booking.revise' AND a.reason=NEW.reason)
 THEN RAISE EXCEPTION 'Booking provenance denied' USING ERRCODE='23514';END IF;
 IF NEW.version=1 THEN
  IF b.version<>1 OR b.origin_draft_id<>d.id OR b.current_revision_id<>NEW.id OR p->'target'<>'null'::jsonb THEN RAISE EXCEPTION 'Booking origin denied' USING ERRCODE='23514';END IF;
  prior='[]'::jsonb;
 ELSE
  IF b.version+1<>NEW.version OR p->'target'->>'id' IS DISTINCT FROM b.id::text OR (p->'target'->>'version')::integer IS DISTINCT FROM b.version THEN RAISE EXCEPTION 'Stale booking' USING ERRCODE='23514';END IF;
  SELECT sources INTO prior FROM booking_revision WHERE shop_id=b.shop_id AND id=b.current_revision_id;
 END IF;
 expected=prior||(p->'orders');
 IF NEW.sources IS DISTINCT FROM expected OR (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(NEW.sources))<>jsonb_array_length(NEW.sources) THEN RAISE EXCEPTION 'Booking source mismatch' USING ERRCODE='23514';END IF;
 IF NEW.context->>'payerId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM customer WHERE shop_id=NEW.shop_id AND id=(NEW.context->>'payerId')::uuid) THEN RAISE EXCEPTION 'Payer denied' USING ERRCODE='23503';END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(p->'orders') LOOP
  SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=(s->>'id')::uuid;
  IF o.customer_id IS DISTINCT FROM b.customer_id OR o.version IS DISTINCT FROM (s->>'version')::integer OR NOT EXISTS(SELECT 1 FROM order_acceptance_snapshot x WHERE x.shop_id=NEW.shop_id AND x.order_id=o.id AND x.digest=s->>'snapshotDigest') OR EXISTS(SELECT 1 FROM booking_member m WHERE m.shop_id=NEW.shop_id AND m.order_id=o.id) THEN RAISE EXCEPTION 'Garment link denied' USING ERRCODE='23514';END IF;
 END LOOP;
 RETURN NEW;
END $fn$;
