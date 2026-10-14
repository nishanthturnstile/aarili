-- 0.3.1a synthetic proof ONLY; deliberately outside production migrations.
-- Installed as app_owner under the existing transaction advisory lock.
CREATE TABLE synthetic_money_value (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL DEFAULT uuidv7(),
 amount_paise bigint NOT NULL, length_mm bigint NOT NULL CHECK(length_mm >= 0),
 PRIMARY KEY(shop_id,id)
);
ALTER TABLE synthetic_money_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_money_value FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON synthetic_money_value AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON synthetic_money_value FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON synthetic_money_value FROM PUBLIC;
GRANT SELECT,INSERT ON synthetic_money_value TO app_user;
CREATE TRIGGER synthetic_money_immutable BEFORE UPDATE OR DELETE ON synthetic_money_value
 FOR EACH ROW EXECUTE FUNCTION reject_history_change();
-- Storage supports int8. A corrupt/imported out-of-wire-range value must be
-- rejected by the repository, never silently narrowed to a JSON number.
