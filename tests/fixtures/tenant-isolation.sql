-- Disposable synthetic records only. Not a production migration or feature.
CREATE TABLE isolation_parent (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL DEFAULT uuidv7(),
 label text NOT NULL, PRIMARY KEY(shop_id,id), UNIQUE(shop_id,label)
);
CREATE TABLE isolation_child (
 shop_id uuid NOT NULL REFERENCES shop(shop_id), id uuid NOT NULL DEFAULT uuidv7(),
 parent_id uuid NOT NULL, label text NOT NULL, PRIMARY KEY(shop_id,id),
 FOREIGN KEY(shop_id,parent_id) REFERENCES isolation_parent(shop_id,id)
);
ALTER TABLE isolation_parent ENABLE ROW LEVEL SECURITY;
ALTER TABLE isolation_parent FORCE ROW LEVEL SECURITY;
ALTER TABLE isolation_child ENABLE ROW LEVEL SECURITY;
ALTER TABLE isolation_child FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_context ON isolation_parent AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_context ON isolation_child AS RESTRICTIVE FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON isolation_parent FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
CREATE POLICY tenant_access ON isolation_child FOR ALL TO app_user
 USING(shop_context_allows(shop_id)) WITH CHECK(shop_context_allows(shop_id));
REVOKE ALL ON isolation_parent,isolation_child FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON isolation_parent,isolation_child TO app_user;
