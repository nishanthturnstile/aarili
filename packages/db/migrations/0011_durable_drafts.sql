-- Additive durable draft foundation. Apply with app_owner/migration lock after
-- backup. No destructive down migration or runtime deletion authority.
CREATE TABLE durable_draft (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 workflow text NOT NULL CHECK(workflow ~ '^[a-z][a-z0-9.-]{0,79}$'),
 schema_version integer NOT NULL CHECK(schema_version>0),
 creator_id uuid NOT NULL, lifecycle text NOT NULL CHECK(lifecycle IN ('active','promoted','abandoned')),
 version integer NOT NULL CHECK(version>0), payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 created_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()), updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 result_type text, result_id uuid,
 PRIMARY KEY(shop_id,id),
 FOREIGN KEY(shop_id,creator_id) REFERENCES shop_membership(shop_id,user_id),
 CHECK(substring(id::text from 15 for 1)='7'),
 CHECK((lifecycle='promoted' AND result_type IS NOT NULL AND result_id IS NOT NULL)
 OR (lifecycle<>'promoted' AND result_type IS NULL AND result_id IS NULL)),
 UNIQUE(shop_id,result_type,result_id)
);
CREATE INDEX durable_draft_resume ON durable_draft(shop_id,lifecycle,created_at,id);
ALTER TABLE durable_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE durable_draft FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON durable_draft AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON durable_draft FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON durable_draft FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT,UPDATE ON durable_draft TO app_user;
CREATE FUNCTION durable_draft_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.creator_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
   OR NEW.lifecycle<>'active' OR NEW.version<>1 THEN
   RAISE EXCEPTION 'Draft provenance denied' USING ERRCODE='42501'; END IF;
  NEW.created_at=date_trunc('milliseconds',clock_timestamp()); NEW.updated_at=NEW.created_at;
 ELSE
  IF OLD.lifecycle<>'active' OR NEW.shop_id IS DISTINCT FROM OLD.shop_id OR NEW.id IS DISTINCT FROM OLD.id
   OR NEW.creator_id IS DISTINCT FROM OLD.creator_id OR NEW.workflow IS DISTINCT FROM OLD.workflow
   OR NEW.schema_version IS DISTINCT FROM OLD.schema_version OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.version<>OLD.version+1 THEN
   RAISE EXCEPTION 'Draft history protected' USING ERRCODE='42501'; END IF;
  NEW.updated_at=GREATEST(OLD.updated_at,date_trunc('milliseconds',clock_timestamp()));
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION durable_draft_guard() FROM PUBLIC;
CREATE TRIGGER durable_draft_guard BEFORE INSERT OR UPDATE ON durable_draft FOR EACH ROW EXECUTE FUNCTION durable_draft_guard();
