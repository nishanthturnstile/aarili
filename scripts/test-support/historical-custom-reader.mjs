import assert from "node:assert/strict";
import pg from "pg";

// Historic synthetic setup only. Restore the actual reader before migration and
// all post-upgrade assertions. No application fallback or write is changed.
export async function withHistoricalCustomReader(admin, run) {
  assert.equal(
    (
      await admin.query(
        "select count(*)::int n from information_schema.columns where table_schema='public' and table_name='garment_order' and column_name='intake_kind'",
      )
    ).rows[0].n,
    0,
    "reader adapter requires a genuine pre-0034 schema",
  );
  const original = pg.Client.prototype.query;
  let rewrites = 0;
  pg.Client.prototype.query = function (query, ...args) {
    const text = typeof query === "string" ? query : query?.text;
    if (
      this.user === "app_user" &&
      text?.startsWith("select o.id,o.code,o.origin_draft_id") &&
      text.includes("from garment_order o join order_acceptance_snapshot s") &&
      text.includes(" and o.intake_kind='custom'")
    ) {
      const historic = text.replace(" and o.intake_kind='custom'", "");
      rewrites++;
      return original.call(
        this,
        typeof query === "string" ? historic : { ...query, text: historic },
        ...args,
      );
    }
    return original.call(this, query, ...args);
  };
  try {
    const result = await run();
    assert(rewrites > 0, "historic reader adapter was exercised");
    return result;
  } finally {
    pg.Client.prototype.query = original;
  }
}
