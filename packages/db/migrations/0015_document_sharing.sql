-- Additive immutable manual-sharing history; retain on compatible rollback.
CREATE TABLE document_share_event (
 shop_id uuid NOT NULL,id uuid NOT NULL,doc_id uuid NOT NULL,revision integer NOT NULL,
 kind text NOT NULL CHECK(kind IN ('prepared','marked-sent')),actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),prepared_id uuid,
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 request_key uuid NOT NULL,request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,request_key),
 UNIQUE(shop_id,id,doc_id,revision,actor_id,sha256,kind),
 prepared_kind text GENERATED ALWAYS AS ('prepared'::text) STORED,
 FOREIGN KEY(shop_id,doc_id,revision) REFERENCES document_artifact(shop_id,doc_id,revision),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,id) REFERENCES audit_event(shop_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(shop_id,prepared_id,doc_id,revision,actor_id,sha256,prepared_kind)
  REFERENCES document_share_event(shop_id,id,doc_id,revision,actor_id,sha256,kind),
 CHECK((kind='prepared' AND prepared_id IS NULL) OR (kind='marked-sent' AND prepared_id IS NOT NULL))
);
CREATE INDEX document_share_history ON document_share_event(shop_id,doc_id,revision,created_at DESC,id DESC);
CREATE FUNCTION document_share_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Sharing history protected' USING ERRCODE='42501'; END IF;
 IF NEW.actor_id IS DISTINCT FROM nullif(current_setting('app.actor_id',true),'')::uuid
 OR NOT EXISTS(SELECT 1 FROM document_artifact a JOIN document_output o ON o.shop_id=a.shop_id AND o.id=a.output_id
 WHERE a.shop_id=NEW.shop_id AND a.doc_id=NEW.doc_id AND a.revision=NEW.revision AND o.sha256=NEW.sha256) THEN
 RAISE EXCEPTION 'Sharing provenance denied' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION document_share_guard() FROM PUBLIC;
CREATE TRIGGER document_share_history BEFORE INSERT OR UPDATE OR DELETE ON document_share_event FOR EACH ROW EXECUTE FUNCTION document_share_guard();
ALTER TABLE document_share_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_share_event FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON document_share_event AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON document_share_event FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON document_share_event FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT ON document_share_event TO app_user;
GRANT SELECT ON document_share_event TO app_backup;
