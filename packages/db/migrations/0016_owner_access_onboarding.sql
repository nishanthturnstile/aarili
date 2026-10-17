-- ACCESS-01/05/06: expand bootstrap to defer shop naming until verified sign-in.
-- Keep legacy admission provenance (including reserved names/hashes) immutable.
ALTER TABLE owner_bootstrap DROP CONSTRAINT owner_bootstrap_check;
ALTER TABLE owner_bootstrap ADD CONSTRAINT owner_bootstrap_check CHECK (
 (user_id IS NULL AND shop_name IS NULL AND admission_key IS NULL AND request_hash IS NULL AND reserved_at IS NULL AND completed_at IS NULL AND shop_id IS NULL)
 OR (user_id IS NOT NULL AND admission_key IS NOT NULL AND request_hash IS NOT NULL AND reserved_at IS NOT NULL AND ((completed_at IS NULL) = (shop_id IS NULL)))
);

-- This remains the sole initial tenant-write exception. Naming never edits a
-- completed shop. The caller's app_user transaction writes audit and replay data
-- after this function, so all effects commit or roll back together.
CREATE FUNCTION complete_owner_bootstrap(actor uuid, requested_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $fn$
DECLARE pending public.owner_bootstrap; initial_shop uuid;
BEGIN
 SELECT * INTO pending FROM public.owner_bootstrap WHERE singleton FOR UPDATE;
 IF pending.user_id IS DISTINCT FROM actor OR NOT EXISTS (SELECT 1 FROM public.auth_user WHERE id = actor AND email_verified) THEN
   RAISE EXCEPTION 'Bootstrap access denied' USING ERRCODE='42501';
 END IF;
 IF requested_name IS NULL OR length(btrim(requested_name)) NOT BETWEEN 1 AND 120 THEN
   RAISE EXCEPTION 'Shop name required' USING ERRCODE='22023';
 END IF;
 requested_name := btrim(requested_name);
 PERFORM set_config('app.user_id', actor::text, true);
 PERFORM set_config('app.actor_id', actor::text, true);
 IF pending.completed_at IS NOT NULL THEN
   PERFORM set_config('app.shop_id', pending.shop_id::text, true);
   -- app_owner intentionally has no general tenant read policy. Resolve the
   -- name with invoker rights in the authenticated caller before this path.
   RETURN pending.shop_id;
 END IF;
 initial_shop := uuidv7();
 PERFORM set_config('app.shop_id', initial_shop::text, true);
 INSERT INTO public.shop(shop_id, name) VALUES (initial_shop, requested_name);
 INSERT INTO public.shop_membership(shop_id, user_id, role) VALUES (initial_shop, actor, 'owner');
 UPDATE public.owner_bootstrap SET completed_at = now(), shop_id = initial_shop WHERE singleton;
 RETURN initial_shop;
END $fn$;
REVOKE ALL ON FUNCTION complete_owner_bootstrap(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_owner_bootstrap(uuid,text) TO app_user;

-- Older clients can only finish an existing named reservation. Nameless new
-- reservations fail closed; completed legacy installations retain replay.
CREATE OR REPLACE FUNCTION complete_owner_bootstrap(actor uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $fn$
DECLARE pending public.owner_bootstrap;
BEGIN
 SELECT * INTO pending FROM public.owner_bootstrap WHERE singleton FOR UPDATE;
 IF pending.user_id IS DISTINCT FROM actor OR NOT EXISTS (SELECT 1 FROM public.auth_user WHERE id = actor AND email_verified) THEN
   RAISE EXCEPTION 'Bootstrap access denied' USING ERRCODE='42501';
 END IF;
 IF pending.shop_name IS NULL THEN
   RAISE EXCEPTION 'Legacy reservation required' USING ERRCODE='22023';
 END IF;
 IF pending.completed_at IS NOT NULL THEN RETURN pending.shop_id; END IF;
 RETURN public.complete_owner_bootstrap(actor, pending.shop_name);
END $fn$;
REVOKE ALL ON FUNCTION complete_owner_bootstrap(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_owner_bootstrap(uuid) TO app_user;
