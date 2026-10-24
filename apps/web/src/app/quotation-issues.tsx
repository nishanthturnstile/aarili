"use client";
import { onOwnerInvalidation } from "@aarili/api/client";
import {
  createQuotationIssue,
  createQuotationResponse,
  QuoteIssueRequestError,
  readQuotationIssue,
  reviewQuotationIssue,
} from "@aarili/api/quotation-issues-client";
import type {
  QuoteIssueCommand,
  QuoteIssueReview,
  QuoteResponseCommand,
  quoteIssueReadSchema,
} from "@aarili/contracts/quotation-issues";
import { type Locale, quotationIssueMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { z } from "zod";
import { PrivateDocumentSharing } from "./document-sharing";
import type { OwnerGuard } from "./owner-feedback";

type Read = z.infer<typeof quoteIssueReadSchema>;
type Pending =
  | { kind: "issue"; input: QuoteIssueCommand; key: string; version: number }
  | {
      kind: "response";
      input: QuoteResponseCommand;
      key: string;
      version: number;
    };
export function QuotationIssues({
  shopId,
  proposalId,
  locale,
  guard,
  navigation,
}: {
  shopId: string;
  proposalId: string;
  locale: Locale;
  guard: OwnerGuard;
  navigation?: { current: () => boolean };
}) {
  const t = quotationIssueMessages[locale],
    id = useId(),
    alive = useRef(true),
    sequence = useRef(0),
    pending = useRef<Pending | null>(null),
    working = useRef(false),
    composing = useRef(false);
  const [language, setLanguage] = useState<Locale>("en"),
    [expiryDate, setExpiry] = useState(""),
    [customerLabel, setCustomer] = useState(""),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [sharingWork, setSharingWork] = useState({
      inFlight: false,
      outcomeUnknown: false,
    }),
    [notice, setNotice] = useState<"checking" | "error" | "stale" | null>(null),
    [review, setReview] = useState<QuoteIssueReview | null>(null),
    [read, setRead] = useState<Read | null>(null),
    [phone, setPhone] = useState(""),
    [responseKind, setKind] =
      useState<QuoteResponseCommand["value"]["kind"]>("rejected"),
    [channel, setChannel] =
      useState<QuoteResponseCommand["value"]["channel"]>("verbal"),
    [reported, setReported] = useState(""),
    [evidence, setEvidence] = useState(""),
    [responseReason, setResponseReason] = useState(""),
    [respondent, setRespondent] = useState(""),
    [attest, setAttest] = useState(false);
  useEffect(() => {
    alive.current = true;
    const remove = onOwnerInvalidation(() => {
      alive.current = false;
      sequence.current++;
      pending.current = null;
      setReview(null);
      setRead(null);
      setReason("");
      setEvidence("");
      setResponseReason("");
      setCustomer("");
      setExpiry("");
      setPhone("");
      setRespondent("");
      setReported("");
      setAck(false);
      setAttest(false);
      setDirty(false);
    });
    return () => {
      alive.current = false;
      sequence.current++;
      remove();
    };
  }, []);
  useEffect(() => {
    const track = guard.track();
    track.set({
      dirty,
      inFlight: busy || sharingWork.inFlight,
      outcomeUnknown: notice === "checking" || sharingWork.outcomeUnknown,
    });
    return () => track.dispose();
  }, [guard, dirty, busy, notice, sharingWork]);
  const mayLeave = useCallback(() => {
    if (
      working.current ||
      pending.current ||
      sharingWork.inFlight ||
      sharingWork.outcomeUnknown
    )
      return false;
    if (dirty && !window.confirm(t.discard)) return false;
    setDirty(false);
    setReview(null);
    setReason("");
    setEvidence("");
    setResponseReason("");
    setReported("");
    setCustomer("");
    setExpiry("");
    setAck(false);
    setAttest(false);
    return true;
  }, [dirty, t.discard, sharingWork]);
  // The parent must resolve this command before replacing the selected proposal.
  useEffect(() => {
    if (!navigation) return;
    navigation.current = mayLeave;
    return () => {
      if (navigation.current === mayLeave) navigation.current = () => true;
    };
  }, [navigation, mayLeave]);
  async function run(action: () => Promise<void>) {
    if (working.current || !alive.current) return;
    working.current = true;
    setBusy(true);
    setNotice(null);
    const n = sequence.current;
    try {
      await action();
    } catch (error) {
      if (alive.current && n === sequence.current) {
        if (
          pending.current &&
          (!(error instanceof QuoteIssueRequestError) ||
            error.status >= 500 ||
            error.status === 429)
        ) {
          setNotice("checking");
        } else {
          pending.current = null;
          setAck(false);
          setAttest(false);
          setNotice(
            error instanceof QuoteIssueRequestError &&
              [409, 412].includes(error.status)
              ? "stale"
              : "error",
          );
          setReview(null);
        }
      }
    } finally {
      working.current = false;
      if (alive.current && n === sequence.current) setBusy(false);
    }
  }
  function changed() {
    setReview(null);
    setAck(false);
  }
  async function inspect() {
    await run(async () => {
      const result = await reviewQuotationIssue(shopId, {
        proposalId,
        language,
        expiryDate,
        customerLabel,
      });
      if (alive.current) {
        setReview(result);
        setAck(false);
      }
    });
  }
  async function openIssued(docId: string, revision: number) {
    if (!mayLeave()) return;
    await run(async () => {
      const next = await readQuotationIssue(shopId, docId, revision);
      if (alive.current) setRead(next);
    });
  }
  async function execute() {
    const request = pending.current;
    if (!request) return;
    await run(async () => {
      if (request.kind === "issue") {
        const result = await createQuotationIssue(
          shopId,
          request.input,
          request.key,
          request.version,
        );
        if (!alive.current) return;
        pending.current = null;
        setDirty(false);
        setReason("");
        setAck(false);
        setReview(null);
        const next = await readQuotationIssue(
          shopId,
          result.entry.docId,
          result.entry.revision,
        );
        if (alive.current) setRead(next);
      } else {
        const result = await createQuotationResponse(
          shopId,
          request.input,
          request.key,
          request.version,
        );
        if (!alive.current) return;
        pending.current = null;
        setDirty(false);
        const next = await readQuotationIssue(
          shopId,
          result.event.docId,
          result.event.revision,
        );
        if (alive.current) setRead(next);
        setEvidence("");
        setResponseReason("");
        setAttest(false);
      }
    });
  }
  async function issue() {
    if (!review || !ack || !reason.trim() || composing.current) return;
    pending.current ??= {
      kind: "issue",
      key: crypto.randomUUID(),
      version: review.version,
      input: {
        proposalId,
        language,
        expiryDate,
        customerLabel,
        digest: review.digest,
        previousRevision: review.history[0]?.revision ?? null,
        acknowledged: true,
        reason,
      },
    };
    await execute();
  }
  async function respond() {
    if (
      !read ||
      !attest ||
      !reported ||
      !responseReason.trim() ||
      composing.current
    )
      return;
    const date = new Date(reported);
    if (!Number.isFinite(date.getTime())) return;
    pending.current ??= {
      kind: "response",
      key: crypto.randomUUID(),
      version: read.responseVersion,
      input: {
        docId: read.entry.docId,
        revision: read.entry.revision,
        modelHash: read.entry.modelHash,
        previousId: read.events.at(-1)?.id ?? null,
        acknowledged: true,
        value: {
          kind: responseKind,
          respondentCustomerId: respondent || null,
          reportedAt: date.toISOString(),
          channel,
          evidence,
          reason: responseReason,
        },
      },
    };
    await execute();
  }
  const disabled = busy || !!pending.current || !alive.current;
  const field = (
    name: string,
    label: string,
    value: string,
    set: (v: string) => void,
    type = "text",
  ) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
      <Input
        id={`${id}-${name}`}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setDirty(true);
          set(e.target.value);
        }}
      />
    </Field>
  );
  return (
    <section
      className="owner-content"
      aria-labelledby={id}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
      }}
    >
      <h3 id={id}>{t.title}</h3>
      <p>{t.boundary}</p>
      <p role={notice ? "alert" : "status"}>{notice ? t[notice] : ""}</p>
      {pending.current && (
        <Button disabled={busy} onClick={() => void execute()}>
          {t.retry}
        </Button>
      )}
      <div className="owner-form" aria-busy={busy}>
        <Field>
          <FieldLabel htmlFor={`${id}-language`}>{t.language}</FieldLabel>
          <select
            id={`${id}-language`}
            className="ui-input"
            value={language}
            disabled={disabled}
            onChange={(e) => {
              setDirty(true);
              setLanguage(e.target.value as Locale);
              changed();
            }}
          >
            <option value="en">English</option>
            <option value="ta">தமிழ்</option>
          </select>
        </Field>
        {field(
          "expiry",
          t.expiry,
          expiryDate,
          (v) => {
            setExpiry(v);
            changed();
          },
          "date",
        )}
        {field("customer", t.customer, customerLabel, (v) => {
          setCustomer(v);
          changed();
        })}
        {field("reason", t.reason, reason, setReason)}
        <Button disabled={disabled} onClick={() => void inspect()}>
          {t.review}
        </Button>
        {review && (
          <>
            <p>
              {t.issued}: {review.issueDate} · {t.through}:{" "}
              {review.expiryDate ?? "—"}
            </p>
            <p>{review.validityTerms?.[locale]}</p>
            {review.blockers.length ? (
              <p role="alert">
                {t.blocked}:{" "}
                {review.blockers
                  .map(
                    (b) =>
                      t.blockers[b as keyof typeof t.blockers] ?? t.blocked,
                  )
                  .join(" ")}
              </p>
            ) : (
              <p>{t.reviewed}</p>
            )}
            <label>
              <input
                type="checkbox"
                checked={ack}
                disabled={disabled}
                onChange={(e) => {
                  setDirty(true);
                  setAck(e.target.checked);
                }}
              />
              {t.ack}
            </label>
            <Button
              disabled={
                disabled || !ack || !reason.trim() || !!review.blockers.length
              }
              onClick={() => void issue()}
            >
              {t.issue}
            </Button>
            <h4>{t.history}</h4>
            {review.history.map((h) => (
              <Button
                key={h.revision}
                variant="outline"
                disabled={disabled || h.revoked}
                onClick={() => void openIssued(h.docId, h.revision)}
              >
                {t.open} · {h.number} · {t.version} {h.revision}
              </Button>
            ))}
          </>
        )}
      </div>
      {read && (
        <>
          <h4>
            {read.entry.number} · {t.version} {read.entry.revision}
          </h4>
          <p>
            {t.issued}: {read.model.issueDate} · {t.through}:{" "}
            {read.model.expiryDate}
          </p>
          {read.expired || read.historical || read.withdrawn ? (
            <p role="status">{t.historical}</p>
          ) : null}
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              void run(async () => {
                const next = await readQuotationIssue(
                  shopId,
                  read.entry.docId,
                  read.entry.revision,
                );
                if (alive.current) setRead(next);
              })
            }
          >
            {t.refresh}
          </Button>
          {field("phone", t.phone, phone, setPhone, "tel")}
          <PrivateDocumentSharing
            selection={{
              shopId,
              docId: read.entry.docId,
              revision: read.entry.revision,
            }}
            locale={locale}
            recipient={{ phone }}
            requirePreview
            reviewAcknowledgement={t.ack}
            onWorkChange={setSharingWork}
          />
          <h4>{t.response}</h4>
          {!read.events.length && <p>{t.unknown}</p>}
          <ol>
            {read.events.map((event) => (
              <li key={event.id}>
                {event.value
                  ? {
                      approved: t.approved,
                      rejected: t.rejected,
                      withdrawn: t.withdrawn,
                      "issue-withdrawn": t.issueWithdrawn,
                    }[event.value.kind]
                  : "—"}{" "}
                · {event.recordedAt} · {event.value?.reason}
              </li>
            ))}
          </ol>
          <div className="owner-form">
            <Field>
              <FieldLabel htmlFor={`${id}-kind`}>{t.kind}</FieldLabel>
              <select
                id={`${id}-kind`}
                className="ui-input"
                disabled={disabled}
                value={responseKind}
                onChange={(e) => {
                  setDirty(true);
                  setKind(e.target.value as typeof responseKind);
                }}
              >
                <option value="approved">{t.approved}</option>
                <option value="rejected">{t.rejected}</option>
                <option value="withdrawn">{t.withdrawn}</option>
                <option value="issue-withdrawn">{t.issueWithdrawn}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-respondent`}>
                {t.respondent}
              </FieldLabel>
              <select
                id={`${id}-respondent`}
                className="ui-input"
                disabled={disabled}
                value={respondent}
                onChange={(e) => {
                  setDirty(true);
                  setRespondent(e.target.value);
                }}
              >
                <option value="">{t.respondentNone}</option>
                {read.respondentCustomerIds.map((customer) => (
                  <option key={customer} value={customer}>
                    {read.model.customerLabel || customer}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-channel`}>{t.channel}</FieldLabel>
              <select
                id={`${id}-channel`}
                className="ui-input"
                disabled={disabled}
                value={channel}
                onChange={(e) => {
                  setDirty(true);
                  setChannel(e.target.value as typeof channel);
                }}
              >
                <option value="verbal">{t.verbal}</option>
                <option value="manual-message">{t.message}</option>
                <option value="written">{t.written}</option>
              </select>
            </Field>
            {field(
              "reported",
              t.reported,
              reported,
              setReported,
              "datetime-local",
            )}
            {field("evidence", t.evidence, evidence, setEvidence)}
            {field(
              "responseReason",
              t.responseReason,
              responseReason,
              setResponseReason,
            )}
            <label>
              <input
                type="checkbox"
                checked={attest}
                disabled={disabled}
                onChange={(e) => {
                  setDirty(true);
                  setAttest(e.target.checked);
                }}
              />
              {t.attest}
            </label>
            <Button
              disabled={
                disabled ||
                !attest ||
                !reported ||
                !responseReason.trim() ||
                (!respondent && ["approved", "rejected"].includes(responseKind))
              }
              onClick={() => void respond()}
            >
              {t.record}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
