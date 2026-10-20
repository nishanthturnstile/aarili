import assert from "node:assert/strict";
import pg from "pg";

// Historic synthetic setup only. Restore the actual reader before migration and
// all post-upgrade assertions. No application fallback or write is changed.
export async function withHistoricalCustomReader(admin, run) {
  assert.equal(
    (
      await admin.query(
        "select to_regclass('order_service_capacity_contribution') as relation",
      )
    ).rows[0].relation,
    null,
    "reader adapter requires a genuine pre-0035 schema",
  );
  const original = pg.Client.prototype.query;
  let rewrites = 0;
  pg.Client.prototype.query = function (query, ...args) {
    const text = typeof query === "string" ? query : query?.text;
    if (
      this.user === "app_user" &&
      text?.startsWith(
        "select 1 where exists(select 1 from service_property_subject",
      ) &&
      text.includes("or exists(select 1 from order_service_change_line")
    ) {
      const historic = text.replace(
        / or exists\(select 1 from order_service_change_line where shop_id=(\$\d+)::uuid and id in\(select value::uuid from jsonb_array_elements_text\((\$\d+)::jsonb\)\)\)/,
        " or ($1::uuid is null or $2::jsonb is null)",
      );
      assert.notEqual(
        historic,
        text,
        "historical service identity reader shape",
      );
      rewrites++;
      return original.call(
        this,
        typeof query === "string" ? historic : { ...query, text: historic },
        ...args,
      );
    }
    if (
      this.user === "app_user" &&
      text?.includes(
        "union all select change_id as id,quantity,unit,delivery_date from order_service_capacity_contribution",
      )
    ) {
      const historic = text.replace(
        / union all select change_id as id,quantity,unit,delivery_date from order_service_capacity_contribution where shop_id=(\$\d+)::uuid and category_id=(\$\d+)::uuid/,
        " and $1::uuid is not null and $2::uuid is not null",
      );
      assert.notEqual(historic, text, "historical demand adapter shape");
      rewrites++;
      return original.call(
        this,
        typeof query === "string" ? historic : { ...query, text: historic },
        ...args,
      );
    }
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
