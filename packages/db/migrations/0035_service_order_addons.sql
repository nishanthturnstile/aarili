-- 1.2.3b expand only. Back up before non-disposable use. Rollback gates new
-- workflows/readers, retains revisions, contributions, and the union demand reader.
CREATE TABLE order_service_change (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,order_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>1),origin_draft_id uuid NOT NULL,actor_id uuid NOT NULL,audit_id uuid NOT NULL,command_key uuid NOT NULL,
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object' AND octet_length(content::text)<=1048576),
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,order_id,id),UNIQUE(shop_id,order_id,version),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE order_service_change_line (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,order_id uuid NOT NULL,change_id uuid NOT NULL,piece_id uuid,
 profile_entry_id uuid NOT NULL,profile_revision_id uuid NOT NULL,source_key text NOT NULL,content jsonb NOT NULL,
 PRIMARY KEY(shop_id,id),UNIQUE NULLS NOT DISTINCT(shop_id,order_id,piece_id,profile_entry_id,source_key),
 FOREIGN KEY(shop_id,order_id,change_id) REFERENCES order_service_change(shop_id,order_id,id),
 FOREIGN KEY(shop_id,order_id,piece_id) REFERENCES order_piece(shop_id,order_id,id),
 FOREIGN KEY(shop_id,profile_entry_id,profile_revision_id) REFERENCES service_intake_profile_revision(shop_id,entry_id,id)
);
CREATE INDEX order_service_line_history ON order_service_change_line(shop_id,order_id,change_id);
CREATE TABLE order_service_capacity_contribution (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),change_id uuid NOT NULL,order_id uuid NOT NULL,category_id uuid NOT NULL,
 delivery_date date NOT NULL,unit text NOT NULL CHECK(unit IN ('garments','effort-points')),quantity integer NOT NULL CHECK(quantity>0),
 PRIMARY KEY(shop_id,change_id),FOREIGN KEY(shop_id,order_id,change_id) REFERENCES order_service_change(shop_id,order_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES order_capacity_demand(shop_id,order_id)
);
CREATE INDEX order_service_capacity_week ON order_service_capacity_contribution(shop_id,category_id,delivery_date);
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['order_service_change','order_service_change_line','order_service_capacity_contribution'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION order_immutable_guard()',t||'_immutable',t);
 END LOOP;
END $policies$;
CREATE FUNCTION order_service_change_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;o public.garment_order;s public.order_acceptance_snapshot;p public.service_intake_profile_revision;v jsonb;mapped_quantity numeric;
BEGIN
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id;
 v=NEW.content->'input';
 SELECT * INTO p FROM service_intake_profile_revision WHERE shop_id=NEW.shop_id AND id=(v->'profile'->>'revisionId')::uuid;
 IF d.workflow IS DISTINCT FROM 'order.service-change' OR d.lifecycle IS DISTINCT FROM 'active' OR d.schema_version<>1 OR d.payload IS DISTINCT FROM v
 OR o.intake_kind IS DISTINCT FROM 'custom' OR NEW.version IS DISTINCT FROM o.version+1
 OR (v->>'orderId')::uuid IS DISTINCT FROM o.id OR (v->>'version')::integer IS DISTINCT FROM o.version
 OR v->>'originalDigest' IS DISTINCT FROM s.digest OR NEW.content->>'originalDigest' IS DISTINCT FROM s.digest
 OR NEW.content->>'previousScopeDigest' IS DISTINCT FROM v->>'scopeDigest'
 OR NEW.content->'originalPromise' IS DISTINCT FROM s.content->'currentPromise'
 OR NEW.content->>'categoryId' IS DISTINCT FROM s.category_id::text
 OR NEW.content->>'unit' IS DISTINCT FROM (SELECT unit FROM order_capacity_demand WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id)
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 OR length(trim(v->>'reason'))=0 OR length(trim(v->>'agreement'))=0 OR length(trim(v->'capacity'->>'reason'))=0
 OR v->'review'->>'acknowledged' IS DISTINCT FROM 'true' OR v->'review'->>'fingerprint' IS DISTINCT FROM NEW.content->>'fingerprint'
 OR p.id IS NULL OR p.entry_id IS DISTINCT FROM (v->'profile'->>'entryId')::uuid OR p.authority IS DISTINCT FROM 'synthetic-fixture'
 OR NEW.content->'profile'->>'id' IS DISTINCT FROM p.id::text OR NEW.content->'profile'->'content' IS DISTINCT FROM p.content
 OR NOT EXISTS(SELECT 1 FROM service_intake_profile h WHERE h.shop_id=p.shop_id AND h.entry_id=p.entry_id AND h.current_id=p.id AND p.available)
 OR NEW.content->>'membershipId' IS DISTINCT FROM (SELECT booking_id::text FROM booking_member WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id)
 OR (NEW.content->>'membershipVersion')::integer IS DISTINCT FROM (SELECT b.version FROM booking_member m JOIN booking b ON (b.shop_id,b.id)=(m.shop_id,m.booking_id) WHERE m.shop_id=NEW.shop_id AND m.order_id=NEW.order_id)
 OR NEW.content->>'membershipRevisionId' IS DISTINCT FROM (SELECT b.current_revision_id::text FROM booking_member m JOIN booking b ON (b.shop_id,b.id)=(m.shop_id,m.booking_id) WHERE m.shop_id=NEW.shop_id AND m.order_id=NEW.order_id)
 OR (v->>'commercial'='outside-package') IS DISTINCT FROM EXISTS(SELECT 1 FROM booking_member m JOIN booking_commercial_revision c ON (c.shop_id,c.booking_id)=(m.shop_id,m.booking_id) WHERE m.shop_id=NEW.shop_id AND m.order_id=NEW.order_id AND c.basis='package-proposal')
 OR v->>'commercial' NOT IN ('additional-charge','outside-package')
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.action='order.service-change' AND a.entity_id=NEW.order_id AND a.idempotency_key=NEW.command_key)

 THEN RAISE EXCEPTION 'Service change provenance denied' USING ERRCODE='23514';END IF;
 IF NEW.content->'requirements'->'definition' IS DISTINCT FROM (SELECT content FROM service_template_revision WHERE shop_id=NEW.shop_id AND id=p.definition_id)
 OR p.content->>'capacityUnit' IS DISTINCT FROM NEW.content->>'unit'
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'requirements'->'items') i WHERE i->>'assigneeId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shop_membership m WHERE m.shop_id=NEW.shop_id AND m.user_id=(i->>'assigneeId')::uuid))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.content->'lines') m WHERE m->>'optional'='false' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v->'lines') l WHERE l->>'key'=m->>'key' AND l->>'notRequired'='false'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.content->'lines') m JOIN jsonb_array_elements(v->'lines') l ON l->>'key'=m->>'key' WHERE l->>'notRequired'='false' AND m->>'quantity' IS NULL)
 THEN RAISE EXCEPTION 'Reviewed service mapping and requirements required' USING ERRCODE='23514';END IF;
 SELECT sum(quantity) INTO mapped_quantity FROM (SELECT DISTINCT m->>'coverageKey' coverage,(m->>'quantity')::integer quantity FROM jsonb_array_elements(p.content->'lines') m JOIN jsonb_array_elements(v->'lines') l ON l->>'key'=m->>'key' WHERE l->>'notRequired'='false') groups;
 IF mapped_quantity IS NULL THEN RAISE EXCEPTION 'Selected mapped work required' USING ERRCODE='23514';END IF;
 IF v->'capacity'->>'basis'='already-covered' THEN
  IF (v->'capacity'->>'coveredBy')::uuid IS DISTINCT FROM o.id OR (NEW.content->>'quantity')::integer<>0 THEN RAISE EXCEPTION 'Coverage evidence required' USING ERRCODE='23514';END IF;
 ELSIF v->'capacity'->>'basis'='incremental' THEN
  IF (NEW.content->>'quantity')::integer<=0 OR (NEW.content->>'quantity')::numeric IS DISTINCT FROM mapped_quantity OR v->'capacity'->>'coveredBy' IS NOT NULL THEN RAISE EXCEPTION 'Increment required' USING ERRCODE='23514';END IF;
 ELSE RAISE EXCEPTION 'Capacity unresolved' USING ERRCODE='23514';END IF;
 NEW.created_xid=pg_current_xact_id();RETURN NEW;
END $fn$;
CREATE TRIGGER order_service_change_insert BEFORE INSERT ON order_service_change FOR EACH ROW EXECUTE FUNCTION order_service_change_guard();
-- Extend only the aggregate UPDATE branch. Original acceptance/presentation
-- checks remain byte-for-byte in the recorded predecessor function.
DO $extend$ DECLARE body text; needle text; BEGIN
 body=pg_get_functiondef('garment_order_guard()'::regprocedure);
 needle=E'BEGIN\n';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Order guard shape changed';END IF;
 body=replace(body,needle,needle||$branch$
 IF TG_OP='UPDATE' AND NEW.intake_kind='custom' AND NEW.presentation=OLD.presentation
 AND (to_jsonb(NEW)-'version')=(to_jsonb(OLD)-'version') AND NEW.version::bigint=OLD.version::bigint+1
 AND EXISTS(SELECT 1 FROM order_service_change c WHERE c.shop_id=NEW.shop_id AND c.order_id=NEW.id AND c.version=NEW.version AND c.created_xid=pg_current_xact_id() AND c.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid)
 THEN RETURN NEW; END IF;
$branch$);
 EXECUTE body;
END $extend$;
CREATE FUNCTION order_service_change_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE c public.order_service_change;d public.durable_draft;line jsonb;
BEGIN
 IF TG_TABLE_NAME='order_service_change' THEN c=NEW;
 ELSE SELECT * INTO c FROM order_service_change WHERE shop_id=NEW.shop_id AND id=NEW.change_id;END IF;
 SELECT * INTO d FROM durable_draft WHERE shop_id=c.shop_id AND id=c.origin_draft_id;
 IF d.lifecycle IS DISTINCT FROM 'promoted' OR d.result_type IS DISTINCT FROM 'order.service-change' OR d.result_id IS DISTINCT FROM c.id
 OR NOT EXISTS(SELECT 1 FROM garment_order o WHERE o.shop_id=c.shop_id AND o.id=c.order_id AND o.version>=c.version)
 OR (SELECT count(*) FROM order_service_change_line l WHERE l.shop_id=c.shop_id AND l.change_id=c.id)<>jsonb_array_length(c.content->'lines')
 OR jsonb_array_length(c.content->'lines')=0
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=c.shop_id AND k.key=c.command_key AND k.actor_id=c.actor_id AND k.action='draft.promote')
 THEN RAISE EXCEPTION 'Service change incomplete' USING ERRCODE='23514';END IF;
 FOR line IN SELECT * FROM jsonb_array_elements(c.content->'lines') LOOP
 IF NOT EXISTS(SELECT 1 FROM order_service_change_line l WHERE l.shop_id=c.shop_id AND l.order_id=c.order_id AND l.change_id=c.id AND l.id=(line->>'id')::uuid AND l.content=line AND l.piece_id IS NOT DISTINCT FROM (c.content->'input'->>'pieceId')::uuid AND l.profile_revision_id=(c.content->'profile'->>'id')::uuid AND l.source_key=line->>'key')
 THEN RAISE EXCEPTION 'Service line provenance denied' USING ERRCODE='23514';END IF;
 END LOOP;
 IF (c.content->>'quantity')::integer>0 THEN
 IF NOT EXISTS(SELECT 1 FROM order_service_capacity_contribution x WHERE x.shop_id=c.shop_id AND x.change_id=c.id AND x.order_id=c.order_id AND x.quantity=(c.content->>'quantity')::integer AND x.category_id=(c.content->>'categoryId')::uuid AND x.unit=c.content->>'unit' AND x.delivery_date=(c.content->'originalPromise'->>'date')::date) THEN RAISE EXCEPTION 'Service demand missing' USING ERRCODE='23514';END IF;
 ELSIF EXISTS(SELECT 1 FROM order_service_capacity_contribution x WHERE x.shop_id=c.shop_id AND x.change_id=c.id) THEN RAISE EXCEPTION 'Covered demand counted twice' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER order_service_change_commit AFTER INSERT ON order_service_change DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_service_change_commit_guard();
CREATE CONSTRAINT TRIGGER order_service_line_commit AFTER INSERT ON order_service_change_line DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_service_change_commit_guard();
CREATE CONSTRAINT TRIGGER order_service_capacity_commit AFTER INSERT ON order_service_capacity_contribution DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_service_change_commit_guard();

-- Explicit opt-in conversion retains every raw source field and stable identity.
CREATE TABLE service_intake_conversion (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),source_draft_id uuid NOT NULL,target_draft_id uuid NOT NULL,
 actor_id uuid NOT NULL,command_key uuid NOT NULL,request_id uuid NOT NULL,source_payload jsonb NOT NULL,
 PRIMARY KEY(shop_id,source_draft_id),UNIQUE(shop_id,target_draft_id),CHECK(source_draft_id<>target_draft_id),
 FOREIGN KEY(shop_id,source_draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,target_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id)
);
ALTER TABLE service_intake_conversion ENABLE ROW LEVEL SECURITY;ALTER TABLE service_intake_conversion FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON service_intake_conversion AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON service_intake_conversion FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON service_intake_conversion FROM PUBLIC,app_user,app_privacy;GRANT SELECT,INSERT ON service_intake_conversion TO app_user;
CREATE TRIGGER service_intake_conversion_immutable BEFORE UPDATE OR DELETE ON service_intake_conversion FOR EACH ROW EXECUTE FUNCTION order_immutable_guard();
CREATE FUNCTION service_intake_conversion_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.durable_draft;t public.durable_draft;expected jsonb;
BEGIN
 SELECT * INTO s FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.source_draft_id;
 SELECT * INTO t FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.target_draft_id;
 IF s.workflow='order.quick' THEN expected=s.payload||jsonb_build_object('commitmentReview',NULL);
 ELSIF s.workflow='order.group' THEN
 expected=s.payload||jsonb_build_object('review',NULL,'lines',(SELECT jsonb_agg(l||jsonb_build_object('intake',(l->'intake')||jsonb_build_object('commitmentReview',NULL)) ORDER BY n) FROM jsonb_array_elements(s.payload->'lines') WITH ORDINALITY x(l,n)));
 ELSE RAISE EXCEPTION 'Unsupported source intake' USING ERRCODE='23514';END IF;
 IF TG_WHEN='BEFORE' THEN
 IF s.lifecycle IS DISTINCT FROM 'active' OR t.workflow IS DISTINCT FROM 'order.services-intake' OR t.lifecycle IS DISTINCT FROM 'active' OR t.version<>1
 OR t.payload->>'kind' IS DISTINCT FROM (CASE WHEN s.workflow='order.quick' THEN 'custom' ELSE 'group' END)
 OR t.payload->'base' IS DISTINCT FROM expected OR t.payload->'selections' IS DISTINCT FROM '[]'::jsonb OR t.payload->'review' IS DISTINCT FROM 'null'::jsonb
 OR NEW.source_payload IS DISTINCT FROM s.payload OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
 THEN RAISE EXCEPTION 'Service conversion denied' USING ERRCODE='23514';END IF;
 ELSE
 IF s.lifecycle IS DISTINCT FROM 'promoted' OR s.result_type IS DISTINCT FROM 'order.services-intake-draft' OR s.result_id IS DISTINCT FROM t.id
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k JOIN audit_event a ON a.shop_id=k.shop_id AND a.idempotency_key=k.key WHERE k.shop_id=NEW.shop_id AND k.key=NEW.command_key AND k.action='draft.convert' AND k.actor_id=NEW.actor_id AND a.entity_id=s.id AND a.action='draft.convert' AND a.request_id=NEW.request_id)
 THEN RAISE EXCEPTION 'Service conversion incomplete' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER service_conversion_insert BEFORE INSERT ON service_intake_conversion FOR EACH ROW EXECUTE FUNCTION service_intake_conversion_guard();
CREATE CONSTRAINT TRIGGER service_conversion_commit AFTER INSERT ON service_intake_conversion DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION service_intake_conversion_guard();

-- Pure adapter for the new workflow only. Old v1 drafts/readers are unchanged.
CREATE FUNCTION service_intake_base(d public.durable_draft,fingerprint text) RETURNS public.durable_draft LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $fn$
DECLARE decision jsonb;BEGIN
 IF d.workflow='order.services-intake' THEN
 decision=d.payload->'review';
 IF d.payload->>'kind'='custom' THEN d.workflow='order.quick';d.payload=(d.payload->'base')||jsonb_build_object('commitmentReview',decision||jsonb_build_object('fingerprint',fingerprint));
 ELSIF d.payload->>'kind'='group' THEN d.workflow='order.group';d.payload=(d.payload->'base')||jsonb_build_object('review',decision);
 END IF;
 END IF;RETURN d;
END $fn$;
DO $adapt$ DECLARE name text;body text;needle text;replacement text;BEGIN
 FOREACH name IN ARRAY ARRAY['garment_order_guard','order_acceptance_commit_guard','group_commercial_guard','group_order_complete_guard','booking_revision_guard'] LOOP
 body=pg_get_functiondef((name||'()')::regprocedure);
 needle='SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id;';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Draft adapter predecessor changed: %',name;END IF;
 replacement=needle||E'\n d=service_intake_base(d,'||CASE WHEN name='order_acceptance_commit_guard' THEN 's.content->''review''->>''fingerprint''' ELSE 'NULL' END||');';
 body=replace(body,needle,replacement);EXECUTE body;
 END LOOP;
END $adapt$;
-- One supplemental revision per selected target in an atomic intake.
ALTER TABLE order_service_change DROP CONSTRAINT order_service_change_shop_id_origin_draft_id_key;
ALTER TABLE order_service_change ADD UNIQUE(shop_id,origin_draft_id,order_id);
CREATE FUNCTION service_intake_selection_matches(d public.durable_draft,o public.garment_order,c jsonb) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $fn$
 SELECT d.workflow='order.services-intake' AND o.origin_draft_id=d.id AND o.version=1
 AND c->'input'->'review'=d.payload->'review'
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(d.payload->'selections') sel WHERE (sel->>'lineId')::uuid IS NOT DISTINCT FROM o.origin_line_id
 AND (sel-'lineId')=((c->'input')-ARRAY['orderId','version','originalDigest','scopeDigest','pieceId','review'])||jsonb_build_object('capacity',(c->'input'->'capacity')||jsonb_build_object('coveredBy',NULL)))
$fn$;
DO $adapt_change$ DECLARE body text;needle text;BEGIN
 body=pg_get_functiondef('order_service_change_guard()'::regprocedure);
 needle='d.workflow IS DISTINCT FROM ''order.service-change'' OR d.lifecycle IS DISTINCT FROM ''active'' OR d.schema_version<>1 OR d.payload IS DISTINCT FROM v';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Change adapter predecessor changed';END IF;
 body=replace(body,needle,'((d.workflow IS DISTINCT FROM ''order.service-change'' OR d.payload IS DISTINCT FROM v) AND service_intake_selection_matches(d,o,NEW.content) IS DISTINCT FROM true) OR d.lifecycle IS DISTINCT FROM ''active'' OR d.schema_version<>1');EXECUTE body;
 body=pg_get_functiondef('order_service_change_commit_guard()'::regprocedure);
 needle='d.result_type IS DISTINCT FROM ''order.service-change'' OR d.result_id IS DISTINCT FROM c.id';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Change commit predecessor changed';END IF;
 body=replace(body,needle,'((d.result_type IS DISTINCT FROM ''order.service-change'' OR d.result_id IS DISTINCT FROM c.id) AND (d.workflow IS DISTINCT FROM ''order.services-intake'' OR d.result_type NOT IN (''order.accepted'',''booking.revision'')))');EXECUTE body;
END $adapt_change$;
REVOKE ALL ON FUNCTION service_intake_base(public.durable_draft,text),service_intake_selection_matches(public.durable_draft,public.garment_order,jsonb),service_intake_conversion_guard(),order_service_change_guard(),order_service_change_commit_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION service_intake_base(public.durable_draft,text),service_intake_selection_matches(public.durable_draft,public.garment_order,jsonb) TO app_user;

-- Canonical catalogue identity prevents a second profile/version from adding the
-- same service again under a different request key. Piece scope remains explicit.
CREATE FUNCTION service_change_catalogue_source(profile_id uuid,source_key text) RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $fn$
 SELECT CASE WHEN m->>'addonKey' IS NULL THEN (t.content->'service'->>'entryId')::uuid
 ELSE (SELECT (a->>'entryId')::uuid FROM jsonb_array_elements(t.content->'addons') a WHERE a->>'key'=m->>'addonKey') END
 FROM service_intake_profile_revision p JOIN service_template_revision t ON (t.shop_id,t.id)=(p.shop_id,p.definition_id),jsonb_array_elements(p.content->'lines') m
 WHERE p.shop_id=NULLIF(current_setting('app.shop_id',true),'')::uuid AND p.id=profile_id AND m->>'key'=source_key
$fn$;
REVOKE ALL ON FUNCTION service_change_catalogue_source(uuid,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION service_change_catalogue_source(uuid,text) TO app_user;
ALTER TABLE order_service_change_line ADD COLUMN catalogue_entry_id uuid NOT NULL;
ALTER TABLE order_service_change_line ADD FOREIGN KEY(shop_id,catalogue_entry_id) REFERENCES service_catalogue_entry(shop_id,entry_id);
ALTER TABLE order_service_change_line ADD UNIQUE NULLS NOT DISTINCT(shop_id,order_id,piece_id,catalogue_entry_id);
ALTER TABLE order_service_capacity_contribution ADD FOREIGN KEY(shop_id,category_id) REFERENCES service_catalogue_entry(shop_id,entry_id);
CREATE FUNCTION service_change_line_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE c public.order_service_change;mapping jsonb;selected jsonb;amount numeric;
BEGIN
 SELECT * INTO c FROM order_service_change WHERE shop_id=NEW.shop_id AND id=NEW.change_id;
 SELECT m INTO mapping FROM jsonb_array_elements(c.content->'profile'->'content'->'lines') m WHERE m->>'key'=NEW.source_key;
 SELECT l INTO selected FROM jsonb_array_elements(c.content->'input'->'lines') l WHERE l->>'id'=NEW.id::text;
 IF selected->>'priceState'='quoted' AND selected->>'notRequired'='false' THEN
  IF trim(selected->>'priceText') !~ '^([0-9]+|[1-9][0-9]{0,2}(,[0-9]{3})+|[1-9][0-9]?(,[0-9]{2})*,[0-9]{3})(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Exact line price required' USING ERRCODE='23514';END IF;
  amount=replace(trim(selected->>'priceText'),',','')::numeric*100;
  IF amount<0 OR amount>9007199254740991 OR (NEW.content->>'pricePaise')::numeric IS DISTINCT FROM amount THEN RAISE EXCEPTION 'Line price mismatch' USING ERRCODE='23514';END IF;
 ELSIF NEW.content->>'pricePaise' IS NOT NULL THEN RAISE EXCEPTION 'Unknown is not zero' USING ERRCODE='23514';END IF;
 IF NEW.catalogue_entry_id IS DISTINCT FROM service_change_catalogue_source(NEW.profile_revision_id,NEW.source_key)
 OR NEW.profile_entry_id IS DISTINCT FROM (c.content->'profile'->>'entryId')::uuid
 OR selected IS NULL OR mapping IS NULL OR NEW.content->>'key' IS DISTINCT FROM selected->>'key'
 OR NEW.content->>'requestedWork' IS DISTINCT FROM selected->>'requestedWork'
 OR NEW.content->>'sourceRevisionId' IS DISTINCT FROM NEW.profile_revision_id::text
 OR NEW.content->>'addonKey' IS DISTINCT FROM mapping->>'addonKey' OR NEW.content->>'taskKey' IS DISTINCT FROM mapping->>'taskKey'
 OR NEW.content->>'coverageKey' IS DISTINCT FROM mapping->>'coverageKey' OR NEW.content->'quantity' IS DISTINCT FROM mapping->'quantity'
 OR NEW.content->>'state' IS DISTINCT FROM (CASE WHEN selected->>'notRequired'='true' THEN 'not-required' ELSE 'pending' END)
 OR NEW.content->>'priceState' IS DISTINCT FROM selected->>'priceState'
 OR NEW.content->>'notRequiredReason' IS DISTINCT FROM selected->>'notRequiredReason'
 OR (selected->>'notRequired'='true' AND (mapping->>'optional'<>'true' OR length(trim(selected->>'notRequiredReason'))=0))
 THEN RAISE EXCEPTION 'Exact supplemental line source required' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER service_change_line_insert BEFORE INSERT ON order_service_change_line FOR EACH ROW EXECUTE FUNCTION service_change_line_guard();
REVOKE ALL ON FUNCTION service_change_line_guard() FROM PUBLIC;
CREATE FUNCTION service_change_draft_target_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF OLD.workflow='order.service-change' AND ((NEW.payload->>'orderId') IS DISTINCT FROM (OLD.payload->>'orderId') OR (NEW.payload->>'originalDigest') IS DISTINCT FROM (OLD.payload->>'originalDigest')) THEN RAISE EXCEPTION 'Service draft target is immutable' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER service_change_draft_target BEFORE UPDATE ON durable_draft FOR EACH ROW EXECUTE FUNCTION service_change_draft_target_guard();
REVOKE ALL ON FUNCTION service_change_draft_target_guard() FROM PUBLIC;
