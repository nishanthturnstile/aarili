-- W1 1.1.3a. Additive synthetic-only customer registration. Final policy/live gates remain held.
CREATE TABLE customer_person (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 1 AND 120),
 phone text NOT NULL DEFAULT '' CHECK(length(phone)<=40), email text NOT NULL DEFAULT '' CHECK(length(email)<=254),
 aliases jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(aliases)='array' AND jsonb_array_length(aliases)<=20),
 version integer NOT NULL CHECK(version>0), synthetic boolean NOT NULL CHECK(synthetic),
 created_by uuid NOT NULL, updated_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 PRIMARY KEY(shop_id,id),
 FOREIGN KEY(shop_id,created_by) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,updated_by) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE customer (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, person_id uuid NOT NULL,
 code_number bigint NOT NULL CHECK(code_number>0), code text NOT NULL, notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,person_id), UNIQUE(shop_id,code), UNIQUE(shop_id,code_number),
 FOREIGN KEY(shop_id,person_id) REFERENCES customer_person(shop_id,id)
);
CREATE TABLE privacy_notice_version (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL, version text NOT NULL,
 title_en text NOT NULL,title_ta text NOT NULL,text_en text NOT NULL,text_ta text NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 purpose text NOT NULL CHECK(purpose='service'), synthetic boolean NOT NULL CHECK(synthetic),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,version)
);
CREATE TABLE consent_record (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 person_id uuid NOT NULL,giver_person_id uuid NOT NULL,notice_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose='service'),decision text NOT NULL CHECK(decision='grant'),
 language text NOT NULL CHECK(language IN ('en','ta')),source text NOT NULL CHECK(source IN ('in-person','phone')),
 notice_explained boolean NOT NULL CHECK(notice_explained),
 occurred_at timestamptz NOT NULL,recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 recorded_by uuid NOT NULL,synthetic boolean NOT NULL CHECK(synthetic),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,person_id), CHECK(person_id=giver_person_id),
 FOREIGN KEY(shop_id,person_id) REFERENCES customer_person(shop_id,id),
 FOREIGN KEY(shop_id,giver_person_id) REFERENCES customer_person(shop_id,id),
 FOREIGN KEY(shop_id,notice_id) REFERENCES privacy_notice_version(shop_id,id),
 FOREIGN KEY(shop_id,recorded_by) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE customer_search_key (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),person_id uuid NOT NULL,ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 20),
 algorithm_version integer NOT NULL CHECK(algorithm_version=1),
 name_ta_norm text NOT NULL,name_latin_norm text NOT NULL,name_skel text NOT NULL,phone_digits text NOT NULL,
 phone_last4 text GENERATED ALWAYS AS (CASE WHEN length(phone_digits)>=4 THEN right(phone_digits,4) END) STORED,
 phone_last6 text GENERATED ALWAYS AS (CASE WHEN length(phone_digits)>=6 THEN right(phone_digits,6) END) STORED,
 PRIMARY KEY(shop_id,person_id,ordinal),FOREIGN KEY(shop_id,person_id) REFERENCES customer_person(shop_id,id)
);
CREATE INDEX customer_keys_tamil ON customer_search_key(shop_id,algorithm_version,name_ta_norm);
CREATE INDEX customer_keys_latin ON customer_search_key(shop_id,algorithm_version,name_latin_norm);
CREATE INDEX customer_keys_skeleton ON customer_search_key(shop_id,algorithm_version,name_skel);
CREATE INDEX customer_keys_phone ON customer_search_key(shop_id,phone_digits);
CREATE INDEX customer_keys_last4 ON customer_search_key(shop_id,phone_last4);
CREATE INDEX customer_keys_last6 ON customer_search_key(shop_id,phone_last6);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['customer_person','customer','privacy_notice_version','consent_record','customer_search_key'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(display_name,phone,email,aliases,version,updated_by,updated_at) ON customer_person TO app_user;
GRANT UPDATE(notes) ON customer TO app_user;
-- Search keys are updated in place; no runtime DELETE is needed for changed alias counts.
GRANT UPDATE(algorithm_version,name_ta_norm,name_latin_norm,name_skel,phone_digits) ON customer_search_key TO app_user;
CREATE FUNCTION customer_person_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.updated_by IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Customer actor denied' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 OR NEW.created_by<>NEW.updated_by THEN RAISE EXCEPTION 'Customer initial version denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.version::bigint<>OLD.version::bigint+1 THEN RAISE EXCEPTION 'Customer version denied' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.updated_at=date_trunc('milliseconds',clock_timestamp()); RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION customer_person_guard() FROM PUBLIC;
CREATE TRIGGER customer_person_guard BEFORE INSERT OR UPDATE ON customer_person FOR EACH ROW EXECUTE FUNCTION customer_person_guard();
CREATE FUNCTION customer_consent_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.recorded_by IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Consent recording actor denied' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION customer_consent_guard() FROM PUBLIC;
CREATE TRIGGER customer_consent_guard BEFORE INSERT ON consent_record FOR EACH ROW EXECUTE FUNCTION customer_consent_guard();
