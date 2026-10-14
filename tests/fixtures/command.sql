-- Synthetic dev/test only, never part of application migrations.
CREATE TABLE synthetic_record (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), value text NOT NULL CHECK(value IN ('alpha','beta','gamma')),
 finalized boolean NOT NULL DEFAULT false, correction_of uuid, event_id uuid NOT NULL,
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,correction_of),
 FOREIGN KEY(shop_id,correction_of) REFERENCES synthetic_record(shop_id,id),
 FOREIGN KEY(shop_id,event_id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE synthetic_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_record FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON synthetic_record AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON synthetic_record FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON synthetic_record FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON synthetic_record TO app_user;
CREATE FUNCTION protect_synthetic_history() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE source public.synthetic_record;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  IF OLD.finalized THEN RAISE EXCEPTION 'Finalized history protected' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (NEW.shop_id<>OLD.shop_id OR NEW.id<>OLD.id OR NEW.correction_of IS DISTINCT FROM OLD.correction_of OR NEW.version<>OLD.version+1) THEN
   RAISE EXCEPTION 'Invalid record transition' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='INSERT' AND NEW.correction_of IS NOT NULL THEN
  SELECT * INTO source FROM public.synthetic_record WHERE shop_id=NEW.shop_id AND id=NEW.correction_of FOR UPDATE;
  IF NOT FOUND OR NOT source.finalized OR NOT NEW.finalized THEN
   RAISE EXCEPTION 'Finalized source required' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION protect_synthetic_history() FROM PUBLIC;
CREATE TRIGGER synthetic_history BEFORE INSERT OR UPDATE OR DELETE ON synthetic_record FOR EACH ROW EXECUTE FUNCTION protect_synthetic_history();
