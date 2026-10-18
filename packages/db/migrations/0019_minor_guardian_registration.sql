-- Synthetic-only registration evidence. No measurement, media or live policy activation.
ALTER TABLE privacy_notice_version DROP CONSTRAINT privacy_notice_version_purpose_check;
ALTER TABLE privacy_notice_version ADD CONSTRAINT privacy_notice_version_purpose_check CHECK(purpose IN ('service','wearer-permissions','guardian-permissions'));
CREATE TABLE guardian_authority (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,wearer_id uuid NOT NULL,person_id uuid NOT NULL,
 authority text NOT NULL CHECK(authority IN ('parent','legal-guardian')),
 scope text NOT NULL CHECK(scope IN ('measurement','private-photo','measurement-and-private-photo')),
 source text NOT NULL CHECK(source IN ('in-person','phone')),occurred_at timestamptz NOT NULL,
 wearer_version integer NOT NULL CHECK(wearer_version>0),authority_epoch integer NOT NULL CHECK(authority_epoch>0),
 recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 origin_draft_id uuid,synthetic boolean NOT NULL CHECK(synthetic),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,wearer_id,id),UNIQUE(shop_id,wearer_id,id,person_id),UNIQUE(shop_id,wearer_id,wearer_version),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,wearer_id) REFERENCES wearer(shop_id,id),
 FOREIGN KEY(shop_id,person_id) REFERENCES customer_person(shop_id,id),
 FOREIGN KEY(shop_id,recorded_by) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id)
);
CREATE TABLE guardian_verification_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,wearer_id uuid NOT NULL,authority_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','confirmed','rejected','withdrawn')),
 method text NOT NULL CHECK(method IN ('synthetic-review-v1','not-verified')),
 evidence_ref text NOT NULL CHECK(length(evidence_ref)<=500),
 scope text NOT NULL CHECK(scope IN ('measurement','private-photo','measurement-and-private-photo')),
 source text NOT NULL CHECK(source IN ('in-person','phone')),occurred_at timestamptz NOT NULL,
 wearer_version integer NOT NULL CHECK(wearer_version>0),authority_epoch integer NOT NULL CHECK(authority_epoch>0),
 previous_id uuid,recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,wearer_id,authority_id,id),UNIQUE(shop_id,wearer_id,wearer_version),
 FOREIGN KEY(shop_id,wearer_id,authority_id) REFERENCES guardian_authority(shop_id,wearer_id,id),
 FOREIGN KEY(shop_id,wearer_id,authority_id,previous_id) REFERENCES guardian_verification_event(shop_id,wearer_id,authority_id,id),
 FOREIGN KEY(shop_id,recorded_by) REFERENCES shop_membership(shop_id,user_id),
 CHECK(status<>'confirmed' OR (method='synthetic-review-v1' AND length(btrim(evidence_ref))>0))
);
CREATE TABLE guardian_purpose_event (
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,wearer_id uuid NOT NULL,authority_id uuid NOT NULL,
 giver_person_id uuid NOT NULL,purpose text NOT NULL CHECK(purpose IN ('measurement','private-photo','marketing','publication')),
 decision text NOT NULL CHECK(decision IN ('grant','refusal','withdrawal')),notice_id uuid NOT NULL,notice_explained boolean NOT NULL CHECK(notice_explained),
 language text NOT NULL CHECK(language IN ('en','ta')),source text NOT NULL CHECK(source IN ('in-person','phone')),occurred_at timestamptz NOT NULL,
 verification_id uuid,previous_id uuid,wearer_version integer NOT NULL CHECK(wearer_version>0),authority_epoch integer NOT NULL CHECK(authority_epoch>0),
 recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),synthetic boolean NOT NULL CHECK(synthetic),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,wearer_id,authority_id,purpose,id),UNIQUE(shop_id,wearer_id,wearer_version),
 FOREIGN KEY(shop_id,wearer_id,authority_id,giver_person_id) REFERENCES guardian_authority(shop_id,wearer_id,id,person_id),
 FOREIGN KEY(shop_id,wearer_id,authority_id,verification_id) REFERENCES guardian_verification_event(shop_id,wearer_id,authority_id,id),
 FOREIGN KEY(shop_id,wearer_id,authority_id,purpose,previous_id) REFERENCES guardian_purpose_event(shop_id,wearer_id,authority_id,purpose,id),
 FOREIGN KEY(shop_id,notice_id) REFERENCES privacy_notice_version(shop_id,id),
 FOREIGN KEY(shop_id,recorded_by) REFERENCES shop_membership(shop_id,user_id),
 CHECK(decision<>'grant' OR purpose IN ('measurement','private-photo'))
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['guardian_authority','guardian_verification_event','guardian_purpose_event'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
 END LOOP;
END $policies$;
CREATE INDEX guardian_authority_latest ON guardian_authority(shop_id,wearer_id,wearer_version DESC);
CREATE INDEX guardian_verification_latest ON guardian_verification_event(shop_id,wearer_id,authority_id,wearer_version DESC);
CREATE INDEX guardian_purpose_latest ON guardian_purpose_event(shop_id,wearer_id,authority_id,purpose,wearer_version DESC);
CREATE FUNCTION guardian_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE w wearer%ROWTYPE;a guardian_authority%ROWTYPE;v guardian_verification_event%ROWTYPE;latest uuid;prev uuid;
BEGIN
 IF NEW.recorded_by IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN RAISE EXCEPTION 'Guardian actor denied' USING ERRCODE='42501';END IF;
 SELECT * INTO w FROM wearer WHERE shop_id=NEW.shop_id AND id=NEW.wearer_id FOR UPDATE;
 IF w.id IS NULL OR NEW.wearer_version IS DISTINCT FROM w.version OR NEW.authority_epoch IS DISTINCT FROM w.authority_epoch THEN RAISE EXCEPTION 'Guardian aggregate denied' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='guardian_authority' THEN
  IF w.age IS DISTINCT FROM 'minor' OR NEW.person_id=w.person_id THEN RAISE EXCEPTION 'Minor guardian identity denied' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO a FROM guardian_authority WHERE shop_id=NEW.shop_id AND wearer_id=NEW.wearer_id AND id=NEW.authority_id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Guardian subject denied' USING ERRCODE='23503';END IF;
  SELECT id INTO latest FROM guardian_authority WHERE shop_id=NEW.shop_id AND wearer_id=NEW.wearer_id ORDER BY wearer_version DESC LIMIT 1;
  IF TG_TABLE_NAME='guardian_verification_event' THEN
   SELECT id INTO prev FROM guardian_verification_event WHERE shop_id=NEW.shop_id AND wearer_id=NEW.wearer_id AND authority_id=NEW.authority_id ORDER BY wearer_version DESC LIMIT 1;
   IF NEW.previous_id IS DISTINCT FROM prev OR NEW.scope<>a.scope THEN RAISE EXCEPTION 'Guardian verification chain denied' USING ERRCODE='23514';END IF;
   IF NEW.status='confirmed' AND (w.age<>'minor' OR latest<>a.id) THEN RAISE EXCEPTION 'Current minor authority required' USING ERRCODE='23514';END IF;
  ELSE
   SELECT * INTO v FROM guardian_verification_event WHERE shop_id=NEW.shop_id AND wearer_id=NEW.wearer_id AND authority_id=NEW.authority_id ORDER BY wearer_version DESC LIMIT 1;
   SELECT id INTO prev FROM guardian_purpose_event WHERE shop_id=NEW.shop_id AND wearer_id=NEW.wearer_id AND authority_id=NEW.authority_id AND purpose=NEW.purpose ORDER BY wearer_version DESC LIMIT 1;
   IF NEW.previous_id IS DISTINCT FROM prev OR NEW.giver_person_id<>a.person_id THEN RAISE EXCEPTION 'Guardian purpose chain denied' USING ERRCODE='23514';END IF;
   IF NOT EXISTS(SELECT 1 FROM privacy_notice_version WHERE shop_id=NEW.shop_id AND id=NEW.notice_id AND purpose='guardian-permissions' AND synthetic) THEN RAISE EXCEPTION 'Guardian notice denied' USING ERRCODE='23514';END IF;
   IF NEW.decision='withdrawal' AND NOT EXISTS(SELECT 1 FROM guardian_purpose_event WHERE shop_id=NEW.shop_id AND id=prev AND decision='grant' AND notice_id=NEW.notice_id) THEN RAISE EXCEPTION 'Guardian withdrawal denied' USING ERRCODE='23514';END IF;
   IF NEW.decision='grant' AND (w.age<>'minor' OR latest<>a.id OR v.id IS NULL OR v.id IS DISTINCT FROM NEW.verification_id OR v.status<>'confirmed' OR v.authority_epoch<>w.authority_epoch OR NOT (a.scope=NEW.purpose OR a.scope='measurement-and-private-photo')) THEN RAISE EXCEPTION 'Verified guardian required' USING ERRCODE='23514';END IF;
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION guardian_evidence_guard() FROM PUBLIC;
CREATE TRIGGER guardian_authority_guard BEFORE INSERT ON guardian_authority FOR EACH ROW EXECUTE FUNCTION guardian_evidence_guard();
CREATE TRIGGER guardian_verification_guard BEFORE INSERT ON guardian_verification_event FOR EACH ROW EXECUTE FUNCTION guardian_evidence_guard();
CREATE TRIGGER guardian_purpose_guard BEFORE INSERT ON guardian_purpose_event FOR EACH ROW EXECUTE FUNCTION guardian_evidence_guard();
