import {
  materializeOrderPieces,
  OrderRequestError,
  readOrderPieces,
} from "@aarili/api/orders-client";
import type { AcceptedOrder, OrderPieces } from "@aarili/contracts/orders";
import { templateSections } from "@aarili/contracts/service-templates";
import { type Locale, orderPieceMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useEffect, useRef, useState } from "react";
import type { OwnerGuard } from "./owner-feedback";

export function OrderPiecesDetail({
  order,
  shopId,
  locale,
  guard,
  disabled,
  onBusy,
}: {
  order: AcceptedOrder;
  shopId: string;
  locale: Locale;
  guard: OwnerGuard;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const t = orderPieceMessages[locale],
    [data, setData] = useState<OrderPieces>(),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState<
      "error" | "checking" | "stale" | "conflict"
    >(),
    [review, setReview] = useState(false),
    [reason, setReason] = useState("");
  const alive = useRef(true),
    feedback = useRef<HTMLParagraphElement>(null);
  const pending = useRef<
    | {
        key: string;
        version: number;
        input: { snapshotDigest: string; reason: string };
        unknown: boolean;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current = undefined;
    };
  }, []);
  useEffect(() => {
    const tracker = guard.track();
    tracker.set({
      dirty: review && !!reason.trim(),
      inFlight: working,
      outcomeUnknown: message === "checking",
    });
    onBusy(working || message === "checking" || review);
    return () => {
      tracker.dispose();
      onBusy(false);
    };
  }, [guard, onBusy, working, message, review, reason]);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  useEffect(() => {
    let current = true;
    setData(undefined);
    setWorking(true);
    setReview(false);
    setReason("");
    setMessage(undefined);
    readOrderPieces(shopId, order.id)
      .then((r) => {
        if (current) {
          setData(r);
          if (r.orderVersion !== order.version) setMessage("stale");
        }
      })
      .catch(() => {
        if (current) setMessage("error");
      })
      .finally(() => {
        if (current) setWorking(false);
      });
    return () => {
      current = false;
    };
  }, [shopId, order.id, order.version]);
  async function load() {
    if (working || pending.current) return;
    setWorking(true);
    try {
      const r = await readOrderPieces(shopId, order.id);
      if (alive.current) {
        setData(r);
        setMessage(r.orderVersion === order.version ? undefined : "stale");
      }
    } catch (e) {
      if (alive.current) {
        if (e instanceof OrderRequestError && e.status === 404) {
          setData(undefined);
          setReview(false);
          setReason("");
        }
        setMessage("error");
      }
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  async function prepare() {
    if (working || disabled || (!pending.current && (!data || !reason.trim())))
      return;
    const command = pending.current ?? {
      key: crypto.randomUUID(),
      version: data?.orderVersion ?? order.version,
      input: {
        snapshotDigest: data?.snapshotDigest ?? order.snapshotDigest,
        reason: reason.trim(),
      },
      unknown: false,
    };
    pending.current = command;
    setWorking(true);
    try {
      const r = await materializeOrderPieces(
        shopId,
        order.id,
        command.input,
        command.key,
        command.version,
      );
      if (alive.current) {
        pending.current = undefined;
        setData(r);
        setReview(false);
        setReason("");
        setMessage(undefined);
        if (command.unknown) {
          try {
            const latest = await readOrderPieces(shopId, order.id);
            if (alive.current) {
              setData(latest);
              if (latest.orderVersion !== order.version) setMessage("stale");
            }
          } catch {
            if (alive.current) {
              setData(undefined);
              setMessage("error");
            }
          }
        }
      }
    } catch (e) {
      if (alive.current) {
        if (
          e instanceof OrderRequestError &&
          e.status >= 400 &&
          e.status < 500 &&
          (e.status !== 429 || !command.unknown)
        ) {
          pending.current = undefined;
          if (e.status === 404) {
            setData(undefined);
            setReview(false);
            setReason("");
          }
          setMessage(
            e.status === 412
              ? "stale"
              : e.status === 409
                ? "conflict"
                : "error",
          );
        } else {
          command.unknown = true;
          setMessage("checking");
        }
      }
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  function requirements(positions: number[]) {
    return (
      <ul>
        {positions.map((position) => {
          const item = order.requirements.items[position];
          if (
            !item ||
            (order.presentation === "simple" &&
              item.state !== "unresolved" &&
              item.required !== true)
          )
            return null;
          const section = templateSections.find((s) => s === item.section);
          const source = section
            ? order.requirements.definition[section].find(
                (i) => i.key === item.key,
              )
            : undefined;
          const detail =
            locale === "ta" ? source?.instructionTa : source?.instructionEn;
          return (
            <li key={position}>
              <strong>{locale === "ta" ? item.labelTa : item.labelEn}</strong> —{" "}
              {item.state === "not-required" ? t.excluded : t.unresolved}
              {order.presentation === "detailed" && (
                <details>
                  <summary>{t.detail}</summary>
                  {detail && <p>{detail}</p>}
                  <p>{item.source}</p>
                  {!!item.blockers.length && <p>{item.blockers.join(", ")}</p>}
                </details>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  const structure = data?.structure,
    shared =
      structure?.requirements
        .filter((r) => r.pieceKey === null)
        .map((r) => r.position) ?? [];
  return (
    <section className="owner-form" aria-label={t.title}>
      <h3>{t.title}</h3>
      {working && !data && <p role="status">{t.loading}</p>}
      {message && (
        <p ref={feedback} tabIndex={-1} role="alert">
          {t[message]}
        </p>
      )}
      {message && (
        <Button
          disabled={working || disabled}
          onClick={() => void (pending.current ? prepare() : load())}
        >
          {t.retry}
        </Button>
      )}
      {data?.state === "unsupported" && (
        <>
          <p role="status">{t.unsupported}</p>
          {requirements(order.requirements.items.map((_, i) => i))}
        </>
      )}
      {data?.state === "historical-preview" && (
        <>
          <p>{t.legacy}</p>
          {!review && (
            <Button
              disabled={working || disabled}
              onClick={() => setReview(true)}
            >
              {t.prepare}
            </Button>
          )}
          {review && (
            <div className="owner-form">
              <h4>{t.review}</h4>
              <p>{t.preview}</p>
              <Field>
                <FieldLabel htmlFor="piece-reason">{t.reason}</FieldLabel>
                <Input
                  id="piece-reason"
                  value={reason}
                  maxLength={1000}
                  disabled={working || !!pending.current}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <div className="owner-actions">
                <Button
                  disabled={
                    working ||
                    disabled ||
                    !!pending.current ||
                    !reason.trim() ||
                    !!message
                  }
                  onClick={() => void prepare()}
                >
                  {t.confirm}
                </Button>
                <Button
                  variant="ghost"
                  disabled={working || !!pending.current}
                  onClick={() => {
                    setReview(false);
                    setReason("");
                    setMessage(undefined);
                  }}
                >
                  {t.cancel}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {structure && (
        <>
          {!structure.pieces.length && <p>{t.none}</p>}
          {structure.pieces.map((p) => (
            <article
              key={p.key}
              className="owner-form"
              aria-label={locale === "ta" ? p.labelTa : p.labelEn}
            >
              <h4>{locale === "ta" ? p.labelTa : p.labelEn}</h4>
              <p>
                {p.applicability === "not-applicable"
                  ? t.excluded
                  : p.applicability === "unresolved"
                    ? t.unknown
                    : t.booked}
              </p>
              {p.applicability !== "applicable" && p.reason && (
                <p>{p.reason}</p>
              )}
              <p>
                {t.form}:{" "}
                {p.form
                  ? locale === "ta"
                    ? p.form.labelTa
                    : p.form.labelEn
                  : t.noForm}
              </p>
              {p.applicability !== "not-applicable" &&
                requirements(
                  structure.requirements
                    .filter((r) => r.pieceKey === p.key)
                    .map((r) => r.position),
                )}
              {order.presentation === "detailed" && (
                <details>
                  <summary>{t.original}</summary>
                  <p>
                    {p.key} · {p.revisionId}
                  </p>
                  {p.form && <p>{p.form.revisionId}</p>}
                </details>
              )}
            </article>
          ))}
          {!!shared.length && (
            <div>
              <h4>{t.shared}</h4>
              <p>{t.sharedHint}</p>
              {requirements(shared)}
            </div>
          )}
        </>
      )}
      {data?.provenance && (
        <details>
          <summary>{t.history}</summary>
          <p>
            {t.prepared} ·{" "}
            {new Date(data.provenance.recordedAt).toLocaleString(
              locale === "ta" ? "ta-IN" : "en-IN",
              { timeZone: "Asia/Kolkata" },
            )}
          </p>
          <p>{data.provenance.reason}</p>
        </details>
      )}
      <p>{t.unavailable}</p>
    </section>
  );
}
