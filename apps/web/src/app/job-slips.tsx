"use client";
import { onOwnerInvalidation } from "@aarili/api/client";
import {
  createJobSlipIssue,
  JobSlipRequestError,
  readJobSlip,
} from "@aarili/api/job-slips-client";
import { readOrderPieces } from "@aarili/api/orders-client";
import type { JobSlipIssue, JobSlipReview } from "@aarili/contracts/job-slips";
import {
  jobSlipMessages,
  type Locale,
  materialLabelMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useEffect, useId, useRef, useState } from "react";
import { PrivateDocumentSharing } from "./document-sharing";
import { MaterialLabels } from "./material-labels";
import type { OwnerGuard } from "./owner-feedback";

export function JobSlips({
  shopId,
  orderId,
  locale,
  service = false,
  guard,
}: {
  shopId: string;
  orderId: string;
  locale: Locale;
  service?: boolean;
  guard?: OwnerGuard;
}) {
  const [purpose, setPurpose] = useState("job-slip"),
    [open, setOpen] = useState(false),
    [pieces, setPieces] = useState<{ id: string; label: string }[]>([]),
    [pieceId, setPieceId] = useState<string | null>(null),
    [scopeSafe, setScopeSafe] = useState(true);
  const t = jobSlipMessages[locale],
    heading = useId(),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const update = () => setScopeSafe(guard?.safe() ?? true);
    update();
    return guard?.subscribe(update);
  }, [guard]);
  async function start() {
    setOpen(true);
    if (!service)
      try {
        const p = await readOrderPieces(shopId, orderId);
        if (alive.current)
          setPieces(
            p.identities.map((v) => {
              const d = p.structure?.pieces.find((d) => d.key === v.key);
              return {
                id: v.id,
                label:
                  locale === "ta"
                    ? (d?.labelTa ?? v.key)
                    : (d?.labelEn ?? v.key),
              };
            }),
          );
      } catch {
        /* The scoped source review still returns an explicit failure. */
      }
  }
  return (
    <section className="owner-content" aria-labelledby={heading}>
      <h2 id={heading}>{t.title}</h2>
      {!open ? (
        <Button onClick={() => void start()}>{t.open}</Button>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor={`${heading}-purpose`}>
              {materialLabelMessages[locale].purpose}
            </FieldLabel>
            <select
              id={`${heading}-purpose`}
              className="ui-input"
              value={purpose}
              disabled={!scopeSafe}
              onChange={(e) => setPurpose(e.target.value)}
            >
              <option value="job-slip">
                {materialLabelMessages[locale].slip}
              </option>
              <option value="labels">
                {materialLabelMessages[locale].labels}
              </option>
            </select>
          </Field>
          {pieces.length ? (
            <Field>
              <FieldLabel htmlFor={`${heading}-piece`}>{t.scope}</FieldLabel>
              <select
                id={`${heading}-piece`}
                className="ui-input"
                value={pieceId ?? ""}
                disabled={!scopeSafe}
                onChange={(e) => {
                  if (!guard || guard.safe())
                    setPieceId(e.target.value || null);
                }}
              >
                <option value="">{t.whole}</option>
                {pieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.id}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {purpose === "labels" ? (
            <MaterialLabels
              key={`labels:${shopId}:${orderId}:${pieceId}`}
              shopId={shopId}
              orderId={orderId}
              pieceId={pieceId}
              locale={locale}
              {...(guard ? { guard } : {})}
            />
          ) : (
            <ScopedJobSlip
              onPrintShop={() => setPurpose("labels")}
              key={`${shopId}:${orderId}:${pieceId}`}
              shopId={shopId}
              orderId={orderId}
              pieceId={pieceId}
              locale={locale}
              {...(guard ? { guard } : {})}
            />
          )}
        </>
      )}
    </section>
  );
}
function ScopedJobSlip({
  onPrintShop,
  shopId,
  orderId,
  pieceId,
  locale,
  guard,
}: {
  onPrintShop: () => void;
  shopId: string;
  orderId: string;
  pieceId: string | null;
  locale: Locale;
  guard?: OwnerGuard;
}) {
  const t = jobSlipMessages[locale],
    id = useId();
  const [review, setReview] = useState<JobSlipReview>(),
    [previousSources, setPreviousSources] = useState<
      JobSlipReview["model"]["sources"] | null
    >(null),
    [omitted, setOmitted] = useState<string[]>([]),
    [language, setLanguage] = useState<Locale>("en"),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<"error" | "stale" | "checking">(),
    [selection, setSelection] = useState<{
      shopId: string;
      docId: string;
      revision: number;
    } | null>(null),
    [audience, setAudience] = useState("owner"),
    [phone, setPhone] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) feedback.current?.focus();
  }, [notice]);
  const generation = useRef(0),
    valid = useRef(true),
    pending = useRef<{
      input: JobSlipIssue;
      key: string;
      version: number;
    } | null>(null);
  useEffect(() => {
    valid.current = true;
    const remove = onOwnerInvalidation(() => {
      valid.current = false;
      generation.current++;
      pending.current = null;
      setReview(undefined);
      setPreviousSources(null);
      setSelection(null);
      setReason("");
      setPhone("");
      setAck(false);
    });
    return () => {
      valid.current = false;
      generation.current++;
      pending.current = null;
      remove();
    };
  }, []);
  useEffect(() => {
    const track = guard?.track();
    track?.set({
      dirty: !!reason,
      inFlight: busy,
      outcomeUnknown: notice === "checking",
    });
    return () => track?.dispose();
  }, [guard, reason, busy, notice]);
  async function inspect(values = omitted) {
    if (notice === "stale" && review) setPreviousSources(review.model.sources);
    const n = ++generation.current;
    setBusy(true);
    setSelection(null);
    setAck(false);
    setNotice(undefined);
    try {
      const r = await readJobSlip(shopId, { orderId, pieceId }, values);
      if (valid.current && generation.current === n) setReview(r);
    } catch {
      if (valid.current && generation.current === n) {
        setReview(undefined);
        setNotice("error");
      }
    } finally {
      if (valid.current && generation.current === n) setBusy(false);
    }
  }
  async function issue() {
    if (!review || busy || !valid.current) return;
    pending.current ??= {
      key: crypto.randomUUID(),
      version: review.version,
      input: {
        orderId,
        pieceId,
        omittedAssetIds: omitted,
        sourceDigest: review.sourceDigest,
        docId: review.history[0]?.docId ?? crypto.randomUUID(),
        revision: (review.history[0]?.revision ?? 0) + 1,
        language,
        reason,
        acknowledged: true,
      },
    };
    const request = pending.current,
      n = ++generation.current;
    setBusy(true);
    setNotice(undefined);
    setSelection(null);
    try {
      const result = await createJobSlipIssue(
        shopId,
        request.input,
        request.key,
        request.version,
      );
      if (valid.current && n === generation.current) {
        pending.current = null;
        setReason("");
        setAck(false);
        setSelection({
          shopId,
          docId: result.status.docId,
          revision: result.status.revision,
        });
        setReview(undefined);
      }
    } catch (error) {
      if (valid.current && n === generation.current) {
        if (error instanceof JobSlipRequestError && error.status < 500) {
          pending.current = null;
          setAck(false);
          setNotice(error.status === 412 ? "stale" : "error");
        } else setNotice("checking");
      }
    } finally {
      if (valid.current && n === generation.current) setBusy(false);
    }
  }
  const disabled = busy || !valid.current || !!pending.current;
  return (
    <div>
      <p>{t.private}</p>
      <p ref={feedback} tabIndex={-1} role={notice ? "alert" : "status"}>
        {notice ? t[notice] : busy ? t.reviewing : ""}
      </p>
      <Button disabled={disabled} onClick={() => void inspect()}>
        {t.review}
      </Button>
      {notice === "checking" ? (
        <Button disabled={busy} onClick={() => void issue()}>
          {t.reconcile}
        </Button>
      ) : null}
      {review ? (
        <>
          <p>{t.sourceReview}</p>
          <p>
            <strong>{review.model.orderCode}</strong>
            {pieceId ? ` / ${pieceId}` : ""}
          </p>
          {previousSources ? (
            <div className="owner-content">
              <h3>{t.changedSources}</h3>
              <p>{t.previous}</p>
              <ul>
                {previousSources.map((s) => (
                  <li key={`${s.kind}:${s.id}`}>
                    {s.kind}: {s.id} {s.version === null ? "" : `v${s.version}`}
                  </li>
                ))}
              </ul>
              <p>{t.current}</p>
            </div>
          ) : null}
          <h3>{t.source}</h3>
          <ul>
            {review.model.sources.map((s) => (
              <li key={`${s.kind}:${s.id}`}>
                {s.kind}: {s.id}
                {s.version === null ? "" : ` · v${s.version}`} — {s.description}
              </li>
            ))}
          </ul>
          <h3>{t.work}</h3>
          {[...new Set(review.model.instructions)].map((s) => (
            <p key={s}>{s}</p>
          ))}
          {review.model.measurements.length ? (
            <>
              <h3>{t.measurements}</h3>
              <dl>
                {review.model.measurements.map((v) => (
                  <div key={v.fieldId}>
                    <dt>{v.label[locale]}</dt>
                    <dd>
                      {v.value} {v.unit} — {v.source}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          {review.model.warnings.map((w) => (
            <p key={w.en}>{w[locale]}</p>
          ))}
          {review.optionalAssets.length ? (
            <fieldset disabled={disabled}>
              <legend>{t.omission}</legend>
              {review.optionalAssets.map((a) => (
                <Field key={a.assetId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={omitted.includes(a.assetId)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...omitted, a.assetId]
                          : omitted.filter((v) => v !== a.assetId);
                        setOmitted(next);
                        void inspect(next);
                      }}
                    />{" "}
                    {t.omit}: {a.referenceId}
                  </label>
                </Field>
              ))}
            </fieldset>
          ) : null}
          {review.blockers.length ? (
            <>
              <p>{t.blocked}</p>
              <ul>
                {review.blockers.map((b) => (
                  <li key={b}>{t.blockers[b]}</li>
                ))}
              </ul>
            </>
          ) : null}
          <Field>
            <FieldLabel htmlFor={`${id}-language`}>{t.language}</FieldLabel>
            <select
              id={`${id}-language`}
              className="ui-input"
              disabled={disabled}
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value as Locale);
                setSelection(null);
                setAck(false);
              }}
            >
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-reason`}>{t.reason}</FieldLabel>
            <Input
              id={`${id}-reason`}
              disabled={disabled}
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Field>
            <label>
              <input
                type="checkbox"
                disabled={disabled}
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />{" "}
              {t.acknowledgement}
            </label>
          </Field>
          <Button
            disabled={
              disabled || !ack || !reason.trim() || !!review.blockers.length
            }
            onClick={() => void issue()}
          >
            {review.history.length ? t.revise : t.create}
          </Button>
          <h3>{t.history}</h3>
          <ol>
            {review.history.map((h) => (
              <li key={h.revision}>
                {t.revision} {h.revision} · {h.language} ·{" "}
                <time dateTime={h.createdAt}>{h.createdAt}</time>{" "}
                {h.revoked ? (
                  t.unavailable
                ) : (
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      setSelection({
                        shopId,
                        docId: h.docId,
                        revision: h.revision,
                      })
                    }
                  >
                    {t.select}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </>
      ) : null}
      {selection ? (
        <>
          <Field>
            <FieldLabel htmlFor={`${id}-audience`}>{t.audience}</FieldLabel>
            <select
              id={`${id}-audience`}
              className="ui-input"
              value={audience}
              onChange={(e) => {
                if (e.target.value === "print-shop") {
                  onPrintShop();
                  return;
                }
                setAudience(e.target.value);
                setPhone("");
              }}
            >
              <option value="owner">{t.owner}</option>
              <option value="production">{t.production}</option>
              <option value="print-shop">{t.printShop}</option>
            </select>
          </Field>
          {audience === "print-shop" ? (
            <p>{t.printShopHelp}</p>
          ) : (
            <>
              {audience === "production" ? (
                <Field>
                  <FieldLabel htmlFor={`${id}-phone`}>{t.recipient}</FieldLabel>
                  <Input
                    id={`${id}-phone`}
                    type="tel"
                    value={phone}
                    maxLength={24}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              ) : null}
              <PrivateDocumentSharing
                key={`${selection.docId}:${selection.revision}:${audience}:${phone}`}
                selection={selection}
                locale={locale}
                recipient={{ phone }}
                requirePreview={true}
                allowExternalShare={audience === "production"}
              />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
