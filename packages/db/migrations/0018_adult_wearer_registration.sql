-- W1 1.1.3b. Synthetic-only wearer roles, attributable relationships/preferences,
-- separate immutable purpose events and connected draft origin. No minor grant path.
ALTER TABLE privacy_notice_version DROP CONSTRAINT privacy_notice_version_purpose_check;
ALTER TABLE privacy_notice_version ADD CONSTRAINT privacy_notice_version_purpose_check CHECK(purpose IN ('service','wearer-permissions'));
CREATE TABLE wearer (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,person_id uuid NOT NULL,
 age text NOT NULL CHECK(age IN ('adult','minor','unknown')),authority_epoch integer NOT NULL DEFAULT 1 CHECK(authority_epoch>0),version integer NOT NULL CHECK(version>0),
 synthetic boolean NOT NULL CHECK(synthetic),created_by uuid NOT NULL,updated_by uuid NOT NULL,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,person_id),UNIQUE(shop_id,id,person_id),
 FOREIGN KEY(shop_id,person_id) REFERENCES customer_person(shop_id,id),
 FOREIGN KEY(shop_id,created_by) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,updated_by) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE wearer_preferences (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),wearer_id uuid NOT NULL,
 language text NOT NULL DEFAULT '',channel text NOT NULL DEFAULT '',fit text NOT NULL DEFAULT '',style text NOT NULL DEFAULT '',delivery text NOT NULL DEFAULT '',source text NOT NULL DEFAULT '',
 PRIMARY KEY(shop_id,wearer_id),FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),
 CHECK(length(language)<=1000 AND length(channel)<=1000 AND length(fit)<=1000 AND length(style)<=1000 AND length(delivery)<=1000 AND length(source)<=1000)
);
CREATE TABLE customer_wearer_relationship (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,customer_id uuid NOT NULL,wearer_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('self','family','other')),
 statement_by_person_id uuid NOT NULL,authorised boolean NOT NULL,informed boolean NOT NULL,
 authorisation_declined boolean NOT NULL DEFAULT false,informed_declined boolean NOT NULL DEFAULT false,
 CHECK(NOT(authorised AND authorisation_declined)),CHECK(NOT(informed AND informed_declined)),
 source text NOT NULL CHECK(source IN ('in-person','phone')),occurred_at timestamptz NOT NULL,interaction text NOT NULL CHECK(length(btrim(interaction)) BETWEEN 1 AND 500),
 origin_draft_id uuid,
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,customer_id,wearer_id),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),
 FOREIGN KEY(shop_id,statement_by_person_id) REFERENCES customer_person(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id)
);
CREATE TABLE wearer_relationship_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,relationship_id uuid NOT NULL,
 wearer_version integer NOT NULL CHECK(wearer_version>0),evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),notice_id uuid NOT NULL,
 recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,relationship_id,wearer_version),
 FOREIGN KEY(shop_id,relationship_id) REFERENCES customer_wearer_relationship(shop_id,id),
 FOREIGN KEY(shop_id,notice_id) REFERENCES privacy_notice_version(shop_id,id),
 FOREIGN KEY(shop_id,recorded_by) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE wearer_preference_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,wearer_id uuid NOT NULL,wearer_version integer NOT NULL,
 expressed jsonb NOT NULL CHECK(jsonb_typeof(expressed)='object'),recorded_by uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,wearer_id,wearer_version),
 FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),
 FOREIGN KEY(shop_id,recorded_by) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE wearer_age_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,wearer_id uuid NOT NULL,wearer_version integer NOT NULL,
 age text NOT NULL CHECK(age IN ('adult','minor','unknown')),source text NOT NULL CHECK(source IN ('in-person','phone')),
 occurred_at timestamptz NOT NULL,recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,wearer_id,wearer_version),
 FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),
 FOREIGN KEY(shop_id,recorded_by) REFERENCES shop_membership(shop_id,user_id)
);
CREATE TABLE wearer_purpose_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,wearer_id uuid NOT NULL,person_id uuid NOT NULL,
 purpose text NOT NULL CHECK(purpose IN ('service','marketing','publication','private-media')),
 decision text NOT NULL CHECK(decision IN ('grant','refusal','withdrawal')),notice_id uuid NOT NULL,
 giver_person_id uuid NOT NULL CHECK(giver_person_id=person_id),language text NOT NULL CHECK(language IN ('en','ta')),
 notice_explained boolean NOT NULL CHECK(notice_explained),source text NOT NULL CHECK(source IN ('in-person','phone')),
 occurred_at timestamptz NOT NULL,recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 recorded_by uuid NOT NULL,wearer_version integer NOT NULL,authority_epoch integer NOT NULL,previous_id uuid,synthetic boolean NOT NULL CHECK(synthetic),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,wearer_id,purpose,id),UNIQUE(shop_id,wearer_id,wearer_version),
 FOREIGN KEY(shop_id,wearer_id,person_id) REFERENCES wearer(shop_id,id,person_id),
 FOREIGN KEY(shop_id,giver_person_id) REFERENCES customer_person(shop_id,id),
 FOREIGN KEY(shop_id,notice_id) REFERENCES privacy_notice_version(shop_id,id),
 FOREIGN KEY(shop_id,recorded_by) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,wearer_id,purpose,previous_id) REFERENCES wearer_purpose_event(shop_id,wearer_id,purpose,id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['wearer','wearer_preferences','customer_wearer_relationship','wearer_relationship_event','wearer_preference_event','wearer_age_event','wearer_purpose_event'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
GRANT UPDATE(age,authority_epoch,version,updated_by) ON wearer TO app_user;
GRANT UPDATE(language,channel,fit,style,delivery,source) ON wearer_preferences TO app_user;
GRANT UPDATE(kind,statement_by_person_id,authorised,informed,authorisation_declined,informed_declined,source,occurred_at,interaction) ON customer_wearer_relationship TO app_user;
CREATE FUNCTION wearer_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.updated_by IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Wearer actor denied' USING ERRCODE='42501';END IF;
 IF (TG_OP='INSERT' AND (NEW.version<>1 OR NEW.created_by<>NEW.updated_by)) OR (TG_OP='UPDATE' AND NEW.version::bigint<>OLD.version::bigint+1) THEN RAISE EXCEPTION 'Wearer version denied' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION wearer_guard() FROM PUBLIC;
CREATE TRIGGER wearer_guard BEFORE INSERT OR UPDATE ON wearer FOR EACH ROW EXECUTE FUNCTION wearer_guard();
CREATE FUNCTION wearer_relationship_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE contact uuid;subject uuid;
BEGIN
 SELECT person_id INTO contact FROM customer WHERE shop_id=NEW.shop_id AND id=NEW.customer_id;
 SELECT person_id INTO subject FROM wearer WHERE shop_id=NEW.shop_id AND id=NEW.wearer_id;
 IF NEW.statement_by_person_id IS DISTINCT FROM contact OR ((NEW.kind='self') IS DISTINCT FROM (contact=subject)) THEN RAISE EXCEPTION 'Wearer relationship denied' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION wearer_relationship_guard() FROM PUBLIC;
CREATE TRIGGER wearer_relationship_guard BEFORE INSERT OR UPDATE ON customer_wearer_relationship FOR EACH ROW EXECUTE FUNCTION wearer_relationship_guard();
CREATE FUNCTION wearer_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE current_age text;
BEGIN
 IF NEW.recorded_by IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Wearer evidence actor denied' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='wearer_purpose_event' THEN
  SELECT age INTO current_age FROM wearer WHERE shop_id=NEW.shop_id AND id=NEW.wearer_id FOR UPDATE;
  IF NEW.decision='grant' AND current_age IS DISTINCT FROM 'adult' THEN RAISE EXCEPTION 'Adult authority required' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION wearer_evidence_guard() FROM PUBLIC;
CREATE TRIGGER wearer_purpose_guard BEFORE INSERT ON wearer_purpose_event FOR EACH ROW EXECUTE FUNCTION wearer_evidence_guard();
CREATE TRIGGER wearer_relationship_event_guard BEFORE INSERT ON wearer_relationship_event FOR EACH ROW EXECUTE FUNCTION wearer_evidence_guard();
CREATE TRIGGER wearer_preference_event_guard BEFORE INSERT ON wearer_preference_event FOR EACH ROW EXECUTE FUNCTION wearer_evidence_guard();
CREATE TRIGGER wearer_age_event_guard BEFORE INSERT ON wearer_age_event FOR EACH ROW EXECUTE FUNCTION wearer_evidence_guard();
CREATE INDEX wearer_names ON wearer(shop_id,person_id);
CREATE INDEX wearer_customer_lookup ON customer_wearer_relationship(shop_id,customer_id,id);
CREATE INDEX wearer_purpose_latest ON wearer_purpose_event(shop_id,wearer_id,purpose,wearer_version DESC);
