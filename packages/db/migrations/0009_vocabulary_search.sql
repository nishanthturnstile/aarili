-- W0 0.4.1c: additive vocabulary only. Customer/search entities stay test-only.
CREATE TABLE vocabulary (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 current_revision_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(shop_id,id)
);
CREATE TABLE vocabulary_revision (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 vocabulary_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
 previous_id uuid, label_ta text NOT NULL CHECK(length(btrim(label_ta)) BETWEEN 1 AND 240),
 label_en text NOT NULL CHECK(length(btrim(label_en)) BETWEEN 1 AND 240),
 aliases jsonb NOT NULL CHECK(jsonb_typeof(aliases)='array' AND jsonb_array_length(aliases)<=100),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 240),
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, algorithm_version integer NOT NULL CHECK(algorithm_version=1),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,vocabulary_id,id), UNIQUE(shop_id,vocabulary_id,revision),
 FOREIGN KEY(shop_id,vocabulary_id) REFERENCES vocabulary(shop_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,vocabulary_id,previous_id) REFERENCES vocabulary_revision(shop_id,vocabulary_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((revision=1)=(previous_id IS NULL))
);
ALTER TABLE vocabulary ADD FOREIGN KEY(shop_id,id,current_revision_id)
 REFERENCES vocabulary_revision(shop_id,vocabulary_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE vocabulary_search_key (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), revision_id uuid NOT NULL,
 algorithm_version integer NOT NULL CHECK(algorithm_version=1), ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 101),
 original_text text NOT NULL CHECK(length(btrim(original_text)) BETWEEN 1 AND 240),
 name_ta_norm text NOT NULL, name_latin_norm text NOT NULL, name_skel text NOT NULL,
 PRIMARY KEY(shop_id,revision_id,algorithm_version,ordinal),
 FOREIGN KEY(shop_id,revision_id) REFERENCES vocabulary_revision(shop_id,id)
);
CREATE INDEX vocabulary_keys_tamil ON vocabulary_search_key(shop_id,algorithm_version,name_ta_norm);
CREATE INDEX vocabulary_keys_latin ON vocabulary_search_key(shop_id,algorithm_version,name_latin_norm);
CREATE INDEX vocabulary_keys_skeleton ON vocabulary_search_key(shop_id,algorithm_version,name_skel);
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary FORCE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_revision FORCE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_search_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocabulary_search_key FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON vocabulary AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON vocabulary FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_context ON vocabulary_revision AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON vocabulary_revision FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_context ON vocabulary_search_key AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON vocabulary_search_key FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON vocabulary,vocabulary_revision,vocabulary_search_key FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT ON vocabulary,vocabulary_revision,vocabulary_search_key TO app_user;
GRANT UPDATE(current_revision_id,version) ON vocabulary TO app_user;
-- Backup SELECT is inherited from the reviewed default privileges.
CREATE FUNCTION vocabulary_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE prior public.vocabulary_revision; event public.audit_event; alias jsonb;
BEGIN
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
  RAISE EXCEPTION 'Vocabulary provenance denied' USING ERRCODE='42501';
 END IF;
 SELECT * INTO event FROM public.audit_event WHERE shop_id=NEW.shop_id AND id=NEW.audit_id;
 IF event.id IS NULL OR event.actor_type<>'user' OR event.actor_id<>NEW.actor_id OR event.action<>'vocabulary.revise'
  OR event.entity_type<>'vocabulary_revision' OR event.entity_id<>NEW.id THEN
  RAISE EXCEPTION 'Vocabulary audit denied' USING ERRCODE='23514';
 END IF;
 IF NEW.previous_id IS NOT NULL THEN
  SELECT * INTO prior FROM public.vocabulary_revision WHERE shop_id=NEW.shop_id AND id=NEW.previous_id AND vocabulary_id=NEW.vocabulary_id;
  IF prior.id IS NULL OR prior.revision<>NEW.revision-1 THEN RAISE EXCEPTION 'Vocabulary revision chain denied' USING ERRCODE='23514'; END IF;
 END IF;
 FOR alias IN SELECT value FROM jsonb_array_elements(NEW.aliases) LOOP
  IF jsonb_typeof(alias)<>'string' OR length(btrim(alias #>> '{}')) NOT BETWEEN 1 AND 240 THEN
   RAISE EXCEPTION 'Vocabulary alias denied' USING ERRCODE='23514';
  END IF;
 END LOOP;
 NEW.created_xid=pg_current_xact_id();
 RETURN NEW;
END $fn$;
CREATE FUNCTION vocabulary_head_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.vocabulary_revision;
BEGIN
 SELECT * INTO r FROM public.vocabulary_revision WHERE shop_id=NEW.shop_id AND id=NEW.current_revision_id AND vocabulary_id=NEW.id;
 IF r.id IS NULL OR r.revision<>NEW.version OR r.created_xid<>pg_current_xact_id() THEN
  RAISE EXCEPTION 'Vocabulary head denied' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.version<>1 THEN RAISE EXCEPTION 'Vocabulary initial version denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.shop_id<>OLD.shop_id OR NEW.id<>OLD.id OR NEW.version::bigint<>OLD.version::bigint+1 OR r.previous_id<>OLD.current_revision_id THEN
   RAISE EXCEPTION 'Vocabulary version denied' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION vocabulary_key_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.vocabulary_revision; expected text;
BEGIN
 SELECT * INTO r FROM public.vocabulary_revision WHERE shop_id=NEW.shop_id AND id=NEW.revision_id;
 IF r.id IS NULL OR r.created_xid<>pg_current_xact_id() OR NEW.algorithm_version<>r.algorithm_version THEN
  RAISE EXCEPTION 'Vocabulary keys sealed' USING ERRCODE='42501';
 END IF;
 expected=CASE NEW.ordinal WHEN 0 THEN r.label_ta WHEN 1 THEN r.label_en ELSE r.aliases->>(NEW.ordinal-2) END;
 IF expected IS NULL OR NEW.original_text<>expected THEN RAISE EXCEPTION 'Vocabulary key source denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION vocabulary_complete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.vocabulary WHERE shop_id=NEW.shop_id AND id=NEW.vocabulary_id AND current_revision_id=NEW.id AND version=NEW.revision)
 OR (SELECT count(*) FROM public.vocabulary_search_key WHERE shop_id=NEW.shop_id AND revision_id=NEW.id) <> jsonb_array_length(NEW.aliases)+2 THEN
  RAISE EXCEPTION 'Vocabulary revision incomplete' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION vocabulary_revision_guard(),vocabulary_head_guard(),vocabulary_key_guard(),vocabulary_complete() FROM PUBLIC;
CREATE TRIGGER vocabulary_provenance BEFORE INSERT ON vocabulary_revision FOR EACH ROW EXECUTE FUNCTION vocabulary_revision_guard();
CREATE TRIGGER vocabulary_head BEFORE INSERT OR UPDATE ON vocabulary FOR EACH ROW EXECUTE FUNCTION vocabulary_head_guard();
CREATE TRIGGER vocabulary_key_source BEFORE INSERT ON vocabulary_search_key FOR EACH ROW EXECUTE FUNCTION vocabulary_key_guard();
CREATE CONSTRAINT TRIGGER vocabulary_complete AFTER INSERT ON vocabulary_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION vocabulary_complete();
CREATE TRIGGER vocabulary_revision_immutable BEFORE UPDATE OR DELETE ON vocabulary_revision FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER vocabulary_key_immutable BEFORE UPDATE OR DELETE ON vocabulary_search_key FOR EACH ROW EXECUTE FUNCTION reject_history_change();
