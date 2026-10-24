-- #173 / 1.4.1a. Expand only; no rates/policies seeded. Retain on compatible rollback.
CREATE TABLE quotation_rate_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,rate_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),previous_id uuid,origin_draft_id uuid NOT NULL,actor_id uuid NOT NULL,audit_id uuid NOT NULL,
 entry_id uuid NOT NULL,source_revision_id uuid NOT NULL,definition_id uuid NOT NULL,profile_revision_id uuid NOT NULL,
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,rate_id,id),UNIQUE(shop_id,rate_id,version),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,rate_id,previous_id) REFERENCES quotation_rate_revision(shop_id,rate_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,entry_id,source_revision_id) REFERENCES service_catalogue_availability(shop_id,entry_id,id),
 FOREIGN KEY(shop_id,entry_id,definition_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id),FOREIGN KEY(shop_id,profile_revision_id) REFERENCES shop_profile_revision(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL))
);
CREATE TABLE quotation_rate (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,entry_id uuid NOT NULL,component text NOT NULL CHECK(component IN('labour','lining','fabric','trims','alteration','craft','rush')),unit text NOT NULL CHECK(unit IN('item','mm')),
 basis_quantity bigint NOT NULL CHECK(basis_quantity BETWEEN 1 AND 9007199254740991 AND (unit<>'item' OR basis_quantity=1)),current_revision_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,entry_id,component,unit),FOREIGN KEY(shop_id,entry_id) REFERENCES service_catalogue_entry(shop_id,entry_id),FOREIGN KEY(shop_id,id,current_revision_id) REFERENCES quotation_rate_revision(shop_id,rate_id,id)
);
ALTER TABLE quotation_rate_revision ADD FOREIGN KEY(shop_id,rate_id) REFERENCES quotation_rate(shop_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE quotation_rate_entry (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),revision_id uuid NOT NULL,entry_id uuid NOT NULL,position integer NOT NULL CHECK(position BETWEEN 0 AND 63),
 valid_from date NOT NULL,valid_until date,rate_paise bigint NOT NULL CHECK(rate_paise BETWEEN 0 AND 9007199254740991),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,revision_id,entry_id),UNIQUE(shop_id,revision_id,position),FOREIGN KEY(shop_id,revision_id) REFERENCES quotation_rate_revision(shop_id,id),CHECK(valid_until IS NULL OR valid_until>valid_from)
);
CREATE TABLE quotation_policy_binding (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('advance','quoteValidity','discount','cancellation','changeCharges')),version integer NOT NULL CHECK(version>0),previous_id uuid,
 origin_draft_id uuid NOT NULL,actor_id uuid NOT NULL,audit_id uuid NOT NULL,source_draft_id uuid NOT NULL,source_draft_version integer NOT NULL CHECK(source_draft_version>0),source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 policy jsonb NOT NULL CHECK(jsonb_typeof(policy)='object'),reason text NOT NULL CHECK(length(trim(reason))>0),authority text NOT NULL CHECK(authority IN('owner-reviewed','synthetic-only')),
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,kind,version),UNIQUE(shop_id,kind,id),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,kind,previous_id) REFERENCES quotation_policy_binding(shop_id,kind,id),FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,source_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),CHECK((version=1)=(previous_id IS NULL))
);
CREATE INDEX quotation_policy_binding_source ON quotation_policy_binding(shop_id,source_draft_id,source_draft_version);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['quotation_rate','quotation_rate_revision','quotation_rate_entry','quotation_policy_binding'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT TO app_user USING(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT TO app_user WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $rls$;
GRANT UPDATE(current_revision_id,version) ON quotation_rate TO app_user;
CREATE FUNCTION quotation_configuration_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;s public.durable_draft;a public.audit_event;prior public.quotation_rate_revision;e public.quotation_rate_entry;old public.quotation_rate_entry;today date;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Quotation configuration history protected' USING ERRCODE='42501';END IF;
 NEW.created_xid=pg_current_xact_id();
 IF TG_TABLE_NAME='quotation_rate_entry' THEN
  IF NOT EXISTS(SELECT 1 FROM quotation_rate_revision r WHERE r.shop_id=NEW.shop_id AND r.id=NEW.revision_id AND r.created_xid=pg_current_xact_id()) THEN RAISE EXCEPTION 'Rate entry sealed' USING ERRCODE='23514';END IF;RETURN NEW;
 END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO a FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id;
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.lifecycle IS DISTINCT FROM 'active' OR d.schema_version<>1 OR a.actor_id IS DISTINCT FROM NEW.actor_id OR a.entity_id IS DISTINCT FROM NEW.id OR a.entity_type IS DISTINCT FROM 'quotation_configuration' THEN RAISE EXCEPTION 'Rate review provenance denied' USING ERRCODE='42501';END IF;
 IF d.payload->>'baseVersion' IS DISTINCT FROM (NEW.version-1)::text OR (d.payload->>'baseRevisionId')::uuid IS DISTINCT FROM NEW.previous_id THEN RAISE EXCEPTION 'Review base denied' USING ERRCODE='23514';END IF;
 NEW.recorded_at=date_trunc('milliseconds',clock_timestamp());
 IF TG_TABLE_NAME='quotation_policy_binding' THEN
  SELECT * INTO s FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.source_draft_id;
  IF d.workflow<>'pricing.policy-review' OR a.action<>'pricing.policy.review' OR d.payload->>'kind' IS DISTINCT FROM NEW.kind OR (d.payload->>'sourceDraftId')::uuid IS DISTINCT FROM NEW.source_draft_id OR (d.payload->>'sourceDraftVersion')::integer IS DISTINCT FROM NEW.source_draft_version OR d.payload->>'reason' IS DISTINCT FROM NEW.reason OR d.payload->>'acknowledged' IS DISTINCT FROM 'true'
   OR s.workflow IS DISTINCT FROM 'shop.policies' OR s.schema_version<>1 OR s.lifecycle<>'active' OR s.version<>NEW.source_draft_version OR NEW.source_hash<>encode(sha256(convert_to(s.payload::text,'UTF8')),'hex') OR NEW.policy IS DISTINCT FROM s.payload->'policy' OR NEW.policy->>'kind'<>NEW.kind OR NEW.policy->>'state' NOT IN('reviewed','not-applicable')
   OR (NEW.authority='owner-reviewed' AND NEW.policy->'authority'->>'kind' IS DISTINCT FROM 'owner-proposal')
   OR (NEW.kind IN('quoteValidity','discount') AND NEW.policy->>'state'<>'reviewed')
   OR (NEW.policy->>'state'='reviewed' AND (length(trim(NEW.policy->'terms'->>'en'))=0 OR length(trim(NEW.policy->'terms'->>'ta'))=0))
   OR (NEW.policy->>'state'='not-applicable' AND length(trim(NEW.policy->>'reason'))=0)
   OR (NEW.version>1 AND NOT EXISTS(SELECT 1 FROM quotation_policy_binding p WHERE p.shop_id=NEW.shop_id AND p.id=NEW.previous_id AND p.kind=NEW.kind AND p.version=NEW.version-1))
   THEN RAISE EXCEPTION 'Quotation-only policy binding denied' USING ERRCODE='23514';END IF;
 ELSE
  NEW.content_hash=encode(sha256(convert_to(NEW.content::text,'UTF8')),'hex');
  SELECT * INTO prior FROM quotation_rate_revision WHERE shop_id=NEW.shop_id AND id=NEW.previous_id;
  IF d.workflow<>'pricing.rate' OR a.action<>'pricing.rate.publish' OR (d.payload->>'rateId')::uuid IS DISTINCT FROM NEW.rate_id OR (d.payload->'source'->>'entryId')::uuid IS DISTINCT FROM NEW.entry_id OR (d.payload->'source'->>'revisionId')::uuid IS DISTINCT FROM NEW.source_revision_id
   OR NEW.content->>'reason' IS DISTINCT FROM d.payload->>'reason' OR length(trim(NEW.content->>'reason'))=0 OR NEW.content->>'component' IS DISTINCT FROM d.payload->>'component' OR NEW.content->>'unit' IS DISTINCT FROM d.payload->>'unit' OR (NEW.content->>'basisQuantity')::bigint IS DISTINCT FROM (d.payload->>'basisText')::bigint OR NEW.content->>'available' IS DISTINCT FROM d.payload->>'available'
   OR NEW.content->'source' IS DISTINCT FROM jsonb_build_object('entryId',NEW.entry_id::text,'revisionId',NEW.source_revision_id::text) OR (NEW.content->>'definitionId')::uuid IS DISTINCT FROM NEW.definition_id OR (NEW.content->>'profileRevisionId')::uuid IS DISTINCT FROM NEW.profile_revision_id
   OR NEW.content->>'authority' NOT IN('owner-reviewed','synthetic-only')
   OR (NEW.version>1 AND (prior.rate_id IS DISTINCT FROM NEW.rate_id OR prior.version<>NEW.version-1))
   OR NOT EXISTS(SELECT 1 FROM service_catalogue_availability c WHERE c.shop_id=NEW.shop_id AND c.id=NEW.source_revision_id AND c.entry_id=NEW.entry_id AND c.definition_id=NEW.definition_id)
   OR NOT EXISTS(SELECT 1 FROM service_catalogue_revision c WHERE c.shop_id=NEW.shop_id AND c.id=NEW.definition_id AND c.content->>'labelEn'=NEW.content->>'labelEn' AND c.content->>'labelTa'=NEW.content->>'labelTa' AND (c.authority<>'synthetic-fixture' OR NEW.content->>'authority'='synthetic-only'))
   THEN RAISE EXCEPTION 'Rate source/draft denied' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION quotation_configuration_guard() FROM PUBLIC;
CREATE TRIGGER quotation_rate_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON quotation_rate_revision FOR EACH ROW EXECUTE FUNCTION quotation_configuration_guard();
CREATE TRIGGER quotation_rate_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON quotation_rate_entry FOR EACH ROW EXECUTE FUNCTION quotation_configuration_guard();
CREATE TRIGGER quotation_policy_binding_guard BEFORE INSERT OR UPDATE OR DELETE ON quotation_policy_binding FOR EACH ROW EXECUTE FUNCTION quotation_configuration_guard();
CREATE FUNCTION quotation_rate_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.quotation_rate_revision;BEGIN
 SELECT * INTO r FROM quotation_rate_revision WHERE shop_id=NEW.shop_id AND id=NEW.current_revision_id;
 IF NOT FOUND OR r.rate_id<>NEW.id OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.entry_id<>NEW.entry_id OR r.content->>'component'<>NEW.component OR r.content->>'unit'<>NEW.unit OR (r.content->>'basisQuantity')::bigint<>NEW.basis_quantity THEN RAISE EXCEPTION 'Rate pointer denied' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' THEN IF NEW.version<>1 THEN RAISE EXCEPTION 'Rate first version denied';END IF;
 ELSE IF NEW.shop_id<>OLD.shop_id OR NEW.id<>OLD.id OR NEW.entry_id<>OLD.entry_id OR NEW.component<>OLD.component OR NEW.unit<>OLD.unit OR NEW.basis_quantity<>OLD.basis_quantity OR NEW.version<>OLD.version+1 OR r.previous_id<>OLD.current_revision_id THEN RAISE EXCEPTION 'Rate identity protected' USING ERRCODE='23514';END IF;END IF;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION quotation_rate_pointer_guard() FROM PUBLIC;
CREATE TRIGGER quotation_rate_pointer_guard BEFORE INSERT OR UPDATE ON quotation_rate FOR EACH ROW EXECUTE FUNCTION quotation_rate_pointer_guard();
CREATE FUNCTION quotation_review_complete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft; r public.quotation_rate_revision; x jsonb; e public.quotation_rate_entry;o public.quotation_rate_entry;today date;expected text;
BEGIN
 expected=CASE WHEN TG_TABLE_NAME='quotation_rate_revision' THEN 'pricing.rate.revision' ELSE 'pricing.policy.binding' END;
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_id IS DISTINCT FROM NEW.id OR d.result_type IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Quotation promotion incomplete' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='quotation_policy_binding' THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM quotation_rate i WHERE i.shop_id=NEW.shop_id AND i.id=NEW.rate_id AND i.current_revision_id=NEW.id AND i.version=NEW.version) THEN RAISE EXCEPTION 'Rate pointer incomplete' USING ERRCODE='23514';END IF;
 IF (SELECT count(*) FROM quotation_rate_entry WHERE shop_id=NEW.shop_id AND revision_id=NEW.id) NOT BETWEEN 1 AND 64 OR (SELECT count(*) FROM quotation_rate_entry WHERE shop_id=NEW.shop_id AND revision_id=NEW.id)<>jsonb_array_length(d.payload->'entries') OR jsonb_array_length(NEW.content->'entries')<>jsonb_array_length(d.payload->'entries') THEN RAISE EXCEPTION 'Rate entries incomplete' USING ERRCODE='23514';END IF;
 today=(NEW.recorded_at AT TIME ZONE 'Asia/Kolkata')::date;
 FOR e IN SELECT * FROM quotation_rate_entry WHERE shop_id=NEW.shop_id AND revision_id=NEW.id LOOP
  x=d.payload->'entries'->e.position;
  IF (x->>'entryId')::uuid IS DISTINCT FROM e.entry_id OR x->>'from'<>e.valid_from::text OR NULLIF(x->>'until','')::date IS DISTINCT FROM e.valid_until OR trim(x->>'rateText') !~ '^[0-9]+(\.[0-9]{1,2})?$' OR (trim(x->>'rateText'))::numeric*100<>e.rate_paise
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'entries') p WHERE (p->>'entryId')::uuid=e.entry_id AND p->>'from'=e.valid_from::text AND (p->>'until')::date IS NOT DISTINCT FROM e.valid_until AND (p->>'ratePaise')::bigint=e.rate_paise)
   THEN RAISE EXCEPTION 'Rate entry value denied' USING ERRCODE='23514';END IF;
  IF e.valid_from<today THEN
   SELECT * INTO o FROM quotation_rate_entry WHERE shop_id=NEW.shop_id AND revision_id=NEW.previous_id AND entry_id=e.entry_id;
   IF NOT FOUND OR o.valid_from<>e.valid_from OR o.rate_paise<>e.rate_paise OR (e.valid_until IS DISTINCT FROM o.valid_until AND (e.valid_until IS NULL OR e.valid_until<today OR o.valid_until<today)) THEN RAISE EXCEPTION 'Rate backdating denied' USING ERRCODE='23514';END IF;
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM quotation_rate_entry a JOIN quotation_rate_entry b ON a.shop_id=b.shop_id AND a.revision_id=b.revision_id AND a.position<b.position WHERE a.shop_id=NEW.shop_id AND a.revision_id=NEW.id AND daterange(a.valid_from,a.valid_until,'[)')&&daterange(b.valid_from,b.valid_until,'[)'))
 OR EXISTS(SELECT 1 FROM quotation_rate_entry a WHERE a.shop_id=NEW.shop_id AND a.revision_id=NEW.previous_id AND a.valid_from<today AND NOT EXISTS(SELECT 1 FROM quotation_rate_entry b WHERE b.shop_id=a.shop_id AND b.revision_id=NEW.id AND b.entry_id=a.entry_id AND b.valid_from=a.valid_from AND b.rate_paise=a.rate_paise)) THEN RAISE EXCEPTION 'Rate history/range denied' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION quotation_review_complete() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER quotation_rate_complete AFTER INSERT ON quotation_rate_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION quotation_review_complete();
CREATE CONSTRAINT TRIGGER quotation_policy_complete AFTER INSERT ON quotation_policy_binding DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION quotation_review_complete();
