-- 0.3.1c production infrastructure only. No commercial source tables, balances,
-- financial endpoints, tax/refund policies or provider configuration.
CREATE TABLE journal_batch (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL DEFAULT uuidv7(),
 source_id uuid NOT NULL, subject_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('posting','reversal','liability','settlement')),
 related_id uuid, reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 240),
 actor_id uuid NOT NULL, request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 audit_id uuid NOT NULL, command_key uuid NOT NULL,
 entry_count integer NOT NULL CHECK(entry_count BETWEEN 2 AND 5),
 created_at timestamptz NOT NULL DEFAULT now(), created_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(shop_id,id), UNIQUE(shop_id,source_id), UNIQUE(shop_id,related_id,kind),
 FOREIGN KEY(shop_id,related_id) REFERENCES journal_batch(shop_id,id),
 FOREIGN KEY(shop_id,audit_id) REFERENCES audit_event(shop_id,id),
 CHECK((kind='posting' AND related_id IS NULL) OR (kind<>'posting' AND related_id IS NOT NULL)),
 CHECK(related_id IS DISTINCT FROM id)
);
CREATE INDEX journal_batch_subject ON journal_batch(shop_id,subject_id,id);
CREATE TABLE journal_entry (
 shop_id uuid NOT NULL, batch_id uuid NOT NULL,
 account text NOT NULL CHECK(account IN ('cash','receivable','revenue','deposit','refund')),
 amount_paise bigint NOT NULL CHECK(amount_paise <> 0 AND amount_paise BETWEEN -9007199254740991 AND 9007199254740991),
 PRIMARY KEY(shop_id,batch_id,account),
 FOREIGN KEY(shop_id,batch_id) REFERENCES journal_batch(shop_id,id)
);
ALTER TABLE journal_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_batch FORCE ROW LEVEL SECURITY;
ALTER TABLE journal_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON journal_batch AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON journal_batch FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_context ON journal_entry AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON journal_entry FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON journal_batch,journal_entry FROM PUBLIC,app_user,app_privacy;
GRANT SELECT ON journal_batch,journal_entry TO app_user;
GRANT INSERT(shop_id,id,source_id,subject_id,kind,related_id,reason,actor_id,request_hash,audit_id,command_key,entry_count) ON journal_batch TO app_user;
GRANT INSERT ON journal_entry TO app_user;
-- app_backup's existing owner default privileges give SELECT only.
CREATE TRIGGER journal_batch_immutable BEFORE UPDATE OR DELETE ON journal_batch FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER journal_entry_immutable BEFORE UPDATE OR DELETE ON journal_entry FOR EACH ROW EXECUTE FUNCTION reject_history_change();

CREATE FUNCTION journal_open_batch() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE b public.journal_batch%ROWTYPE;
BEGIN
 -- Serial subject writes and fresh statement snapshots protect aggregate bounds.
 -- Alternate snapshot isolation must fail closed rather than use stale totals.
 IF current_setting('transaction_isolation') <> 'read committed' THEN
  RAISE EXCEPTION 'Journal isolation denied' USING ERRCODE='40001';
 END IF;
 IF TG_TABLE_NAME='journal_batch' THEN
  IF NOT COALESCE(public.shop_context_allows(NEW.shop_id),false)
   OR NEW.actor_id IS DISTINCT FROM NULLIF(current_setting('app.actor_id',true),'')::uuid THEN
   RAISE EXCEPTION 'Journal provenance denied' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('aarili:journal:'||NEW.shop_id::text||':'||NEW.subject_id::text,0));
  NEW.created_xid=pg_current_xact_id(); NEW.created_at=now();
 ELSE
  SELECT * INTO b FROM public.journal_batch WHERE shop_id=NEW.shop_id AND id=NEW.batch_id;
  IF NOT FOUND OR b.created_xid <> pg_current_xact_id() THEN
   RAISE EXCEPTION 'Committed journal is sealed' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER journal_batch_open BEFORE INSERT ON journal_batch FOR EACH ROW EXECUTE FUNCTION journal_open_batch();
CREATE TRIGGER journal_entry_open BEFORE INSERT ON journal_entry FOR EACH ROW EXECUTE FUNCTION journal_open_batch();

CREATE FUNCTION journal_commit_check() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE b public.journal_batch%ROWTYPE; target public.journal_batch%ROWTYPE;
 batch uuid; n integer; net numeric; debit numeric; liability bigint;
BEGIN
 IF TG_TABLE_NAME='journal_batch' THEN batch=NEW.id; ELSE batch=NEW.batch_id; END IF;
 SELECT * INTO STRICT b FROM public.journal_batch WHERE shop_id=NEW.shop_id AND id=batch;
 SELECT count(*),sum(amount_paise),sum(CASE WHEN amount_paise>0 THEN amount_paise ELSE 0 END)
 INTO n,net,debit FROM public.journal_entry WHERE shop_id=b.shop_id AND batch_id=b.id;
 IF n<>b.entry_count OR net IS DISTINCT FROM 0::numeric OR debit>9007199254740991 THEN
  RAISE EXCEPTION 'Journal incomplete, unbalanced or out of range' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.journal_entry e JOIN public.journal_batch j ON j.shop_id=e.shop_id AND j.id=e.batch_id
  WHERE j.shop_id=b.shop_id AND j.subject_id=b.subject_id GROUP BY e.account HAVING abs(sum(e.amount_paise))>9007199254740991) THEN
  RAISE EXCEPTION 'Journal aggregate out of range' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_event a WHERE a.shop_id=b.shop_id AND a.id=b.audit_id
  AND a.actor_type='user' AND a.actor_id=b.actor_id AND a.action='journal.'||b.kind
  AND a.entity_type='journal_batch' AND a.entity_id=b.id AND a.idempotency_key=b.command_key AND a.reason=b.reason
  AND a.source_event_id IS NOT DISTINCT FROM (SELECT audit_id FROM public.journal_batch WHERE shop_id=b.shop_id AND id=b.related_id))
 OR NOT EXISTS(SELECT 1 FROM public.idempotency_key k WHERE k.shop_id=b.shop_id AND k.key=b.command_key
  AND k.actor_type='user' AND k.actor_id=b.actor_id AND k.action='journal.'||b.kind AND k.request_hash=b.request_hash
  AND k.status=200 AND k.response=jsonb_build_object('id',b.id::text)) THEN
  RAISE EXCEPTION 'Journal atomic provenance missing' USING ERRCODE='23514';
 END IF;
 IF b.related_id IS NOT NULL THEN
  SELECT * INTO STRICT target FROM public.journal_batch WHERE shop_id=b.shop_id AND id=b.related_id;
  IF target.subject_id<>b.subject_id OR target.kind='reversal' THEN
   RAISE EXCEPTION 'Journal link denied' USING ERRCODE='23514';
  END IF;
  IF b.kind='reversal' THEN
   IF EXISTS(SELECT 1 FROM public.journal_batch WHERE shop_id=b.shop_id AND related_id=target.id AND kind IN('settlement','liability'))
    OR EXISTS(SELECT account FROM public.journal_entry WHERE shop_id=b.shop_id AND batch_id IN(b.id,target.id)
      GROUP BY account HAVING sum(amount_paise)<>0 OR count(*)<>2) THEN
    RAISE EXCEPTION 'Journal reversal denied' USING ERRCODE='23514';
   END IF;
  ELSIF b.kind='liability' THEN
   SELECT -amount_paise INTO liability FROM public.journal_entry WHERE shop_id=b.shop_id AND batch_id=target.id AND account='deposit';
   IF liability IS NULL OR liability<=0 OR n<>2
    OR NOT EXISTS(SELECT 1 FROM public.journal_entry WHERE shop_id=b.shop_id AND batch_id=b.id AND account='deposit' AND amount_paise=liability)
    OR NOT EXISTS(SELECT 1 FROM public.journal_entry WHERE shop_id=b.shop_id AND batch_id=b.id AND account='refund' AND amount_paise=-liability)
    OR EXISTS(SELECT 1 FROM public.journal_batch WHERE shop_id=b.shop_id AND related_id=target.id AND kind='reversal') THEN
    RAISE EXCEPTION 'Journal liability denied' USING ERRCODE='23514';
   END IF;
  ELSE
   SELECT -amount_paise INTO liability FROM public.journal_entry WHERE shop_id=b.shop_id AND batch_id=target.id AND account='refund';
   IF liability IS NULL OR liability<=0 OR n<>2
    OR NOT EXISTS(SELECT 1 FROM public.journal_entry WHERE shop_id=b.shop_id AND batch_id=b.id AND account='refund' AND amount_paise=liability)
    OR NOT EXISTS(SELECT 1 FROM public.journal_entry WHERE shop_id=b.shop_id AND batch_id=b.id AND account='cash' AND amount_paise=-liability)
    OR EXISTS(SELECT 1 FROM public.journal_batch WHERE shop_id=b.shop_id AND related_id=target.id AND kind='reversal') THEN
    RAISE EXCEPTION 'Journal settlement denied' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER journal_batch_balanced AFTER INSERT ON journal_batch DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION journal_commit_check();
CREATE CONSTRAINT TRIGGER journal_entry_balanced AFTER INSERT ON journal_entry DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION journal_commit_check();
REVOKE ALL ON FUNCTION journal_open_batch(),journal_commit_check() FROM PUBLIC;
