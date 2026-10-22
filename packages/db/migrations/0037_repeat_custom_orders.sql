-- 1.2.4a: additive repeat lineage. Disable order.repeat writes before rollback;
-- retain lineage and use a compatible reader. No source snapshot/backfill rewrite.
CREATE TABLE order_repeat_origin (
 shop_id uuid NOT NULL, draft_id uuid NOT NULL, source_order_id uuid NOT NULL,
 source jsonb NOT NULL, command_key uuid NOT NULL, actor_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,draft_id), UNIQUE(shop_id,command_key),
 FOREIGN KEY(shop_id,draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,source_order_id) REFERENCES garment_order(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id)
);
CREATE INDEX order_repeat_source ON order_repeat_origin(shop_id,source_order_id,draft_id);
CREATE TABLE order_repeat_target (
 shop_id uuid NOT NULL, draft_id uuid NOT NULL, order_id uuid NOT NULL,
 PRIMARY KEY(shop_id,draft_id), UNIQUE(shop_id,order_id),
 FOREIGN KEY(shop_id,draft_id) REFERENCES order_repeat_origin(shop_id,draft_id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['order_repeat_origin','order_repeat_target'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING (shop_context_allows(shop_id)) WITH CHECK (shop_context_allows(shop_id))',t);
 EXECUTE format('CREATE POLICY tenant_access ON %I AS PERMISSIVE FOR ALL TO app_user USING (shop_context_allows(shop_id)) WITH CHECK (shop_context_allows(shop_id))',t);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION order_immutable_guard()',t||'_immutable',t);
 END LOOP;
END $policies$;

-- Reuse exactly the existing custom acceptance guards via their pure adapter.
-- Existing quick/group/service branches and historic strict payloads are unchanged.
DO $adapter$ DECLARE body text;needle text; BEGIN
 body=pg_get_functiondef('service_intake_base(public.durable_draft,text)'::regprocedure);
 needle='END IF;RETURN d;';
 IF position(needle in body)=0 THEN RAISE EXCEPTION 'Repeat adapter predecessor changed';END IF;
 body=replace(body,needle,'END IF;IF d.workflow=''order.repeat'' THEN d.workflow=''order.quick'';d.payload=d.payload-''repeat'';END IF;RETURN d;');
 EXECUTE body;
END $adapter$;

CREATE FUNCTION order_repeat_origin_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;o public.garment_order;s public.order_acceptance_snapshot;expected jsonb;
BEGIN
 SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.source_order_id;
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.source_order_id;
 expected=jsonb_build_object('customerId',s.content->'intake'->'customerId','wearerId',s.content->'intake'->'wearerId','manifest',s.content->'intake'->'manifest',
 'presentation','simple','presentationRevisionId',NULL,'deliveryDate','','deliveryTime','','orderDate','','historicalReason','',
 'requestedDate','','eventDate','','occasion','','priority','normal','priceState','to-be-quoted','priceText','',
 'instructions',CASE WHEN NEW.source->>'reuseInstructions'='true' THEN s.content->'intake'->>'instructions' ELSE '' END,'repeat',NEW.source);
 IF d.workflow IS DISTINCT FROM 'order.repeat' OR d.schema_version<>1 OR d.version<>1 OR d.lifecycle IS DISTINCT FROM 'active'
 OR d.payload IS DISTINCT FROM expected OR o.intake_kind IS DISTINCT FROM 'custom'
 OR NEW.source->>'sourceId' IS DISTINCT FROM o.id::text OR (NEW.source->>'sourceVersion')::integer IS DISTINCT FROM o.version
 OR NEW.source->>'snapshotDigest' IS DISTINCT FROM s.digest OR NEW.source->>'scopeDigest' !~ '^[a-f0-9]{64}$'
 OR NOT (NEW.source ?& ARRAY['sourceId','sourceVersion','snapshotDigest','scopeDigest','reuseInstructions'])
 OR NEW.source-ARRAY['sourceId','sourceVersion','snapshotDigest','scopeDigest','reuseInstructions']<>'{}'::jsonb
 OR jsonb_typeof(NEW.source->'reuseInstructions') IS DISTINCT FROM 'boolean'
 OR NEW.source->>'scopeDigest' IS NULL
 OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR d.creator_id IS DISTINCT FROM NEW.actor_id
 THEN RAISE EXCEPTION 'Repeat origin denied' USING ERRCODE='23514';END IF;
 NEW.recorded_at=clock_timestamp(); RETURN NEW;
END $fn$;
CREATE TRIGGER order_repeat_origin_insert BEFORE INSERT ON order_repeat_origin FOR EACH ROW EXECUTE FUNCTION order_repeat_origin_guard();

CREATE FUNCTION order_repeat_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE d public.durable_draft;r public.order_repeat_origin;t public.order_repeat_target;s public.order_acceptance_snapshot;o public.garment_order;
BEGIN
 IF TG_TABLE_NAME='durable_draft' THEN
  IF NEW.workflow<>'order.repeat' THEN RETURN NEW;END IF;
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.id;
 ELSE
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;
 END IF;
 SELECT * INTO r FROM order_repeat_origin WHERE shop_id=d.shop_id AND draft_id=d.id;
 IF r.draft_id IS NULL OR d.workflow IS DISTINCT FROM 'order.repeat' OR d.payload->'repeat'->>'sourceId' IS DISTINCT FROM r.source_order_id::text
 OR d.payload->'repeat'->>'snapshotDigest' IS DISTINCT FROM r.source->>'snapshotDigest'
 OR d.payload->'repeat'->'reuseInstructions' IS DISTINCT FROM r.source->'reuseInstructions'
 OR NOT (d.payload->'repeat' ?& ARRAY['sourceId','sourceVersion','snapshotDigest','scopeDigest','reuseInstructions'])
 OR (d.payload->'repeat')-ARRAY['sourceId','sourceVersion','snapshotDigest','scopeDigest','reuseInstructions']<>'{}'::jsonb
 OR jsonb_typeof(d.payload->'repeat'->'sourceVersion') IS DISTINCT FROM 'number'
 OR (d.payload->'repeat'->>'sourceVersion') !~ '^[1-9][0-9]*$'
 OR (d.payload->'repeat'->>'scopeDigest') IS NULL OR (d.payload->'repeat'->>'scopeDigest') !~ '^[a-f0-9]{64}$'
 OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=r.shop_id AND a.entity_id=r.draft_id AND a.action='draft.save' AND a.idempotency_key=r.command_key AND a.actor_id=r.actor_id)
 THEN RAISE EXCEPTION 'Repeat draft provenance incomplete' USING ERRCODE='23514';END IF;
 SELECT * INTO o FROM garment_order WHERE shop_id=r.shop_id AND id=r.source_order_id;
 IF (d.payload->>'customerId')::uuid IS DISTINCT FROM o.customer_id OR (d.payload->>'wearerId')::uuid IS DISTINCT FROM o.wearer_id THEN RAISE EXCEPTION 'Repeat identity cannot move' USING ERRCODE='23514';END IF;
 SELECT * INTO t FROM order_repeat_target WHERE shop_id=d.shop_id AND draft_id=d.id;
 IF d.lifecycle='promoted' THEN
  SELECT * INTO o FROM garment_order WHERE shop_id=t.shop_id AND id=t.order_id;
  SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=t.shop_id AND order_id=t.order_id;
  IF t.order_id IS NULL OR d.result_type IS DISTINCT FROM 'order.accepted' OR d.result_id IS DISTINCT FROM t.order_id
  OR o.origin_draft_id IS DISTINCT FROM d.id OR o.intake_kind IS DISTINCT FROM 'custom' OR o.id=r.source_order_id
  OR s.content->'snapshot'->'repeat' IS DISTINCT FROM d.payload->'repeat'
  OR s.content->'intake' IS DISTINCT FROM d.payload-'repeat'
  THEN RAISE EXCEPTION 'Repeat acceptance incomplete' USING ERRCODE='23514';END IF;
 ELSIF t.order_id IS NOT NULL THEN RAISE EXCEPTION 'Unaccepted repeat target' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER order_repeat_draft_commit AFTER INSERT OR UPDATE ON durable_draft DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_repeat_commit_guard();
CREATE CONSTRAINT TRIGGER order_repeat_origin_commit AFTER INSERT ON order_repeat_origin DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_repeat_commit_guard();
CREATE CONSTRAINT TRIGGER order_repeat_target_commit AFTER INSERT ON order_repeat_target DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_repeat_commit_guard();
REVOKE ALL ON FUNCTION order_repeat_origin_guard(),order_repeat_commit_guard() FROM PUBLIC;
