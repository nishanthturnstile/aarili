import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolveVocabulary, reviseVocabulary } from "@aarili/core/vocabulary";
import { createDatabase, sql, withShop } from "@aarili/db";
import { vocabularyRepository } from "@aarili/db/vocabulary-repository";
import { searchKeysV1 } from "@aarili/i18n/search";
import pg from "pg";
import { migrateDatabase } from "../migrate.mjs";
import { withPostgres } from "./postgres.mjs";
export async function withVocabularyFixture(run) {
  return withPostgres(async (configuration) => {
    await migrateDatabase(configuration.migrationConnectionString);
    const migration = new pg.Client({
      connectionString: configuration.migrationConnectionString,
    });
    const admin = new pg.Client({
      connectionString: configuration.adminConnectionString,
    });
    const runtime = createDatabase(configuration.connectionString, 4);
    const a = { user: randomUUID(), shop: randomUUID() },
      b = { user: randomUUID(), shop: randomUUID() };
    try {
      await migration.connect();
      await admin.connect();
      assert.equal(
        (
          await migration.query(
            "select to_regclass('synthetic_search_identity') as r",
          )
        ).rows[0].r,
        null,
      );
      await migration.query("BEGIN");
      await migration.query("SELECT pg_advisory_xact_lock(120021)");
      // Same approved extension as local infrastructure; disposable test DB only.
      await migration.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
      await migration.query(
        await readFile("tests/fixtures/vocabulary.sql", "utf8"),
      );
      await migration.query("COMMIT");
      for (const [identity, name] of [
        [a, "vocabulary-a"],
        [b, "vocabulary-b"],
      ]) {
        await admin.query(
          "insert into auth_user(id,name,email,email_verified) values($1,$2,$3,true)",
          [identity.user, `Synthetic ${name}`, `${name}@example.test`],
        );
        await admin.query("insert into shop(shop_id,name) values($1,$2)", [
          identity.shop,
          `Synthetic ${name}`,
        ]);
        await admin.query(
          "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
          [identity.shop, identity.user],
        );
      }
      return await run({ runtime, migration, admin, a, b });
    } finally {
      await migration.query("ROLLBACK").catch(() => {});
      await Promise.all([runtime.pool.end(), migration.end(), admin.end()]);
    }
  });
}
export const vocabularyInput = (overrides = {}) => ({
  labelTa: "ரவிக்கை",
  labelEn: "Blouse",
  aliases: ["ravikkai", "choli"],
  reason: "Synthetic vocabulary setup",
  ...overrides,
});
export const vocabularyRun = (f, work, identity = f.a) =>
  withShop(f.runtime.db, identity.user, identity.shop, (tx) =>
    work(tx, vocabularyRepository(tx, identity.shop)),
  );
export const vocabularyCommand = (
  f,
  id,
  input = vocabularyInput(),
  headers = {},
  identity = f.a,
) =>
  vocabularyRun(
    f,
    (_tx, repository) =>
      reviseVocabulary(
        { shopId: identity.shop, actorId: identity.user, repository },
        id,
        input,
        { key: randomUUID(), requestId: randomUUID(), ...headers },
      ),
    identity,
  );
export async function insertSearchIdentity(
  f,
  revision,
  {
    id = randomUUID(),
    name = "கண்ணு",
    phone = "+91 90000 01234",
    notes = "Original synthetic note",
  } = {},
) {
  const k = searchKeysV1(name, phone);
  await vocabularyRun(f, (tx) =>
    tx.execute(sql`insert into synthetic_search_identity(shop_id,id,display_name,original_notes,original_phone,algorithm_version,name_ta_norm,name_latin_norm,name_skel,phone_digits,vocabulary_id,referenced_revision_id)
 values(${f.a.shop}::uuid,${id}::uuid,${name},${notes},${phone},${k.algorithmVersion},${k.nameTaNorm},${k.nameLatinNorm},${k.nameSkel},${k.phoneDigits},${revision.vocabularyId}::uuid,${revision.id}::uuid)`),
  );
  return id;
}
// Test-only path; no route, CLI product surface or browser persistence.
export async function searchSynthetic(f, query, identity = f.a) {
  const k = searchKeysV1(query, query);
  return vocabularyRun(
    f,
    async (tx, repo) => {
      const terms = await resolveVocabulary(repo, query);
      const termIds = `{${terms.map((r) => r.vocabularyId).join(",")}}`;
      return (
        await tx.execute(sql`select i.id,i.display_name,i.original_notes,i.original_phone,r.label_ta,r.label_en,
   case when i.id::text=${query} or (${k.phoneDigits}<>'' and i.phone_digits=${k.phoneDigits})
    or (length(${k.phoneDigits})=4 and i.phone_last4=${k.phoneLast4})
    or (length(${k.phoneDigits})=6 and i.phone_last6=${k.phoneLast6}) then 0
    when i.vocabulary_id=any(${termIds}::uuid[]) then 1
    when starts_with(i.name_latin_norm,${k.nameLatinNorm}) then 2 else 3 end as rank
   from synthetic_search_identity i join vocabulary_revision r on r.shop_id=i.shop_id and r.id=i.referenced_revision_id
   where i.shop_id=${identity.shop}::uuid and i.algorithm_version=1 and (
    i.id::text=${query} or (${k.phoneDigits}<>'' and i.phone_digits=${k.phoneDigits})
    or i.vocabulary_id=any(${termIds}::uuid[])
    or (length(${k.phoneDigits})=4 and i.phone_last4=${k.phoneLast4})
    or (length(${k.phoneDigits})=6 and i.phone_last6=${k.phoneLast6})
    or (${k.nameLatinNorm}<>'' and starts_with(i.name_latin_norm,${k.nameLatinNorm}))
    or (${k.nameSkel}<>'' and i.name_skel=${k.nameSkel})
    or (${k.nameLatinNorm}<>'' and similarity(i.name_latin_norm,${k.nameLatinNorm})>=0.3)) order by rank,i.id`)
      ).rows;
    },
    identity,
  );
}
