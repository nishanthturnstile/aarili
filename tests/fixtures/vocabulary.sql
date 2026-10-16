-- Synthetic identities only: no customer table in application migrations.
CREATE TABLE synthetic_search_identity (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL,
 display_name text NOT NULL, original_notes text NOT NULL, original_phone text NOT NULL,
 algorithm_version integer NOT NULL CHECK(algorithm_version=1),
 name_ta_norm text NOT NULL,name_latin_norm text NOT NULL,name_skel text NOT NULL,
 phone_digits text NOT NULL,
 phone_last4 text GENERATED ALWAYS AS (CASE WHEN length(phone_digits)>=4 THEN right(phone_digits,4) END) STORED,
 phone_last6 text GENERATED ALWAYS AS (CASE WHEN length(phone_digits)>=6 THEN right(phone_digits,6) END) STORED,
 vocabulary_id uuid NOT NULL, referenced_revision_id uuid NOT NULL,
 PRIMARY KEY(shop_id,id),
 FOREIGN KEY(shop_id,vocabulary_id,referenced_revision_id) REFERENCES vocabulary_revision(shop_id,vocabulary_id,id)
);
CREATE INDEX synthetic_search_phone ON synthetic_search_identity(shop_id,phone_digits);
CREATE INDEX synthetic_search_last4 ON synthetic_search_identity(shop_id,phone_last4);
CREATE INDEX synthetic_search_last6 ON synthetic_search_identity(shop_id,phone_last6);
ALTER TABLE synthetic_search_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthetic_search_identity FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON synthetic_search_identity AS RESTRICTIVE FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON synthetic_search_identity FOR ALL TO app_user USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON synthetic_search_identity FROM PUBLIC,app_user,app_privacy;
GRANT SELECT,INSERT ON synthetic_search_identity TO app_user;
