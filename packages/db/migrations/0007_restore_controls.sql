-- Installation metadata, no customer content. Default installation is closed.
-- Provision the NOLOGIN operator role explicitly before this additive migration.
ALTER TABLE shop ADD COLUMN is_practice boolean NOT NULL DEFAULT false;
-- Same narrow locking pattern as lock_job_membership: runtime has no UPDATE.
CREATE POLICY shop_owner_lock ON shop FOR UPDATE TO app_owner
 USING(shop_id=NULLIF(current_setting('app.shop_id',true),'')::uuid) WITH CHECK(false);
CREATE FUNCTION lock_shop_practice() RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE practice boolean;
BEGIN
 IF session_user<>'app_user' OR NOT COALESCE(public.shop_context_allows(NULLIF(current_setting('app.shop_id',true),'')::uuid),false) THEN RETURN NULL; END IF;
 SELECT is_practice INTO practice FROM public.shop WHERE shop_id=NULLIF(current_setting('app.shop_id',true),'')::uuid FOR SHARE;
 RETURN practice;
END $fn$;
REVOKE ALL ON FUNCTION lock_shop_practice() FROM PUBLIC,app_privacy,app_restore_operator;
GRANT EXECUTE ON FUNCTION lock_shop_practice() TO app_user;
CREATE TABLE system_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 restore_epoch uuid NOT NULL, side_effects_enabled boolean NOT NULL DEFAULT false,
 money_frozen boolean NOT NULL DEFAULT true
);
CREATE TABLE system_control_event (
 id uuid PRIMARY KEY DEFAULT uuidv7(), occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 operator_login name NOT NULL, action text NOT NULL CHECK(action IN ('install','restore','freeze','reconcile','disable','enable')),
 previous_epoch uuid, restore_epoch uuid NOT NULL,
 side_effects_enabled boolean NOT NULL, money_frozen boolean NOT NULL
);
INSERT INTO system_state(restore_epoch) VALUES(uuidv7());
INSERT INTO system_control_event(operator_login,action,restore_epoch,side_effects_enabled,money_frozen)
 SELECT session_user,'install',restore_epoch,side_effects_enabled,money_frozen FROM system_state;
REVOKE ALL ON system_state,system_control_event FROM PUBLIC,app_user,app_privacy,app_restore_operator;
GRANT SELECT ON system_state TO app_user;
GRANT SELECT ON system_state,system_control_event TO app_restore_operator,app_backup;
GRANT USAGE ON SCHEMA public TO app_restore_operator;
CREATE TRIGGER system_control_event_immutable BEFORE UPDATE OR DELETE ON system_control_event
 FOR EACH ROW EXECUTE FUNCTION reject_history_change();

-- Every protected transaction first acquires the shared installation lock in a
-- separate statement, then reads state (READ COMMITTED). Operator takes exclusive.
-- No tenant/entity locks are acquired by the operator. Held through commit.
CREATE FUNCTION transition_restore_control(expected_epoch uuid, requested_action text) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE previous public.system_state; next_epoch uuid;
BEGIN
 IF requested_action NOT IN ('restore','freeze','reconcile','disable','enable') OR requested_action IS NULL THEN
  RAISE EXCEPTION 'Control action denied' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(120036);
 SELECT * INTO previous FROM public.system_state WHERE singleton FOR UPDATE;
 IF NOT FOUND OR expected_epoch IS DISTINCT FROM previous.restore_epoch THEN
  RAISE EXCEPTION 'Control epoch missing or stale' USING ERRCODE='40001';
 END IF;
 next_epoch=CASE WHEN requested_action='restore' THEN uuidv7() ELSE previous.restore_epoch END;
 UPDATE public.system_state SET restore_epoch=next_epoch,
  side_effects_enabled=CASE WHEN requested_action IN ('restore','disable') THEN false WHEN requested_action='enable' THEN true ELSE previous.side_effects_enabled END,
  money_frozen=CASE WHEN requested_action IN ('restore','freeze') THEN true WHEN requested_action='reconcile' THEN false ELSE previous.money_frozen END
 WHERE singleton;
 INSERT INTO public.system_control_event(operator_login,action,previous_epoch,restore_epoch,side_effects_enabled,money_frozen)
  SELECT session_user,requested_action,previous.restore_epoch,restore_epoch,side_effects_enabled,money_frozen FROM public.system_state;
 RETURN next_epoch;
END $fn$;
REVOKE ALL ON FUNCTION transition_restore_control(uuid,text) FROM PUBLIC,app_user,app_privacy;
GRANT EXECUTE ON FUNCTION transition_restore_control(uuid,text) TO app_restore_operator;
CREATE FUNCTION current_restore_epoch() RETURNS uuid LANGUAGE sql SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT restore_epoch FROM public.system_state WHERE singleton
$fn$;
REVOKE ALL ON FUNCTION current_restore_epoch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_restore_epoch() TO app_user;
-- No quarantine release API. Reconciliation allows NEW work only; old epochs
-- and immutable quarantine cannot be relabelled or automatically redriven.
