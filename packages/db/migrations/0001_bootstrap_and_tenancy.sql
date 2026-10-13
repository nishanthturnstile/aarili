-- Global installation metadata. Auth alone owns admission/resume; there is no reset.
CREATE TABLE owner_bootstrap (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 user_id uuid UNIQUE REFERENCES auth_user(id),
 shop_name text, admission_key text, request_hash text, reserved_at timestamptz, completed_at timestamptz,
 shop_id uuid UNIQUE,
 CHECK ((user_id IS NULL AND shop_name IS NULL AND admission_key IS NULL AND request_hash IS NULL AND reserved_at IS NULL AND completed_at IS NULL AND shop_id IS NULL)
     OR (user_id IS NOT NULL AND shop_name IS NOT NULL AND admission_key IS NOT NULL AND request_hash IS NOT NULL AND reserved_at IS NOT NULL AND ((completed_at IS NULL) = (shop_id IS NULL))))
);
INSERT INTO owner_bootstrap(singleton) VALUES(true);
CREATE TABLE owner_verification (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth_user(id),
 expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_verification_user_idx ON owner_verification(user_id);
CREATE TABLE application_rate_limit (key varchar(255) PRIMARY KEY, points integer NOT NULL DEFAULT 0, expire bigint);

CREATE TABLE shop (
 shop_id uuid PRIMARY KEY DEFAULT uuidv7(), name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shop_membership (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), user_id uuid NOT NULL REFERENCES auth_user(id),
 role text NOT NULL CHECK (role = 'owner'), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (shop_id, user_id)
);
ALTER TABLE owner_bootstrap ADD CONSTRAINT bootstrap_shop_fk FOREIGN KEY (shop_id) REFERENCES shop(shop_id);
ALTER TABLE shop ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_membership FORCE ROW LEVEL SECURITY;
CREATE POLICY shop_read ON shop FOR SELECT USING (
 shop_id = NULLIF(current_setting('app.shop_id', true), '')::uuid
 AND EXISTS (SELECT 1 FROM shop_membership m WHERE m.shop_id = shop.shop_id AND m.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
);
CREATE POLICY shop_initial_write ON shop FOR INSERT WITH CHECK (
 current_user = 'app_owner' AND shop_id = NULLIF(current_setting('app.shop_id', true), '')::uuid
);
-- Own membership is the deliberate pre-shop-context read exception.
CREATE POLICY membership_read ON shop_membership FOR SELECT USING (
 user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
);
CREATE POLICY membership_initial_write ON shop_membership FOR INSERT WITH CHECK (
 current_user = 'app_owner' AND shop_id = NULLIF(current_setting('app.shop_id', true), '')::uuid
 AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
);

CREATE FUNCTION preserve_bootstrap() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF TG_OP = 'DELETE' OR OLD.completed_at IS NOT NULL
    OR (OLD.user_id IS NOT NULL AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.shop_name IS DISTINCT FROM OLD.shop_name OR NEW.reserved_at IS DISTINCT FROM OLD.reserved_at OR NEW.admission_key IS DISTINCT FROM OLD.admission_key OR NEW.request_hash IS DISTINCT FROM OLD.request_hash)) THEN
   RAISE EXCEPTION 'Bootstrap provenance is immutable';
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER bootstrap_history BEFORE UPDATE OR DELETE ON owner_bootstrap FOR EACH ROW EXECUTE FUNCTION preserve_bootstrap();

-- This is the sole initial tenant-write exception. No arbitrary membership grant.
-- Fixed search_path, explicit schemas, no dynamic SQL and PUBLIC execution revoked.
CREATE FUNCTION complete_owner_bootstrap(actor uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $fn$
DECLARE pending public.owner_bootstrap; initial_shop uuid;
BEGIN
 SELECT * INTO pending FROM public.owner_bootstrap WHERE singleton FOR UPDATE;
 IF pending.user_id IS DISTINCT FROM actor OR NOT EXISTS (SELECT 1 FROM public.auth_user WHERE id = actor AND email_verified) THEN
   RAISE EXCEPTION 'Bootstrap access denied';
 END IF;
 IF pending.completed_at IS NOT NULL THEN RETURN pending.shop_id; END IF;
 initial_shop := uuidv7();
 PERFORM set_config('app.user_id', actor::text, true);
 PERFORM set_config('app.actor_id', actor::text, true);
 PERFORM set_config('app.shop_id', initial_shop::text, true);
 INSERT INTO public.shop(shop_id, name) VALUES (initial_shop, pending.shop_name);
 INSERT INTO public.shop_membership(shop_id, user_id, role) VALUES (initial_shop, actor, 'owner');
 UPDATE public.owner_bootstrap SET completed_at = now(), shop_id = initial_shop WHERE singleton;
 RETURN initial_shop;
END $fn$;
REVOKE ALL ON FUNCTION complete_owner_bootstrap(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION preserve_bootstrap() FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_user, auth_account, auth_session, auth_verification, auth_rate_limit, owner_verification, application_rate_limit TO app_user;
GRANT SELECT ON owner_bootstrap, shop, shop_membership TO app_user;
GRANT UPDATE(user_id, shop_name, admission_key, request_hash, reserved_at) ON owner_bootstrap TO app_user;
GRANT EXECUTE ON FUNCTION complete_owner_bootstrap(uuid) TO app_user;
