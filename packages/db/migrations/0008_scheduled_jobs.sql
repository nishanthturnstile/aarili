-- W0 0.3.2c. Registered synthetic tasks only; no retention/provider effects.
-- Queue DDL stays under migration authority, never under a consumer login.
SELECT pgboss.create_queue('foundation.dead', '{"policy":"standard","retryLimit":0}'::jsonb);
SELECT pgboss.create_queue('foundation.schedule', '{"policy":"standard","retryLimit":2,"retryDelay":1,"retryBackoff":true,"retryDelayMax":8,"expireInSeconds":30,"deadLetter":"foundation.dead"}'::jsonb);

CREATE TABLE job_schedule (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), task text NOT NULL CHECK(task IN ('foundation.daily','foundation.nightly')),
 authorizer_id uuid NOT NULL REFERENCES auth_user(id), enabled boolean NOT NULL,
 version integer NOT NULL CHECK(version>0), next_due timestamptz NOT NULL,
 PRIMARY KEY(shop_id,task)
);
CREATE INDEX job_schedule_due ON job_schedule(shop_id,next_due) WHERE enabled;
CREATE TABLE job_schedule_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL DEFAULT uuidv7(),
 task text NOT NULL, authorizer_id uuid NOT NULL, version integer NOT NULL,
 enabled boolean NOT NULL, operator_login name NOT NULL, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,task,version),
 FOREIGN KEY(shop_id,task) REFERENCES job_schedule(shop_id,task)
);
CREATE TABLE job_schedule_run (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL DEFAULT uuidv7(),
 task text NOT NULL, grant_version integer NOT NULL, authorizer_id uuid NOT NULL,
 business_date date NOT NULL, due_at timestamptz NOT NULL, restore_epoch uuid NOT NULL,
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,task,business_date),
 FOREIGN KEY(shop_id,task) REFERENCES job_schedule(shop_id,task),
 FOREIGN KEY(shop_id,task,grant_version) REFERENCES job_schedule_event(shop_id,task,version),
 CHECK(business_date=(due_at AT TIME ZONE 'Asia/Kolkata')::date)
);
CREATE TABLE job_schedule_effect (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), run_id uuid NOT NULL, audit_id uuid NOT NULL,
 PRIMARY KEY(shop_id,run_id), UNIQUE(shop_id,audit_id),
 FOREIGN KEY(shop_id,run_id) REFERENCES job_schedule_run(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE job_schedule_quarantine (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), run_id uuid NOT NULL, observed_epoch uuid NOT NULL,
 PRIMARY KEY(shop_id,run_id), FOREIGN KEY(shop_id,run_id) REFERENCES job_schedule_run(shop_id,id)
);

-- FORCE remains effective for the owner. Owner policies are used exclusively
-- inside the fixed, parameter-scoped functions below, not by runtime queries.
DO $body$
DECLARE relation text;
BEGIN
 FOREACH relation IN ARRAY ARRAY['job_schedule','job_schedule_event','job_schedule_run','job_schedule_effect','job_schedule_quarantine'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',relation);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',relation);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',relation);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',relation);
  EXECUTE format('CREATE POLICY scheduled_owner ON %I FOR ALL TO app_owner USING(true) WITH CHECK(true)',relation);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy,app_restore_operator',relation);
  EXECUTE format('GRANT SELECT ON %I TO app_user,app_backup',relation);
  IF relation<>'job_schedule' THEN
   EXECUTE format('CREATE TRIGGER scheduled_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_history_change()',relation);
  END IF;
 END LOOP;
END $body$;

-- Private operator sets only one named grant for the completed installation
-- owner. No arbitrary system actor, shop enumeration or membership admission.
CREATE FUNCTION configure_job_schedule(tenant uuid, owner_id uuid, task_name text, expected_version integer, enable boolean) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE current_version integer; due timestamptz; hour integer;
BEGIN
 IF NOT pg_has_role(session_user,'app_restore_operator','MEMBER') OR task_name NOT IN ('foundation.daily','foundation.nightly') THEN
  RAISE EXCEPTION 'Schedule configuration denied' USING ERRCODE='42501'; END IF;
 PERFORM set_config('app.user_id',owner_id::text,true),set_config('app.actor_id',owner_id::text,true),set_config('app.shop_id',tenant::text,true);
 PERFORM 1 FROM public.owner_bootstrap b JOIN public.auth_user u ON u.id=b.user_id
  WHERE b.user_id=owner_id AND b.shop_id=tenant AND b.completed_at IS NOT NULL AND u.email_verified FOR SHARE OF u;
 IF NOT FOUND THEN RAISE EXCEPTION 'Schedule owner denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.shop_membership WHERE shop_id=tenant AND user_id=owner_id AND role='owner' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Schedule membership denied' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:schedule:'||tenant::text||':'||task_name,0));
 SELECT version INTO current_version FROM public.job_schedule WHERE shop_id=tenant AND task=task_name FOR UPDATE;
 IF COALESCE(current_version,0)<>expected_version THEN RAISE EXCEPTION 'Schedule version conflict' USING ERRCODE='40001'; END IF;
 hour=CASE task_name WHEN 'foundation.daily' THEN 6 ELSE 1 END;
 due=((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+make_time(hour,0,0)) AT TIME ZONE 'Asia/Kolkata';
 IF due<=clock_timestamp() THEN due=due+interval '1 day'; END IF;
 INSERT INTO public.job_schedule VALUES(tenant,task_name,owner_id,enable,expected_version+1,due)
  ON CONFLICT(shop_id,task) DO UPDATE SET authorizer_id=EXCLUDED.authorizer_id,enabled=EXCLUDED.enabled,version=EXCLUDED.version,next_due=EXCLUDED.next_due;
 INSERT INTO public.job_schedule_event(shop_id,task,authorizer_id,version,enabled,operator_login)
  VALUES(tenant,task_name,owner_id,expected_version+1,enable,session_user);
 RETURN expected_version+1;
END $fn$;
REVOKE ALL ON FUNCTION configure_job_schedule(uuid,uuid,text,integer,boolean) FROM PUBLIC,app_user,app_privacy;
GRANT EXECUTE ON FUNCTION configure_job_schedule(uuid,uuid,text,integer,boolean) TO app_restore_operator;

-- Only explicitly enabled grants are discoverable. This is not a shop list.
CREATE FUNCTION due_job_schedules() RETURNS TABLE(shop_id uuid,authorizer_id uuid,task text)
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT g.shop_id,g.authorizer_id,g.task FROM public.job_schedule g JOIN public.owner_bootstrap b
 ON b.shop_id=g.shop_id AND b.user_id=g.authorizer_id AND b.completed_at IS NOT NULL
 WHERE session_user='app_user' AND g.enabled AND g.next_due<=clock_timestamp()
 ORDER BY g.next_due LIMIT 100
$fn$;
REVOKE ALL ON FUNCTION due_job_schedules() FROM PUBLIC,app_privacy,app_restore_operator;
GRANT EXECUTE ON FUNCTION due_job_schedules() TO app_user;
-- A queue locator resolves only immutable registered run provenance, never a
-- payload-supplied authorizer. withShop and current authority still follow.
CREATE FUNCTION locate_job_run(tenant uuid,run uuid) RETURNS TABLE(authorizer_id uuid,restore_epoch uuid)
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT r.authorizer_id,r.restore_epoch FROM public.job_schedule_run r WHERE session_user='app_user' AND r.shop_id=tenant AND r.id=run
$fn$;
REVOKE ALL ON FUNCTION locate_job_run(uuid,uuid) FROM PUBLIC,app_privacy,app_restore_operator;
GRANT EXECUTE ON FUNCTION locate_job_run(uuid,uuid) TO app_user;

CREATE FUNCTION lock_job_schedule(task_name text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE tenant uuid:=NULLIF(current_setting('app.shop_id',true),'')::uuid;
BEGIN
 IF session_user<>'app_user' OR NOT COALESCE(public.shop_context_allows(tenant),false) THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:schedule:'||tenant::text||':'||task_name,0));
 PERFORM 1 FROM public.job_schedule WHERE shop_id=tenant AND task=task_name FOR UPDATE;
 RETURN FOUND;
END $fn$;
REVOKE ALL ON FUNCTION lock_job_schedule(text) FROM PUBLIC,app_privacy,app_restore_operator;
GRANT EXECUTE ON FUNCTION lock_job_schedule(text) TO app_user;

-- Claim one trusted occurrence, advance only by its own calendar day, and let
-- the caller enlist the pg-boss INSERT in this same transaction. Missed dates
-- catch up in bounded batches; their intended date survives delayed handling.
CREATE FUNCTION claim_job_occurrence(task_name text) RETURNS SETOF job_schedule_run
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE g public.job_schedule; r public.job_schedule_run; tenant uuid:=NULLIF(current_setting('app.shop_id',true),'')::uuid;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(120036);
 IF NOT public.lock_job_schedule(task_name) THEN RETURN; END IF;
 SELECT * INTO g FROM public.job_schedule WHERE shop_id=tenant AND task=task_name;
 IF NOT g.enabled OR g.next_due>clock_timestamp() OR g.authorizer_id IS DISTINCT FROM NULLIF(current_setting('app.user_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM public.owner_bootstrap WHERE shop_id=tenant AND user_id=g.authorizer_id AND completed_at IS NOT NULL)
 OR NOT public.lock_job_membership() OR NOT EXISTS(SELECT 1 FROM public.auth_user WHERE id=g.authorizer_id AND email_verified) THEN RETURN; END IF;
 INSERT INTO public.job_schedule_run(shop_id,task,grant_version,authorizer_id,business_date,due_at,restore_epoch)
 VALUES(tenant,task_name,g.version,g.authorizer_id,(g.next_due AT TIME ZONE 'Asia/Kolkata')::date,g.next_due,public.current_restore_epoch())
 ON CONFLICT(shop_id,task,business_date) DO NOTHING RETURNING * INTO r;
 UPDATE public.job_schedule SET next_due=g.next_due+interval '1 day' WHERE shop_id=tenant AND task=task_name;
 IF r.id IS NOT NULL THEN RETURN NEXT r; END IF;
END $fn$;
REVOKE ALL ON FUNCTION claim_job_occurrence(text) FROM PUBLIC,app_privacy,app_restore_operator;
GRANT EXECUTE ON FUNCTION claim_job_occurrence(text) TO app_user;

GRANT INSERT ON job_schedule_effect,job_schedule_quarantine TO app_user;
CREATE FUNCTION scheduled_effect_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE r public.job_schedule_run; g public.job_schedule;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(120036);
 SELECT * INTO r FROM public.job_schedule_run WHERE shop_id=NEW.shop_id AND id=NEW.run_id;
 IF NOT FOUND OR r.authorizer_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Scheduled provenance denied' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='job_schedule_quarantine' THEN
  IF NEW.observed_epoch IS DISTINCT FROM public.current_restore_epoch() OR r.restore_epoch=NEW.observed_epoch THEN
   RAISE EXCEPTION 'Scheduled quarantine denied' USING ERRCODE='23514'; END IF;
 ELSE
  PERFORM public.lock_job_schedule(r.task);
  SELECT * INTO g FROM public.job_schedule WHERE shop_id=NEW.shop_id AND task=r.task;
  IF NOT g.enabled OR g.version<>r.grant_version OR g.authorizer_id<>r.authorizer_id OR r.restore_epoch IS DISTINCT FROM public.current_restore_epoch()
   OR NOT public.lock_job_membership() OR NOT EXISTS(SELECT 1 FROM public.auth_user WHERE id=r.authorizer_id AND email_verified)
   OR NOT EXISTS(SELECT 1 FROM public.owner_bootstrap WHERE shop_id=NEW.shop_id AND user_id=r.authorizer_id AND completed_at IS NOT NULL)
   OR EXISTS(SELECT 1 FROM public.job_schedule_quarantine WHERE shop_id=NEW.shop_id AND run_id=r.id) THEN
   RAISE EXCEPTION 'Scheduled authority denied' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION scheduled_effect_guard() FROM PUBLIC;
CREATE TRIGGER scheduled_effect_provenance BEFORE INSERT ON job_schedule_effect FOR EACH ROW EXECUTE FUNCTION scheduled_effect_guard();
CREATE TRIGGER scheduled_quarantine_provenance BEFORE INSERT ON job_schedule_quarantine FOR EACH ROW EXECUTE FUNCTION scheduled_effect_guard();

-- Retain the existing user path verbatim in substance. System audits are
-- admitted only for an actual registered effect/run in the caller's tenant.
CREATE OR REPLACE FUNCTION command_provenance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT COALESCE(public.shop_context_allows(NEW.shop_id),false) THEN RAISE EXCEPTION 'Command provenance denied' USING ERRCODE='42501'; END IF;
 IF NEW.actor_type='system' AND TG_TABLE_NAME='audit_event' AND NEW.action='foundation.schedule.consume' THEN
  IF NEW.entity_type<>'job_schedule_run' OR NEW.entity_id<>NEW.request_id OR NEW.idempotency_key<>NEW.request_id OR NEW.source_event_id IS NOT NULL OR NEW.reason IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM public.job_schedule_run r JOIN public.job_schedule_effect e ON e.shop_id=r.shop_id AND e.run_id=r.id
    WHERE r.shop_id=NEW.shop_id AND r.id=NEW.entity_id AND e.audit_id=NEW.id
    AND r.authorizer_id=NULLIF(current_setting('app.actor_id',true),'')::uuid
    AND NEW.actor_id=CASE r.task WHEN 'foundation.daily' THEN '00000000-0037-4000-8000-000000000001'::uuid ELSE '00000000-0037-4000-8000-000000000002'::uuid END
    AND NEW.changes=jsonb_build_object('task',r.task,'businessDate',r.business_date::text,'authorizerId',r.authorizer_id,'grantVersion',r.grant_version)) THEN
   RAISE EXCEPTION 'System provenance denied' USING ERRCODE='42501'; END IF;
 ELSIF NEW.actor_type<>'user' OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Command provenance denied' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='audit_event' THEN NEW.occurred_at=now(); ELSE NEW.created_at=now(); END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION scheduled_effect_complete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id AND actor_type='system'
 AND action='foundation.schedule.consume' AND entity_id=NEW.run_id) THEN RAISE EXCEPTION 'Scheduled audit incomplete' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION scheduled_effect_complete() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER scheduled_audit_complete AFTER INSERT ON job_schedule_effect DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION scheduled_effect_complete();
