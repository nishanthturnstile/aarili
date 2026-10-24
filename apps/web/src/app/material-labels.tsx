"use client";
import { onOwnerInvalidation } from "@aarili/api/client";
import {
  createMaterialLabelIssue,
  MaterialLabelRequestError,
  readMaterialLabel,
  readMaterialLabelCandidates,
} from "@aarili/api/material-labels-client";
import type {
  MaterialLabelCandidates,
  MaterialLabelIssue,
  MaterialLabelReview,
  MaterialLabelSelection,
} from "@aarili/contracts/material-labels";
import { type Locale, materialLabelMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useEffect, useId, useRef, useState } from "react";
import { PrivateDocumentSharing } from "./document-sharing";
import type { OwnerGuard } from "./owner-feedback";

type Review = MaterialLabelReview;
export function MaterialLabels({
  shopId,
  orderId,
  pieceId,
  locale,
  guard,
}: {
  shopId: string;
  orderId: string;
  pieceId: string | null;
  locale: Locale;
  guard?: OwnerGuard;
}) {
  const t = materialLabelMessages[locale],
    id = useId();
  const [candidates, setCandidates] = useState<MaterialLabelCandidates>({
    orders: [],
    next: null,
  });
  const [selections, setSelections] = useState<MaterialLabelSelection[]>([
      { orderId, pieceId, copies: 1 },
    ]),
    [nextOrder, setNextOrder] = useState(""),
    [nextPiece, setNextPiece] = useState(""),
    [copies, setCopies] = useState(1),
    [review, setReview] = useState<Review>(),
    [language, setLanguage] = useState<Locale>("en"),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<"error" | "stale" | "checking">(),
    [selection, setSelection] = useState<{
      shopId: string;
      docId: string;
      revision: number;
    } | null>(null),
    [audience, setAudience] = useState("print-shop"),
    [phone, setPhone] = useState("");
  const valid = useRef(true),
    generation = useRef(0),
    pending = useRef<{
      input: MaterialLabelIssue;
      key: string;
      version: number;
    } | null>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    valid.current = true;
    const remove = onOwnerInvalidation(() => {
      valid.current = false;
      generation.current++;
      pending.current = null;
      setReview(undefined);
      setSelection(null);
      setSelections([]);
      setPhone("");
      setNextOrder("");
      setNextPiece("");
      setCandidates({ orders: [], next: null });
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
    if (notice) feedback.current?.focus();
  }, [notice]);
  useEffect(() => {
    const track = guard?.track();
    track?.set({
      dirty: false,
      inFlight: busy,
      outcomeUnknown: notice === "checking",
    });
    return () => track?.dispose();
  }, [guard, busy, notice]);
  function change(values: MaterialLabelSelection[]) {
    generation.current++;
    setSelections(values);
    setReview(undefined);
    setSelection(null);
    setAck(false);
    setNotice(undefined);
  }
  async function loadCandidates(before?: string) {
    const n = ++generation.current;
    setBusy(true);
    setNotice(undefined);
    try {
      const page = await readMaterialLabelCandidates(shopId, before);
      if (valid.current && n === generation.current)
        setCandidates((previous) => ({
          orders: before ? [...previous.orders, ...page.orders] : page.orders,
          next: page.next,
        }));
    } catch {
      if (valid.current && n === generation.current) setNotice("error");
    } finally {
      if (valid.current && n === generation.current) setBusy(false);
    }
  }
  async function inspect() {
    const n = ++generation.current;
    setBusy(true);
    setSelection(null);
    setAck(false);
    setNotice(undefined);
    try {
      const r = await readMaterialLabel(shopId, selections);
      if (valid.current && n === generation.current) setReview(r);
    } catch {
      if (valid.current && n === generation.current) {
        setReview(undefined);
        setNotice("error");
      }
    } finally {
      if (valid.current && n === generation.current) setBusy(false);
    }
  }
  async function issue() {
    if (!review || busy || !valid.current) return;
    pending.current ??= {
      key: crypto.randomUUID(),
      version: review.version,
      input: {
        selections,
        docId: review.history[0]?.docId ?? crypto.randomUUID(),
        revision: (review.history[0]?.revision ?? 0) + 1,
        sourceDigest: review.sourceDigest,
        language,
        acknowledged: true,
      },
    };
    const request = pending.current,
      n = ++generation.current;
    setBusy(true);
    setNotice(undefined);
    setSelection(null);
    try {
      const result = await createMaterialLabelIssue(
        shopId,
        request.input,
        request.key,
        request.version,
      );
      if (valid.current && n === generation.current) {
        pending.current = null;
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
        if (error instanceof MaterialLabelRequestError && error.status < 500) {
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
      <p>{t.help}</p>
      <p ref={feedback} tabIndex={-1} role={notice ? "alert" : "status"}>
        {notice ? t[notice] : busy ? t.busy : ""}
      </p>
      <h3>{t.title}</h3>
      <ol>
        {selections.map((s, i) => (
          <li key={`${s.orderId}:${s.pieceId}`}>
            <span>
              {s.orderId} {s.pieceId ?? t.unknown} · {t.copies}: {s.copies}
            </span>{" "}
            <Field>
              <FieldLabel htmlFor={`${id}-copy-${i}`}>{t.copies}</FieldLabel>
              <Input
                id={`${id}-copy-${i}`}
                type="number"
                min={1}
                max={64}
                value={s.copies}
                disabled={disabled}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (
                    !Number.isInteger(value) ||
                    value < 1 ||
                    value > 64 ||
                    selections.reduce(
                      (n, v, index) => n + (index === i ? value : v.copies),
                      0,
                    ) > 64
                  ) {
                    setNotice("error");
                    return;
                  }
                  change(
                    selections.map((v, index) =>
                      index === i ? { ...v, copies: value } : v,
                    ),
                  );
                }}
              />
            </Field>
            <Button
              disabled={disabled}
              onClick={() => change(selections.filter((_, n) => n !== i))}
            >
              {t.remove}
            </Button>
          </li>
        ))}
      </ol>
      <fieldset disabled={disabled}>
        <legend>{t.add}</legend>
        <Button onClick={() => void loadCandidates()}>{t.choose}</Button>
        {candidates.next ? (
          <Button
            onClick={() => void loadCandidates(candidates.next ?? undefined)}
          >
            {t.more}
          </Button>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`${id}-order`}>{t.order}</FieldLabel>
          <select
            id={`${id}-order`}
            className="ui-input"
            value={nextOrder}
            onChange={(e) => {
              setNextOrder(e.target.value);
              setNextPiece("");
            }}
          >
            <option value="">{t.choose}</option>
            {candidates.orders.map((o) => (
              <option key={o.orderId} value={o.orderId}>
                {o.orderCode} ? {o.garment[locale]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-piece`}>{t.piece}</FieldLabel>
          <select
            id={`${id}-piece`}
            className="ui-input"
            value={nextPiece}
            onChange={(e) => setNextPiece(e.target.value)}
          >
            <option value="">{t.unknown}</option>
            {candidates.orders
              .find((o) => o.orderId === nextOrder)
              ?.pieces.map((p) => (
                <option key={p.pieceId} value={p.pieceId}>
                  {p.name[locale]}
                </option>
              ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-copies`}>{t.copies}</FieldLabel>
          <Input
            id={`${id}-copies`}
            type="number"
            min={1}
            max={64}
            value={copies}
            onChange={(e) => setCopies(Number(e.target.value))}
          />
        </Field>
        <Button
          disabled={!nextOrder}
          onClick={() => {
            const order = nextOrder,
              piece = nextPiece.trim() || null;
            if (
              !Number.isInteger(copies) ||
              copies < 1 ||
              copies > 64 ||
              selections.length >= 32 ||
              selections.reduce((n, s) => n + s.copies, 0) + copies > 64 ||
              selections.some((s) => s.orderId === order && s.pieceId === piece)
            ) {
              setNotice("error");
              return;
            }
            change([...selections, { orderId: order, pieceId: piece, copies }]);
            setNextOrder("");
            setNextPiece("");
          }}
        >
          {t.add}
        </Button>
      </fieldset>
      <Button
        disabled={disabled || !selections.length}
        onClick={() => void inspect()}
      >
        {t.review}
      </Button>
      {notice === "checking" ? (
        <Button disabled={busy} onClick={() => void issue()}>
          {t.retry}
        </Button>
      ) : null}
      {review ? (
        <>
          <ol>
            {review.model.labels.map((v, i) => (
              <li key={`${v.orderId}:${v.pieceId}:${v.copy}`}>
                {i + 1}. {v.orderCode} · {v.garment[locale]}{" "}
                {v.pieceName?.[locale]} {v.pieceId} · {t.quantity}:{" "}
                {v.quantity ?? t.unknown} · {t.copy} {v.copy}/{v.copies}
              </li>
            ))}
          </ol>
          <Field>
            <FieldLabel htmlFor={`${id}-language`}>{t.language}</FieldLabel>
            <select
              id={`${id}-language`}
              className="ui-input"
              disabled={disabled}
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value as Locale);
                setAck(false);
                setSelection(null);
              }}
            >
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
            </select>
          </Field>
          <label>
            <input
              type="checkbox"
              disabled={disabled}
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />{" "}
            {t.ack}
          </label>
          <Button disabled={disabled || !ack} onClick={() => void issue()}>
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
                setAudience(e.target.value);
                setPhone("");
              }}
            >
              <option value="print-shop">{t.printShop}</option>
              <option value="owner">{t.owner}</option>
              <option value="production">{t.production}</option>
            </select>
          </Field>
          {audience !== "owner" ? (
            <Field>
              <FieldLabel htmlFor={`${id}-phone`}>{t.phone}</FieldLabel>
              <Input
                id={`${id}-phone`}
                type="tel"
                maxLength={24}
                value={phone}
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
            reviewAcknowledgement={t.previewAck}
            allowExternalShare={audience !== "owner"}
          />
        </>
      ) : null}
    </div>
  );
}
