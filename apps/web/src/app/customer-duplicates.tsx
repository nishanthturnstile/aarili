import { OwnerRequestError } from "@aarili/api/client";
import {
  readCustomerPair,
  readDuplicateCandidates,
  recordCustomerPair,
} from "@aarili/api/customer-history-client";
import type {
  CustomerPair,
  DuplicateCandidates,
} from "@aarili/contracts/customer-history";
import { identityReviewMessages, type Locale } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Status } from "@aarili/ui/components/status";
import { useLocale } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { ContactMerge } from "./contact-merge";
import type { OwnerGuard } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";

type Pair = CustomerPair;
type Page = DuplicateCandidates;
type Attempt = {
  key: string;
  etag: string;
  input: {
    firstId: string;
    secondId: string;
    fingerprint: string;
    decision: "keep-separate" | "dismiss";
    reason: string;
  };
};
export function CustomerDuplicates({
  shopId,
  customerId,
  mergedIntoId,
  queries,
  guard,
}: {
  shopId: string;
  customerId: string;
  mergedIntoId?: string | undefined;
  queries: ReturnType<typeof createOwnerQueries>;
  guard: OwnerGuard;
}) {
  const locale = useLocale() as Locale,
    t = identityReviewMessages[locale],
    id = useId();
  const [page, setPage] = useState<Page>(),
    [pair, setPair] = useState<Pair>(),
    [mergePair, setMergePair] = useState<Pair>(),
    [reason, setReason] = useState(""),
    [decision, setDecision] = useState<"keep-separate" | "dismiss">(
      "keep-separate",
    ),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [saved, setSaved] = useState(false),
    [attempt, setAttempt] = useState<Attempt>(),
    [stale, setStale] = useState(false);
  const seq = useRef(0),
    abort = useRef<AbortController | null>(null),
    locked = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    pending = useRef<Attempt | undefined>(undefined),
    mergePending = useRef(false);
  pending.current = attempt;
  const [work] = useState(() => guard.track());
  useEffect(() => () => work.dispose(), [work]);
  useEffect(() => {
    work.set({
      dirty: !!reason.trim(),
      inFlight: busy,
      outcomeUnknown: !!attempt,
    });
  }, [work, reason, busy, attempt]);
  useEffect(() => {
    if (pair) heading.current?.focus();
  }, [pair]);
  useEffect(() => {
    const clear = () => {
      seq.current++;
      abort.current?.abort();
      setPage(undefined);
      setPair(undefined);
      setMergePair(undefined);
      mergePending.current = false;
      setReason("");
      setDecision("keep-separate");
      setAttempt(undefined);
      setBusy(false);
      setSaved(false);
      setFailure(t.changed);
    };
    const un = queries.onInvalidate(clear);
    const focus = () => {
      if (!pending.current && !mergePending.current) clear();
      else {
        seq.current++;
        abort.current?.abort();
        setPair(undefined);
        setPage(undefined);
        setReason("");
        setBusy(false);
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (pending.current || mergePending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("focus", focus);
    window.addEventListener("beforeunload", leave);
    return () => {
      seq.current++;
      abort.current?.abort();
      un();
      window.removeEventListener("focus", focus);
      window.removeEventListener("beforeunload", leave);
    };
  }, [queries, t.changed]);
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    const n = ++seq.current,
      epoch = queries.version(),
      controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    setBusy(true);
    setFailure("");
    setSaved(false);
    try {
      await action(controller.signal);
    } catch (e) {
      if (n !== seq.current || !queries.isCurrent(epoch)) return;
      setPage(undefined);
      setPair(undefined);
      const changed =
        e instanceof OwnerRequestError &&
        ["VERSION_STALE", "PAIR_CHANGED"].includes(e.code);
      setStale(changed);
      if (changed) setAttempt(undefined);
      setFailure(
        changed
          ? t.changed
          : e instanceof OwnerRequestError && e.code === "RATE_LIMITED"
            ? t.limited
            : t.error,
      );
    } finally {
      locked.current = false;
      if (n === seq.current && queries.isCurrent(epoch)) setBusy(false);
    }
  }
  const canReplaceMerge = () =>
    !mergePending.current &&
    (!mergePair || guard.safe() || window.confirm(t.discardEdits));
  const load = (after?: string) => {
    if (!canReplaceMerge()) return;
    return run(async (signal) => {
      if (mergePending.current) return;
      setMergePair(undefined);
      setPair(undefined);
      setAttempt(undefined);
      setReason("");
      setStale(false);
      setPage(undefined);
      const result = await readDuplicateCandidates(
        shopId,
        customerId,
        after,
        signal,
      );
      if (!signal.aborted) setPage(result);
    });
  };
  const preview = (other: string) => {
    if (!canReplaceMerge()) return;
    return run(async (signal) => {
      if (mergePending.current) return;
      setMergePair(undefined);
      setDecision("keep-separate");
      setPair(undefined);
      setAttempt(undefined);
      setReason("");
      setStale(false);
      const result = await readCustomerPair(shopId, customerId, other, signal);
      if (!signal.aborted) {
        setPair(result);
        setMergePair(result);
      }
    });
  };
  function save() {
    if (mergePending.current) return;
    if (locked.current) return;
    if (!attempt && (!pair || !reason.trim())) return;
    const next = attempt ?? {
      key: crypto.randomUUID(),
      etag: `"v${pair?.version}"`,
      input: {
        firstId: pair?.contacts[0]?.customer.id as string,
        secondId: pair?.contacts[1]?.customer.id as string,
        fingerprint: pair?.fingerprint as string,
        decision,
        reason: reason.trim(),
      },
    };
    setAttempt(next);
    void run(async (signal) => {
      await recordCustomerPair(shopId, next.input, next.key, next.etag, signal);
      if (!signal.aborted) {
        setAttempt(undefined);
        setPair(undefined);
        setPage(undefined);
        setReason("");
        setSaved(true);
      }
    });
  }
  return (
    <section
      className="customer-evidence identity-review"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>{t.title}</h2>
      <p>{t.intro}</p>
      {mergedIntoId && (
        <Button
          type="button"
          variant="outline"
          disabled={busy || !!attempt || !!reason.trim()}
          onClick={() => void preview(mergedIntoId)}
        >
          {t.review}
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        disabled={busy || !!attempt || !!reason.trim()}
        onClick={() => void load()}
      >
        {t.browse}
      </Button>
      <div role="status">{busy ? t.busy : saved ? t.saved : ""}</div>
      {failure && (
        <div role="alert">
          <Status tone="warning">{failure}</Status>
        </div>
      )}
      {stale && (
        <Button type="button" onClick={() => void load()}>
          {t.refresh}
        </Button>
      )}
      {page && (
        <>
          <ul className="identity-candidates">
            {page.candidates.map((c) => (
              <li key={c.customer.id}>
                <strong>
                  {c.customer.displayName} · {c.customer.code}
                </strong>
                <p>{c.customer.phone}</p>
                <ul>
                  {c.reasons.map((r) => (
                    <li key={r}>{t[r]}</li>
                  ))}
                </ul>
                {c.decision && <p>{t[c.decision]}</p>}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !!attempt || !!reason.trim()}
                  onClick={() => void preview(c.customer.id)}
                >
                  {t.review}: {c.customer.code}
                </Button>
              </li>
            ))}
          </ul>
          {!page.candidates.length && <p>{t.empty}</p>}
          {page.next && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void load(page.next as string)}
            >
              {t.more}
            </Button>
          )}
        </>
      )}
      {pair && (
        <>
          <h3 ref={heading} tabIndex={-1}>
            {t.review}
          </h3>
          <div className="identity-pair">
            {pair.contacts.map((c) => (
              <section key={c.customer.id}>
                <h4>
                  {c.customer.displayName} · {c.customer.code}
                </h4>
                <p>
                  {t.version} {c.customer.version} ·{" "}
                  {c.customer.phone || t.unknown}
                </p>
                <p>{c.customer.email}</p>
                <p>{c.customer.aliases.join(", ")}</p>
                <h5>{t.wearers}</h5>
                {!c.wearers.length && <p>{t.none}</p>}
                <ul>
                  {c.wearers.map((w) => (
                    <li key={w.id}>
                      <strong>
                        {w.displayName ?? t.withheld} · {w.id.slice(-8)}
                      </strong>
                      <p>
                        {t.age[w.age]} · {t.relationship[w.relationship]} ·{" "}
                        {t.version} {w.version}
                      </p>
                      <p>{w.eligible ? t.eligible : t.withheld}</p>
                      <p>{w.guardianVerified ? t.guardian : t.noGuardian}</p>
                      <a href={`/customers/${c.customer.id}`}>
                        {c.customer.code}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <fieldset disabled={busy || !!attempt}>
              <legend>{t.save}</legend>
              <Field>
                <FieldLabel htmlFor={`${id}-decision`}>{t.review}</FieldLabel>
                <select
                  id={`${id}-decision`}
                  className="ui-input"
                  value={decision}
                  onChange={(e) =>
                    setDecision(e.target.value as typeof decision)
                  }
                >
                  <option value="keep-separate">{t["keep-separate"]}</option>
                  <option value="dismiss">{t.dismiss}</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-reason`}>{t.reason}</FieldLabel>
                <textarea
                  id={`${id}-reason`}
                  className="ui-input"
                  required
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            </fieldset>
            <Button type="submit" disabled={busy || !reason.trim()}>
              {attempt ? t.retry : t.save}
            </Button>
          </form>

          <h4>{t.history}</h4>
          <ol>
            {pair.decisions.map((d) => (
              <li key={d.id}>
                <strong>
                  {t[d.decision]} · {t.version} {d.version}
                </strong>
                <p>
                  {new Date(d.recordedAt).toLocaleString(locale)} · {d.actorId}
                </p>
                <p>{d.reason ?? (d.redacted ? t.redacted : t.unknown)}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      {mergePair && (
        <ContactMerge
          shopId={shopId}
          pair={mergePair}
          queries={queries}
          guard={guard}
          onPendingChange={(value) => {
            mergePending.current = value;
          }}
        />
      )}
      {attempt && !pair && (
        <Button type="button" disabled={busy} onClick={save}>
          {t.retry}
        </Button>
      )}
      {(page || pair || attempt) && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (
              (!guard.safe() || attempt || reason.trim()) &&
              !window.confirm(
                attempt || mergePending.current ? t.discard : t.discardEdits,
              )
            )
              return;
            seq.current++;
            abort.current?.abort();
            setAttempt(undefined);
            setPair(undefined);
            setMergePair(undefined);
            mergePending.current = false;
            setPage(undefined);
            setReason("");
            setFailure("");
          }}
        >
          {t.close}
        </Button>
      )}
    </section>
  );
}
