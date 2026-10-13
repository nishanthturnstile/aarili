-- Auth identity exception (§8.2), confined to packages/auth. No tenant or
-- business record is changed. Additive; retain on application rollback.
ALTER TABLE auth_session ADD COLUMN auth_method text NOT NULL DEFAULT 'credential'
 CHECK (auth_method IN ('credential', 'google'));
CREATE TABLE auth_connection_event (
 id uuid PRIMARY KEY DEFAULT uuidv7(),
 user_id uuid NOT NULL REFERENCES auth_user(id),
 session_id uuid NOT NULL,
 provider_id text NOT NULL CHECK (provider_id = 'google'),
 action text NOT NULL CHECK (action IN ('linked', 'reauthorised', 'disconnected')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_connection_event_user_idx ON auth_connection_event(user_id, created_at);
REVOKE ALL ON auth_connection_event FROM PUBLIC, app_user;
GRANT SELECT, INSERT ON auth_connection_event TO app_user;
-- Session attribution deliberately survives session revocation/deletion.
CREATE FUNCTION preserve_auth_connection_event() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 RAISE EXCEPTION 'Connection history is immutable';
END $fn$;
CREATE TRIGGER auth_connection_history BEFORE UPDATE OR DELETE ON auth_connection_event
 FOR EACH ROW EXECUTE FUNCTION preserve_auth_connection_event();
