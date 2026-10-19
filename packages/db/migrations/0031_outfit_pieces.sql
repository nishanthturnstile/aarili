-- 1.2.2a: additive structural records only. Never replace accepted snapshots.
-- Compatible rollback retains these rows; disable unsupported acceptance commands.
CREATE TABLE order_piece_set (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), order_id uuid NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version=1), order_version integer NOT NULL CHECK(order_version>0),
 snapshot_digest text NOT NULL CHECK(snapshot_digest ~ '^[a-f0-9]{64}$'),
 structure_digest text NOT NULL CHECK(structure_digest ~ '^[a-f0-9]{64}$'),
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object' AND octet_length(content::text)<=524288),
 actor_id uuid NOT NULL, audit_id uuid NOT NULL, command_key uuid NOT NULL, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),
 recorded_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,order_id),
 FOREIGN KEY(shop_id,order_id) REFERENCES order_acceptance_snapshot(shop_id,order_id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id)
);
CREATE TABLE order_piece (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), order_id uuid NOT NULL, id uuid NOT NULL DEFAULT uuidv7(),
 source_key text NOT NULL, entry_id uuid NOT NULL, revision_id uuid NOT NULL,
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
 PRIMARY KEY(shop_id,order_id,id), UNIQUE(shop_id,id), UNIQUE(shop_id,order_id,source_key),
 UNIQUE(shop_id,order_id,source_key,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES order_piece_set(shop_id,order_id),
 FOREIGN KEY(shop_id,entry_id,revision_id) REFERENCES service_catalogue_revision(shop_id,entry_id,id)
);
CREATE TABLE order_requirement_scope (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), order_id uuid NOT NULL, position integer NOT NULL CHECK(position>=0),
 piece_key text, piece_id uuid, addon_key text,
 CHECK(piece_id IS NULL OR piece_key IS NOT NULL),
 PRIMARY KEY(shop_id,order_id,position),
 FOREIGN KEY(shop_id,order_id) REFERENCES order_piece_set(shop_id,order_id),
 FOREIGN KEY(shop_id,order_id,position) REFERENCES order_requirement(shop_id,order_id,position),
 FOREIGN KEY(shop_id,order_id,piece_key,piece_id) REFERENCES order_piece(shop_id,order_id,source_key,id)
);
CREATE INDEX order_scope_piece ON order_requirement_scope(shop_id,order_id,piece_id,position);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['order_piece_set','order_piece','order_requirement_scope'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);
  EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION order_immutable_guard()',t||'_immutable',t);
 END LOOP;
END $policies$;
CREATE FUNCTION order_piece_set_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.order_acceptance_snapshot; o public.garment_order; p jsonb; ref jsonb; d jsonb; f jsonb;
 r jsonb; i jsonb; expected_piece text; expected_addon text; expected_form jsonb;
BEGIN
 SELECT * INTO s FROM order_acceptance_snapshot WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id;
 SELECT * INTO o FROM garment_order WHERE shop_id=NEW.shop_id AND id=NEW.order_id;
 IF s.order_id IS NULL OR NEW.snapshot_digest IS DISTINCT FROM s.digest OR NEW.order_version IS DISTINCT FROM o.version
  OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid
  OR NOT EXISTS(SELECT 1 FROM audit_event a WHERE a.shop_id=NEW.shop_id AND a.id=NEW.audit_id AND a.actor_id=NEW.actor_id AND a.entity_id=NEW.order_id AND a.idempotency_key=NEW.command_key AND a.action=(CASE WHEN o.created_xid=pg_current_xact_id() THEN 'order.accept' ELSE 'order.pieces.materialize' END))
  OR NEW.content->>'schemaVersion' IS DISTINCT FROM '1'
  OR jsonb_array_length(NEW.content->'pieces') IS DISTINCT FROM jsonb_array_length(s.content->'requirements'->'definition'->'pieces')
  OR jsonb_array_length(NEW.content->'requirements') IS DISTINCT FROM jsonb_array_length(s.content->'requirements'->'items')
 THEN RAISE EXCEPTION 'Piece provenance denied' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(NEW.content->'pieces') LOOP
  SELECT value INTO ref FROM jsonb_array_elements(s.content->'requirements'->'definition'->'pieces') WHERE value->>'key'=p->>'key';
  SELECT value INTO d FROM jsonb_array_elements(s.content->'snapshot'->'catalogue') WHERE value->>'id'=ref->>'revisionId' AND value->>'entryId'=ref->>'entryId';
  SELECT value INTO f FROM jsonb_array_elements(s.content->'requirements'->'definition'->'forms') WHERE value->>'pieceKey'=p->>'key';
  expected_form='null'::jsonb;
  IF f IS NOT NULL THEN
   SELECT jsonb_build_object('entryId',value->'entryId','revisionId',value->'id','labelEn',value->'content'->'labelEn','labelTa',value->'content'->'labelTa') INTO expected_form FROM jsonb_array_elements(s.content->'snapshot'->'forms') WHERE value->>'id'=f->>'revisionId' AND value->>'entryId'=f->>'entryId';
  END IF;
  IF ref IS NULL OR d->'content'->>'kind' IS DISTINCT FROM 'piece' OR expected_form IS NULL
   OR p IS DISTINCT FROM (ref || jsonb_build_object('labelEn',d->'content'->'labelEn','labelTa',d->'content'->'labelTa','form',expected_form))
  THEN RAISE EXCEPTION 'Piece source mismatch' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(NEW.content->'requirements') LOOP
  i=s.content->'requirements'->'items'->((r->>'position')::integer);
  expected_piece=NULL; expected_addon=NULL;
  IF i->>'section'='measurement' THEN
   SELECT value INTO ref FROM jsonb_array_elements(s.content->'requirements'->'definition'->'forms') WHERE i->>'key'=value->>'revisionId' OR starts_with(i->>'key',(value->>'revisionId')||':');
   IF ref IS NULL THEN RAISE EXCEPTION 'Measurement scope missing' USING ERRCODE='23514'; END IF;
   expected_piece=ref->>'pieceKey';
  ELSE
   SELECT value INTO ref FROM jsonb_array_elements(s.content->'requirements'->'definition'->(i->>'section')) WHERE value->>'key'=i->>'key';
   IF ref IS NULL THEN RAISE EXCEPTION 'Requirement scope missing' USING ERRCODE='23514'; END IF;
   expected_piece=ref->'scope'->>'pieceKey'; expected_addon=ref->'scope'->>'addonKey';
  END IF;
  IF i IS NULL OR r->>'pieceKey' IS DISTINCT FROM expected_piece OR r->>'addonKey' IS DISTINCT FROM expected_addon
  THEN RAISE EXCEPTION 'Requirement scope mismatch' USING ERRCODE='23514'; END IF;
 END LOOP;
 NEW.recorded_at=date_trunc('milliseconds',clock_timestamp()); NEW.created_xid=pg_current_xact_id(); RETURN NEW;
END $fn$;
CREATE TRIGGER order_piece_set_guard BEFORE INSERT ON order_piece_set FOR EACH ROW EXECUTE FUNCTION order_piece_set_guard();
CREATE FUNCTION order_piece_child_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.order_piece_set; p jsonb; r jsonb; expected_id uuid;
BEGIN
 SELECT * INTO s FROM order_piece_set WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id;
 IF s.order_id IS NULL OR s.created_xid<>pg_current_xact_id() THEN RAISE EXCEPTION 'Piece structure closed' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='order_piece' THEN
  SELECT value INTO p FROM jsonb_array_elements(s.content->'pieces') WHERE value->>'key'=NEW.source_key AND value->>'applicability'<>'not-applicable';
  IF p IS NULL OR NEW.content IS DISTINCT FROM p OR NEW.entry_id::text IS DISTINCT FROM p->>'entryId' OR NEW.revision_id::text IS DISTINCT FROM p->>'revisionId'
  THEN RAISE EXCEPTION 'Piece instance denied' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT value INTO r FROM jsonb_array_elements(s.content->'requirements') WHERE (value->>'position')::integer=NEW.position;
  SELECT id INTO expected_id FROM order_piece WHERE shop_id=NEW.shop_id AND order_id=NEW.order_id AND source_key=r->>'pieceKey';
  IF r IS NULL OR NEW.piece_key IS DISTINCT FROM r->>'pieceKey' OR NEW.addon_key IS DISTINCT FROM r->>'addonKey' OR NEW.piece_id IS DISTINCT FROM expected_id
  THEN RAISE EXCEPTION 'Piece requirement link denied' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER order_piece_insert BEFORE INSERT ON order_piece FOR EACH ROW EXECUTE FUNCTION order_piece_child_guard();
CREATE TRIGGER order_requirement_scope_insert BEFORE INSERT ON order_requirement_scope FOR EACH ROW EXECUTE FUNCTION order_piece_child_guard();
CREATE FUNCTION order_piece_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE s public.order_piece_set; o public.garment_order;
BEGIN
 IF TG_TABLE_NAME='garment_order' THEN SELECT * INTO s FROM order_piece_set WHERE shop_id=NEW.shop_id AND order_id=NEW.id;
 ELSE s=NEW; END IF;
 IF s.order_id IS NULL THEN RAISE EXCEPTION 'Piece structure incomplete' USING ERRCODE='23514'; END IF;
 SELECT * INTO o FROM garment_order WHERE shop_id=s.shop_id AND id=s.order_id;
 IF (SELECT count(*) FROM order_piece WHERE shop_id=s.shop_id AND order_id=s.order_id)<>(SELECT count(*) FROM jsonb_array_elements(s.content->'pieces') p WHERE p->>'applicability'<>'not-applicable')
 OR (SELECT count(*) FROM order_requirement_scope WHERE shop_id=s.shop_id AND order_id=s.order_id)<>jsonb_array_length(s.content->'requirements')
 OR NOT EXISTS(SELECT 1 FROM idempotency_key k WHERE k.shop_id=s.shop_id AND k.key=s.command_key AND k.actor_id=s.actor_id AND k.action=(CASE WHEN o.created_xid=s.created_xid THEN 'draft.promote' ELSE 'order.pieces.materialize' END))
 THEN RAISE EXCEPTION 'Piece command incomplete' USING ERRCODE='23514'; END IF; RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER order_piece_commit AFTER INSERT ON order_piece_set DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_piece_commit_guard();
CREATE CONSTRAINT TRIGGER order_piece_acceptance_commit AFTER INSERT ON garment_order DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION order_piece_commit_guard();
REVOKE ALL ON FUNCTION order_piece_set_guard(),order_piece_child_guard(),order_piece_commit_guard() FROM PUBLIC;
