import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApi } from "@aarili/api";
import { syntheticCustomerPolicy } from "@aarili/core/customer-policy";
import { mutateDraft } from "@aarili/core/drafts";
import {
  syntheticGuardianPolicy,
  syntheticWearerPolicy,
} from "@aarili/core/wearer-policy";
import {
  guardianDraftWorkflow,
  mutateGuardian,
  mutateWearer,
} from "@aarili/core/wearers";
import { sql, withShop } from "@aarili/db";
import { draftRepository } from "@aarili/db/draft-repository";
import { assertIsolationCatalog } from "@aarili/db/isolation-catalog";
import {
  guardianRepository,
  wearerRepository,
} from "@aarili/db/wearer-repository";
import { test } from "vitest";
import { withTenantFixture } from "../scripts/test-support/tenant-isolation.mjs";

const origin = "http://127.0.0.1:3103",
  at = "2026-10-17T00:00:00.000Z";
const prefs = {
  language: "",
  channel: "",
  fit: "",
  style: "",
  delivery: "",
  source: "",
};
function request(f, path, method = "GET", body, headers = {}, who = f.a) {
  return f.api.fetch(
    new Request(`${origin}/api/shops/${who.shop}${path}`, {
      method,
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}
async function okay(r) {
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  return r.json();
}
async function rejected(r, status, code) {
  assert.equal(r.status, status, JSON.stringify(await r.clone().json()));
  assert.equal((await r.json()).error.code, code);
}
async function fixture(work) {
  await withTenantFixture(
    async (f) => {
      f.api = createApi(async () => true, {
        ...f.owner,
        commandLimit: async () => 0,
      });
      await work(f);
    },
    { customerPolicy: syntheticCustomerPolicy },
  );
}
async function customer(f, who = f.a) {
  const r = await okay(
    await request(
      f,
      "/customers",
      "POST",
      {
        displayName: "Synthetic aunt contact",
        aliases: [],
        serviceEvidence: {
          noticeId: syntheticCustomerPolicy.notice.id,
          language: "en",
          decision: "grant",
          giver: "self",
          noticeExplained: true,
          source: "phone",
          occurredAt: at,
        },
      },
      { "Idempotency-Key": randomUUID() },
      who,
    ),
  );
  return okay(
    await request(f, `/customers/${r.customerId}`, "GET", undefined, {}, who),
  );
}
const base = (c, id) => `/customers/${c.id}/wearers/${id}`;
const path = (c, id) => `${base(c, id)}/guardians`;
async function child(f, c, age = "minor") {
  const r = await okay(
    await request(
      f,
      `/customers/${c.id}/wearers`,
      "POST",
      {
        mode: "new",
        displayName: "Synthetic child",
        age,
        preferences: prefs,
        relationship: {
          kind: "family",
          statementByPersonId: c.personId,
          authorised: true,
          informed: true,
          source: "phone",
          occurredAt: at,
          interaction: "Synthetic aunt registration",
        },
      },
      { "Idempotency-Key": randomUUID() },
    ),
  );
  return okay(await request(f, base(c, r.wearerId)));
}
const claimInput = (overrides = {}) => ({
  guardian: { mode: "new", displayName: "Synthetic parent" },
  authority: "parent",
  scope: "measurement-and-private-photo",
  source: "phone",
  occurredAt: at,
  ...overrides,
});
const headers = (version, key = randomUUID()) => ({
  "Idempotency-Key": key,
  "If-Match": `"v${version}"`,
});
async function claim(f, c, w, input = claimInput(), key = randomUUID()) {
  return okay(
    await request(f, path(c, w.id), "POST", input, headers(w.version, key)),
  );
}
async function read(f, c, id) {
  return okay(await request(f, path(c, id)));
}
const verification = (a, overrides = {}) => ({
  authorityId: a.id,
  status: "confirmed",
  method: "synthetic-review-v1",
  evidenceRef: "Invented reference fixture-only 80",
  scope: a.scope,
  source: "in-person",
  occurredAt: at,
  ...overrides,
});
const purpose = (a, overrides = {}) => ({
  authorityId: a.id,
  purpose: "measurement",
  decision: "grant",
  noticeId: syntheticGuardianPolicy.notice.id,
  noticeExplained: true,
  language: "ta",
  giverPersonId: a.personId,
  source: "in-person",
  occurredAt: at,
  ...overrides,
});
async function verify(f, c, id, p, input = verification(p.authority)) {
  return okay(
    await request(
      f,
      `${path(c, id)}/verification-events`,
      "POST",
      input,
      headers(p.version),
    ),
  );
}
async function consent(
  f,
  c,
  id,
  p,
  input = purpose(p.authority),
  key = randomUUID(),
) {
  return okay(
    await request(
      f,
      `${path(c, id)}/consent-events`,
      "POST",
      input,
      headers(p.version, key),
    ),
  );
}
async function age(f, c, id, value) {
  const w = await okay(await request(f, base(c, id)));
  const { id: _, customerId: __, ...relationship } = w.relationship;
  await okay(
    await request(
      f,
      base(c, id),
      "PATCH",
      { age: value, preferences: w.preferences, relationship },
      headers(w.version),
    ),
  );
}
function run(f, work) {
  return withShop(f.parallel.db, f.a.user, f.a.shop, (tx) =>
    work(
      {
        shopId: f.a.shop,
        actor: { type: "user", id: f.a.user },
        repository: guardianRepository(
          tx,
          f.a.shop,
          syntheticGuardianPolicy.notice.id,
        ),
        wearers: wearerRepository(tx, f.a.shop),
        policy: syntheticGuardianPolicy,
      },
      tx,
    ),
  );
}
async function counts(f) {
  return (
    await f.admin.query(
      `select (select count(*) from guardian_authority)::int a,(select count(*) from guardian_verification_event)::int v,(select count(*) from guardian_purpose_event)::int p,(select count(*) from customer_person)::int people,(select count(*) from audit_event)::int audit,(select count(*) from idempotency_key)::int keys`,
    )
  ).rows[0];
}

test(
  "CW-09/11 separate aunt child parent; pending refusal, explicit synthetic verification, independent purposes and immutable linked withdrawal",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await customer(f),
        w = await child(f, c),
        key = randomUUID(),
        input = claimInput();
      // Separate pool connections exercise overlapping key/subject locks rather
      // than allowing the single-connection owner API pool to serialize retries.
      const [first, replay] = await Promise.all([
        run(f, (ctx) =>
          mutateGuardian(ctx, c.id, w.id, "claim", input, {
            key,
            requestId: randomUUID(),
            ifMatch: `"v${w.version}"`,
          }),
        ),
        run(f, (ctx) =>
          mutateGuardian(
            ctx,
            c.id.toUpperCase(),
            w.id.toUpperCase(),
            "claim",
            input,
            {
              key: key.toUpperCase(),
              requestId: randomUUID(),
              ifMatch: `"v${w.version}"`,
            },
          ),
        ),
      ]);
      assert.deepEqual(replay, first);
      assert.deepEqual(
        await okay(
          await request(
            f,
            path({ id: c.id.toUpperCase() }, w.id.toUpperCase()),
            "POST",
            input,
            headers(w.version, key.toUpperCase()),
          ),
        ),
        first,
      );
      assert.deepEqual(await claim(f, c, w, input, key), first);
      await rejected(
        await request(
          f,
          path(c, w.id),
          "POST",
          claimInput({ authority: "legal-guardian" }),
          headers(w.version, key),
        ),
        422,
        "IDEMPOTENCY_MISMATCH",
      );
      let p = await read(f, c, w.id),
        a = p.authority;
      assert(a);
      assert.notEqual(a.personId, c.personId);
      assert.notEqual(a.personId, w.personId);
      assert.equal(a.status, "pending");
      assert.equal(a.verifiedCurrent, false);
      await rejected(
        await request(
          f,
          `${path(c, w.id)}/consent-events`,
          "POST",
          purpose(a, { giverPersonId: c.personId }),
          headers(p.version),
        ),
        409,
        "GUARDIAN_GIVER_INVALID",
      );
      await rejected(
        await request(
          f,
          `${path(c, w.id)}/consent-events`,
          "POST",
          purpose(a),
          headers(p.version),
        ),
        409,
        "VERIFIED_GUARDIAN_REQUIRED",
      );
      await consent(
        f,
        c,
        w.id,
        p,
        purpose(a, { purpose: "private-photo", decision: "refusal" }),
      );
      p = await read(f, c, w.id);
      assert.equal(p.purposes[0].eligible, false);
      await rejected(
        await request(
          f,
          `${path(c, w.id)}/verification-events`,
          "POST",
          verification(a, { method: "not-verified" }),
          headers(p.version),
        ),
        409,
        "SYNTHETIC_VERIFICATION_REQUIRED",
      );
      await verify(f, c, w.id, p);
      p = await read(f, c, w.id);
      assert.equal(p.authority.verifiedCurrent, true);
      assert.equal(p.authority.verifications[0].recordedBy, f.a.user);
      for (const purposeName of ["marketing", "publication"])
        await rejected(
          await request(
            f,
            `${path(c, w.id)}/consent-events`,
            "POST",
            purpose(a, { purpose: purposeName }),
            headers(p.version),
          ),
          409,
          "MINOR_PURPOSE_PROHIBITED",
        );
      const grantKey = randomUUID(),
        grantVersion = p.version,
        grant = await consent(f, c, w.id, p, purpose(a), grantKey);
      p = await read(f, c, w.id);
      assert.equal(
        p.purposes.find((x) => x.purpose === "measurement").eligible,
        true,
      );
      assert.equal(
        p.purposes.find((x) => x.purpose === "private-photo").decision,
        "refusal",
      );
      const previous = p.purposes.find((x) => x.purpose === "measurement");
      await consent(f, c, w.id, p, purpose(a, { decision: "withdrawal" }));
      p = await read(f, c, w.id);
      const withdrawal = p.purposes.find((x) => x.purpose === "measurement");
      assert.equal(withdrawal.previousId, previous.id);
      assert.equal(withdrawal.eligible, false);
      assert.deepEqual(
        await okay(
          await request(
            f,
            `${path(c, w.id)}/consent-events`,
            "POST",
            purpose(a),
            headers(grantVersion, grantKey),
          ),
        ),
        grant,
      );
      assert.equal(
        (await read(f, c, w.id)).purposes.find(
          (x) => x.purpose === "measurement",
        ).eligible,
        false,
      );
      const history = await f.admin.query(
        "select decision,giver_person_id from guardian_purpose_event where wearer_id=$1 and purpose=$2 order by wearer_version",
        [w.id, "measurement"],
      );
      assert.deepEqual(
        history.rows.map((x) => x.decision),
        ["grant", "withdrawal"],
      );
      assert(history.rows.every((x) => x.giver_person_id === a.personId));
      const receipts = await f.admin.query(
        "select response from idempotency_key where action like 'guardian.%'",
      );
      for (const row of receipts.rows)
        assert.deepEqual(Object.keys(row.response).sort(), [
          "authorityId",
          "version",
          "wearerId",
        ]);
      const audit = await f.admin.query(
        "select changes from audit_event where action like 'guardian.%'",
      );
      for (const row of audit.rows)
        assert.deepEqual(Object.keys(row.changes).sort(), [
          "synthetic",
          "version",
        ]);
      const discovery = await okay(
        await request(f, "/guardian-people/search", "POST", {
          query: "Synthetic parent",
          limit: 10,
        }),
      );
      assert.equal(discovery.people.length, 1);
      assert.deepEqual(Object.keys(discovery.people[0]).sort(), [
        "displayName",
        "personId",
      ]);
    }),
);

test(
  "CW-09/11 TRU-01 wrong subject/giver/scope/notice/tenant, self guardianship, FORCE RLS, raw FK, pooled missing context and strict admission",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await customer(f),
        w = await child(f, c);
      await rejected(
        await request(
          f,
          path(c, w.id),
          "POST",
          claimInput({ guardian: { mode: "existing", personId: w.personId } }),
          headers(w.version),
        ),
        409,
        "SELF_GUARDIANSHIP_DENIED",
      );
      const bc = await customer(f, f.b);
      await rejected(
        await request(
          f,
          path(c, w.id),
          "POST",
          claimInput({ guardian: { mode: "existing", personId: bc.personId } }),
          headers(w.version),
        ),
        404,
        "GUARDIAN_NOT_FOUND",
      );
      await claim(f, c, w);
      let p = await read(f, c, w.id);
      await verify(f, c, w.id, p);
      p = await read(f, c, w.id);
      const other = await child(f, c);
      const rollbackKey = randomUUID(),
        before = await counts(f);
      await assert.rejects(
        run(f, (ctx) =>
          mutateGuardian(
            {
              ...ctx,
              repository: {
                ...ctx.repository,
                audit: async () => {
                  throw Error("Injected direct guardian audit failure");
                },
              },
            },
            c.id,
            w.id,
            "purpose",
            purpose(p.authority),
            {
              key: rollbackKey,
              requestId: randomUUID(),
              ifMatch: `"v${p.version}"`,
            },
          ),
        ),
        { message: "Injected direct guardian audit failure" },
      );
      assert.deepEqual(await counts(f), before);
      const retry = await consent(
        f,
        c,
        w.id,
        p,
        purpose(p.authority),
        rollbackKey,
      );
      assert.equal(retry.version, p.version + 1);
      p = await read(f, c, w.id);
      await rejected(
        await request(
          f,
          `${path(c, other.id)}/consent-events`,
          "POST",
          purpose(p.authority),
          headers(other.version),
        ),
        409,
        "GUARDIAN_AUTHORITY_INVALID",
      );
      await rejected(
        await request(
          f,
          `${path(c, w.id)}/consent-events`,
          "POST",
          purpose(p.authority, { noticeId: randomUUID() }),
          headers(p.version),
        ),
        409,
        "NOTICE_VERSION_STALE",
      );
      await rejected(
        await request(
          f,
          `${path(c, w.id)}/verification-events`,
          "POST",
          verification(p.authority, { scope: "measurement" }),
          headers(p.version),
        ),
        409,
        "GUARDIAN_SCOPE_INVALID",
      );
      await rejected(
        await request(f, path(c, w.id), "GET", undefined, {}, f.b),
        404,
        "NOT_FOUND",
      );
      await rejected(
        await request(f, path(c, w.id), "POST", claimInput(), {
          "Idempotency-Key": randomUUID(),
        }),
        428,
        "PRECONDITION_REQUIRED",
      );
      await rejected(
        await request(f, path(c, w.id), "POST", claimInput(), headers(1)),
        412,
        "VERSION_STALE",
      );
      await rejected(
        await request(f, path(c, w.id), "POST", claimInput(), {
          ...headers(p.version),
          Origin: "https://wrong.invalid",
        }),
        403,
        "UNSAFE_ORIGIN",
      );
      const bad = await f.api.fetch(
        new Request(`${origin}/api/shops/${f.a.shop}${path(c, w.id)}`, {
          method: "POST",
          headers: {
            Origin: origin,
            Cookie: f.a.cookie,
            "Content-Type": "application/json",
            ...headers(p.version),
          },
          body: "{",
        }),
      );
      await rejected(bad, 422, "VALIDATION_FAILED");
      await rejected(
        await request(
          f,
          path(c, w.id),
          "POST",
          claimInput({
            guardian: { mode: "new", displayName: "x".repeat(66000) },
          }),
          headers(p.version),
        ),
        413,
        "INVALID_REQUEST",
      );
      await assertIsolationCatalog(f.runtime.db);
      assert.equal(
        (
          await f.runtime.db.execute(
            sql`select count(*)::int n from guardian_authority`,
          )
        ).rows[0].n,
        0,
      );
      await run(f, async (_ctx, tx) => {
        assert.equal(
          (
            await tx.execute(
              sql`select count(*)::int n from guardian_authority`,
            )
          ).rows[0].n,
          1,
        );
      });
      assert.equal(
        (
          await f.runtime.db.execute(
            sql`select count(*)::int n from guardian_authority`,
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(
        withShop(f.runtime.db, f.a.user, f.a.shop, async (tx) => {
          await tx.execute(
            sql`update wearer set version=version+1,authority_epoch=authority_epoch+1,updated_by=${f.a.user}::uuid where shop_id=${f.a.shop}::uuid and id=${w.id}::uuid`,
          );
          await tx.execute(
            sql`insert into guardian_authority(shop_id,id,wearer_id,person_id,authority,scope,source,occurred_at,wearer_version,authority_epoch,recorded_by,synthetic) select ${f.a.shop}::uuid,uuidv7(),id,${bc.personId}::uuid,'parent','measurement','phone',now(),version,authority_epoch,${f.a.user}::uuid,true from wearer where shop_id=${f.a.shop}::uuid and id=${w.id}::uuid`,
          );
        }),
        (e) => e.cause?.code === "23503" || e.code === "23503",
      );
      await assert.rejects(
        run(f, async (_ctx, tx) =>
          tx.execute(
            sql`update guardian_authority set scope='measurement' where shop_id=${f.a.shop}::uuid`,
          ),
        ),
      );
      await assert.rejects(
        run(f, async (_ctx, tx) =>
          tx.execute(
            sql`delete from guardian_purpose_event where shop_id=${f.a.shop}::uuid`,
          ),
        ),
      );
      const exact = [
        "guardian_authority",
        "guardian_purpose_event",
        "guardian_verification_event",
      ];
      const policies = await f.admin.query(
        "select relname,relrowsecurity,relforcerowsecurity from pg_class where relname=any($1::text[])",
        [exact],
      );
      assert.equal(policies.rows.length, 3);
      assert(
        policies.rows.every((x) => x.relrowsecurity && x.relforcerowsecurity),
      );
    }),
);

test(
  "CW-06/09/13 concurrent age grant and authority replacement serialize; no old grant revival and withdrawal keeps old giver",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await customer(f),
        w = await child(f, c);
      await claim(f, c, w);
      let p = await read(f, c, w.id);
      await verify(f, c, w.id, p);
      p = await read(f, c, w.id);
      const a = p.authority;
      const current = await okay(await request(f, base(c, w.id))),
        { id: _, customerId: __, ...relationship } = current.relationship;
      const raced = await Promise.allSettled([
        run(f, (ctx) =>
          mutateGuardian(ctx, c.id, w.id, "purpose", purpose(a), {
            key: randomUUID(),
            requestId: randomUUID(),
            ifMatch: `"v${p.version}"`,
          }),
        ),
        run(f, (ctx) =>
          mutateWearer(
            {
              shopId: ctx.shopId,
              actor: ctx.actor,
              repository: ctx.wearers,
              policy: syntheticWearerPolicy,
            },
            c.id,
            "update",
            w.id,
            { age: "unknown", preferences: current.preferences, relationship },
            {
              key: randomUUID(),
              requestId: randomUUID(),
              ifMatch: `"v${p.version}"`,
            },
          ),
        ),
      ]);
      assert.deepEqual(
        raced
          .map((x) => (x.status === "fulfilled" ? 200 : x.reason.status))
          .sort(),
        [200, 412],
      );
      p = await read(f, c, w.id);
      if (!p.purposes.some((x) => x.purpose === "measurement")) {
        await age(f, c, w.id, "minor");
        p = await read(f, c, w.id);
        await verify(f, c, w.id, p);
        p = await read(f, c, w.id);
        await consent(f, c, w.id, p);
      }
      await age(f, c, w.id, "unknown");
      assert.equal((await read(f, c, w.id)).purposes[0].eligible, false);
      await age(f, c, w.id, "minor");
      p = await read(f, c, w.id);
      assert.equal(p.authority.status, "confirmed");
      assert.equal(p.authority.verifiedCurrent, false);
      assert.equal(p.purposes[0].eligible, false);
      await rejected(
        await request(
          f,
          `${path(c, w.id)}/consent-events`,
          "POST",
          purpose(a),
          headers(p.version),
        ),
        409,
        "GUARDIAN_REVIEW_REQUIRED",
      );
      const c2 = await okay(await request(f, base(c, w.id)));
      await claim(
        f,
        c,
        c2,
        claimInput({
          guardian: {
            mode: "new",
            displayName: "Synthetic replacement guardian",
          },
        }),
      );
      p = await read(f, c, w.id);
      assert.equal(p.authorities.length, 2);
      assert.equal(p.authority.status, "pending");
      assert.equal(p.purposes[0].eligible, false);
      await consent(f, c, w.id, p, purpose(a, { decision: "withdrawal" }));
      p = await read(f, c, w.id);
      assert.equal(p.purposes[0].giverPersonId, a.personId);
      assert.equal(p.purposes[0].decision, "withdrawal");
      await rejected(
        await request(
          f,
          `${path(c, w.id)}/verification-events`,
          "POST",
          verification(a),
          headers(p.version),
        ),
        409,
        "CURRENT_MINOR_AUTHORITY_REQUIRED",
      );
      await verify(f, c, w.id, p);
      p = await read(f, c, w.id);
      await consent(
        f,
        c,
        w.id,
        p,
        purpose(p.authority, { purpose: "private-photo" }),
      );
      p = await read(f, c, w.id);
      assert.equal(
        p.purposes.find((x) => x.authorityId === p.authority.id).eligible,
        true,
      );
      await verify(
        f,
        c,
        w.id,
        p,
        verification(p.authority, {
          status: "withdrawn",
          method: "not-verified",
          evidenceRef: "Invented withdrawal",
        }),
      );
      p = await read(f, c, w.id);
      assert(p.purposes.every((x) => !x.eligible));
      assert.equal(
        p.authority.verifications.at(-1).previousId,
        p.authority.verifications[0].id,
      );
    }),
);

test(
  "CW-06/12/13 guardian durable draft incomplete/save/resume/current promotion, origin FK exact replay and audit rollback atomicity",
  { timeout: 180000 },
  async () =>
    fixture(async (f) => {
      const c = await customer(f),
        w = await child(f, c),
        id = (await f.admin.query("select uuidv7() id")).rows[0].id;
      const payload = {
        synthetic: true,
        noticeId: syntheticGuardianPolicy.notice.id,
        customerId: c.id,
        customerVersion: c.version,
        wearerId: w.id,
        wearerVersion: w.version,
        claim: { guardian: { mode: "new", displayName: "" } },
      };
      const save = (draftId, body, version) =>
        request(
          f,
          `/drafts/${draftId}`,
          "PUT",
          { workflow: "wearer.guardian", schemaVersion: 1, payload: body },
          {
            "Idempotency-Key": randomUUID(),
            ...(version ? { "If-Match": `"v${version}"` } : {}),
          },
        );
      const promote = (draftId, key = randomUUID(), version = 1) =>
        request(
          f,
          `/drafts/${draftId}/promote`,
          "POST",
          {},
          headers(version, key),
        );
      await okay(await save(id, payload));
      assert.equal(
        (await okay(await request(f, `/drafts/${id}`))).payload.claim.guardian
          .displayName,
        "",
      );
      await rejected(await promote(id), 422, "VALIDATION_FAILED");
      payload.claim = claimInput();
      await okay(await save(id, payload, 1));
      const failKey = randomUUID(),
        before = await counts(f);
      await assert.rejects(
        run(f, (ctx, tx) =>
          mutateDraft(
            {
              shopId: f.a.shop,
              actor: ctx.actor,
              repository: draftRepository(tx, f.a.shop),
              workflows: new Map([
                [
                  "wearer.guardian",
                  guardianDraftWorkflow({
                    ...ctx,
                    repository: {
                      ...ctx.repository,
                      audit: async () => {
                        throw Error("Injected guardian audit failure");
                      },
                    },
                  }),
                ],
              ]),
            },
            id,
            "promote",
            {},
            { key: failKey, requestId: randomUUID(), ifMatch: '"v2"' },
          ),
        ),
        { message: "Injected guardian audit failure" },
      );
      assert.deepEqual(await counts(f), before);
      assert.equal(
        (await okay(await request(f, `/drafts/${id}`))).lifecycle,
        "active",
      );
      const key = randomUUID(),
        result = await okay(await promote(id, key, 2));
      assert.deepEqual(await okay(await promote(id, key, 2)), result);
      const p = await read(f, c, w.id);
      assert.equal(p.authority.id, result.draft.result.id);
      assert.equal(p.authority.originDraftId, id);
      assert.equal(p.authority.status, "pending");
      const stale = (await f.admin.query("select uuidv7() id")).rows[0].id;
      await okay(
        await save(stale, {
          ...payload,
          wearerVersion: p.version,
          noticeId: randomUUID(),
        }),
      );
      await rejected(await promote(stale), 409, "REQUEST_CONFLICT");
      const staleAge = (await f.admin.query("select uuidv7() id")).rows[0].id;
      await okay(
        await save(staleAge, { ...payload, wearerVersion: p.version }),
      );
      await age(f, c, w.id, "unknown");
      await rejected(await promote(staleAge), 409, "REQUEST_CONFLICT");
      const cross = (await f.admin.query("select uuidv7() id")).rows[0].id;
      await okay(await save(cross, { ...payload, customerId: randomUUID() }));
      await rejected(await promote(cross), 404, "NOT_FOUND");
    }),
);

test("CW-08/09 default production composition blocks guardian mutations and draft workflow; adult endpoint still rejects minor grants", {
  timeout: 180000,
}, async () => {
  await withTenantFixture(async (f) => {
    const p = await okay(await request(f, "/guardians/policy"));
    assert.equal(p.enabled, false);
    await rejected(
      await request(
        f,
        `/customers/${randomUUID()}/wearers/${randomUUID()}/guardians`,
        "POST",
        claimInput(),
        headers(1),
      ),
      409,
      "GUARDIAN_POLICY_PENDING",
    );
    const id = (await f.admin.query("select uuidv7() id")).rows[0].id;
    await rejected(
      await request(
        f,
        `/drafts/${id}`,
        "PUT",
        { workflow: "wearer.guardian", schemaVersion: 1, payload: {} },
        { "Idempotency-Key": randomUUID() },
      ),
      422,
      "VALIDATION_FAILED",
    );
  });
  await fixture(async (f) => {
    const c = await customer(f),
      w = await child(f, c);
    await rejected(
      await request(
        f,
        `${base(c, w.id)}/consent-events`,
        "POST",
        {
          purpose: "private-media",
          decision: "grant",
          noticeId: "019e70b1-0000-7000-8000-000000000079",
          noticeExplained: true,
          language: "en",
          giverPersonId: w.personId,
          source: "phone",
          occurredAt: at,
        },
        headers(w.version),
      ),
      409,
      "ADULT_AUTHORITY_REQUIRED",
    );
    for (const ageValue of ["unknown", "adult"]) {
      const other = await child(f, c, ageValue);
      await rejected(
        await request(
          f,
          path(c, other.id),
          "POST",
          claimInput(),
          headers(other.version),
        ),
        409,
        "EXPLICIT_MINOR_REQUIRED",
      );
    }
  });
});
