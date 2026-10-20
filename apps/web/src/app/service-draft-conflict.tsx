import { previewQuickOrder } from "@aarili/api/orders-client";
import { readServiceProfile } from "@aarili/api/small-services-client";
import type { DraftRecord } from "@aarili/contracts/drafts";
import {
  groupIntakeDraftSchema,
  type QuickOrderDraft,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import {
  type ServiceIntakeDraft,
  serviceChangeDraftSchema,
  serviceIntakeDraftSchema,
} from "@aarili/contracts/small-services";
import {
  bookingMessages,
  groupIntakeMessages,
  type Locale,
  orderMessages,
  serviceAdditionMessages,
  smallServiceMessages,
} from "@aarili/i18n";
import { useEffect, useState } from "react";

function SavedBase({
  value,
  shopId,
  locale,
}: {
  value: QuickOrderDraft;
  shopId: string;
  locale: Locale;
}) {
  const [identity, setIdentity] =
      useState<Awaited<ReturnType<typeof previewQuickOrder>>>(),
    o = orderMessages[locale],
    t = serviceAdditionMessages[locale];
  useEffect(() => {
    let current = true;
    void previewQuickOrder(shopId, value).then(
      (r) => {
        if (current) setIdentity(r);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [shopId, value]);
  return (
    <dl>
      <dt>{o.customerId}</dt>
      <dd>{identity?.customer?.label ?? t.unresolved}</dd>
      <dt>{o.wearerId}</dt>
      <dd>{identity?.wearer?.label ?? t.unresolved}</dd>
      <dt>{t.promise}</dt>
      <dd>
        {value.deliveryDate} {value.deliveryTime}
      </dd>
      <dt>{o.instructions}</dt>
      <dd className="preserve-text">{value.instructions}</dd>
      <dt>{t.price}</dt>
      <dd>{value.priceState === "quoted" ? value.priceText : t.unknown}</dd>
    </dl>
  );
}
function SavedSelection({
  value,
  shopId,
  locale,
}: {
  value: Pick<
    ServiceIntakeDraft["selections"][number],
    "profile" | "lines" | "capacity" | "commercial" | "reason" | "agreement"
  >;
  shopId: string;
  locale: Locale;
}) {
  const [label, setLabel] = useState(""),
    t = serviceAdditionMessages[locale],
    s = smallServiceMessages[locale];
  const revision = value.profile?.revisionId;
  useEffect(() => {
    const ac = new AbortController();
    setLabel("");
    if (revision)
      void readServiceProfile(shopId, revision, ac.signal).then(
        (p) => {
          if (!ac.signal.aborted)
            setLabel(
              `${locale === "ta" ? p.content.labelTa : p.content.labelEn} · ${p.version}`,
            );
        },
        () => {},
      );
    return () => ac.abort();
  }, [shopId, revision, locale]);
  return (
    <article>
      <h3>{label || s.profile}</h3>
      <ol className="order-choices">
        {value.lines.map((line, index) => (
          <li key={line.id}>
            <strong>
              {t.work} {index + 1}
            </strong>
            <p className="preserve-text">{line.requestedWork}</p>
            <p>
              {line.notRequired
                ? t.notRequired
                : `${t.price}: ${line.priceState === "quoted" ? line.priceText : t.unknown}`}
            </p>
            {line.notRequiredReason && (
              <p className="preserve-text">{line.notRequiredReason}</p>
            )}
          </li>
        ))}
      </ol>
      <dl>
        <dt>{t.commercial}</dt>
        <dd>
          {value.commercial === "outside-package"
            ? t.outside
            : value.commercial === "additional-charge"
              ? t.charge
              : t.unresolved}
        </dd>
        <dt>{t.capacity}</dt>
        <dd>
          {value.capacity.basis === "already-covered"
            ? t.covered
            : value.capacity.basis === "incremental"
              ? t.incremental
              : t.unresolved}
        </dd>
        <dt>{t.capacityReason}</dt>
        <dd className="preserve-text">{value.capacity.reason}</dd>
        <dt>{t.reason}</dt>
        <dd className="preserve-text">{value.reason}</dd>
        <dt>{t.agreement}</dt>
        <dd className="preserve-text">{value.agreement}</dd>
      </dl>
    </article>
  );
}
export function ServiceDraftConflict({
  record,
  shopId,
  locale,
}: {
  record: DraftRecord;
  shopId: string;
  locale: Locale;
}) {
  const t = serviceAdditionMessages[locale],
    change = serviceChangeDraftSchema.safeParse(record.payload),
    intake = serviceIntakeDraftSchema.safeParse(record.payload),
    b = bookingMessages[locale],
    g = groupIntakeMessages[locale];
  if (change.success)
    return (
      <section className="order-editor service-additions">
        <p>
          {new Date(record.updatedAt).toLocaleString(
            locale === "ta" ? "ta-IN" : "en-IN",
          )}
        </p>
        <SavedSelection value={change.data} shopId={shopId} locale={locale} />
      </section>
    );
  if (!intake.success) return <p>{t.error}</p>;
  const v = intake.data,
    group = v.kind === "group" ? groupIntakeDraftSchema.parse(v.base) : null,
    rows = group
      ? group.lines
      : [{ id: "custom", intake: quickOrderDraftSchema.parse(v.base) }];
  return (
    <section className="order-editor service-additions">
      <p>
        {new Date(record.updatedAt).toLocaleString(
          locale === "ta" ? "ta-IN" : "en-IN",
        )}
      </p>
      {rows.map((row, index) => (
        <article key={row.id}>
          <h3>
            {t.base} {index + 1}
          </h3>
          <SavedBase value={row.intake} shopId={shopId} locale={locale} />
        </article>
      ))}
      {group && (
        <dl>
          <dt>{b.occasion}</dt>
          <dd>{b[group.context.occasion]}</dd>
          <dt>{b.notes}</dt>
          <dd className="preserve-text">{group.context.notes}</dd>
          <dt>{g.reason}</dt>
          <dd className="preserve-text">{group.reason}</dd>
          <dt>{g.basis}</dt>
          <dd>
            {group.commercial.basis === "package-proposal"
              ? g.package
              : g.aggregate}
          </dd>
          {group.commercial.basis === "package-proposal" && (
            <>
              <dt>{g.packageAmount}</dt>
              <dd>
                {group.commercial.packagePriceState === "quoted"
                  ? group.commercial.packagePriceText
                  : g.packageUnknown}
              </dd>
            </>
          )}
        </dl>
      )}
      {v.selections.map((value, index) => (
        <SavedSelection
          key={value.lineId ?? index}
          value={value}
          shopId={shopId}
          locale={locale}
        />
      ))}
    </section>
  );
}
