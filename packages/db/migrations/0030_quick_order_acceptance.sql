-- 1.2.1b: additive, synthetic-only acceptance. No policy activation or backfill.
-- Retain records/schema on compatible application rollback. Back up non-disposable DBs.
CREATE TABLE garment_order (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 code_number bigint NOT NULL CHECK(code_number>0), code text NOT NULL,
 origin_draft_id uuid NOT NULL, customer_id uuid NOT NULL, wearer_id uuid NOT NULL,
 owner_id uuid NOT NULL, audit_id uuid NOT NULL,
 price_state text NOT NULL CHECK(price_state IN ('quoted','to-be-quoted')),
 price_paise bigint CHECK(price_paise>=0 AND price_paise<=9007199254740991),
 CHECK((price_state='quoted')=(price_paise IS NOT NULL)),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), presentation text NOT NULL CHECK(presentation IN ('simple','detailed')),
 accepted_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,code), UNIQUE(shop_id,code_number), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,owner_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE order_acceptance_snapshot (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), order_id uuid NOT NULL,
 manifest_id uuid NOT NULL, definition_id uuid NOT NULL, category_id uuid NOT NULL,
 binding_id uuid NOT NULL, rule_id uuid NOT NULL, calendar_id uuid NOT NULL,
 profile_id uuid NOT NULL, policies_id uuid NOT NULL, presentation_id uuid,
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object' AND octet_length(content::text)<=524288),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(shop_id,order_id), FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,manifest_id) REFERENCES service_template_availability(shop_id,id),
 FOREIGN KEY(shop_id,definition_id) REFERENCES service_template_revision(shop_id,id),
 FOREIGN KEY(shop_id,category_id,binding_id) REFERENCES service_commitment_binding_revision(shop_id,category_id,id),
 FOREIGN KEY(shop_id,rule_id) REFERENCES shop_commitments_revision(shop_id,id),
 FOREIGN KEY(shop_id,calendar_id) REFERENCES shop_calendar_revision(shop_id,id),
 FOREIGN KEY(shop_id,profile_id) REFERENCES shop_profile_revision(shop_id,id),
 FOREIGN KEY(shop_id,policies_id) REFERENCES shop_policies_revision(shop_id,id),
 FOREIGN KEY(shop_id,presentation_id) REFERENCES shop_presentation_revision(shop_id,id)
);
CREATE TABLE order_requirement (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), order_id uuid NOT NULL,
 position integer NOT NULL CHECK(position>=0), section text NOT NULL, source_key text NOT NULL,
 assignee_id uuid, content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
 PRIMARY KEY(shop_id,order_id,position), UNIQUE(shop_id,order_id,section,source_key),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,assignee_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE order_capacity_demand (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), order_id uuid NOT NULL,
 category_id uuid NOT NULL, delivery_date date NOT NULL,
 unit text NOT NULL CHECK(unit IN ('garments','effort-points')),
 quantity integer NOT NULL CHECK(quantity>0),
 PRIMARY KEY(shop_id,order_id),
 FOREIGN KEY(shop_id,order_id) REFERENCES order_acceptance_snapshot(shop_id,order_id),
 FOREIGN KEY(shop_id,category_id) REFERENCES service_catalogue_entry(shop_id,entry_id)
);
CREATE INDEX order_capacity_bucket ON order_capacity_demand(shop_id,category_id,delivery_date,order_id);
CREATE TABLE order_presentation_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), order_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), mode text NOT NULL CHECK(mode IN ('simple','detailed')),
 actor_id uuid NOT NULL, audit_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,order_id,version),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['garment_order','order_acceptance_snapshot','order_requirement','order_capacity_demand','order_presentation_event'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(version,presentation) ON garment_order TO app_user;
CREATE FUNCTION order_immutable_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN RAISE EXCEPTION 'Accepted order history protected' USING ERRCODE='42501'; END $fn$;
CREATE TRIGGER order_snapshot_immutable BEFORE UPDATE OR DELETE ON order_acceptance_snapshot FOR EACH ROW EXECUTE FUNCTION order_immutable_guard();
CREATE TRIGGER order_requirement_immutable BEFORE UPDATE OR DELETE ON order_requirement FOR EACH ROW EXECUTE FUNCTION order_immutable_guard();
CREATE TRIGGER order_demand_immutable BEFORE UPDATE OR DELETE ON order_capacity_demand FOR EACH ROW EXECUTE FUNCTION order_immutable_guard();
CREATE TRIGGER order_presentation_immutable BEFORE UPDATE OR DELETE ON order_presentation_event FOR EACH ROW EXECUTE FUNCTION order_immutable_guard();
CREATE FUNCTION order_child_insert_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE o public.garment_order; s public.order_acceptance_snapshot;
BEGIN
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 IF o.id IS NULL THEN RAISE EXCEPTION 'Order missing' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='order_presentation_event' THEN
  IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
   OR NEW.version<>(CASE WHEN o.created_xid=pg_current_xact_id() THEN 1 ELSE o.version+1 END)
   OR NOT EXISTS(SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_type='user' AND actor_id=NEW.actor_id AND entity_id=NEW.order_id AND action=(CASE WHEN NEW.version=1 THEN 'order.accept' ELSE 'order.presentation' END))
  THEN RAISE EXCEPTION 'Order presentation provenance denied' USING ERRCODE='23514'; END IF;
  NEW.recorded_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id();
 ELSE
  IF o.created_xid<>pg_current_xact_id() THEN RAISE EXCEPTION 'Order snapshot closed' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='order_requirement' THEN
   SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id;
   IF NEW.content IS DISTINCT FROM (s.content->'requirements'->'items'->NEW.position)
    OR NEW.content->>'section' IS DISTINCT FROM NEW.section OR NEW.content->>'key' IS DISTINCT FROM NEW.source_key
    OR (NEW.content->>'assigneeId')::uuid IS DISTINCT FROM NEW.assignee_id
   THEN RAISE EXCEPTION 'Order requirement denied' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='order_capacity_demand' THEN
   SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id;
   IF NEW.category_id IS DISTINCT FROM s.category_id
    OR NEW.delivery_date IS DISTINCT FROM (s.content->'intake'->>'deliveryDate')::date
    OR NEW.unit IS DISTINCT FROM s.content->'review'->'evaluation'->'facts'->>'unit'
    OR NEW.quantity IS DISTINCT FROM (s.content->'review'->'evaluation'->'facts'->>'candidate')::integer
   THEN RAISE EXCEPTION 'Order demand provenance denied' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='order_acceptance_snapshot' THEN
   IF NOT EXISTS(SELECT 1 FROM service_template_availability WHERE shop_id=NEW.shop_id AND id=NEW.manifest_id AND definition_id=NEW.definition_id)
    OR NOT EXISTS(SELECT 1 FROM service_commitment_binding_revision WHERE shop_id=NEW.shop_id AND id=NEW.binding_id AND category_id=NEW.category_id AND rule_revision_id=NEW.rule_id)
    OR NEW.content->'snapshot'->'sources' IS DISTINCT FROM jsonb_build_object('manifestId',NEW.manifest_id,'definitionId',NEW.definition_id,'categoryId',NEW.category_id,'bindingId',NEW.binding_id,'ruleId',NEW.rule_id,'calendarId',NEW.calendar_id,'profileId',NEW.profile_id,'policiesId',NEW.policies_id,'presentationId',NEW.presentation_id)
   THEN RAISE EXCEPTION 'Order source provenance denied' USING ERRCODE='23514'; END IF;
  END IF;
 END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER order_snapshot_insert BEFORE INSERT ON order_acceptance_snapshot FOR EACH ROW EXECUTE FUNCTION order_child_insert_guard();
CREATE TRIGGER order_requirement_insert BEFORE INSERT ON order_requirement FOR EACH ROW EXECUTE FUNCTION order_child_insert_guard();
CREATE TRIGGER order_demand_insert BEFORE INSERT ON order_capacity_demand FOR EACH ROW EXECUTE FUNCTION order_child_insert_guard();
CREATE TRIGGER order_presentation_insert BEFORE INSERT ON order_presentation_event FOR EACH ROW EXECUTE FUNCTION order_child_insert_guard();
CREATE FUNCTION garment_order_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Order protected' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
  IF d.id IS NULL OR d.workflow<>'order.quick' OR d.schema_version<>1 OR d.lifecycle<>'active'
   OR (d.payload->>'customerId')::uuid IS DISTINCT FROM NEW.customer_id
   OR (d.payload->>'wearerId')::uuid IS DISTINCT FROM NEW.wearer_id
   OR d.payload->>'presentation' IS DISTINCT FROM NEW.presentation
   OR d.payload->>'priceState' IS DISTINCT FROM NEW.price_state
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
CREATE TRIGGER garment_order_guard BEFORE INSERT OR UPDATE OR DELETE ON garment_order FOR EACH ROW EXECUTE FUNCTION garment_order_guard();
CREATE FUNCTION order_acceptance_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.order_acceptance_snapshot; d public.durable_draft;
BEGIN
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM 'order.accepted' OR d.result_id IS DISTINCT FROM NEW.id
 OR s.order_id IS NULL OR s.content->'intake' IS DISTINCT FROM d.payload
 OR s.manifest_id IS DISTINCT FROM (d.payload->'manifest'->>'revisionId')::uuid
 OR s.definition_id IS DISTINCT FROM (d.payload->'manifest'->>'definitionId')::uuid
 OR s.content->>'synthetic' IS DISTINCT FROM 'true'
 OR (s.content->>'pricePaise')::bigint IS DISTINCT FROM NEW.price_paise
 OR NOT EXISTS(SELECT 1 FROM order_capacity_demand WHERE shop_id=NEW.shop_id AND order_id=NEW.id AND category_id=s.category_id AND delivery_date=(d.payload->>'deliveryDate')::date)
 OR (SELECT count(*) FROM order_requirement WHERE shop_id=NEW.shop_id AND order_id=NEW.id)<>jsonb_array_length(s.content->'requirements'->'items')
 OR NOT EXISTS(SELECT 1 FROM order_presentation_event WHERE shop_id=NEW.shop_id AND order_id=NEW.id AND version=1 AND mode=NEW.presentation AND actor_id=NEW.owner_id)
 THEN RAISE EXCEPTION 'Order acceptance incomplete' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER order_acceptance_commit_guard AFTER INSERT ON garment_order DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_acceptance_commit_guard();
CREATE FUNCTION order_presentation_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id AND version>=NEW.version)
 OR NOT EXISTS(SELECT 1 FROM audit_event a JOIN idempotency_key k ON k.shop_id=a.shop_id AND k.key=a.idempotency_key WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND k.actor_id=NEW.actor_id AND k.action=CASE WHEN NEW.version=1 THEN 'draft.promote' ELSE 'order.presentation' END)
 THEN RAISE EXCEPTION 'Order presentation command incomplete' USING ERRCODE='23514'; END IF; RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER order_presentation_commit_guard AFTER INSERT ON order_presentation_event DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_presentation_commit_guard();
REVOKE ALL ON FUNCTION order_immutable_guard(),order_child_insert_guard(),garment_order_guard(),order_acceptance_commit_guard(),order_presentation_commit_guard() FROM PUBLIC;
