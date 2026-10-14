import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { postJournal, reversalEntries } from "@aarili/core/journal";
import { sql, withShop } from "@aarili/db";
import { journalRepository } from "@aarili/db/journal-repository";

export const pair = (debit, credit, amount) => [
  { account: debit, amountPaise: amount },
  { account: credit, amountPaise: -amount },
];
export function posting(subjectId, entries, extras = {}) {
  return {
    sourceId: randomUUID(),
    subjectId,
    kind: "posting",
    relatedId: null,
    reason: "Synthetic accountant-review example",
    entries,
    ...extras,
  };
}
export function journalCommand(
  f,
  command,
  key = randomUUID(),
  identity = f.a,
  decorate = (r) => r,
) {
  return withShop(f.runtime.db, identity.user, identity.shop, (tx) =>
    postJournal(
      decorate(journalRepository(tx, identity.shop), tx),
      identity.user,
      command,
      { key, requestId: randomUUID() },
    ),
  );
}
export function positions(f, subjectId, identity = f.a) {
  return withShop(f.runtime.db, identity.user, identity.shop, (tx) =>
    journalRepository(tx, identity.shop).positions(subjectId),
  );
}
export function linkedReversal(batch) {
  return posting(batch.subjectId, reversalEntries(batch.entries), {
    kind: "reversal",
    relatedId: batch.id,
    reason: "Synthetic payment reversal",
  });
}
// Agent-operated inspection is not human acceptance. No retained target or
// commercial source entities; the enclosing harness creates disposable PG.
export function createJournalInspection(f) {
  let ac18,
    confirmation,
    confirmationBatch,
    confirmKey,
    reverse,
    reverseKey,
    sale,
    credit,
    liability,
    settlement,
    settlementKey;
  async function inspect(subjectId, stage, extra = {}) {
    const balances = await positions(f, subjectId);
    const history = await withShop(
      f.runtime.db,
      f.a.user,
      f.a.shop,
      async (tx) => {
        const repo = journalRepository(tx, f.a.shop);
        const rows = (
          await tx.execute(
            sql`select id from journal_batch where shop_id=${f.a.shop}::uuid and subject_id=${subjectId}::uuid order by created_at,id`,
          )
        ).rows;
        const history = [];
        for (const row of rows) history.push(await repo.read(row.id));
        return history;
      },
    );
    const result = {
      stage,
      ...extra,
      duePaise: balances.receivable,
      depositPaise: 0 - balances.deposit,
      refundLiabilityPaise: 0 - balances.refund,
      balances,
      history,
    };
    console.info(JSON.stringify(result));
    return result;
  }
  return async function journal(action) {
    if (action === "start") {
      ac18 = randomUUID();
      await inspect(
        ac18,
        "quotation/agreed=200000; neither revenue nor receivable",
        { agreedPaise: 200000 },
      );
      const advance = await journalCommand(
        f,
        posting(ac18, pair("cash", "deposit", 70000)),
      );
      await inspect(ac18, "advance is deposit", { source: advance.id });
      await journalCommand(
        f,
        posting(ac18, pair("receivable", "revenue", 200000)),
      );
      await journalCommand(
        f,
        posting(ac18, pair("deposit", "receivable", 70000)),
      );
      confirmation = posting(ac18, pair("cash", "receivable", 50000));
      confirmKey = randomUUID();
      confirmationBatch = undefined;
      reverse = undefined;
      reverseKey = undefined;
      const result = await inspect(ac18, "AC-18 billed/confirmed/pending", {
        pendingPaise: 50000,
      });
      assert.equal(result.duePaise, 130000);
      return result;
    }
    if (action === "confirm" || action === "lost-response") {
      assert(ac18, "Run :journal start first");
      const original = await journalCommand(f, confirmation, confirmKey);
      confirmationBatch = original;
      if (action === "lost-response") {
        // Response loss occurs after transaction completion, not a rollback.
        console.info(
          "Synthetic response discarded AFTER commit; retry same command key",
        );
        assert.deepEqual(
          await journalCommand(f, confirmation, confirmKey),
          original,
        );
      }
      const result = await inspect(ac18, "AC-18 confirmation/replay", {
        pendingPaise: 0,
      });
      assert.equal(result.duePaise, reverse ? 130000 : 80000);
      return result;
    }
    if (action === "reverse") {
      assert(confirmationBatch, "Run :journal start and confirm first");
      reverse ??= linkedReversal(confirmationBatch);
      reverseKey ??= randomUUID();
      await journalCommand(f, reverse, reverseKey);
      const result = await inspect(ac18, "AC-19 linked reversal/replay");
      assert.equal(result.duePaise, 130000);
      return result;
    }
    if (action === "sale") {
      sale = randomUUID();
      credit = undefined;
      liability = undefined;
      settlement = undefined;
      settlementKey = undefined;
      await journalCommand(
        f,
        posting(sale, pair("receivable", "revenue", 100000)),
      );
      await journalCommand(
        f,
        posting(sale, pair("cash", "receivable", 100000)),
      );
      return inspect(sale, "AC-20 fully paid sale");
    }
    if (action === "credit") {
      assert(sale, "Run :journal sale first");
      credit ??= await journalCommand(
        f,
        posting(sale, pair("revenue", "deposit", 100000)),
      );
      return inspect(sale, "AC-20 sale credit is separate customer credit");
    }
    if (action === "liability") {
      assert(credit, "Run :journal sale and credit first");
      liability ??= await journalCommand(
        f,
        posting(sale, pair("deposit", "refund", 100000), {
          kind: "liability",
          relatedId: credit.id,
          reason: "Synthetic refund liability linked to sale credit",
        }),
      );
      settlement ??= posting(sale, pair("refund", "cash", 100000), {
        kind: "settlement",
        relatedId: liability.id,
        reason: "Synthetic approved refund settlement",
      });
      settlementKey ??= randomUUID();
      return inspect(sale, "AC-20 linked refund payable");
    }
    if (action === "fail-refund" || action === "settle") {
      assert(liability, "Run :journal sale, credit and liability first");
      if (action === "fail-refund") {
        await assert.rejects(() =>
          journalCommand(f, settlement, settlementKey, f.a, (r) => ({
            ...r,
            async persist(...args) {
              await r.persist(...args);
              throw new Error("Synthetic pre-commit failure");
            },
          })),
        );
        const result = await inspect(
          sale,
          "Failed refund remains payable; no partial effect",
        );
        assert.equal(result.refundLiabilityPaise, 100000);
        return result;
      }
      await journalCommand(f, settlement, settlementKey);
      const result = await inspect(sale, "AC-20 settlement/replay");
      assert.equal(result.duePaise, 0);
      assert.equal(result.refundLiabilityPaise, 0);
      return result;
    }
    if (action === "reject") {
      await assert.rejects(() =>
        journalCommand(
          f,
          posting(randomUUID(), [
            { account: "cash", amountPaise: 100 },
            { account: "deposit", amountPaise: -99 },
          ]),
        ),
      );
      console.info("JOURNAL_UNBALANCED: rejected before writes");
      await assert.rejects(() =>
        journalCommand(
          f,
          posting(randomUUID(), pair("cash", "deposit", 100)),
          randomUUID(),
          f.a,
          (r) => ({
            ...r,
            insertEntry: (id, e) =>
              r.insertEntry(
                id,
                e.account === "deposit" ? { ...e, amountPaise: -99 } : e,
              ),
          }),
        ),
      );
      console.info(
        "23514: direct runtime unbalanced entries rejected AT COMMIT; audit/key/postings rolled back",
      );
      return;
    }
    if (action === "mutate") {
      assert(ac18, "Run :journal start first");
      await assert.rejects(() =>
        withShop(f.runtime.db, f.a.user, f.a.shop, (tx) =>
          tx.execute(
            sql`update journal_entry set amount_paise=1 where shop_id=${f.a.shop}::uuid`,
          ),
        ),
      );
      console.info("42501: ordinary original-posting mutation denied");
      return inspect(ac18, "Original immutable history retained");
    }
    if (action === "inspect") {
      assert(ac18, "Run :journal start first");
      return inspect(ac18, "Current immutable journal");
    }
    throw new Error(
      "Use start, confirm, lost-response, reverse, sale, credit, liability, fail-refund, settle, reject, mutate or inspect",
    );
  };
}
