CREATE TABLE product_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), action_id uuid NOT NULL,
 name text NOT NULL CHECK(name IN ('draft.saved','draft.promoted','draft.abandoned','media.stored','pdf.rendered','support.recorded')),
 subject_id uuid NOT NULL, schema_version integer, bytes bigint, category text, duration_seconds integer,
 occurred_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(shop_id,action_id),
 FOREIGN KEY(shop_id,action_id) REFERENCES audit_event(shop_id,id),
 CONSTRAINT product_event_fields CHECK (
 (name IN ('draft.saved','draft.promoted','draft.abandoned') AND schema_version IS NOT NULL AND schema_version BETWEEN 1 AND 2147483647 AND bytes IS NULL AND category IS NULL AND duration_seconds IS NULL) OR
 (name='media.stored' AND bytes IS NOT NULL AND bytes BETWEEN 1 AND 9007199254740991 AND schema_version IS NULL AND category IS NULL AND duration_seconds IS NULL) OR
 (name='pdf.rendered' AND schema_version IS NULL AND bytes IS NULL AND category IS NULL AND duration_seconds IS NULL) OR
 (name='support.recorded' AND category IS NOT NULL AND duration_seconds IS NOT NULL AND category IN ('setup','training','troubleshooting','recovery') AND duration_seconds BETWEEN 1 AND 2147483647 AND schema_version IS NULL AND bytes IS NULL)
 )
);
CREATE INDEX product_event_period ON product_event(shop_id,occurred_at,action_id);
CREATE INDEX product_event_subject ON product_event(shop_id,name,subject_id,occurred_at);
ALTER TABLE product_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_event FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON product_event AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON product_event FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON product_event FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT ON product_event TO app_user;
GRANT SELECT ON product_event TO app_backup;
CREATE FUNCTION product_event_provenance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 SELECT occurred_at INTO NEW.occurred_at FROM public.audit_event WHERE shop_id=NEW.shop_id AND id=NEW.action_id AND entity_id=NEW.subject_id;
 IF NOT FOUND OR NOT COALESCE(public.shop_context_allows(NEW.shop_id),false) THEN
  RAISE EXCEPTION 'Usage provenance denied' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION product_event_provenance() FROM PUBLIC;
CREATE TRIGGER product_event_provenance BEFORE INSERT ON product_event FOR EACH ROW EXECUTE FUNCTION product_event_provenance();
CREATE TRIGGER product_event_immutable BEFORE UPDATE OR DELETE ON product_event FOR EACH ROW EXECUTE FUNCTION reject_history_change();
-- Additive only. No retention/deletion or processor activation is authorised here.
