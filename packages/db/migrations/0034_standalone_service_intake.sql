-- 1.2.3a / SS-01..14: additive, synthetic-only intake. No production mappings.
-- Back up before non-disposable use. Compatible rollback must gate service
-- writes/unsupported readers; retain these immutable records and nullable branch.
ALTER TABLE garment_order ADD COLUMN intake_kind text NOT NULL DEFAULT 'custom' CHECK(intake_kind IN ('custom','service'));
ALTER TABLE garment_order ALTER COLUMN wearer_id DROP NOT NULL;
ALTER TABLE garment_order ADD CONSTRAINT custom_order_wearer CHECK(intake_kind='service' OR wearer_id IS NOT NULL);
ALTER TABLE garment_order ADD FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id);

CREATE TABLE service_intake_profile_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,entry_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),previous_id uuid,
 actor_id uuid NOT NULL,audit_id uuid NOT NULL,origin_draft_id uuid NOT NULL,
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object' AND octet_length(content::text)<=131072),
 available boolean NOT NULL,reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),
 authority text NOT NULL CHECK(authority IN ('owner-proposal','synthetic-fixture')),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),manifest_id uuid NOT NULL,definition_id uuid NOT NULL,
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,entry_id,id),UNIQUE(shop_id,entry_id,version),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,entry_id,previous_id) REFERENCES service_intake_profile_revision(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,manifest_id) REFERENCES service_template_availability(shop_id,id),
 FOREIGN KEY(shop_id,definition_id) REFERENCES service_template_revision(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE service_intake_profile (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),entry_id uuid NOT NULL,current_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,entry_id),FOREIGN KEY(shop_id,entry_id,current_id) REFERENCES service_intake_profile_revision(shop_id,entry_id,id)
);
ALTER TABLE service_intake_profile_revision ADD FOREIGN KEY(shop_id,entry_id) REFERENCES service_intake_profile(shop_id,entry_id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX service_intake_profile_manifest ON service_intake_profile_revision(shop_id,manifest_id,id);
CREATE TABLE service_property_subject (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,order_id uuid NOT NULL,
 customer_id uuid NOT NULL,wearer_id uuid,
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 1000),property_reference text NOT NULL CHECK(length(property_reference)<=160),
 intake_context text NOT NULL CHECK(length(intake_context)<=1000),source_order_id uuid,source_piece_id uuid,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,order_id),UNIQUE(shop_id,order_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,customer_id,wearer_id) REFERENCES customer_wearer_relationship(shop_id,customer_id,wearer_id),
 FOREIGN KEY(shop_id,source_order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,source_order_id,source_piece_id) REFERENCES order_piece(shop_id,order_id,id),
 CHECK(source_piece_id IS NULL OR source_order_id IS NOT NULL)
);
CREATE INDEX service_subject_source ON service_property_subject(shop_id,source_order_id,source_piece_id);
CREATE TABLE service_order_line (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),order_id uuid NOT NULL,id uuid NOT NULL,
 position integer NOT NULL CHECK(position BETWEEN 0 AND 31),profile_revision_id uuid NOT NULL,source_key text NOT NULL,
 price_paise bigint CHECK(price_paise BETWEEN 0 AND 9007199254740991),
 state text NOT NULL CHECK(state IN ('pending','not-required')),
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
 PRIMARY KEY(shop_id,order_id,id),UNIQUE(shop_id,id),UNIQUE(shop_id,order_id,source_key),UNIQUE(shop_id,order_id,position),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,profile_revision_id) REFERENCES service_intake_profile_revision(shop_id,id)
);
CREATE INDEX service_line_profile ON service_order_line(shop_id,profile_revision_id,order_id);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['service_intake_profile_revision','service_intake_profile','service_property_subject','service_order_line'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
  IF t<>'service_intake_profile' THEN EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION order_immutable_guard()',t||'_immutable',t);END IF;
 END LOOP;
END $policies$;
GRANT UPDATE(current_id,version) ON service_intake_profile TO app_user;

CREATE FUNCTION service_profile_insert_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;head public.service_intake_profile;template public.service_template_revision;service public.service_catalogue_revision;form jsonb;line jsonb;ref jsonb;
BEGIN
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO head FROM service_intake_profile WHERE shop_id=NEW.shop_id AND entry_id=NEW.entry_id;
 SELECT * INTO template FROM service_template_revision WHERE shop_id=NEW.shop_id AND id=NEW.definition_id;
 IF d.workflow IS DISTINCT FROM 'service.intake-profile' OR d.lifecycle IS DISTINCT FROM 'active' OR d.schema_version<>1
 OR d.payload->'content' IS DISTINCT FROM NEW.content OR (d.payload->>'entryId')::uuid IS DISTINCT FROM NEW.entry_id
 OR (d.payload->>'available')::boolean IS DISTINCT FROM NEW.available OR d.payload->>'reason' IS DISTINCT FROM NEW.reason
 OR (d.payload->>'baseVersion')::integer IS DISTINCT FROM NEW.version-1
 OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id
 OR coalesce(head.version,0)<>NEW.version-1 OR head.current_id IS DISTINCT FROM NEW.previous_id
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.entity_id=NEW.id AND a.action='service-profile.publish')
 OR NOT EXISTS(SELECT 1 FROM service_template_availability a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.manifest_id AND a.definition_id=NEW.definition_id AND a.entry_id::text=NEW.content->'manifest'->>'entryId')
 OR NEW.manifest_id::text IS DISTINCT FROM NEW.content->'manifest'->>'revisionId' OR NEW.definition_id::text IS DISTINCT FROM NEW.content->'manifest'->>'definitionId'
 OR NEW.content->>'wearerRequirement' NOT IN ('required','not-required') OR jsonb_array_length(NEW.content->'lines') NOT BETWEEN 1 AND 32
 THEN RAISE EXCEPTION 'Service profile provenance denied' USING ERRCODE='23514';END IF;
 SELECT * INTO service FROM service_catalogue_revision WHERE shop_id=NEW.shop_id AND id=(template.content->'service'->>'revisionId')::uuid AND entry_id=(template.content->'service'->>'entryId')::uuid;
 IF service.content->>'serviceKind' NOT IN ('alteration','small-service') OR service.id IS NULL
 OR (NEW.content->>'wearerRequirement'='not-required' AND (service.content->>'serviceKind'<>'small-service' OR length(trim(NEW.content->>'wearerReason'))=0))
 THEN RAISE EXCEPTION 'Service profile applicability denied' USING ERRCODE='23514';END IF;
 IF NEW.content->>'wearerRequirement'='not-required' THEN
  FOR form IN SELECT value FROM jsonb_array_elements(template.content->'forms') LOOP
   IF NOT EXISTS(SELECT 1 FROM measurement_form_revision f WHERE f.shop_id=NEW.shop_id AND f.id=(form->>'revisionId')::uuid AND f.entry_id=(form->>'entryId')::uuid AND f.content->>'decision'='not-required' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f.content->'groups') g WHERE jsonb_array_length(g->'fields')>0))
   THEN RAISE EXCEPTION 'Service wearer exemption denied' USING ERRCODE='23514';END IF;
  END LOOP;
 END IF;
 IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(NEW.content->'lines'))<>jsonb_array_length(NEW.content->'lines')
 OR (SELECT count(DISTINCT coalesce(value->>'addonKey','$base')) FROM jsonb_array_elements(NEW.content->'lines'))<>jsonb_array_length(NEW.content->'lines')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'lines') l GROUP BY l->>'coverageKey' HAVING count(DISTINCT coalesce(l->>'quantity','null'))>1)
 THEN RAISE EXCEPTION 'Service profile duplicate mapping' USING ERRCODE='23514';END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(NEW.content->'lines') LOOP
  IF line->>'key' !~ '^[a-z][a-z0-9-]{0,79}$' OR length(trim(line->>'coverageKey'))=0
  OR (line->>'quantity' IS NOT NULL AND (line->>'quantity')::integer NOT BETWEEN 0 AND 1000000)
  OR (line->>'addonKey' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(template.content->'addons') a WHERE a->>'key'=line->>'addonKey' AND a->>'applicability'='applicable'))
  OR (line->>'optional'='true' AND (line->>'addonKey' IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(service.content->'addons') required JOIN jsonb_array_elements(template.content->'addons') a ON a->>'entryId'=required->>'entryId' AND a->>'revisionId'=required->>'revisionId' WHERE a->>'key'=line->>'addonKey' AND required->>'optional'='true')))
  OR (line->>'taskKey' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(template.content->'tasks') t WHERE t->>'key'=line->>'taskKey' AND t->'scope'->>'addonKey' IS NOT DISTINCT FROM line->>'addonKey' AND t->>'applicability'<>'not-applicable'))
  THEN RAISE EXCEPTION 'Service profile mapping denied' USING ERRCODE='23514';END IF;
 END LOOP;
 IF (service.content->>'serviceKind'='alteration' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'lines') l WHERE l->>'addonKey' IS NULL AND l->>'optional'='false'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(service.content->'addons') required JOIN jsonb_array_elements(template.content->'addons') a ON a->>'entryId'=required->>'entryId' AND a->>'revisionId'=required->>'revisionId' WHERE required->>'optional'='false' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'lines') l WHERE l->>'addonKey'=a->>'key' AND l->>'optional'='false'))
 THEN RAISE EXCEPTION 'Required service mapping omitted' USING ERRCODE='23514';END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp());NEW.created_xid=pg_current_xact_id();RETURN NEW;
END $fn$;
CREATE TRIGGER service_profile_insert BEFORE INSERT ON service_intake_profile_revision FOR EACH ROW EXECUTE FUNCTION service_profile_insert_guard();
CREATE FUNCTION service_profile_head_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Service profile head protected' USING ERRCODE='42501';END IF;
 IF (TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['current_id','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['current_id','version']) OR NEW.version<>OLD.version+1))
 OR NOT EXISTS(SELECT 1 FROM service_intake_profile_revision r WHERE r.shop_id=NEW.shop_id AND r.entry_id=NEW.entry_id AND r.id=NEW.current_id AND r.version=NEW.version AND r.created_xid=pg_current_xact_id() AND r.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid)
 THEN RAISE EXCEPTION 'Service profile head denied' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER service_profile_head BEFORE INSERT OR UPDATE OR DELETE ON service_intake_profile FOR EACH ROW EXECUTE FUNCTION service_profile_head_guard();
CREATE FUNCTION service_profile_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM durable_draft d WHERE d.shop_id=NEW.shop_id AND d.id=NEW.origin_draft_id AND d.lifecycle='promoted' AND d.result_type='service-profile.revision' AND d.result_id=NEW.id)
 OR NOT EXISTS(SELECT 1 FROM service_intake_profile p WHERE p.shop_id=NEW.shop_id AND p.entry_id=NEW.entry_id AND p.version>=NEW.version)
 OR NOT EXISTS(SELECT 1 FROM audit_event a JOIN idempotency_key k ON (k.shop_id,k.key)=(a.shop_id,a.idempotency_key) WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND k.actor_id=NEW.actor_id AND k.action='draft.promote')
 THEN RAISE EXCEPTION 'Service profile publication incomplete' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER service_profile_complete AFTER INSERT ON service_intake_profile_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_profile_commit_guard();

CREATE FUNCTION service_intake_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE o public.garment_order;s public.order_acceptance_snapshot;p jsonb;line jsonb;source public.garment_order;
BEGIN
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id;
 IF o.intake_kind IS DISTINCT FROM 'service' OR o.created_xid<>pg_current_xact_id() OR s.order_id IS NULL THEN RAISE EXCEPTION 'Service intake closed' USING ERRCODE='23514';END IF;
 p=s.content->'intake';
 IF TG_TABLE_NAME='service_property_subject' THEN
  IF NEW.id::text IS DISTINCT FROM p->>'subjectId' OR NEW.customer_id IS DISTINCT FROM o.customer_id OR NEW.wearer_id IS DISTINCT FROM o.wearer_id
  OR NEW.description IS DISTINCT FROM p->>'subjectDescription' OR NEW.property_reference IS DISTINCT FROM p->>'propertyReference' OR NEW.intake_context IS DISTINCT FROM p->>'intakeContext'
  OR NEW.source_order_id IS DISTINCT FROM (p->>'sourceOrderId')::uuid OR NEW.source_piece_id IS DISTINCT FROM (p->>'sourcePieceId')::uuid
  THEN RAISE EXCEPTION 'Service property provenance denied' USING ERRCODE='23514';END IF;
  IF NEW.source_order_id IS NOT NULL THEN
   SELECT * INTO source FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.source_order_id;
   IF source.id IS NULL OR source.customer_id IS DISTINCT FROM NEW.customer_id OR (source.wearer_id IS NOT NULL AND source.wearer_id IS DISTINCT FROM NEW.wearer_id)
   OR (s.content->'snapshot'->'serviceSource'->>'version')::integer IS DISTINCT FROM source.version
   OR s.content->'snapshot'->'serviceSource'->>'kind' IS DISTINCT FROM source.intake_kind
   OR NOT EXISTS(SELECT 1 FROM order_acceptance_snapshot x WHERE x.shop_id=source.shop_id AND x.order_id=source.id AND x.digest=s.content->'snapshot'->'serviceSource'->>'digest')
   THEN RAISE EXCEPTION 'Service source identity denied' USING ERRCODE='23514';END IF;
  END IF;
 ELSE
  line=s.content->'service'->'lines'->NEW.position;
  IF NEW.content IS DISTINCT FROM line OR NEW.id::text IS DISTINCT FROM line->>'id' OR NEW.source_key IS DISTINCT FROM line->>'key'
  OR NEW.price_paise IS DISTINCT FROM (line->>'pricePaise')::bigint OR NEW.state IS DISTINCT FROM line->>'state'
  OR NEW.profile_revision_id::text IS DISTINCT FROM p->'profile'->>'revisionId'
  THEN RAISE EXCEPTION 'Service line provenance denied' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER service_subject_insert BEFORE INSERT ON service_property_subject FOR EACH ROW EXECUTE FUNCTION service_intake_child_guard();
CREATE TRIGGER service_line_insert BEFORE INSERT ON service_order_line FOR EACH ROW EXECUTE FUNCTION service_intake_child_guard();

-- The service-only commit branch requires exact profile/line/demand derivation;
-- original custom/group checks below are preserved, including populated 0033 data.
CREATE FUNCTION service_order_acceptance_valid(tenant uuid,order_id uuid) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE o public.garment_order;s public.order_acceptance_snapshot;d public.durable_draft;r public.service_intake_profile_revision;
 p jsonb;line jsonb;mapping jsonb;accepted jsonb;amount bigint;total bigint=0;unknown_price boolean=false;candidate_quantity integer;template public.service_template_revision;ref jsonb;definition public.service_catalogue_revision;
 item jsonb;configured jsonb;addon_key text;expected_count integer;form_ref jsonb;form_definition public.measurement_form_revision;
BEGIN
 SELECT * INTO o FROM garment_order WHERE shop_id=tenant AND id=order_id;
 SELECT * INTO s FROM order_acceptance_snapshot x WHERE x.shop_id=tenant AND x.order_id=o.id;
 SELECT * INTO d FROM durable_draft WHERE shop_id=tenant AND id=o.origin_draft_id;p=d.payload;
 SELECT * INTO r FROM service_intake_profile_revision WHERE shop_id=tenant AND id=(p->'profile'->>'revisionId')::uuid;
 SELECT * INTO template FROM service_template_revision WHERE shop_id=tenant AND id=r.definition_id;
 IF o.intake_kind IS DISTINCT FROM 'service' OR d.workflow IS DISTINCT FROM 'order.service' OR d.schema_version<>1
 OR d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM 'service-order.accepted' OR d.result_id IS DISTINCT FROM o.id
 OR s.order_id IS NULL OR s.content->'intake' IS DISTINCT FROM p OR s.content->>'synthetic' IS DISTINCT FROM 'true'
 OR r.id IS NULL OR r.entry_id::text IS DISTINCT FROM p->'profile'->>'entryId' OR NOT r.available OR r.authority<>'synthetic-fixture'
 OR s.manifest_id IS DISTINCT FROM r.manifest_id OR s.definition_id IS DISTINCT FROM r.definition_id
 OR s.content->'service'->'profile'->'content' IS DISTINCT FROM r.content OR s.content->'service'->'profile'->>'digest' IS DISTINCT FROM r.digest
 OR s.content->'service'->'profile'->>'id' IS DISTINCT FROM r.id::text
 OR s.content->'snapshot'->'serviceProfile' IS DISTINCT FROM s.content->'service'->'profile'
 OR s.content->'snapshot'->'serviceLines' IS DISTINCT FROM s.content->'service'->'lines'
 OR s.content->'snapshot'->'intake' IS DISTINCT FROM p
 OR s.content->'requirements'->'definition' IS DISTINCT FROM template.content
 OR s.content->'requirements'->>'templateRevisionId' IS DISTINCT FROM template.id::text
 OR (o.wearer_id IS NULL AND r.content->>'wearerRequirement' IS DISTINCT FROM 'not-required')
 OR NOT EXISTS(SELECT 1 FROM service_property_subject q WHERE q.shop_id=tenant AND q.order_id=o.id AND q.id=(p->>'subjectId')::uuid)
 OR jsonb_array_length(p->'lines') NOT BETWEEN 1 AND 32
 OR (SELECT count(*) FROM service_order_line l WHERE l.shop_id=tenant AND l.order_id=o.id)<>jsonb_array_length(p->'lines')
 OR jsonb_array_length(s.content->'service'->'lines')<>jsonb_array_length(p->'lines')
 OR (SELECT count(*) FROM order_requirement q WHERE q.shop_id=tenant AND q.order_id=o.id)<>jsonb_array_length(s.content->'requirements'->'items')
 OR NOT EXISTS(SELECT 1 FROM order_presentation_event e WHERE e.shop_id=tenant AND e.order_id=o.id AND e.version=1 AND e.mode=o.presentation AND e.actor_id=o.owner_id)
 THEN RETURN false;END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p->'lines') LOOP
  SELECT value INTO mapping FROM jsonb_array_elements(r.content->'lines') WHERE value->>'key'=line->>'key';
  SELECT value INTO accepted FROM jsonb_array_elements(s.content->'service'->'lines') WHERE value->>'id'=line->>'id';
  amount=NULL;
  IF NOT coalesce((line->>'notRequired')::boolean,false) AND line->>'priceState'='quoted' THEN
   IF trim(line->>'priceText') !~ '^([0-9]+|[1-9][0-9]{0,2}(,[0-9]{3})+|[1-9][0-9]?(,[0-9]{2})*,[0-9]{3})(\.[0-9]{1,2})?$' THEN RETURN false;END IF;
   amount=(replace(trim(line->>'priceText'),',','')::numeric*100)::bigint;
  END IF;
  IF (line->>'notRequired')::boolean THEN
   IF mapping->>'optional' IS DISTINCT FROM 'true' OR length(trim(line->>'notRequiredReason'))=0 OR line->>'priceState'<>'to-be-quoted' OR length(trim(line->>'priceText'))<>0 THEN RETURN false;END IF;
  ELSE
   IF length(trim(line->>'requestedWork'))=0 THEN RETURN false;END IF;
   IF amount IS NULL THEN unknown_price=true;ELSE total=total+amount;END IF;
  END IF;
  IF mapping->>'addonKey' IS NULL THEN ref=template.content->'service';ELSE SELECT value INTO ref FROM jsonb_array_elements(template.content->'addons') WHERE value->>'key'=mapping->>'addonKey';END IF;
  SELECT * INTO definition FROM service_catalogue_revision WHERE shop_id=tenant AND id=(ref->>'revisionId')::uuid AND entry_id=(ref->>'entryId')::uuid;
  IF mapping IS NULL OR accepted IS NULL OR definition.id IS NULL
  OR accepted->>'key' IS DISTINCT FROM line->>'key' OR accepted->>'requestedWork' IS DISTINCT FROM line->>'requestedWork'
  OR accepted->>'priceState' IS DISTINCT FROM line->>'priceState' OR (accepted->>'pricePaise')::bigint IS DISTINCT FROM amount
  OR accepted->>'labelEn' IS DISTINCT FROM definition.content->>'labelEn' OR accepted->>'labelTa' IS DISTINCT FROM definition.content->>'labelTa'
  OR accepted->>'sourceRevisionId' IS DISTINCT FROM r.id::text OR accepted->>'addonKey' IS DISTINCT FROM mapping->>'addonKey'
  OR accepted->>'taskKey' IS DISTINCT FROM mapping->>'taskKey' OR accepted->>'coverageKey' IS DISTINCT FROM mapping->>'coverageKey'
  OR accepted->'quantity' IS DISTINCT FROM mapping->'quantity'
  OR accepted->>'state' IS DISTINCT FROM (CASE WHEN (line->>'notRequired')::boolean THEN 'not-required' ELSE 'pending' END)
  OR accepted->>'notRequiredReason' IS DISTINCT FROM line->>'notRequiredReason'
  THEN RETURN false;END IF;
 END LOOP;
 -- Every exact configured item remains present. The reviewed selection may only
 -- exclude addon-scoped work; it cannot mark active task execution completed.
 SELECT coalesce(sum(jsonb_array_length(value)),0)::integer INTO expected_count FROM jsonb_each(template.content) WHERE key IN ('materials','tasks','quality','instructions','confirmation','construction','decoration','method');
 FOR form_ref IN SELECT value FROM jsonb_array_elements(template.content->'forms') LOOP
  SELECT * INTO form_definition FROM measurement_form_revision WHERE shop_id=tenant AND id=(form_ref->>'revisionId')::uuid AND entry_id=(form_ref->>'entryId')::uuid;
  IF form_definition.id IS NULL THEN RETURN false;END IF;
  expected_count=expected_count+(CASE WHEN form_definition.content->>'decision'='not-required' THEN 1 ELSE 0 END)+(SELECT coalesce(sum(jsonb_array_length(g->'fields')),0)::integer FROM jsonb_array_elements(form_definition.content->'groups') g);
 END LOOP;
 IF expected_count IS DISTINCT FROM jsonb_array_length(s.content->'requirements'->'items') THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(s.content->'requirements'->'items') LOOP
  IF item->>'state' NOT IN ('unresolved','not-required') THEN RETURN false;END IF;
  IF item->>'section'<>'measurement' THEN
   SELECT value INTO configured FROM jsonb_array_elements(template.content->(item->>'section')) WHERE value->>'key'=item->>'key';
   IF configured IS NULL OR item->>'labelEn' IS DISTINCT FROM configured->>'labelEn' OR item->>'labelTa' IS DISTINCT FROM configured->>'labelTa' OR item->'required' IS DISTINCT FROM configured->'required' THEN RETURN false;END IF;
   addon_key=configured->'scope'->>'addonKey';
   IF addon_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.content->'lines') m JOIN jsonb_array_elements(p->'lines') selected ON selected->>'key'=m->>'key' WHERE m->>'addonKey'=addon_key AND selected->>'notRequired'='false') THEN
    IF item->>'state' IS DISTINCT FROM 'not-required' OR item->>'applicability' IS DISTINCT FROM 'not-applicable' OR item->>'source' IS DISTINCT FROM 'service-profile:'||r.id::text||':not-selected:'||addon_key THEN RETURN false;END IF;
   ELSIF starts_with(item->>'source','service-profile:') THEN RETURN false;
   END IF;
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.content->'lines') m WHERE m->>'optional'='false' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'lines') l WHERE l->>'key'=m->>'key' AND l->>'notRequired'='false')) THEN RETURN false;END IF;
 SELECT sum(q)::integer INTO candidate_quantity FROM (SELECT m->>'coverageKey' coverage,(m->>'quantity')::integer q FROM jsonb_array_elements(r.content->'lines') m JOIN jsonb_array_elements(p->'lines') l ON l->>'key'=m->>'key' WHERE l->>'notRequired'='false' GROUP BY m->>'coverageKey',m->>'quantity') coverage_groups;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(r.content->'lines') m JOIN jsonb_array_elements(p->'lines') l ON l->>'key'=m->>'key' WHERE l->>'notRequired'='false' AND m->>'quantity' IS NULL)
 OR candidate_quantity IS NULL OR candidate_quantity<=0 OR total>9007199254740991
 OR o.price_paise IS DISTINCT FROM (CASE WHEN unknown_price THEN NULL ELSE total END)
 OR (s.content->>'pricePaise')::bigint IS DISTINCT FROM o.price_paise
 OR (s.content->'service'->>'totalPaise')::bigint IS DISTINCT FROM o.price_paise
 OR NOT EXISTS(SELECT 1 FROM order_capacity_demand q WHERE q.shop_id=tenant AND q.order_id=o.id AND q.category_id=s.category_id AND q.delivery_date=(p->>'deliveryDate')::date AND q.quantity=candidate_quantity AND q.unit=r.content->>'capacityUnit')
 THEN RETURN false;END IF;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION service_profile_insert_guard(),service_profile_head_guard(),service_profile_commit_guard(),service_intake_child_guard(),service_order_acceptance_valid(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_order_acceptance_valid(uuid,uuid) TO app_user;

CREATE OR REPLACE FUNCTION garment_order_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; p jsonb;
BEGIN

 IF NEW.intake_kind='service' THEN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Service order protected' USING ERRCODE='42501';END IF;
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
  p=d.payload;
  IF d.workflow IS DISTINCT FROM 'order.service' OR d.lifecycle IS DISTINCT FROM 'active' OR d.schema_version<>1 OR NEW.origin_line_id IS NOT NULL
   OR (p->>'customerId')::uuid IS DISTINCT FROM NEW.customer_id OR (p->>'wearerId')::uuid IS DISTINCT FROM NEW.wearer_id
   OR p->>'presentation' IS DISTINCT FROM NEW.presentation OR NEW.version<>1
   OR NEW.owner_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
   OR NOT EXISTS(SELECT 1 FROM service_intake_profile_revision r JOIN service_intake_profile h ON (h.shop_id,h.entry_id,h.current_id)=(r.shop_id,r.entry_id,r.id) WHERE r.shop_id=NEW.shop_id AND r.id=(p->'profile'->>'revisionId')::uuid AND r.entry_id=(p->'profile'->>'entryId')::uuid AND r.available AND r.authority='synthetic-fixture' AND (NEW.wearer_id IS NOT NULL OR r.content->>'wearerRequirement'='not-required'))
   OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.owner_id AND a.action='order.accept' AND a.entity_id=NEW.id)
  THEN RAISE EXCEPTION 'Service order provenance denied' USING ERRCODE='23514';END IF;
  NEW.accepted_at=date_trunc('milliseconds',clock_timestamp());NEW.created_xid=pg_current_xact_id();RETURN NEW;
 END IF;
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

 IF NEW.intake_kind='service' THEN
  IF NOT service_order_acceptance_valid(NEW.shop_id,NEW.id) THEN RAISE EXCEPTION 'Service acceptance incomplete' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
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

CREATE OR REPLACE FUNCTION order_piece_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.order_piece_set; o public.garment_order;
BEGIN
 IF TG_TABLE_NAME='garment_order' THEN
  IF NEW.intake_kind='service' THEN
   IF NOT service_order_acceptance_valid(NEW.shop_id,NEW.id) THEN RAISE EXCEPTION 'Service intake structure incomplete' USING ERRCODE='23514';END IF;
   RETURN NEW;
  END IF;
 END IF;
 IF TG_TABLE_NAME='garment_order' THEN SELECT * INTO s FROM order_piece_set WHERE shop_id=NEW.shop_id AND order_id=NEW.id;
 ELSE s=NEW; END IF;
 IF s.order_id IS NULL THEN RAISE EXCEPTION 'Piece structure incomplete' USING ERRCODE='23514'; END IF;
 SELECT * INTO o FROM garment_order WHERE shop_id=s.shop_id AND id=s.order_id;
 IF (SELECT count(*) FROM order_piece WHERE shop_id=s.shop_id AND order_id=s.order_id)<>(SELECT count(*) FROM jsonb_array_elements(s.content->'pieces') p WHERE p->>'applicability'<>'not-applicable')
 OR (SELECT count(*) FROM order_requirement_scope WHERE shop_id=s.shop_id AND order_id=s.order_id)<>jsonb_array_length(s.content->'requirements')
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=s.shop_id AND k.key=s.command_key AND k.actor_id=s.actor_id AND k.action=(CASE WHEN o.created_xid=s.created_xid THEN 'draft.promote' ELSE 'order.pieces.materialize' END))
 THEN RAISE EXCEPTION 'Piece command incomplete' USING ERRCODE='23514'; END IF; RETURN NEW;
END $fn$;
