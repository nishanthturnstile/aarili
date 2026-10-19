// Disposable synthetic UI fixture only: retain the exact v1 accepted snapshot,
// remove acceptance-created structural rows to represent a pre-0031 order.
// Never imported by runtime packages or used with live records.
export async function seedHistoricalPieceOrder(admin, orderId) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw Error("Invalid synthetic order");
  await admin.query("begin");
  try {
    const r = await admin.query(
      "select s.content->>'synthetic' as synthetic,a.action from order_piece_set p join order_acceptance_snapshot s using(shop_id,order_id) join audit_event a on a.shop_id=p.shop_id and a.id=p.audit_id where p.order_id=$1",
      [orderId],
    );
    if (
      r.rows.length !== 1 ||
      r.rows[0].synthetic !== "true" ||
      r.rows[0].action !== "order.accept"
    )
      throw Error("Only new synthetic acceptance fixture allowed");
    for (const table of [
      "order_requirement_scope",
      "order_piece",
      "order_piece_set",
    ]) {
      await admin.query(
        `alter table ${table} disable trigger ${table}_immutable`,
      );
      await admin.query(`delete from ${table} where order_id=$1`, [orderId]);
      await admin.query(
        `alter table ${table} enable trigger ${table}_immutable`,
      );
    }
    await admin.query("commit");
  } catch (e) {
    await admin.query("rollback");
    throw e;
  }
}
