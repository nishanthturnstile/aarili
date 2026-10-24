-- FIN-10/11/12/13, 1.4.2a. Synthetic-only admission; no legacy advance backfill.
ALTER TABLE journal_entry DROP CONSTRAINT journal_entry_account_check;
ALTER TABLE journal_entry ADD CONSTRAINT journal_entry_account_check CHECK(account IN ('cash','electronic','receivable','revenue','deposit','refund'));
CREATE TABLE payment_receipt(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,customer_id uuid NOT NULL,payer_id uuid NOT NULL,
 order_id uuid,booking_id uuid,origin_draft_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,origin_draft_id),
 FOREIGN KEY(shop_id,customer_id) REFERENCES customer(shop_id,id),FOREIGN KEY(shop_id,payer_id) REFERENCES customer(shop_id,id),
 FOREIGN KEY(shop_id,order_id) REFERENCES garment_order(shop_id,id),FOREIGN KEY(shop_id,booking_id) REFERENCES booking(shop_id,id),
 FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id)
);
CREATE INDEX payment_customer ON payment_receipt(shop_id,customer_id,id);
CREATE INDEX payment_payer ON payment_receipt(shop_id,payer_id,id);
CREATE TABLE payment_event(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),id uuid NOT NULL,receipt_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),previous_id uuid,
 status text NOT NULL CHECK(status IN ('pending','confirmed','failed')),amount_paise bigint NOT NULL CHECK(amount_paise BETWEEN 1 AND 9007199254740991),
 method text NOT NULL CHECK(method IN ('cash','upi','bank')),payment_date date NOT NULL,account_id uuid,account_revision_id uuid,profile_id uuid NOT NULL,
 reference text NOT NULL CHECK(length(reference)<=1000),reason text NOT NULL CHECK(length(reason)<=1000),
 attestation text NOT NULL CHECK(attestation IN ('none','cash-received','upi-seen')),restore_epoch uuid,
 actor_id uuid NOT NULL,origin_draft_id uuid NOT NULL,command_key uuid NOT NULL,audit_id uuid NOT NULL,journal_id uuid,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(shop_id,id),UNIQUE(shop_id,receipt_id,version),UNIQUE(shop_id,receipt_id,id),UNIQUE(shop_id,origin_draft_id),UNIQUE(shop_id,journal_id),
 FOREIGN KEY(shop_id,receipt_id) REFERENCES payment_receipt(shop_id,id),FOREIGN KEY(shop_id,receipt_id,previous_id) REFERENCES payment_event(shop_id,receipt_id,id),
 FOREIGN KEY(shop_id,account_revision_id) REFERENCES shop_directory_revision(shop_id,id),FOREIGN KEY(shop_id,profile_id) REFERENCES shop_profile_revision(shop_id,id),
 FOREIGN KEY(shop_id,actor_id) REFERENCES shop_membership(shop_id,user_id),FOREIGN KEY(shop_id,origin_draft_id) REFERENCES durable_draft(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),FOREIGN KEY(shop_id,journal_id) REFERENCES journal_batch(shop_id,id) DEFERRABLE INITIALLY DEFERRED,
 CHECK((method='cash' AND account_id IS NULL AND account_revision_id IS NULL) OR (method<>'cash' AND account_id IS NOT NULL AND account_revision_id IS NOT NULL)),
 CHECK((status='confirmed' AND journal_id IS NOT NULL AND restore_epoch IS NOT NULL AND ((method='cash' AND attestation='cash-received') OR (method='upi' AND attestation='upi-seen'))) OR (status<>'confirmed' AND journal_id IS NULL AND attestation='none'))
);
CREATE UNIQUE INDEX payment_one_confirmation ON payment_event(shop_id,receipt_id) WHERE status='confirmed';
CREATE TABLE payment_reference_claim(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),upi_reference_key text NOT NULL CHECK(length(upi_reference_key) BETWEEN 1 AND 1000),receipt_id uuid NOT NULL,
 PRIMARY KEY(shop_id,upi_reference_key),FOREIGN KEY(shop_id,receipt_id) REFERENCES payment_receipt(shop_id,id)
);
CREATE INDEX payment_claim_receipt ON payment_reference_claim(shop_id,receipt_id);
CREATE TABLE payment_result(
 shop_id uuid NOT NULL REFERENCES shop(shop_id),draft_id uuid NOT NULL,event_id uuid NOT NULL,
 PRIMARY KEY(shop_id,draft_id),FOREIGN KEY(shop_id,draft_id) REFERENCES durable_draft(shop_id,id),FOREIGN KEY(shop_id,event_id) REFERENCES payment_event(shop_id,id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['payment_receipt','payment_event','payment_reference_claim','payment_result'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_context ON %I AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('CREATE POLICY tenant_access ON %I FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id))',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,app_user,app_privacy',t);EXECUTE format('GRANT SELECT,INSERT ON %I TO app_user',t);EXECUTE format('GRANT SELECT ON %I TO app_backup',t);
  EXECUTE format('CREATE TRIGGER payment_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_history_change()',t);
 END LOOP;
END $policies$;
CREATE FUNCTION payment_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE r public.payment_receipt;p public.payment_event;account public.shop_directory_revision;enabled jsonb; BEGIN
 PERFORM pg_advisory_xact_lock_shared(120036);
 -- Directory is locked before receipt state, including direct runtime inserts.
 PERFORM pg_advisory_xact_lock(hashtextextended('directory:'||NEW.shop_id::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:payment:'||NEW.shop_id::text||':'||NEW.receipt_id::text,0));
 SELECT * INTO STRICT r FROM payment_receipt WHERE shop_id=NEW.shop_id AND id=NEW.receipt_id;
 SELECT * INTO p FROM payment_event WHERE shop_id=NEW.shop_id AND receipt_id=NEW.receipt_id ORDER BY version DESC LIMIT 1;
 IF NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid OR NEW.previous_id IS DISTINCT FROM p.id OR NEW.version<>coalesce(p.version,0)+1 OR p.status IN ('confirmed','failed') OR
  NOT EXISTS(SELECT 1 FROM customer c JOIN customer_person cp ON(cp.shop_id,cp.id)=(c.shop_id,c.person_id) WHERE c.shop_id=r.shop_id AND c.id=r.customer_id AND cp.synthetic) OR
  NOT EXISTS(SELECT 1 FROM customer c JOIN customer_person cp ON(cp.shop_id,cp.id)=(c.shop_id,c.person_id) WHERE c.shop_id=r.shop_id AND c.id=r.payer_id AND cp.synthetic) OR
  (p.id IS NOT NULL AND NEW.status<>'pending' AND (NEW.amount_paise,NEW.method,NEW.payment_date,NEW.reference,NEW.profile_id) IS DISTINCT FROM (p.amount_paise,p.method,p.payment_date,p.reference,p.profile_id)) OR
  (NEW.version>1 AND NEW.status IN ('pending','failed') AND length(btrim(NEW.reason))=0) THEN RAISE EXCEPTION 'Payment state/authority conflict' USING ERRCODE='23514'; END IF;
 SELECT v.content->'enabled' INTO enabled FROM shop_directory d JOIN shop_directory_revision v ON (v.shop_id,v.id)=(d.shop_id,d.current_revision_id) WHERE d.shop_id=NEW.shop_id AND v.content->>'kind'='methods';
 -- The destination must be the exact current active revision, never a silently refreshed snapshot.
 IF NEW.status<>'failed' AND NEW.account_revision_id IS NOT NULL THEN
  SELECT * INTO account FROM shop_directory_revision WHERE shop_id=NEW.shop_id AND id=NEW.account_revision_id;
  IF account.entry_id IS DISTINCT FROM NEW.account_id OR account.content->>'kind'<>'account' OR account.content->>'method'<>NEW.method OR account.content->>'active'<>'true' OR NOT EXISTS(SELECT 1 FROM shop_directory WHERE shop_id=NEW.shop_id AND entry_id=NEW.account_id AND current_revision_id=NEW.account_revision_id) THEN RAISE EXCEPTION 'Receiving account changed' USING ERRCODE='23514';END IF;
 END IF;
 IF NEW.status<>'failed' AND NOT coalesce(enabled ? NEW.method,false) THEN RAISE EXCEPTION 'Receiving method disabled' USING ERRCODE='23514';END IF;
 IF NEW.status='confirmed' AND (NOT EXISTS(SELECT 1 FROM system_state WHERE singleton AND NOT money_frozen AND restore_epoch=NEW.restore_epoch) OR NOT EXISTS(SELECT 1 FROM shop WHERE shop_id=NEW.shop_id AND NOT is_practice)) THEN RAISE EXCEPTION 'Financial mutation frozen' USING ERRCODE='23514';END IF;
 NEW.recorded_at=clock_timestamp();RETURN NEW;
END $fn$;
CREATE TRIGGER payment_state BEFORE INSERT ON payment_event FOR EACH ROW EXECUTE FUNCTION payment_event_guard();
CREATE FUNCTION payment_commit_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE e public.payment_event;r public.payment_receipt;j public.journal_batch;d public.durable_draft; BEGIN
 IF TG_TABLE_NAME='payment_receipt' THEN
  IF NOT EXISTS(SELECT 1 FROM payment_event WHERE shop_id=NEW.shop_id AND receipt_id=NEW.id AND version=1) THEN RAISE EXCEPTION 'Payment origin requires event' USING ERRCODE='23514';END IF;RETURN NULL;
 END IF;
 IF TG_TABLE_NAME='payment_result' THEN
  SELECT * INTO d FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.draft_id;
  SELECT * INTO e FROM payment_event WHERE shop_id=NEW.shop_id AND id=NEW.event_id;
  IF d.workflow<>'payment.receipt' OR d.lifecycle<>'promoted' OR d.result_type<>'payment.receipt' OR d.result_id<>NEW.draft_id OR coalesce((d.payload->>'receiptId')::uuid,d.id)<>e.receipt_id THEN RAISE EXCEPTION 'Payment result provenance missing' USING ERRCODE='23514';END IF;RETURN NULL;
 END IF;
 IF TG_TABLE_NAME='payment_reference_claim' THEN
  IF NOT EXISTS(SELECT 1 FROM payment_event WHERE shop_id=NEW.shop_id AND receipt_id=NEW.receipt_id AND method='upi' AND btrim(reference,E' \t\n\v\f\r')=NEW.upi_reference_key) THEN RAISE EXCEPTION 'Reference claim requires exact event' USING ERRCODE='23514';END IF;RETURN NULL;
 END IF;
 e=NEW;SELECT * INTO STRICT r FROM payment_receipt WHERE shop_id=e.shop_id AND id=e.receipt_id;
 SELECT * INTO STRICT d FROM durable_draft WHERE shop_id=e.shop_id AND id=e.origin_draft_id;
 IF d.workflow<>'payment.receipt' OR d.lifecycle<>'promoted' OR d.result_id<>e.origin_draft_id OR d.result_type<>'payment.receipt'
 OR (d.payload->>'customerId')::uuid IS DISTINCT FROM r.customer_id OR (d.payload->>'payerId')::uuid IS DISTINCT FROM r.payer_id
 OR (d.payload->>'orderId')::uuid IS DISTINCT FROM r.order_id OR (d.payload->>'bookingId')::uuid IS DISTINCT FROM r.booking_id
 OR (d.payload->>'expectedVersion')::integer<>e.version-1 OR (d.payload->>'amountText')::numeric*100<>e.amount_paise
 OR d.payload->>'method' IS DISTINCT FROM e.method OR (d.payload->>'paymentDate')::date IS DISTINCT FROM e.payment_date
 OR d.payload->>'reference' IS DISTINCT FROM e.reference OR d.payload->>'reason' IS DISTINCT FROM e.reason
 OR (d.payload->>'accountId')::uuid IS DISTINCT FROM e.account_id OR (d.payload->>'accountRevisionId')::uuid IS DISTINCT FROM e.account_revision_id
 OR (d.payload->>'profileId')::uuid IS DISTINCT FROM e.profile_id
 OR (e.status='confirmed' AND ((d.payload->>'attested')::boolean IS DISTINCT FROM true OR d.payload->>'action' IS DISTINCT FROM e.attestation OR (d.payload->>'restoreEpoch')::uuid IS DISTINCT FROM e.restore_epoch))
 OR (e.status='pending' AND d.payload->>'action' NOT IN ('report','correct')) OR (e.status='failed' AND d.payload->>'action'<>'fail')
 THEN RAISE EXCEPTION 'Exact reviewed payment command required' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM audit_event WHERE shop_id=e.shop_id AND id=e.audit_id AND actor_id=e.actor_id AND action='payment.'||e.status AND entity_id=e.receipt_id AND idempotency_key=e.command_key AND (xmin::text)::xid8=pg_current_xact_id()) OR NOT EXISTS(SELECT 1 FROM payment_result WHERE shop_id=e.shop_id AND draft_id=e.origin_draft_id AND event_id=e.id) THEN RAISE EXCEPTION 'Atomic payment provenance required' USING ERRCODE='23514';END IF;
 IF e.method='upi' AND btrim(e.reference,E' \t\n\v\f\r')<>'' AND NOT EXISTS(SELECT 1 FROM payment_reference_claim WHERE shop_id=e.shop_id AND receipt_id=e.receipt_id AND upi_reference_key=btrim(e.reference,E' \t\n\v\f\r')) THEN RAISE EXCEPTION 'UPI claim required' USING ERRCODE='23514';END IF;
 IF e.status='confirmed' THEN
  SELECT * INTO STRICT j FROM journal_batch WHERE shop_id=e.shop_id AND id=e.journal_id;
  IF j.source_id<>e.receipt_id OR j.subject_id<>r.customer_id OR j.kind<>'posting' OR j.entry_count<>2 OR NOT EXISTS(SELECT 1 FROM journal_entry WHERE shop_id=e.shop_id AND batch_id=j.id AND account='deposit' AND amount_paise=-e.amount_paise) OR NOT EXISTS(SELECT 1 FROM journal_entry WHERE shop_id=e.shop_id AND batch_id=j.id AND account=CASE e.method WHEN 'cash' THEN 'cash' ELSE 'electronic' END AND amount_paise=e.amount_paise) THEN RAISE EXCEPTION 'Exact deposit journal required' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $fn$;
DO $deferred$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['payment_receipt','payment_event','payment_reference_claim','payment_result'] LOOP EXECUTE format('CREATE CONSTRAINT TRIGGER payment_atomic AFTER INSERT ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payment_commit_guard()',t);END LOOP;END $deferred$;
CREATE FUNCTION payment_merge_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM payment_receipt WHERE shop_id=NEW.shop_id AND (customer_id IN (NEW.source_id,NEW.survivor_id) OR payer_id IN (NEW.source_id,NEW.survivor_id))) THEN RAISE EXCEPTION 'Payment ownership requires governed relink' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER payment_identity BEFORE INSERT ON customer_merge_event FOR EACH ROW EXECUTE FUNCTION payment_merge_guard();
CREATE FUNCTION payment_origin_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('aarili:contact-merge:'||NEW.shop_id::text,0));
 IF NEW.id<>NEW.origin_draft_id OR NOT EXISTS(SELECT 1 FROM durable_draft WHERE shop_id=NEW.shop_id AND id=NEW.origin_draft_id AND workflow='payment.receipt')
 OR (NEW.booking_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM booking WHERE shop_id=NEW.shop_id AND id=NEW.booking_id AND customer_id=NEW.customer_id))
 OR (NEW.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM garment_order o WHERE o.shop_id=NEW.shop_id AND o.id=NEW.order_id AND coalesce((SELECT current_customer_id FROM customer_order_attribution a WHERE(a.shop_id,a.order_id)=(o.shop_id,o.id) ORDER BY version DESC LIMIT 1),o.customer_id)=NEW.customer_id AND (NEW.booking_id IS NULL OR EXISTS(SELECT 1 FROM booking_member WHERE shop_id=o.shop_id AND order_id=o.id AND booking_id=NEW.booking_id))))
 OR EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(source_id) mode FROM customer_merge_event WHERE shop_id=NEW.shop_id AND source_id IN (NEW.customer_id,NEW.payer_id) ORDER BY source_id,version DESC)m WHERE mode='merge')
 THEN RAISE EXCEPTION 'Payment origin/scope conflict' USING ERRCODE='23514';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER payment_origin BEFORE INSERT ON payment_receipt FOR EACH ROW EXECUTE FUNCTION payment_origin_guard();
REVOKE ALL ON FUNCTION payment_origin_guard() FROM PUBLIC;
CREATE FUNCTION payment_journal_correction_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF NEW.related_id IS NOT NULL AND EXISTS(SELECT 1 FROM payment_event WHERE shop_id=NEW.shop_id AND journal_id=NEW.related_id) THEN RAISE EXCEPTION 'Payment corrections await governed adjustment workflow' USING ERRCODE='42501';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER payment_journal_correction BEFORE INSERT ON journal_batch FOR EACH ROW EXECUTE FUNCTION payment_journal_correction_guard();
REVOKE ALL ON FUNCTION payment_journal_correction_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION payment_event_guard(),payment_commit_guard(),payment_merge_guard() FROM PUBLIC;
