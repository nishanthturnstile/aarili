-- 1.2.4c direct, non-authoritative reader. No history backfill or new personal
-- storage. Compatible rollback disables /customer-history and retains indexes.
CREATE INDEX history_customer_orders ON garment_order(shop_id,customer_id,wearer_id,id);
CREATE INDEX history_customer_relationships ON customer_wearer_relationship(shop_id,customer_id,wearer_id);
CREATE INDEX history_customer_bookings ON booking(shop_id,customer_id,id);
CREATE INDEX history_audit_order ON audit_event(shop_id,occurred_at DESC,entity_type,id DESC);
CREATE INDEX history_transition_audit ON service_line_transition(shop_id,audit_id);
CREATE INDEX history_booking_revision_audit ON booking_revision(shop_id,audit_id);
