-- 1.1.2e / ST-07–12. Additive only: no rule relabel, backfill or activation.
-- Back up before non-disposable application. Keep immutable schema on rollback.
CREATE TABLE service_commitment_binding_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 category_id uuid NOT NULL, category_revision_id uuid NOT NULL, availability_id uuid NOT NULL,
 rule_revision_id uuid NOT NULL, base_version integer NOT NULL CHECK(base_version>=0),
 version integer NOT NULL CHECK(version=base_version+1), previous_id uuid,
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, origin_draft_id uuid NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 review text NOT NULL CHECK(review IN ('pending','reviewed')),
 reason text NOT NULL CHECK(length(trim(reason))>0 AND length(reason)<=1000),
 authority text NOT NULL CHECK(authority IN ('owner-reviewed','owner-proposal','synthetic-fixture')),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,category_id,id), UNIQUE(shop_id,category_id,version), UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,category_id,category_revision_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,category_id,availability_id) REFERENCES service_catalogue_availability(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,rule_revision_id) REFERENCES shop_commitments_revision(shop_id,id),
 FOREIGN KEY(shop_id,category_id,previous_id) REFERENCES service_commitment_binding_revision(shop_id,category_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE service_commitment_binding (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), category_id uuid NOT NULL,
 current_revision_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,category_id),
 FOREIGN KEY(shop_id,category_id) REFERENCES service_catalogue_entry(shop_id,entry_id),
 FOREIGN KEY(shop_id,category_id,current_revision_id) REFERENCES service_commitment_binding_revision(shop_id,category_id,id)
);
CREATE INDEX service_commitment_binding_category_source ON service_commitment_binding_revision(shop_id,category_revision_id);
CREATE INDEX service_commitment_binding_rule_source ON service_commitment_binding_revision(shop_id,rule_revision_id);
DO $bindings$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['service_commitment_binding','service_commitment_binding_revision'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $bindings$;
GRANT UPDATE(current_revision_id,version) ON service_commitment_binding TO app_user;
CREATE FUNCTION service_commitment_binding_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; cat public.service_catalogue_revision; av public.service_catalogue_availability; rule public.shop_commitments_revision; expected text;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Binding history protected' USING ERRCODE='42501'; END IF;
 -- Serialize with the existing canonical source publishers, including absent pointers.
 PERFORM pg_advisory_xact_lock(hashtextextended('catalogue:'||NEW.shop_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('commitments:'||NEW.shop_id::text,0));
 PERFORM 1 FROM service_catalogue_entry WHERE shop_id=NEW.shop_id AND entry_id=NEW.category_id AND current_change_id=NEW.availability_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Category pointer stale' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM shop_commitments WHERE shop_id=NEW.shop_id AND current_revision_id=NEW.rule_revision_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Rule pointer stale' USING ERRCODE='23514'; END IF;
 SELECT * INTO cat FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND entry_id=NEW.category_id AND id=NEW.category_revision_id;
 SELECT * INTO av FROM service_catalogue_availability WHERE shop_id=NEW.shop_id AND entry_id=NEW.category_id AND id=NEW.availability_id;
 SELECT * INTO rule FROM shop_commitments_revision WHERE shop_id=NEW.shop_id AND id=NEW.rule_revision_id;
 IF cat.id IS NULL OR av.id IS NULL OR rule.id IS NULL OR cat.content->>'kind'<>'category' OR NOT av.available OR av.definition_id<>cat.id THEN
  RAISE EXCEPTION 'Binding source denied' USING ERRCODE='23514'; END IF;
 expected=CASE WHEN cat.authority='synthetic-fixture' OR rule.configuration->>'authority'='synthetic-fixture' THEN 'synthetic-fixture' WHEN NEW.review='reviewed' THEN 'owner-reviewed' ELSE 'owner-proposal' END;
 IF NEW.authority<>expected THEN RAISE EXCEPTION 'Binding authority denied' USING ERRCODE='23514'; END IF;
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NOT EXISTS(
  SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_type='user' AND actor_id=NEW.actor_id
  AND entity_type='service_commitment_binding_revision' AND entity_id=NEW.id AND action='service-commitment-binding.publish'
 ) THEN RAISE EXCEPTION 'Binding provenance denied' USING ERRCODE='42501'; END IF;
 IF NEW.version>1 AND NOT EXISTS(SELECT 1 FROM service_commitment_binding_revision WHERE shop_id=NEW.shop_id AND category_id=NEW.category_id AND id=NEW.previous_id AND version+1=NEW.version) THEN
  RAISE EXCEPTION 'Binding predecessor denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.id IS NULL OR d.workflow<>'service.commitment-bindings' OR d.lifecycle<>'active' OR d.schema_version<>1 OR
 d.payload IS DISTINCT FROM jsonb_build_object('categoryId',NEW.category_id,'categoryRevisionId',NEW.category_revision_id,'availabilityId',NEW.availability_id,'ruleRevisionId',NEW.rule_revision_id,'baseVersion',NEW.base_version,'baseRevisionId',NEW.previous_id,'review',NEW.review,'reason',NEW.reason) THEN
  RAISE EXCEPTION 'Binding draft content denied' USING ERRCODE='23514'; END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION service_commitment_binding_revision_guard() FROM PUBLIC;
CREATE TRIGGER service_commitment_binding_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON service_commitment_binding_revision FOR EACH ROW EXECUTE FUNCTION service_commitment_binding_revision_guard();
CREATE FUNCTION service_commitment_binding_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.service_commitment_binding_revision;
BEGIN
 SELECT * INTO r FROM service_commitment_binding_revision WHERE shop_id=NEW.shop_id AND category_id=NEW.category_id AND id=NEW.current_revision_id;
 IF NOT FOUND OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Binding pointer denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Binding first publication denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.category_id<>OLD.category_id OR NEW.version<>OLD.version+1 OR r.previous_id<>OLD.current_revision_id THEN RAISE EXCEPTION 'Binding version denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION service_commitment_binding_pointer_guard() FROM PUBLIC;
CREATE TRIGGER service_commitment_binding_pointer_guard BEFORE INSERT OR UPDATE ON service_commitment_binding FOR EACH ROW EXECUTE FUNCTION service_commitment_binding_pointer_guard();
CREATE FUNCTION service_commitment_binding_origin_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='service.commitment-bindings' AND lifecycle='promoted' AND result_type='service.commitment-binding.revision' AND result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM service_commitment_binding WHERE shop_id=NEW.shop_id AND category_id=NEW.category_id AND version>=NEW.version) THEN
  RAISE EXCEPTION 'Binding promotion incomplete' USING ERRCODE='23514'; END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION service_commitment_binding_origin_guard() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER service_commitment_binding_origin_guard AFTER INSERT ON service_commitment_binding_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_commitment_binding_origin_guard();
