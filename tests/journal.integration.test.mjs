import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { requestHash } from "@aarili/core/commands";
import { validateJournal } from "@aarili/core/journal";
import { sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { journalRepository } from "@aarili/db/journal-repository";
import fc from "fast-check";
import { test } from "vitest";
import {
  createJournalInspection,
  journalCommand,
  linkedReversal,
  pair,
  positions,
  posting,
} from "../scripts/test-support/journal.mjs";
import { withMoneyFixture } from "../scripts/test-support/money-fixture.mjs";

const run = (f, work, identity = f.a) =>
  withShop(f.runtime.db, identity.user, identity.shop, work);
async function counts(f) {
  const result = [];
  for (const table of [
    "journal_batch",
    "journal_entry",
    "audit_event",
    "idempotency_key",
  ])
    result.push(
      (await f.admin.query(`select count(*)::int as n from ${table}`)).rows[0]
        .n,
    );
  return result;
}
// Deliberately bypass core. Runtime must still be unable to commit invalid
// batches, even with genuine audit/key records and the INSERT grants.
async function raw(
  f,
  input,
  {
    count = input.entries.length,
    omitKey = false,
    entries = input.entries,
    identity = f.a,
  } = {},
) {
  return run(
    f,
    async (tx) => {
      const repo = journalRepository(tx, identity.shop);
      const b = {
        ...input,
        ...(await repo.ids()),
        actorId: identity.user,
        hash: await requestHash(input),
      };
      const key = randomUUID();
      await repo.audit(b, key, randomUUID());
      await repo.insertBatch(
        { ...b, entries: Array.from({ length: count }) },
        key,
      );
      for (const e of entries)
        await tx.execute(
          sql`insert into journal_entry(shop_id,batch_id,account,amount_paise) values(${identity.shop}::uuid,${b.id}::uuid,${e.account},${String(e.amountPaise)}::bigint)`,
        );
      if (!omitKey)
        await repo.persist(
          key,
          { actorId: identity.user, action: `journal.${b.kind}`, hash: b.hash },
          b.id,
        );
      return b;
    },
    identity,
  );
}

test("0.3.1c C1/C6 authoritative COMMIT denies direct app_user imbalance/incomplete/range/provenance and late appends", async () => {
  await withMoneyFixture(async (f) => {
    const before = await counts(f);
    const input = posting(randomUUID(), pair("cash", "deposit", 1));
    for (const options of [
      { entries: [input.entries[0]] },
      { entries: [] },
      { count: 3 },
      {
        entries: [
          { account: "cash", amountPaise: 1 },
          { account: "deposit", amountPaise: -2 },
        ],
      },
      {
        entries: [
          { account: "cash", amountPaise: "9007199254740992" },
          { account: "deposit", amountPaise: "-9007199254740992" },
        ],
      },
      { omitKey: true },
    ]) {
      await assert.rejects(() => raw(f, input, options));
      assert.deepEqual(await counts(f), before);
    }
    await assert.rejects(() =>
      raw(
        f,
        posting(randomUUID(), [
          { account: "cash", amountPaise: Number.MAX_SAFE_INTEGER },
          { account: "receivable", amountPaise: 1 },
          { account: "deposit", amountPaise: -Number.MAX_SAFE_INTEGER },
          { account: "revenue", amountPaise: -1 },
        ]),
      ),
    );
    const good = await journalCommand(f, input);
    for (const bad of [
      { ...linkedReversal(good), entries: pair("deposit", "cash", 2) },
      { ...linkedReversal(good), subjectId: randomUUID() },
      posting(input.subjectId, pair("refund", "cash", 1), {
        kind: "settlement",
        relatedId: good.id,
      }),
    ])
      await assert.rejects(() => raw(f, bad));
    const liability = await journalCommand(
      f,
      posting(randomUUID(), pair("revenue", "refund", 1001)),
    );
    await assert.rejects(() =>
      raw(
        f,
        posting(liability.subjectId, pair("refund", "cash", 1000), {
          kind: "settlement",
          relatedId: liability.id,
        }),
      ),
    );
    const racingSubject = randomUUID();
    const overflow = await Promise.allSettled(
      [1, 2].map(() =>
        journalCommand(
          f,
          posting(
            racingSubject,
            pair("cash", "deposit", Number.MAX_SAFE_INTEGER),
          ),
        ),
      ),
    );
    assert.equal(overflow.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(overflow.filter((r) => r.status === "rejected").length, 1);
    await assert.rejects(() =>
      run(f, (tx) =>
        tx.execute(
          sql`insert into journal_entry(shop_id,batch_id,account,amount_paise) values(${f.a.shop}::uuid,${good.id}::uuid,'revenue',1)`,
        ),
      ),
    );
    const subjectId = randomUUID();
    const max = posting(
      subjectId,
      pair("cash", "deposit", Number.MAX_SAFE_INTEGER),
    );
    await journalCommand(f, max);
    const committed = await counts(f);
    await assert.rejects(() =>
      journalCommand(f, posting(subjectId, pair("cash", "deposit", 1))),
    );
    assert.deepEqual(await counts(f), committed);
    // Bypass withShop to choose isolation BEFORE any query. The journal trigger
    // itself, rather than PostgreSQL's late SET TRANSACTION rejection, denies it.
    await assert.rejects(
      () =>
        f.runtime.db.transaction(async (tx) => {
          await tx.execute(
            sql`set transaction isolation level repeatable read`,
          );
          await tx.execute(
            sql`select set_config('app.user_id',${f.a.user},true), set_config('app.shop_id',${f.a.shop},true), set_config('app.actor_id',${f.a.user},true)`,
          );
          const repo = journalRepository(tx, f.a.shop);
          const b = {
            ...posting(randomUUID(), pair("cash", "deposit", 1)),
            ...(await repo.ids()),
            actorId: f.a.user,
            hash: await requestHash(input),
          };
          const key = randomUUID();
          await repo.audit(b, key, randomUUID());
          await repo.insertBatch(b, key);
        }),
      (e) => (e.cause?.code ?? e.code) === "40001",
    );
    // Forcing outstanding constraints early cannot open a later append loophole.
    const sealedCounts = await counts(f);
    await assert.rejects(
      () =>
        run(f, async (tx) => {
          const repo = journalRepository(tx, f.a.shop);
          const b = {
            ...posting(randomUUID(), pair("cash", "deposit", 1)),
            ...(await repo.ids()),
            actorId: f.a.user,
            hash: await requestHash(input),
          };
          const key = randomUUID();
          await repo.audit(b, key, randomUUID());
          await repo.insertBatch(b, key);
          for (const e of b.entries) await repo.insertEntry(b.id, e);
          await repo.persist(
            key,
            { actorId: f.a.user, action: "journal.posting", hash: b.hash },
            b.id,
          );
          await tx.execute(sql`set constraints all immediate`);
          await repo.insertEntry(b.id, { account: "revenue", amountPaise: 1 });
        }),
      (e) => (e.cause?.code ?? e.code) === "23514",
    );
    assert.deepEqual(await counts(f), sealedCounts);
  });
}, 120000);

test("0.3.1c C2/C3/C4/C7 FIN-13/14/21 AC-18–20 synthetic operational sequence and original provenance", async () => {
  await withMoneyFixture(async (f) => {
    const journal = createJournalInspection(f);
    assert.equal((await journal("start")).duePaise, 130000);
    const confirmed = await journal("lost-response");
    assert.equal(confirmed.duePaise, 80000);
    assert.equal(
      (await journal("confirm")).history.length,
      confirmed.history.length,
    );
    const reversed = await journal("reverse");
    assert.equal(reversed.duePaise, 130000);
    assert.equal(
      (await journal("reverse")).history.length,
      reversed.history.length,
    );
    for (const original of confirmed.history)
      assert.deepEqual(
        reversed.history.find((b) => b.id === original.id),
        original,
      );
    assert.equal((await journal("sale")).duePaise, 0);
    assert.equal((await journal("credit")).depositPaise, 100000);
    assert.equal((await journal("liability")).refundLiabilityPaise, 100000);
    assert.equal((await journal("fail-refund")).refundLiabilityPaise, 100000);
    const settled = await journal("settle");
    assert.equal(settled.refundLiabilityPaise, 0);
    assert.deepEqual(settled.balances, {
      cash: 0,
      electronic: 0,
      receivable: 0,
      revenue: 0,
      deposit: 0,
      refund: 0,
    });
    assert.equal(
      (await journal("settle")).history.length,
      settled.history.length,
    );
    await journal("reject");
    await journal("mutate");
    const rows = (
      await f.admin.query(
        "select b.related_id,b.actor_id,b.reason,b.created_at,a.source_event_id,t.audit_id as original_audit from journal_batch b join audit_event a on a.shop_id=b.shop_id and a.id=b.audit_id join journal_batch t on t.shop_id=b.shop_id and t.id=b.related_id",
      )
    ).rows;
    for (const row of rows) {
      assert.equal(row.source_event_id, row.original_audit);
      assert.equal(row.actor_id, f.a.user);
      assert(row.reason);
      assert(row.created_at);
    }
  });
}, 120000);

test("0.3.1c C4/C6 FIN-12/14 USE-08 AC-19/AC-55 concurrency, durable source/link uniqueness, retention and binding", async () => {
  await withMoneyFixture(async (f) => {
    const command = posting(randomUUID(), pair("cash", "receivable", 70000)),
      key = randomUUID();
    const [a, b] = await Promise.all([
      journalCommand(f, command, key),
      journalCommand(f, command, key),
    ]);
    assert.deepEqual(a, b);
    assert.deepEqual(await counts(f), [1, 2, 1, 1]);
    for (const change of [
      { reason: "Changed reason" },
      { sourceId: randomUUID() },
      { entries: pair("cash", "receivable", 1) },
    ])
      await assert.rejects(
        () => journalCommand(f, { ...command, ...change }, key),
        /IDEMPOTENCY_MISMATCH/,
      );
    // Real second authorised actor in the same shop cannot replay the owner key.
    await f.admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [f.a.shop, f.b.user],
    );
    await assert.rejects(
      () => journalCommand(f, command, key, { user: f.b.user, shop: f.a.shop }),
      /IDEMPOTENCY_MISMATCH/,
    );
    const [c, d] = await Promise.all([
      journalCommand(f, command),
      journalCommand(f, command),
    ]);
    assert.equal(c.id, a.id);
    assert.equal(d.id, a.id);
    assert.deepEqual((await counts(f)).slice(0, 3), [1, 2, 1]);
    await assert.rejects(
      () =>
        journalCommand(f, { ...command, reason: "Different durable binding" }),
      /JOURNAL_SOURCE_CONFLICT/,
    );
    await assert.rejects(
      () =>
        journalCommand(
          f,
          {
            ...command,
            kind: "reversal",
            relatedId: a.id,
            entries: pair("receivable", "cash", 70000),
          },
          key,
        ),
      /IDEMPOTENCY_MISMATCH/,
    );
    const reverse = linkedReversal(a),
      reverseKey = randomUUID();
    const results = await Promise.allSettled([
      journalCommand(f, reverse, reverseKey),
      journalCommand(f, { ...reverse, sourceId: randomUUID() }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.equal((await counts(f))[0], 2);
    // Purge simulation is disposable administrator-only; ordinary runtime has
    // no DELETE grant. Durable source and reversal links survive key retention.
    await f.admin.query("delete from idempotency_key");
    const persistedReverse = (
      await f.admin.query(
        "select source_id from journal_batch where kind='reversal'",
      )
    ).rows[0].source_id;
    assert.equal((await journalCommand(f, command)).id, a.id);
    await journalCommand(f, { ...reverse, sourceId: persistedReverse });
    assert.equal((await counts(f))[0], 2);
    await assert.rejects(
      () => journalCommand(f, { ...reverse, sourceId: randomUUID() }),
      /JOURNAL_LINK_CONFLICT/,
    );
    const saleCredit = await journalCommand(
      f,
      posting(randomUUID(), pair("revenue", "deposit", 100001)),
    );
    const liabilityInput = posting(
      saleCredit.subjectId,
      pair("deposit", "refund", 100001),
      { kind: "liability", relatedId: saleCredit.id },
    );
    await assert.rejects(() =>
      raw(f, { ...liabilityInput, entries: pair("deposit", "refund", 100000) }),
    );
    const liabilities = await Promise.allSettled([
      journalCommand(f, liabilityInput),
      journalCommand(f, { ...liabilityInput, sourceId: randomUUID() }),
    ]);
    assert.equal(liabilities.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(liabilities.filter((r) => r.status === "rejected").length, 1);
    const liability = liabilities.find((r) => r.status === "fulfilled").value;
    await assert.rejects(
      () => journalCommand(f, linkedReversal(saleCredit)),
      /JOURNAL_LINK_CONFLICT/,
    );
    const settle = posting(
      liability.subjectId,
      pair("refund", "cash", 100001),
      { kind: "settlement", relatedId: liability.id },
    );
    const refunds = await Promise.allSettled([
      journalCommand(f, settle),
      journalCommand(f, { ...settle, sourceId: randomUUID() }),
    ]);
    assert.equal(refunds.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(refunds.filter((r) => r.status === "rejected").length, 1);
    assert.equal((await positions(f, liability.subjectId)).refund, 0);
    await assert.rejects(
      () => journalCommand(f, linkedReversal(liability)),
      /JOURNAL_LINK_CONFLICT/,
    );
    // SQL bypass cannot reverse an arbitrary value, settle the wrong amount,
    // cross a subject link, or reverse a settled liability.
    for (const bad of [
      { ...linkedReversal(a), entries: pair("receivable", "cash", 1) },
      { ...linkedReversal(a), subjectId: randomUUID() },
      linkedReversal(liability),
      { ...settle, sourceId: randomUUID(), entries: pair("refund", "cash", 1) },
    ])
      await assert.rejects(() => raw(f, bad));
  });
}, 120000);

test("0.3.1c C6 TRU-06/12 rollback at each actual write and connection loss; lost response replays once", async () => {
  await withMoneyFixture(async (f) => {
    const command = posting(randomUUID(), pair("cash", "deposit", 101)),
      key = randomUUID();
    for (const stage of [
      "audit",
      "insertBatch",
      "entry1",
      "entry2",
      "persist",
      "disconnect",
    ]) {
      const before = await counts(f);
      let entryCount = 0;
      await assert.rejects(() =>
        journalCommand(f, command, key, f.a, (r, tx) => {
          const wrapped = { ...r };
          for (const method of [
            "audit",
            "insertBatch",
            "insertEntry",
            "persist",
          ])
            wrapped[method] = async (...args) => {
              const result = await r[method](...args);
              if (method === "insertEntry") entryCount++;
              if (
                stage === method ||
                (stage === `entry${entryCount}` && method === "insertEntry")
              )
                throw new Error("Synthetic failure");
              if (stage === "disconnect" && method === "persist") {
                const pid = (
                  await tx.execute(sql`select pg_backend_pid() as pid`)
                ).rows[0].pid;
                await f.admin.query("select pg_terminate_backend($1)", [pid]);
                await tx.execute(sql`select 1`);
              }
              return result;
            };
          return wrapped;
        }),
      );
      assert.deepEqual(await counts(f), before);
    }
    const committed = await journalCommand(f, command, key);
    assert.deepEqual(await journalCommand(f, command, key), committed);
    assert.deepEqual(await counts(f), [1, 2, 1, 1]);
  });
}, 120000);

test("0.3.1c C5 TRU-01/TRU-12 AC-38 catalog, bidirectional repository/write/link isolation, immutable originals and pooled reuse", async () => {
  await withMoneyFixture(async (f) => {
    const catalog = await assertIsolationCatalog(f.runtime.db);
    for (const [alter, restore] of [
      [
        "alter table journal_entry no force row level security",
        "alter table journal_entry force row level security",
      ],
      [
        "drop policy tenant_context on journal_batch",
        "create policy tenant_context on journal_batch as restrictive for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id))",
      ],
      [
        "grant update on journal_entry to app_user",
        "revoke update on journal_entry from app_user",
      ],
    ]) {
      await f.migration.query(alter);
      try {
        await assert.rejects(() => assertIsolationCatalog(f.runtime.db));
      } finally {
        await f.migration.query(restore);
      }
      await assertIsolationCatalog(f.runtime.db);
    }
    for (const relation of ["public.journal_batch", "public.journal_entry"])
      assert(catalog.includes(relation));
    const a = await journalCommand(
        f,
        posting(randomUUID(), pair("cash", "deposit", 1)),
      ),
      b = await journalCommand(
        f,
        posting(randomUUID(), pair("cash", "deposit", 1)),
        randomUUID(),
        f.b,
      );
    for (const [own, other, foreign] of [
      [f.a, f.b, b],
      [f.b, f.a, a],
    ]) {
      await run(
        f,
        async (tx) => {
          const r = journalRepository(tx, own.shop);
          assert.equal(await r.read(foreign.id), undefined);
          assert.equal(await r.source(foreign.sourceId), undefined);
          assert.equal(await r.replay(randomUUID()), undefined);
          assert.deepEqual(await r.positions(foreign.subjectId), {
            cash: 0,
            electronic: 0,
            receivable: 0,
            revenue: 0,
            deposit: 0,
            refund: 0,
          });
          assert.equal(
            (await tx.execute(sql`select * from journal_batch`)).rowCount,
            1,
          );
          assert.equal(
            (await tx.execute(sql`select * from journal_entry`)).rowCount,
            2,
          );
        },
        own,
      );
      await assert.rejects(
        () =>
          withShop(f.runtime.db, own.user, other.shop, (tx) =>
            journalRepository(tx, other.shop).read(foreign.id),
          ),
        /Shop access denied/,
      );
      await assert.rejects(
        () => journalCommand(f, linkedReversal(foreign), randomUUID(), own),
        /JOURNAL_NOT_FOUND/,
      );
      await assert.rejects(() =>
        run(
          f,
          (tx) =>
            tx.execute(
              sql`insert into journal_entry(shop_id,batch_id,account,amount_paise) values(${other.shop}::uuid,${foreign.id}::uuid,'refund',1)`,
            ),
          own,
        ),
      );
    }
    for (const table of ["journal_batch", "journal_entry"]) {
      assert.equal(
        (await f.runtime.db.execute(sql.raw(`select * from ${table}`)))
          .rowCount,
        0,
      );
      for (const query of [
        `update ${table} set shop_id=shop_id`,
        `delete from ${table}`,
        `truncate ${table}`,
      ])
        await assert.rejects(() => run(f, (tx) => tx.execute(sql.raw(query))));
      for (const query of [
        `update ${table} set shop_id=shop_id`,
        `delete from ${table}`,
      ])
        await assert.rejects(
          () => f.admin.query(query),
          (e) => e.code === "42501",
        );
    }
    await assert.rejects(() =>
      f.runtime.db.execute(
        sql`insert into journal_entry(shop_id,batch_id,account,amount_paise) values(${f.a.shop}::uuid,${a.id}::uuid,'refund',1)`,
      ),
    );
    await assert.rejects(() =>
      run(f, async (tx) => {
        await tx.execute(
          sql`select set_config('app.actor_id',${f.b.user},true)`,
        );
        await journalRepository(tx, f.a.shop).read(a.id);
        throw new Error("Rollback context");
      }),
    );
    assert.equal(
      (await f.runtime.db.execute(sql`select * from journal_batch`)).rowCount,
      0,
    );
    assert.deepEqual(
      await run(f, (tx) => journalRepository(tx, f.a.shop).read(a.id)),
      a,
    );
    await assert.rejects(() => f.runtime.db.execute(sql`set role app_owner`));
    await assert.rejects(() =>
      run(f, async (tx) => {
        // Even where RLS's WITH CHECK is weakened in future code, composite FK
        // cannot bind a child to another shop's batch.
        await tx.execute(
          sql`insert into journal_entry(shop_id,batch_id,account,amount_paise) values(${f.a.shop}::uuid,${b.id}::uuid,'refund',1)`,
        );
      }),
    );
  });
}, 120000);

test("0.3.1c C1/C2/C4 FIN-12/13/14 AC-19 independent event model reconciles arbitrary paise/retry/reversal sequences", async () => {
  await withMoneyFixture(async (f) => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 100001 }),
            reverse: fc.boolean(),
            retries: fc.integer({ min: 0, max: 2 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        async (events) => {
          const subject = randomUUID();
          let received = 0n;
          await journalCommand(
            f,
            posting(subject, pair("receivable", "revenue", 2000000)),
          );
          for (const event of events) {
            const input = validateJournal(
                posting(subject, pair("cash", "receivable", event.amount)),
              ),
              key = randomUUID();
            const payment = await journalCommand(f, input, key);
            received += BigInt(event.amount);
            for (let i = 0; i < event.retries; i++)
              assert.equal(
                (await journalCommand(f, input, key)).id,
                payment.id,
              );
            if (event.reverse) {
              const reversal = linkedReversal(payment),
                reverseKey = randomUUID();
              await journalCommand(f, reversal, reverseKey);
              received -= BigInt(event.amount);
              for (let i = 0; i < event.retries; i++)
                await journalCommand(f, reversal, reverseKey);
            }
            const result = await positions(f, subject);
            assert.equal(BigInt(result.receivable), 2000000n - received);
            assert.equal(BigInt(result.cash), received);
            assert.equal(result.revenue, -2000000);
            assert.equal(result.deposit, 0);
            assert.equal(result.refund, 0);
            assert.equal(
              Object.values(result).reduce((sum, x) => sum + BigInt(x), 0n),
              0n,
            );
          }
        },
      ),
      { seed: 340019, numRuns: 25 },
    );
  });
}, 180000);
