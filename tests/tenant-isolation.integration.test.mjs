import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readShop } from "@aarili/core";
import { requireRuntimeRole, sql, withShop } from "@aarili/db";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import { shopRepository } from "@aarili/db/shop-repository";
import { shop, shopMembership } from "@aarili/db/tenant-schema";
import { test } from "vitest";
import { migrateDatabase } from "../scripts/migrate.mjs";
import {
  apiRequest,
  fixtureRepository,
  tenantPaths,
  withTenantFixture,
} from "../scripts/test-support/tenant-isolation.mjs";

const context = (tx) =>
  tx.execute(
    sql`select pg_backend_pid() as pid, current_setting('app.user_id',true) as u, current_setting('app.shop_id',true) as s, current_setting('app.actor_id',true) as a`,
  );
async function clean(pool) {
  const row = (
    await pool.query(
      "select current_setting('app.user_id',true) as u,current_setting('app.shop_id',true) as s,current_setting('app.actor_id',true) as a",
    )
  ).rows[0];
  for (const value of Object.values(row))
    assert(!value, "Transaction context leaked");
  assert.equal((await pool.query("select * from shop")).rowCount, 0);
  assert.equal(
    (await pool.query("select * from isolation_parent")).rowCount,
    0,
  );
  return (await pool.query("select pg_backend_pid() as pid")).rows[0].pid;
}

test("0.2.2 D1/D2/D6 TRU-01 AC-38 real sessions → API → core → bound repository; both owners and registered paths", async () => {
  await withTenantFixture(async ({ runtime, admin, owner, api, a, b }) => {
    assert.deepEqual(tenantPaths, [
      "serviceTemplatesRepository.current/read/definition/list/history/append/advance/origin",
      "shops/:shopId/settings/service-templates/list/entries/history/revisions/definitions/preview",
      "service.templates draft promotion",
      "measurementFormsRepository.current/read/definition/list/history/fieldSemantics/append/advance/origin",
      "shops/:shopId/settings/measurement-forms/list/entries/history/revisions/definitions",
      "measurement.forms draft promotion",
      "approvedCategoryResolver.resolve/current-only",
      "commitmentBindingsRepository.current/read/history/append/advance/origin",
      "shops/:shopId/settings/commitments/bindings/binding-revisions/binding-history/bound-preview",
      "service.commitment-bindings draft promotion",
      "serviceCatalogueRepository.current/read/definition/list/history/codeOwner/append/advance/origin",
      "shops/:shopId/settings/catalogue/list/entries/history/revisions/definitions",
      "service.catalogue draft promotion",
      "shopDirectoryRepository.current/read/list/history/configuration/append/advance/origin",
      "shops/:shopId/settings/directory/list/entries/history/revisions",
      "shop.directory draft promotion",
      "shopCommitmentsRepository.current/read/history/append/advance/origin",
      "shops/:shopId/settings/commitments/history/revisions/preview",
      "shop.commitments draft promotion",
      "shopCalendarRepository.current/read/history/append/advance/origin",
      "shopPoliciesRepository.current/read/history/append/advance/origin/pendingKinds",
      "shops/:shopId/settings/calendar/history/revisions",
      "shops/:shopId/settings/policies/history/revisions/readiness",
      "shop.calendar draft promotion",
      "shop.policies draft promotion",
      "shopProfileRepository.current/read/history/append/advance/logoReady",
      "shops/:shopId/settings/profile/history/revisions",
      "guardianRepository.read/search/claim/verify/purpose/origin",
      "shops/:shopId/customers/:customerId/wearers/:id/guardians",
      "shops/:shopId/guardian-people/search",
      "wearer.guardian draft promotion",
      "wearerRepository.read/list/search/insert/link/update/purpose/origin",
      "shops/:shopId/customers/:customerId/wearers",
      "customer.wearer draft promotion",
      "customerRepository.read/search/insert/correct/audit",
      "shops/:shopId/customers",
      "documentRepository.issue/claim/plan/accept/retry/cleanup",
      "shops/:shopId/documents",
      "mediaRepository.read/insert/start/claim/accept/expire",
      "mediaRepository.derivatives/release",
      "mediaRepository.claims/cleanupIntents/intent/cleaned",
      "shops/:shopId/files",
      "shopRepository.read",
      "owner.ownerShop",
      "draftRepository.read/list/insert/update/audit",
      "shops/:shopId/drafts",
      "shops/:shopId",
      "membership-bootstrap",
      "commandRepository.read/insert/update/correctionExists",
      "commandRepository.lockKey/replay/persist/audit/expiredKeys",
      "dev/shops/:shopId/records",
      "moneyFixtureRepository.insert/read",
      "journalRepository.read/source/replay/positions/linked/append",
      "syntheticJobRepository.request/lock/effected/effect",
      "syntheticJobWriter.enqueue/handleSyntheticJob",
      "restoreRepository.lockState/practice",
      "syntheticJobRepository.restoreState/quarantined/quarantine",
      "syntheticFinancial/fakeOutbound",
      "scheduleRepository.run/enabled/effected/quarantine/apply",
      "enqueueDueSchedules/handleScheduledJob/redriveSyntheticJob",
      "usageRepository.append/read",
      "createUsageWriter.record/recordDraftEvent/read",
      "vocabularyRepository.current/read/resolve/append/advance",
      "reviseVocabulary/resolveVocabulary/searchSynthetic",
    ]);
    for (const [own, foreign] of [
      [a, b],
      [b, a],
    ]) {
      assert.equal(
        (await apiRequest(api, `/shops/${own.shop}`, { Cookie: own.cookie }))
          .status,
        200,
      );
      const headers = {
        Cookie: own.cookie,
        "X-Shop-Id": foreign.shop,
        "X-User-Id": foreign.user,
        "X-Actor-Id": foreign.user,
      };
      const response = await apiRequest(api, `/shops/${own.shop}`, headers);
      assert.deepEqual(await response.json(), {
        shopId: own.shop,
        name: own === a ? "சோதனை A" : "Synthetic B",
      });
      for (const id of [foreign.shop, randomUUID()]) {
        const denied = await apiRequest(api, `/shops/${id}`, headers);
        assert.equal(denied.status, 403);
        assert(!JSON.stringify(await denied.json()).includes(foreign.shop));
      }
      assert.equal(
        (await apiRequest(api, "/shops/not-a-uuid", { Cookie: own.cookie }))
          .status,
        422,
      );
      await withShop(runtime.db, own.user, own.shop, async (tx) => {
        assert.deepEqual((await context(tx)).rows[0].a, own.user);
        assert.equal(
          (await readShop(shopRepository(tx), own.shop)).shopId,
          own.shop,
        );
        assert.equal(await shopRepository(tx).read(foreign.shop), undefined);
        assert.deepEqual(
          (await tx.execute(sql`select user_id from shop_membership`)).rows.map(
            (r) => r.user_id,
          ),
          [own.user],
        );
      });
    }
    assert.equal(
      (
        await apiRequest(api, `/shops/${a.shop}`, {
          "X-User-Id": a.user,
          "X-Shop-Id": a.shop,
          "X-Actor-Id": a.user,
        })
      ).status,
      401,
    );
    assert.equal(
      (await owner.ownerShop(new Headers({ Cookie: a.cookie }))).data.shopId,
      a.shop,
    );
    await admin.query(
      "delete from shop_membership where shop_id=$1 and user_id=$2",
      [b.shop, b.user],
    );
    assert.equal(
      (await apiRequest(api, `/shops/${b.shop}`, { Cookie: b.cookie })).status,
      403,
    );
    await assert.rejects(
      withShop(runtime.db, b.user, b.shop, async () => {
        assert.fail("Revoked member entered callback");
      }),
    );
    await admin.query("delete from auth_session where user_id=$1", [a.user]);
    assert.equal(
      (await apiRequest(api, `/shops/${a.shop}`, { Cookie: a.cookie })).status,
      401,
    );
    for (const [u, s] of [
      ["", a.shop],
      [a.user, ""],
      ["bad", a.shop],
      [a.user, "bad"],
    ])
      await assert.rejects(
        withShop(runtime.db, u, s, async () =>
          assert.fail("Malformed context accepted"),
        ),
      );
  });
}, 180000);

test("0.2.2 D4/D5/D6 TRU-01 AC-38 bidirectional parent/child reads and writes, missing filters, guessed links and forged actor", async () => {
  await withTenantFixture(
    async ({ runtime, a, b, parentA, parentB, childA, childB }) => {
      for (const [own, foreign, parent, foreignParent, child, foreignChild] of [
        [a, b, parentA, parentB, childA, childB],
        [b, a, parentB, parentA, childB, childA],
      ]) {
        await withShop(runtime.db, own.user, own.shop, async (tx) => {
          const repo = fixtureRepository(tx);
          assert.equal((await repo.list()).rowCount, 1);
          assert.equal((await repo.byId(parent)).rowCount, 1);
          assert.equal((await repo.children(parent)).rowCount, 1);
          assert.equal((await repo.byId(foreignParent)).rowCount, 0);
          assert.equal((await repo.byId(randomUUID())).rowCount, 0);
          assert.equal((await repo.children(foreignParent)).rowCount, 0);
          assert.equal((await repo.update(foreignParent)).rowCount, 0);
          assert.equal((await repo.delete(foreignChild)).rowCount, 0);
          assert.equal((await repo.update(parent)).rowCount, 1);
          const id = randomUUID();
          await tx.execute(
            sql`insert into isolation_parent(shop_id,id,label) values(${own.shop}::uuid,${id}::uuid,'allowed')`,
          );
          await tx.execute(
            sql`insert into isolation_child(shop_id,parent_id,label) values(${own.shop}::uuid,${id}::uuid,'allowed-child')`,
          );
          await tx.execute(
            sql`delete from isolation_child where parent_id=${id}::uuid`,
          );
          await tx.execute(
            sql`delete from isolation_parent where id=${id}::uuid`,
          );
          assert.equal((await repo.delete(child)).rowCount, 1);
          // Keep the foreign fixture present for the reverse-direction assertions.
          await tx.execute(
            sql`insert into isolation_child(shop_id,id,parent_id,label) values(${own.shop}::uuid,${child}::uuid,${parent}::uuid,'restored-fixture')`,
          );
        });
        for (const execute of [
          (tx) =>
            tx.execute(
              sql`insert into isolation_parent(shop_id,label) values(${foreign.shop}::uuid,'forbidden')`,
            ),
          (tx) =>
            tx.execute(
              sql`update isolation_parent set shop_id=${foreign.shop}::uuid where id=${parent}::uuid`,
            ),
          (tx) =>
            tx.execute(
              sql`insert into isolation_child(shop_id,parent_id,label) values(${own.shop}::uuid,${foreignParent}::uuid,'cross-link')`,
            ),
          (tx) =>
            tx.execute(
              sql`insert into shop_membership(shop_id,user_id,role) values(${foreign.shop}::uuid,${own.user}::uuid,'owner')`,
            ),
          (tx) =>
            tx.execute(
              sql`delete from shop_membership where user_id=${own.user}::uuid`,
            ),
          (tx) =>
            tx.execute(
              sql`update shop set name='forbidden' where shop_id=${own.shop}::uuid`,
            ),
        ])
          await assert.rejects(
            withShop(runtime.db, own.user, own.shop, execute),
            (e) => ["42501", "23503"].includes(e.cause?.code),
          );
        await withShop(runtime.db, own.user, own.shop, async (tx) => {
          await tx.execute(
            sql`select set_config('app.actor_id',${foreign.user},true)`,
          );
          assert.equal(
            (await tx.execute(sql`select * from isolation_parent`)).rowCount,
            0,
          );
        });
        await withShop(runtime.db, own.user, own.shop, async (tx) => {
          await tx.execute(
            sql`select set_config('app.shop_id',${foreign.shop},true)`,
          );
          assert.equal((await tx.execute(sql`select * from shop`)).rowCount, 0);
          assert.equal(
            (await tx.execute(sql`select * from isolation_parent`)).rowCount,
            0,
          );
        });
        await assert.rejects(
          withShop(runtime.db, own.user, own.shop, async (tx) => {
            await tx.execute(
              sql`select set_config('app.shop_id',${foreign.shop},true)`,
            );
            await tx.execute(
              sql`insert into isolation_parent(shop_id,label) values(${foreign.shop}::uuid,'guessed-shop')`,
            );
          }),
        );
        await assert.rejects(
          withShop(runtime.db, own.user, own.shop, async (tx) => {
            await tx.execute(
              sql`select set_config('app.actor_id',${foreign.user},true)`,
            );
            await tx.execute(
              sql`insert into isolation_parent(shop_id,label) values(${own.shop}::uuid,'forged')`,
            );
          }),
        );
      }
      await clean(runtime.pool);
    },
  );
}, 180000);

test("0.2.2 D4 elevated fixture cannot cross-link tenants or move child links", async () => {
  await withTenantFixture(async ({ admin, a, b, parentA, parentB, childA }) => {
    for (const [table, column] of [
      ["shop", shop.shopId],
      ["shop_membership", shopMembership.shopId],
    ]) {
      assert.equal(column.name, "shop_id");
      assert.equal(column.notNull, true);
      const actual = (
        await admin.query(
          "select is_nullable,udt_name from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2",
          [table, column.name],
        )
      ).rows[0];
      assert.deepEqual(actual, { is_nullable: "NO", udt_name: "uuid" });
    }
    await assert.rejects(
      admin.query(
        "insert into isolation_child(shop_id,parent_id,label) values($1,$2,'bad')",
        [a.shop, parentB],
      ),
      { code: "23503" },
    );
    await assert.rejects(
      admin.query(
        "update isolation_child set parent_id=$1 where shop_id=$2 and id=$3",
        [parentB, a.shop, childA],
      ),
      { code: "23503" },
    );
    await assert.rejects(
      admin.query(
        "update isolation_child set shop_id=$1 where shop_id=$2 and id=$3",
        [b.shop, a.shop, childA],
      ),
      { code: "23503" },
    );
    await assert.rejects(
      admin.query(
        "insert into isolation_parent(shop_id,label) values(NULL,'missing')",
      ),
      { code: "23502" },
    );
    assert.equal(
      (
        await admin.query("select parent_id from isolation_child where id=$1", [
          childA,
        ])
      ).rows[0].parent_id,
      parentA,
    );
  });
}, 180000);

test("0.2.2 D5/D7 same physical connection A → empty → B after commit, callback failure and timeout; concurrent transaction isolation", async () => {
  await withTenantFixture(async ({ runtime, parallel, admin, a, b }) => {
    const ids = [];
    for (const own of [a, b, a, b]) {
      ids.push(
        await withShop(
          runtime.db,
          own.user,
          own.shop,
          async (tx) => (await context(tx)).rows[0].pid,
        ),
      );
      ids.push(await clean(runtime.pool));
    }
    const fail = async (tx) => {
      await tx.execute(
        sql`insert into isolation_parent(shop_id,label) values(${a.shop}::uuid,'rolled-back')`,
      );
      throw new Error("Synthetic callback failure");
    };
    await assert.rejects(
      withShop(runtime.db, a.user, a.shop, fail),
      /Synthetic callback failure/,
    );
    ids.push(await clean(runtime.pool));
    await assert.rejects(
      withShop(runtime.db, a.user, a.shop, async (tx) => {
        await tx.execute(
          sql`insert into isolation_parent(shop_id,label) values(${a.shop}::uuid,'timed-out')`,
        );
        await tx.execute(sql`select set_config('statement_timeout','50',true)`);
        await tx.execute(sql`select pg_sleep(1)`);
      }),
      (e) => e.cause?.code === "57014",
    );
    ids.push(await clean(runtime.pool));
    assert.equal(
      new Set(ids).size,
      1,
      "Pool did not reuse the same physical backend",
    );
    ids.push(
      await withShop(
        runtime.db,
        b.user,
        b.shop,
        async (tx) => (await context(tx)).rows[0].pid,
      ),
    );
    ids.push(await clean(runtime.pool));
    assert.equal(new Set(ids).size, 1);
    for (const setting of ["app.user_id", "app.shop_id", "app.actor_id"]) {
      await withShop(runtime.db, a.user, a.shop, async (tx) => {
        await tx.execute(sql`select set_config(${setting},'',true)`);
        assert.equal(
          (await tx.execute(sql`select * from isolation_parent`)).rowCount,
          0,
        );
      });
      await assert.rejects(
        withShop(runtime.db, a.user, a.shop, async (tx) => {
          await tx.execute(sql`select set_config(${setting},'',true)`);
          await tx.execute(
            sql`insert into isolation_parent(shop_id,label) values(${a.shop}::uuid,'empty-context')`,
          );
        }),
      );
    }
    assert.equal(
      (
        await admin.query(
          "select * from isolation_parent where label in ('rolled-back','timed-out')",
        )
      ).rowCount,
      0,
    );
    // Empty user/shop settings deny reads and writes outside withShop.
    await runtime.db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.user_id','',true),set_config('app.shop_id','',true),set_config('app.actor_id','',true)`,
      );
      assert.equal(
        (await tx.execute(sql`select * from shop_membership`)).rowCount,
        0,
      );
      assert.equal((await tx.execute(sql`select * from shop`)).rowCount, 0);
    });
    await assert.rejects(
      runtime.db.transaction((tx) =>
        tx.execute(
          sql`insert into isolation_parent(shop_id,label) values(${a.shop}::uuid,'no-context')`,
        ),
      ),
    );
    let entered = 0,
      release;
    const rendezvous = new Promise((resolve) => {
      release = resolve;
    });
    const rows = await Promise.all(
      [a, b].map((own) =>
        withShop(parallel.db, own.user, own.shop, async (tx) => {
          if (++entered === 2) release();
          await rendezvous;
          const found = await tx.execute(
            sql`select shop_id from isolation_parent`,
          );
          assert(found.rows.every((r) => r.shop_id === own.shop));
          return (await context(tx)).rows[0];
        }),
      ),
    );
    assert.notEqual(rows[0].pid, rows[1].pid);
    // Fixture-only authorised switching: same verified identity, two explicit memberships.
    await admin.query(
      "insert into shop_membership(shop_id,user_id,role) values($1,$2,'owner')",
      [b.shop, a.user],
    );
    assert.equal(
      (await withShop(runtime.db, a.user, b.shop, context)).rows[0].s,
      b.shop,
    );
    await clean(runtime.pool);
  });
}, 180000);

test("0.2.2 D3/D8 real catalog gate rejects FORCE/write-check/policy/grant/schema drift and privilege escalation", async () => {
  await withTenantFixture(async ({ runtime, migration, admin }) => {
    assert.deepEqual(await assertIsolationCatalog(runtime.db), [
      "public.audit_event",
      "public.consent_record",
      "public.customer",
      "public.customer_person",
      "public.customer_search_key",
      "public.customer_wearer_relationship",
      "public.document_artifact",
      "public.document_attempt",
      "public.document_cleanup",
      "public.document_output",
      "public.document_revision",
      "public.document_share_event",
      "public.durable_draft",
      "public.guardian_authority",
      "public.guardian_purpose_event",
      "public.guardian_verification_event",
      "public.idempotency_key",
      "public.isolation_child",
      "public.isolation_parent",
      "public.job_schedule",
      "public.job_schedule_effect",
      "public.job_schedule_event",
      "public.job_schedule_quarantine",
      "public.job_schedule_run",
      "public.journal_batch",
      "public.journal_entry",
      "public.measurement_form_availability",
      "public.measurement_form_entry",
      "public.measurement_form_illustration",
      "public.measurement_form_reference",
      "public.measurement_form_revision",
      "public.media_asset",
      "public.media_attempt",
      "public.media_cleanup_intent",
      "public.media_derivative",
      "public.media_reference",
      "public.privacy_notice_version",
      "public.product_event",
      "public.service_catalogue_availability",
      "public.service_catalogue_entry",
      "public.service_catalogue_reference",
      "public.service_catalogue_revision",
      "public.service_commitment_binding",
      "public.service_commitment_binding_revision",
      "public.service_template_availability",
      "public.service_template_edge",
      "public.service_template_entry",
      "public.service_template_form",
      "public.service_template_item",
      "public.service_template_quality_task",
      "public.service_template_reference",
      "public.service_template_revision",
      "public.shop",
      "public.shop_calendar",
      "public.shop_calendar_revision",
      "public.shop_commitments",
      "public.shop_commitments_revision",
      "public.shop_directory",
      "public.shop_directory_revision",
      "public.shop_membership",
      "public.shop_policies",
      "public.shop_policies_revision",
      "public.shop_profile",
      "public.shop_profile_revision",
      "public.vocabulary",
      "public.vocabulary_revision",
      "public.vocabulary_search_key",
      "public.wearer",
      "public.wearer_age_event",
      "public.wearer_preference_event",
      "public.wearer_preferences",
      "public.wearer_purpose_event",
      "public.wearer_relationship_event",
    ]);
    for (const [alter, restore, pattern] of [
      [
        "alter table isolation_parent no force row level security",
        "alter table isolation_parent force row level security",
        /ENABLE\/FORCE/,
      ],
      [
        "alter policy tenant_context on isolation_parent with check(true)",
        "alter policy tenant_context on isolation_parent with check(shop_context_allows(shop_id))",
        /read\/write guard/,
      ],
      [
        "drop policy tenant_context on isolation_parent; create policy tenant_context on isolation_parent as restrictive for all to app_user using(shop_context_allows(shop_id))",
        "drop policy tenant_context on isolation_parent; create policy tenant_context on isolation_parent as restrictive for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id))",
        /read\/write guard/,
      ],
      [
        "drop policy tenant_access on isolation_child",
        "create policy tenant_access on isolation_child for all to app_user using(shop_context_allows(shop_id)) with check(shop_context_allows(shop_id))",
        /coverage/,
      ],
      [
        "create table unclassified(id uuid)",
        "drop table unclassified",
        /unclassified/,
      ],
      [
        "grant truncate on isolation_parent to app_user",
        "revoke truncate on isolation_parent from app_user",
        /grants/,
      ],
      [
        "grant update on isolation_parent to app_backup",
        "revoke update on isolation_parent from app_backup",
        /maintenance grants/,
      ],
      [
        "grant update(label) on isolation_parent to app_backup",
        "revoke update(label) on isolation_parent from app_backup",
        /maintenance grants/,
      ],
      [
        "grant select(label) on isolation_parent to app_privacy",
        "revoke select(label) on isolation_parent from app_privacy",
        /maintenance grants/,
      ],
      [
        "grant insert on shop to app_user",
        "revoke insert on shop from app_user",
        /bootstrap-only write grants/,
      ],
    ]) {
      await migration.query(alter);
      try {
        await assert.rejects(assertIsolationCatalog(runtime.db), pattern);
      } finally {
        await migration.query(restore);
      }
      await assertIsolationCatalog(runtime.db);
    }
    for (const role of ["app_owner", "app_backup", "app_privacy"]) {
      await assert.rejects(runtime.pool.query(`set role ${role}`), {
        code: "42501",
      });
      await admin.query(`grant ${role} to app_user`);
      try {
        await assert.rejects(
          requireRuntimeRole(runtime.db),
          /Runtime database role denied/,
        );
      } finally {
        await admin.query(`revoke ${role} from app_user`);
      }
    }
    await requireRuntimeRole(runtime.db);
    await admin.query(
      "create role isolation_bypass nologin bypassrls; grant isolation_bypass to app_user",
    );
    try {
      await assert.rejects(
        requireRuntimeRole(runtime.db),
        /Runtime database role denied/,
      );
    } finally {
      await admin.query(
        "revoke isolation_bypass from app_user; drop role isolation_bypass",
      );
    }
    const privileged = await admin.connect();
    try {
      await privileged.query("begin; set local role app_backup");
      assert.equal((await privileged.query("select * from shop")).rowCount, 2);
      await assert.rejects(privileged.query("delete from shop"), {
        code: "42501",
      });
      await privileged.query("rollback; begin; set local role app_privacy");
      await assert.rejects(privileged.query("select * from public.shop"), {
        code: "42501",
      });
      await privileged.query("rollback");
    } finally {
      privileged.release();
    }
  });
}, 180000);

test("0.2.2 D9 retained 0.2.1 schema upgrades under advisory locking; bootstrap attribution is unchanged and immutable", async () => {
  await withTenantFixture(
    async ({ runtime, migrationConnectionString, admin, api, a, b }) => {
      const before = (await admin.query("select * from owner_bootstrap")).rows;
      // Mimic retained 0.2.1 provisioning without maintenance roles. Migration
      // must fail atomically until the separately selected privileged upgrade.
      await admin.query("drop role app_backup, app_privacy");
      await assert.rejects(
        migrateDatabase(migrationConnectionString),
        /app_backup/,
      );
      assert.deepEqual(
        (await admin.query("select * from owner_bootstrap")).rows,
        before,
      );
      const provision = await readFile(
        "infra/provision-maintenance-roles.sql",
        "utf8",
      );
      await admin.query(provision);
      await admin.query(provision); // Explicit provisioning is safely repeatable.
      await Promise.all([
        migrateDatabase(migrationConnectionString),
        migrateDatabase(migrationConnectionString),
      ]);
      assert.deepEqual(
        (await admin.query("select * from owner_bootstrap")).rows,
        before,
      );
      assert.equal(
        (await admin.query("select * from shop_membership")).rowCount,
        2,
      );
      assert.deepEqual(await assertIsolationCatalog(runtime.db), [
        "public.audit_event",
        "public.consent_record",
        "public.customer",
        "public.customer_person",
        "public.customer_search_key",
        "public.customer_wearer_relationship",
        "public.document_artifact",
        "public.document_attempt",
        "public.document_cleanup",
        "public.document_output",
        "public.document_revision",
        "public.document_share_event",
        "public.durable_draft",
        "public.guardian_authority",
        "public.guardian_purpose_event",
        "public.guardian_verification_event",
        "public.idempotency_key",
        "public.job_schedule",
        "public.job_schedule_effect",
        "public.job_schedule_event",
        "public.job_schedule_quarantine",
        "public.job_schedule_run",
        "public.journal_batch",
        "public.journal_entry",
        "public.measurement_form_availability",
        "public.measurement_form_entry",
        "public.measurement_form_illustration",
        "public.measurement_form_reference",
        "public.measurement_form_revision",
        "public.media_asset",
        "public.media_attempt",
        "public.media_cleanup_intent",
        "public.media_derivative",
        "public.media_reference",
        "public.privacy_notice_version",
        "public.product_event",
        "public.service_catalogue_availability",
        "public.service_catalogue_entry",
        "public.service_catalogue_reference",
        "public.service_catalogue_revision",
        "public.service_commitment_binding",
        "public.service_commitment_binding_revision",
        "public.service_template_availability",
        "public.service_template_edge",
        "public.service_template_entry",
        "public.service_template_form",
        "public.service_template_item",
        "public.service_template_quality_task",
        "public.service_template_reference",
        "public.service_template_revision",
        "public.shop",
        "public.shop_calendar",
        "public.shop_calendar_revision",
        "public.shop_commitments",
        "public.shop_commitments_revision",
        "public.shop_directory",
        "public.shop_directory_revision",
        "public.shop_membership",
        "public.shop_policies",
        "public.shop_policies_revision",
        "public.shop_profile",
        "public.shop_profile_revision",
        "public.vocabulary",
        "public.vocabulary_revision",
        "public.vocabulary_search_key",
        "public.wearer",
        "public.wearer_age_event",
        "public.wearer_preference_event",
        "public.wearer_preferences",
        "public.wearer_purpose_event",
        "public.wearer_relationship_event",
      ]);
      assert.equal(
        (await apiRequest(api, `/shops/${a.shop}`, { Cookie: a.cookie }))
          .status,
        200,
      );
      assert.equal(
        (await apiRequest(api, `/shops/${b.shop}`, { Cookie: a.cookie }))
          .status,
        403,
      );
      await assert.rejects(
        runtime.pool.query("update owner_bootstrap set completed_at=NULL"),
        { code: "42501" },
      );
      await assert.rejects(
        admin.query("update owner_bootstrap set shop_id=$1", [b.shop]),
        /Bootstrap provenance is immutable/,
      );
      assert.deepEqual(
        (await admin.query("select * from owner_bootstrap")).rows,
        before,
      );
    },
    { legacy: true },
  );
}, 180000);
