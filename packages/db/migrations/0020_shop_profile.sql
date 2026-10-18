-- W1 1.1.1a: additive profile/history and explicit private shop-branding purpose.
-- Back up before applying outside disposable verification. Compatible app rollback
-- retains these tables/guards. No production policies or media providers seeded.
CREATE TABLE shop_profile_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0), previous_id uuid,
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, baseline boolean NOT NULL,
 effective_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 profile jsonb NOT NULL CHECK(jsonb_typeof(profile)='object'), logo_asset_id uuid,
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,version),
 FOREIGN KEY(shop_id,previous_id) REFERENCES shop_profile_revision(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 FOREIGN KEY(shop_id,logo_asset_id) REFERENCES media_asset(shop_id,id),
 CHECK((version=1)=(previous_id IS NULL)), CHECK(baseline=(version=1)),
 CHECK(profile ? 'displayName' AND jsonb_typeof(profile->'displayName')='string' AND length(btrim(profile->>'displayName')) BETWEEN 1 AND 120),
 CHECK(profile->>'currency' IS NOT DISTINCT FROM 'INR'),
 CHECK(profile->>'timezone' IS NOT DISTINCT FROM 'Asia/Kolkata'),
 CHECK(profile->>'billingRegime' IS NOT DISTINCT FROM 'unregistered-non-tax'),
 CHECK((profile->>'logoAssetId')::uuid IS NOT DISTINCT FROM logo_asset_id)
);
CREATE TABLE shop_profile (
 shop_id uuid NOT NULL PRIMARY KEY REFERENCES shop(shop_id),
 current_revision_id uuid NOT NULL, version integer NOT NULL CHECK(version>=2),
 FOREIGN KEY(shop_id,current_revision_id) REFERENCES shop_profile_revision(shop_id,id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['shop_profile','shop_profile_revision'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(current_revision_id,version) ON shop_profile TO app_user;
CREATE FUNCTION shop_profile_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Profile history protected' USING ERRCODE='42501'; END IF;
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NOT EXISTS(
  SELECT 1 FROM audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_type='user' AND actor_id=NEW.actor_id
  AND entity_type='shop_profile_revision' AND entity_id=NEW.id AND action=CASE WHEN NEW.baseline THEN 'shop-profile.baseline' ELSE 'shop-profile.revise' END
 ) THEN RAISE EXCEPTION 'Profile provenance denied' USING ERRCODE='42501'; END IF;
 IF NEW.version=1 THEN
  IF NEW.profile->>'displayName' IS DISTINCT FROM (SELECT name FROM shop WHERE shop_id=NEW.shop_id) THEN RAISE EXCEPTION 'Profile baseline mismatch' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM shop_profile_revision WHERE shop_id=NEW.shop_id AND id=NEW.previous_id AND version::bigint+1=NEW.version) THEN RAISE EXCEPTION 'Profile predecessor denied' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.logo_asset_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM media_asset WHERE shop_id=NEW.shop_id AND id=NEW.logo_asset_id AND subject_id=NEW.shop_id AND purpose='shop-branding' AND status='ready' AND NOT minor AND visibility='private') THEN
  RAISE EXCEPTION 'Profile logo denied' USING ERRCODE='23514'; END IF;
 NEW.effective_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_profile_revision_guard() FROM PUBLIC;
CREATE TRIGGER shop_profile_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON shop_profile_revision FOR EACH ROW EXECUTE FUNCTION shop_profile_revision_guard();
CREATE FUNCTION shop_profile_pointer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.shop_profile_revision;
BEGIN
 SELECT * INTO r FROM shop_profile_revision WHERE shop_id=NEW.shop_id AND id=NEW.current_revision_id;
 IF NOT FOUND OR r.version<>NEW.version OR r.created_xid<>pg_current_xact_id() OR r.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Profile pointer denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>2 THEN RAISE EXCEPTION 'Profile first publication denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_revision_id THEN RAISE EXCEPTION 'Profile version denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_profile_pointer_guard() FROM PUBLIC;
CREATE TRIGGER shop_profile_pointer_guard BEFORE INSERT OR UPDATE ON shop_profile FOR EACH ROW EXECUTE FUNCTION shop_profile_pointer_guard();

-- Only the canonical name is mutable, guarded by a revision published in this
-- transaction. Membership and shop creation remain bootstrap-only exceptions.
CREATE POLICY shop_profile_name_write ON shop FOR UPDATE TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
GRANT UPDATE(name) ON shop TO app_user;
CREATE FUNCTION shop_profile_name_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF current_user<>'app_user' AND NEW.name IS NOT DISTINCT FROM OLD.name THEN RETURN NEW; END IF;
 IF NEW.shop_id<>OLD.shop_id OR NEW.is_practice<>OLD.is_practice OR NEW.created_at<>OLD.created_at OR NOT EXISTS(
  SELECT 1 FROM shop_profile p JOIN shop_profile_revision r ON r.shop_id=p.shop_id AND r.id=p.current_revision_id
  WHERE p.shop_id=NEW.shop_id AND r.profile->>'displayName'=NEW.name AND r.created_xid=pg_current_xact_id()
  AND r.actor_id=NULLIF(current_setting('app.actor_id',true),'')::uuid
 ) THEN RAISE EXCEPTION 'Canonical shop profile denied' USING ERRCODE='42501'; END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_profile_name_guard() FROM PUBLIC;
CREATE TRIGGER shop_profile_name_guard BEFORE UPDATE ON shop FOR EACH ROW EXECUTE FUNCTION shop_profile_name_guard();
-- A repository omission cannot commit a current pointer/name disagreement.
CREATE FUNCTION shop_profile_canonical_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM shop s JOIN shop_profile p ON p.shop_id=s.shop_id JOIN shop_profile_revision r ON r.shop_id=p.shop_id AND r.id=p.current_revision_id WHERE s.shop_id=NEW.shop_id AND s.name=r.profile->>'displayName') THEN
  RAISE EXCEPTION 'Canonical profile mismatch' USING ERRCODE='23514'; END IF; RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION shop_profile_canonical_guard() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER shop_profile_canonical_guard AFTER INSERT OR UPDATE ON shop_profile DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shop_profile_canonical_guard();
ALTER TABLE media_asset DROP CONSTRAINT media_asset_purpose_check;
ALTER TABLE media_asset ADD CONSTRAINT media_asset_purpose_check CHECK(purpose IN ('wearer-photo','private-fitting','manual-pattern','order-document','voice-note','shop-branding'));
ALTER TABLE media_asset ADD CONSTRAINT media_asset_branding_subject CHECK(purpose<>'shop-branding' OR (subject_id=shop_id AND NOT minor AND content_type LIKE 'image/%'));
