-- Explicit privileged provisioning only. No LOGIN/password/activation here.
-- Reusable on retained synthetic volumes; never executed by app_owner/runtime.
DO $roles$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_backup') THEN
  CREATE ROLE app_backup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_privacy') THEN
  CREATE ROLE app_privacy NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $roles$;
