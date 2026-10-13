-- Additive hardening; retain these guards during compatible application rollback.
-- Roles must first be provisioned explicitly by a local/disposable administrator.
GRANT USAGE ON SCHEMA public TO app_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT SELECT ON TABLES TO app_backup;

-- Invoker rights: own-membership SELECT never depends on this function, so
-- checking membership does not recursively enter its own policy.
CREATE FUNCTION shop_context_allows(tenant uuid) RETURNS boolean
 LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $fn$
 SELECT tenant = NULLIF(current_setting('app.shop_id', true), '')::uuid
  AND NULLIF(current_setting('app.user_id', true), '')::uuid = NULLIF(current_setting('app.actor_id', true), '')::uuid
  AND EXISTS (SELECT 1 FROM public.shop_membership m
    WHERE m.shop_id=tenant AND m.user_id=NULLIF(current_setting('app.user_id', true), '')::uuid)
$fn$;
REVOKE ALL ON FUNCTION shop_context_allows(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shop_context_allows(uuid) TO app_user;
-- A restrictive guard cannot be bypassed by an extra permissive policy.
CREATE POLICY tenant_context ON shop AS RESTRICTIVE FOR ALL TO app_user
 USING (shop_context_allows(shop_id)) WITH CHECK (shop_context_allows(shop_id));
CREATE POLICY membership_identity ON shop_membership AS RESTRICTIVE FOR ALL TO app_user
 USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
 WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
-- Bootstrap is still the sole runtime tenant write exception. Membership/shop
-- grants remain SELECT only; no arbitrary creation, update or deletion.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON shop, shop_membership FROM app_user;
