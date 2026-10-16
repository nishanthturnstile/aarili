import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { VocabularyFailure } from "@aarili/core/vocabulary";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { test } from "vitest";
import {
  insertSearchIdentity,
  searchSynthetic,
  vocabularyCommand,
  vocabularyInput,
  vocabularyRun,
  withVocabularyFixture,
} from "../scripts/test-support/vocabulary-fixture.mjs";

const status = (expected) => (error) =>
  error instanceof VocabularyFailure && error.status === expected;
const databaseCode = (expected) => (error) =>
  (error.cause?.code ?? error.code) === expected;
const counts = async (f) =>
  (
    await f.admin.query(
      `select (select count(*)::int from vocabulary) as heads,(select count(*)::int from vocabulary_revision) as revisions,(select count(*)::int from vocabulary_search_key) as keys,(select count(*)::int from audit_event) as audits,(select count(*)::int from idempotency_key) as commands`,
    )
  ).rows[0];
test("0.4.1c C3 C5 USE-02 DAY-04 AC-02 current vocabulary aliases and immutable historical labels with distinct identities", async () => {
  await withVocabularyFixture(async (f) => {
    const id = randomUUID(),
      original = vocabularyInput();
    const r1 = await vocabularyCommand(f, id, original);
    const identities = [
      await insertSearchIdentity(f, r1),
      await insertSearchIdentity(f, r1, {
        name: "Kannu",
        notes: "Distinct synthetic wearer",
      }),
    ];
    for (const query of [
      "கண்ணு",
      "kannu",
      "ravikkai",
      "choli",
      "Blouse",
      "1234",
      "001234",
      "+91 90000 01234",
    ]) {
      const rows = await searchSynthetic(f, query);
      assert.deepEqual(rows.map((r) => r.id).sort(), [...identities].sort());
    }
    assert.equal((await searchSynthetic(f, "")).length, 0);
    for (const query of ["123", "01234"])
      assert.equal((await searchSynthetic(f, query)).length, 0);
    assert.equal(
      (await searchSynthetic(f, identities[0])).at(0)?.id,
      identities[0],
    );
    const other = await insertSearchIdentity(f, r1, {
      name: "Synthetic Kavitha",
      phone: "90000 05678",
    });
    assert.equal((await searchSynthetic(f, "Synthetic Kav")).at(0)?.id, other);
    assert.equal(
      (await searchSynthetic(f, "Synthetic Kavita")).at(0)?.id,
      other,
    );
    const r2 = await vocabularyCommand(
      f,
      id,
      vocabularyInput({
        labelTa: "புதிய ரவிக்கை",
        labelEn: "New blouse",
        aliases: ["new-only"],
      }),
      { ifMatch: '"v1"' },
    );
    assert.equal(r2.revision, 2);
    assert.equal(r2.previousId, r1.id);
    assert.equal((await searchSynthetic(f, "choli")).length, 0);
    const rows = await searchSynthetic(f, "new-only");
    assert.equal(rows.length, 3);
    assert(
      rows.every(
        (r) =>
          r.label_ta === original.labelTa && r.label_en === original.labelEn,
      ),
    );
    assert.equal(rows.find((r) => r.id === identities[0]).display_name, "கண்ணு");
    assert.equal(
      rows.find((r) => r.id === identities[1]).original_notes,
      "Distinct synthetic wearer",
    );
    assert.equal((await searchSynthetic(f, "new-only", f.b)).length, 0);
    const before = await counts(f);
    for (const table of ["vocabulary_revision", "vocabulary_search_key"]) {
      await assert.rejects(() =>
        vocabularyRun(f, (tx) =>
          tx.execute(sql.raw(`update ${table} set shop_id=shop_id`)),
        ),
      );
      await assert.rejects(() =>
        vocabularyRun(f, (tx) => tx.execute(sql.raw(`delete from ${table}`))),
      );
    }
    await assert.rejects(() =>
      vocabularyRun(f, (tx) =>
        tx.execute(
          sql`insert into vocabulary_search_key(shop_id,revision_id,algorithm_version,ordinal,original_text,name_ta_norm,name_latin_norm,name_skel) values(${f.a.shop}::uuid,${r1.id}::uuid,1,99,'late','','','')`,
        ),
      ),
    );
    assert.deepEqual(await counts(f), before);
  });
}, 120000);
test("0.4.1c C3 command replay binding retry concurrency preconditions and atomic failure", async () => {
  await withVocabularyFixture(async (f) => {
    const id = randomUUID(),
      key = randomUUID(),
      headers = { key };
    const [r1, replay] = await Promise.all([
      vocabularyCommand(f, id, vocabularyInput(), headers),
      vocabularyCommand(f, id, vocabularyInput(), headers),
    ]);
    assert.deepEqual(r1, replay);
    assert.deepEqual(await counts(f), {
      heads: 1,
      revisions: 1,
      keys: 4,
      audits: 1,
      commands: 1,
    });
    await assert.rejects(
      () =>
        vocabularyCommand(
          f,
          id,
          vocabularyInput({ labelEn: "changed" }),
          headers,
        ),
      status(422),
    );
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    await assert.rejects(
      () =>
        vocabularyCommand(f, id, vocabularyInput(), headers, {
          user: f.b.user,
          shop: f.a.shop,
        }),
      status(422),
    );
    await assert.rejects(
      () => vocabularyCommand(f, randomUUID(), vocabularyInput(), headers),
      status(422),
    );
    await assert.rejects(() => vocabularyCommand(f, id), status(428));
    await assert.rejects(
      () => vocabularyCommand(f, id, vocabularyInput(), { ifMatch: "bad" }),
      status(422),
    );
    await assert.rejects(
      () => vocabularyCommand(f, id, vocabularyInput(), { ifMatch: '"v99"' }),
      status(412),
    );
    const updates = await Promise.allSettled(
      ["A", "B"].map((labelEn) =>
        vocabularyCommand(f, id, vocabularyInput({ labelEn }), {
          ifMatch: '"v1"',
        }),
      ),
    );
    assert.equal(updates.filter((r) => r.status === "fulfilled").length, 1);
    const failed = updates.find((r) => r.status === "rejected");
    assert(status(412)(failed.reason));
    assert.deepEqual(
      await vocabularyCommand(f, id, vocabularyInput(), headers),
      r1,
      "Lost original response replays even after newer revision",
    );
    const before = await counts(f),
      retryId = randomUUID(),
      retryKey = randomUUID();
    for (const method of ["append", "advance", "persist"]) {
      await assert.rejects(
        () =>
          vocabularyRun(f, async (_tx, repo) => {
            const wrapped = {
              ...repo,
              [method]: async (...args) => {
                await repo[method](...args);
                throw new Error("Synthetic injected failure");
              },
            };
            const { reviseVocabulary } = await import(
              "@aarili/core/vocabulary"
            );
            return reviseVocabulary(
              { shopId: f.a.shop, actorId: f.a.user, repository: wrapped },
              retryId,
              vocabularyInput(),
              { key: retryKey, requestId: randomUUID() },
            );
          }),
        /Synthetic injected failure/,
      );
      assert.deepEqual(await counts(f), before);
    }
    await vocabularyCommand(f, retryId, vocabularyInput(), { key: retryKey });
    // Same key in another shop is independent; foreign target/revision is invisible.
    await vocabularyCommand(f, randomUUID(), vocabularyInput(), { key }, f.b);
    await assert.rejects(
      () =>
        vocabularyCommand(f, id, vocabularyInput(), { ifMatch: '"v1"' }, f.b),
      status(404),
    );
  });
}, 120000);
test("0.4.1c C4 FORCE RLS missing context app_user read/write composite references and catalog coverage", async () => {
  await withVocabularyFixture(async (f) => {
    const r = await vocabularyCommand(f, randomUUID());
    const tables = await assertIsolationCatalog(f.runtime.db);
    for (const table of [
      "vocabulary",
      "vocabulary_revision",
      "vocabulary_search_key",
      "synthetic_search_identity",
    ]) {
      assert(tables.includes(`public.${table}`));
      assert.equal(
        (await f.runtime.pool.query(`select * from ${table}`)).rowCount,
        0,
      );
      assert.equal(
        (
          await vocabularyRun(
            f,
            (tx) => tx.execute(sql.raw(`select * from ${table}`)),
            f.b,
          )
        ).rowCount,
        0,
      );
    }
    await assert.rejects(() =>
      f.runtime.pool.query(
        "insert into vocabulary(shop_id,id,current_revision_id,version) values($1,$2,$3,1)",
        [f.a.shop, randomUUID(), r.id],
      ),
    );
    await assert.rejects(() =>
      vocabularyRun(f, (tx) =>
        tx.execute(
          sql`insert into vocabulary(shop_id,id,current_revision_id,version) values(${f.b.shop}::uuid,${randomUUID()}::uuid,${r.id}::uuid,1)`,
        ),
      ),
    );
    await assert.rejects(
      () =>
        vocabularyRun(
          f,
          (tx) =>
            tx.execute(
              sql`insert into synthetic_search_identity(shop_id,id,display_name,original_notes,original_phone,algorithm_version,name_ta_norm,name_latin_norm,name_skel,phone_digits,vocabulary_id,referenced_revision_id) values(${f.b.shop}::uuid,${randomUUID()}::uuid,'Synthetic','','',1,'','','','',${r.vocabularyId}::uuid,${r.id}::uuid)`,
            ),
          f.b,
        ),
      databaseCode("23503"),
    );
    await assert.rejects(() =>
      withShop(f.runtime.db, f.a.user, f.b.shop, () => Promise.resolve()),
    );
    const grants = (
      await f.admin.query(
        "select has_table_privilege('app_user','vocabulary_revision','UPDATE,DELETE') as revisions,has_table_privilege('app_user','vocabulary_search_key','UPDATE,DELETE') as keys,has_table_privilege('app_user','vocabulary','DELETE') as heads",
      )
    ).rows[0];
    assert.deepEqual(grants, { revisions: false, keys: false, heads: false });
    for (const table of ["vocabulary_revision", "vocabulary_search_key"]) {
      await f.migration.query(`grant update on ${table} to app_user`);
      try {
        await assert.rejects(
          () => assertIsolationCatalog(f.runtime.db),
          /append-only journal grants/,
        );
        await assert.rejects(
          () =>
            vocabularyRun(f, (tx) =>
              tx.execute(sql.raw(`update ${table} set shop_id=shop_id`)),
            ),
          databaseCode("42501"),
        );
      } finally {
        await f.migration.query(`revoke update on ${table} from app_user`);
      }
    }
  });
}, 120000);
test("0.4.1c C6 production migrations and routing leave synthetic search uninstalled and algorithm v1 explicit", async () => {
  const migration = await readFile(
    "packages/db/migrations/0009_vocabulary_search.sql",
    "utf8",
  );
  assert(!migration.includes("CREATE TABLE synthetic_search_identity"));
  const api = await readFile("packages/api/src/index.ts", "utf8");
  assert(!api.includes("searchSynthetic"));
  assert(migration.includes("CHECK(algorithm_version=1)"));
});
