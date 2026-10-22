import { onOwnerInvalidation } from "@aarili/api/client";
import {
  readDesignDraftReferenceBytes,
  readDesignReferenceBytes,
  readDesignReferenceLibrary,
  readDesignSubjectAssets,
  readPrivateDesignSubjects,
} from "@aarili/api/design-references-client";
import { listAcceptedOrders, readOrderPieces } from "@aarili/api/orders-client";
import type { DesignChoicesRevision } from "@aarili/contracts/design-choices";
import {
  type DesignMediaSubject,
  type DesignMediaSubjectDraft,
  type DesignReferenceDraft,
  type DesignReferenceSnapshot,
  designMediaSubjectCommandSchema,
  designMediaSubjectDraftSchema,
} from "@aarili/contracts/design-references";
import type { DesignSpecificationVersion } from "@aarili/contracts/design-specifications";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import type { MediaPurpose, MediaRecord } from "@aarili/contracts/media";
import type { AcceptedOrder, OrderPieces } from "@aarili/contracts/orders";
import { designReferenceMessages, type Locale } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import { createPrivateUpload, type PrivateUpload } from "./media-upload";
import { PrivateUploadForm } from "./media-upload-form";
import type { OwnerGuard } from "./owner-feedback";

export type ReferenceCandidate = {
  asset: MediaRecord;
  subject: DesignMediaSubject;
};
type T = (typeof designReferenceMessages)[Locale];
type DesignChoicesDefinition = DesignChoicesRevision["definition"];
const text = (d: { labelEn: string; labelTa: string }, locale: Locale) =>
  locale === "ta" ? d.labelTa : d.labelEn;
function sourceName(s: DesignMediaSubject, t: T) {
  return s.redacted
    ? t.erased
    : `${s.sourceText} · ${s.sourceDate ?? t.unknownDate}`;
}
function rightsLabel(basis: DesignMediaSubject["rightsBasis"], t: T) {
  return {
    "shop-owned": t.shopOwned,
    "licensed-reuse": t.licensedReuse,
    "private-fulfilment": t.privateFulfilment,
    unknown: t.unknown,
  }[basis];
}

export function ReferenceComparison({
  current,
  proposed,
  profile,
  locale,
}: {
  current: DesignSpecificationVersion | undefined;
  proposed: DesignReferenceDraft[];
  profile: DesignChoicesDefinition | undefined;
  locale: Locale;
}) {
  const t = designReferenceMessages[locale];
  const previous = current?.referenceItems ?? [];
  const pairs = [
    ...previous.map((before) => ({
      before,
      after: proposed.find(
        (r) => r.replacesId === before.id || r.id === before.id,
      ),
    })),
    ...proposed
      .filter(
        (r) => !previous.some((p) => r.replacesId === p.id || r.id === p.id),
      )
      .map((after) => ({ before: undefined, after })),
  ];
  function describe(
    r: DesignReferenceDraft,
    definition: DesignChoicesDefinition | undefined,
  ) {
    if ("redacted" in r && r.redacted) return <p>{t.erased}</p>;
    const question =
      definition?.content.kind === "profile"
        ? definition.content.questions.find((q) => q.id === r.questionId)
        : undefined;
    return (
      <dl>
        <dt>{t.component}</dt>
        <dd>
          {r.questionId
            ? question
              ? text(question, locale)
              : t.erased
            : t.whole}
        </dd>
        <dt>{t.attachment}</dt>
        <dd className="reference-hash">{r.assetId}</dd>
        <dt>{t.caption}</dt>
        <dd>{r.caption || t.emptyValue}</dd>
        <dt>{t.intent}</dt>
        <dd>{r.intent === "instruction" ? t.instruction : t.inspiration}</dd>
        <dt>{t.notes}</dt>
        <dd>
          {r.annotations.length ? (
            <ul>
              {r.annotations.map((a, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: immutable ordered annotation snapshot has no IDs
                <li key={i}>
                  {a.note} ·{" "}
                  {a.anchor.kind === "note"
                    ? t.note
                    : a.anchor.kind === "point"
                      ? t.point
                      : t.rectangle}
                  {a.anchor.kind !== "note" &&
                    ` (${t.x}: ${a.anchor.x}; ${t.y}: ${a.anchor.y}${a.anchor.kind === "rectangle" ? `; ${t.width}: ${a.anchor.width}; ${t.height}: ${a.anchor.height}` : ""})`}
                </li>
              ))}
            </ul>
          ) : (
            t.emptyValue
          )}
        </dd>
      </dl>
    );
  }
  return (
    <section
      className="owner-form reference-comparison"
      aria-label={t.comparison}
    >
      <h4>{t.comparison}</h4>
      <p>{t.comparisonHint}</p>
      {!pairs.length && <p>{t.noReferences}</p>}
      {pairs.map(({ before, after }) => (
        <div
          className="reference-comparison-pair"
          key={before?.id ?? after?.id}
        >
          <div>
            <h5>
              {t.currentReferences}
              {current ? ` · v${current.version}` : ""}
            </h5>
            {before ? (
              describe(before, current?.profile)
            ) : (
              <p>{t.noReferences}</p>
            )}
          </div>
          <div>
            <h5>{t.proposedReferences}</h5>
            {after ? describe(after, profile) : <p>{t.removedReference}</p>}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ReferenceFields({
  values,
  change,
  profile,
  locale,
  candidate,
  images,
  shopId,
  draftId,
  savedItems,
  knownReferences,
}: {
  values: DesignReferenceDraft[];
  change: (items: DesignReferenceDraft[]) => void;
  profile: DesignChoicesDefinition | undefined;
  locale: Locale;
  candidate: ReferenceCandidate | undefined;
  images: Set<string>;
  shopId: string;
  draftId: string;
  savedItems: DesignReferenceDraft[];
  knownReferences: DesignReferenceSnapshot[];
}) {
  const t = designReferenceMessages[locale];
  function update(i: number, p: Partial<DesignReferenceDraft>) {
    change(values.map((r, n) => (n === i ? { ...r, ...p } : r)));
  }
  return (
    <fieldset className="owner-form">
      <legend>{t.title}</legend>
      <p>{t.hint}</p>
      <p>{t.limit}</p>
      <Button
        type="button"
        disabled={!candidate || values.length >= 20}
        onClick={() => {
          if (candidate)
            change([
              ...values,
              {
                id: crypto.randomUUID(),
                assetId: candidate.asset.id,
                questionId: null,
                intent: "inspiration",
                caption: "",
                annotations: [],
                replacesId: null,
                geometryReviewed: false,
              },
            ]);
        }}
      >
        {t.add}
      </Button>
      {candidate && (
        <p>
          {sourceName(candidate.subject, t)} · {candidate.asset.contentType}
        </p>
      )}
      {values.map((r, i) => (
        <details key={r.id} open>
          <summary>
            {t.caption} {i + 1} ·{" "}
            {r.intent === "instruction" ? t.instruction : t.inspiration}
          </summary>
          <fieldset className="owner-form">
            <legend>
              {t.caption} {i + 1}
            </legend>
            <DraftReferenceReview
              key={`${r.id}-${r.assetId}`}
              reference={r}
              shopId={shopId}
              draftId={draftId}
              locale={locale}
              saved={savedItems.some(
                (s) => s.id === r.id && s.assetId === r.assetId,
              )}
              known={candidate?.asset.id === r.assetId ? candidate : undefined}
              previous={knownReferences.find((p) => p.id === r.replacesId)}
            />
            <label>
              {t.caption}
              <input
                aria-label={t.caption}
                className="ui-input"
                maxLength={1000}
                value={r.caption}
                onChange={(e) => update(i, { caption: e.target.value })}
              />
            </label>
            <label>
              {t.intent}
              <select
                aria-label={t.intent}
                value={r.intent}
                onChange={(e) =>
                  update(i, {
                    intent:
                      e.target.value === "instruction"
                        ? "instruction"
                        : "inspiration",
                  })
                }
              >
                <option value="inspiration">{t.inspiration}</option>
                <option value="instruction">{t.instruction}</option>
              </select>
            </label>
            <label>
              {t.component}
              <select
                aria-label={t.component}
                value={r.questionId ?? ""}
                onChange={(e) =>
                  update(i, { questionId: e.target.value || null })
                }
              >
                <option value="">{t.whole}</option>
                {profile?.content.kind === "profile" &&
                  profile.content.questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {text(q, locale)}
                    </option>
                  ))}
              </select>
            </label>
            <p>{t.geometry}</p>
            {r.annotations.map((a, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: annotation positions are the immutable child identity; these controlled fields have no local state
              <fieldset className="owner-form" key={`${r.id}-${j}`}>
                <legend>
                  {t.notes} {j + 1}
                </legend>
                <label>
                  {t.note}
                  <textarea
                    aria-label={t.note}
                    className="ui-input"
                    maxLength={2000}
                    value={a.note}
                    onChange={(e) =>
                      update(i, {
                        annotations: r.annotations.map((n, k) =>
                          k === j ? { ...n, note: e.target.value } : n,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  {t.anchor}
                  <select
                    aria-label={t.anchor}
                    value={a.anchor.kind}
                    onChange={(e) => {
                      const kind = e.target.value;
                      update(i, {
                        geometryReviewed: true,
                        annotations: r.annotations.map((n, k) =>
                          k === j
                            ? {
                                ...n,
                                anchor:
                                  kind === "point"
                                    ? { kind, x: 5000, y: 5000 }
                                    : kind === "rectangle"
                                      ? {
                                          kind,
                                          x: 2500,
                                          y: 2500,
                                          width: 5000,
                                          height: 5000,
                                        }
                                      : { kind: "note" },
                              }
                            : n,
                        ),
                      });
                    }}
                  >
                    <option value="note">{t.note}</option>
                    {images.has(r.assetId) && (
                      <>
                        <option value="point">{t.point}</option>
                        <option value="rectangle">{t.rectangle}</option>
                      </>
                    )}
                  </select>
                </label>
                {a.anchor.kind !== "note" &&
                  (
                    [
                      "x",
                      "y",
                      ...(a.anchor.kind === "rectangle"
                        ? ["width", "height"]
                        : []),
                    ] as const
                  ).map((key) => (
                    <label key={key}>
                      {t[key as "x" | "y" | "width" | "height"]}
                      <input
                        className="ui-input"
                        type="number"
                        inputMode="numeric"
                        min={key === "width" || key === "height" ? 1 : 0}
                        max={10000}
                        step={1}
                        value={Number(
                          (a.anchor as unknown as Record<string, unknown>)[key],
                        )}
                        onChange={(e) =>
                          update(i, {
                            geometryReviewed: true,
                            annotations: r.annotations.map((n, k) =>
                              k === j
                                ? {
                                    ...n,
                                    anchor: {
                                      ...n.anchor,
                                      [key]: e.target.valueAsNumber,
                                    },
                                  }
                                : n,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    update(i, {
                      annotations: r.annotations.filter((_, k) => k !== j),
                    })
                  }
                >
                  {t.removeNote}
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={r.annotations.length >= 20}
              onClick={() =>
                update(i, {
                  annotations: [
                    ...r.annotations,
                    { note: "", anchor: { kind: "note" } },
                  ],
                })
              }
            >
              {t.addNote}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!candidate}
              onClick={() => {
                if (candidate)
                  update(i, {
                    assetId: candidate.asset.id,
                    annotations: r.annotations.map((n) => ({
                      ...n,
                      anchor: { kind: "note" },
                    })),
                    geometryReviewed: false,
                  });
              }}
            >
              {t.replace}
            </Button>
            <p>{t.geometryReset}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => change(values.filter((_, n) => n !== i))}
            >
              {t.remove}
            </Button>
          </fieldset>
        </details>
      ))}
    </fieldset>
  );
}

function SourceFields({
  values,
  change,
  t,
}: {
  values: DesignMediaSubjectDraft;
  change: (p: Partial<DesignMediaSubjectDraft>) => void;
  t: T;
}) {
  return (
    <div className="owner-form">
      <p>{t.rightsHint}</p>
      <p>{t.libraryHint}</p>
      <label>
        {t.sourceKind}
        <select
          aria-label={t.sourceKind}
          value={values.sourceKind}
          onChange={(e) =>
            change({
              sourceKind: e.target
                .value as DesignMediaSubjectDraft["sourceKind"],
            })
          }
        >
          {(
            ["shop-created", "customer-provided", "licensed", "other"] as const
          ).map((k, i) => (
            <option key={k} value={k}>
              {[t.shopCreated, t.customerProvided, t.licensed, t.other][i]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.sourceText}
        <textarea
          aria-label={t.sourceText}
          className="ui-input"
          maxLength={2000}
          value={values.sourceText}
          onChange={(e) => change({ sourceText: e.target.value })}
        />
      </label>
      <label>
        {t.sourceDate}
        <input
          aria-label={t.sourceDate}
          className="ui-input"
          type="date"
          value={values.sourceDate ?? ""}
          onChange={(e) => change({ sourceDate: e.target.value || null })}
        />
      </label>
      <label>
        {t.rights}
        <select
          aria-label={t.rights}
          value={values.rightsBasis}
          onChange={(e) =>
            change({
              rightsBasis: e.target
                .value as DesignMediaSubjectDraft["rightsBasis"],
            })
          }
        >
          {(
            [
              "unknown",
              "private-fulfilment",
              "shop-owned",
              "licensed-reuse",
            ] as const
          ).map((k, i) => (
            <option key={k} value={k}>
              {
                [t.unknown, t.privateFulfilment, t.shopOwned, t.licensedReuse][
                  i
                ]
              }
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.evidence}
        <textarea
          aria-label={t.evidence}
          className="ui-input"
          maxLength={2000}
          value={values.rightsEvidence}
          onChange={(e) => change({ rightsEvidence: e.target.value })}
        />
      </label>
      <label>
        {t.reason}
        <input
          aria-label={t.reason}
          className="ui-input"
          maxLength={1000}
          value={values.reason}
          onChange={(e) => change({ reason: e.target.value })}
        />
      </label>
    </div>
  );
}

function SourceEditor({
  controller,
  guard,
  locale,
}: {
  controller: DraftRecovery;
  guard: OwnerGuard;
  locale: Locale;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = designReferenceMessages[locale];
  return (
    <DraftForm
      controller={controller}
      schema={designMediaSubjectDraftSchema}
      locale={locale}
      guard={guard}
      canPromote={designMediaSubjectCommandSchema.safeParse(s.values).success}
      promotionLabel={t.create}
    >
      {(form) => (
        <SourceFields
          values={form.watch()}
          change={(patch) => {
            if (patch.sourceKind !== undefined)
              form.setValue("sourceKind", patch.sourceKind, {
                shouldDirty: true,
              });
            if (patch.sourceText !== undefined)
              form.setValue("sourceText", patch.sourceText, {
                shouldDirty: true,
              });
            if (patch.sourceDate !== undefined)
              form.setValue("sourceDate", patch.sourceDate, {
                shouldDirty: true,
              });
            if (patch.rightsBasis !== undefined)
              form.setValue("rightsBasis", patch.rightsBasis, {
                shouldDirty: true,
              });
            if (patch.rightsEvidence !== undefined)
              form.setValue("rightsEvidence", patch.rightsEvidence, {
                shouldDirty: true,
              });
            if (patch.reason !== undefined)
              form.setValue("reason", patch.reason, { shouldDirty: true });
          }}
          t={t}
        />
      )}
    </DraftForm>
  );
}
function SourceUpload({
  upload,
  locale,
}: {
  upload: PrivateUpload;
  locale: Locale;
}) {
  return <PrivateUploadForm controller={upload} locale={locale} />;
}

// Source recording and uploads are siblings of the specification form. No
// nested forms, second upload protocol, browser persistence or automatic reuse.
export function ReferenceWorkbench({
  shopId,
  orderId,
  pieceId,
  locale,
  guard,
  profile,
  onCandidate,
}: {
  shopId: string;
  orderId: string;
  pieceId: string | null;
  locale: Locale;
  guard: OwnerGuard;
  profile: DesignChoicesDefinition | undefined;
  onCandidate: (c: ReferenceCandidate | undefined) => void;
}) {
  const t = designReferenceMessages[locale],
    epoch = useRef(0),
    scope = useRef<ReturnType<typeof createDraftScope> | undefined>(undefined),
    current = useRef<DraftRecovery | undefined>(undefined);
  const [kind, setKind] = useState<"private" | "library">("private"),
    [subjects, setSubjects] = useState<DesignMediaSubject[]>([]),
    [next, setNext] = useState<string | null>(null),
    [selected, setSelected] = useState<DesignMediaSubject>(),
    [assets, setAssets] = useState<MediaRecord[]>([]),
    [assetNext, setAssetNext] = useState<string | null>(null),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState<DraftRecovery>(),
    [sourceDrafts, setSourceDrafts] = useState<DraftRecord[]>([]),
    [purpose, setPurpose] = useState<MediaPurpose>("wearer-photo"),
    [upload, setUpload] = useState<PrivateUpload>(),
    [browseOrder, setBrowseOrder] = useState(orderId),
    [browsePiece, setBrowsePiece] = useState<string | null>(pieceId),
    [orders, setOrders] = useState<AcceptedOrder[]>([]),
    [orderNext, setOrderNext] = useState<string | null>(null),
    [pieces, setPieces] = useState<OrderPieces>();
  const callback = useRef(onCandidate);
  callback.current = onCandidate;
  useEffect(() => {
    const own = createDraftScope(shopId, guard);
    scope.current = own;
    const stop = onOwnerInvalidation(() => {
      epoch.current++;
      setSubjects([]);
      setAssets([]);
      setSelected(undefined);
      setEditor(undefined);
      setSourceDrafts([]);
      callback.current(undefined);
    });
    return () => {
      epoch.current++;
      stop();
      own.dispose();
    };
  }, [shopId, guard]);
  useEffect(() => {
    if (!selected) return;
    const c = createPrivateUpload({
      shopId,
      subjectId: selected.id,
      purpose,
      guard,
    });
    setUpload(c);
    return () => {
      c.dispose();
    };
  }, [selected, shopId, purpose, guard]);
  async function load(before?: string) {
    const gen = ++epoch.current;
    setBusy(true);
    setFailed(false);
    try {
      const page =
        kind === "library"
          ? await readDesignReferenceLibrary(shopId, before)
          : await readPrivateDesignSubjects(
              shopId,
              browseOrder,
              browsePiece,
              before,
            );
      const records: DraftRecord[] = [];
      let cursor: DraftCursor | undefined;
      do {
        const saved = await scope.current?.list(cursor);
        if (!saved) break;
        records.push(...saved.drafts);
        cursor = saved.next ?? undefined;
      } while (cursor);
      if (gen !== epoch.current) return;
      setSourceDrafts(
        records.filter(
          (d) =>
            d.workflow === "design.reference" &&
            d.payload.kind === kind &&
            (kind === "library" ||
              (d.payload.orderId === orderId && d.payload.pieceId === pieceId)),
        ),
      );
      setSubjects((v) => (before ? [...v, ...page.subjects] : page.subjects));
      setNext(page.next);
    } catch {
      if (gen === epoch.current) setFailed(true);
    } finally {
      if (gen === epoch.current) setBusy(false);
    }
  }
  async function files(s: DesignMediaSubject, before?: string) {
    const gen = ++epoch.current;
    setBusy(true);
    setFailed(false);
    callback.current(undefined);
    try {
      const page = await readDesignSubjectAssets(shopId, s.id, before);
      if (gen !== epoch.current) return;
      setSelected(s);
      setAssets((v) => (before ? [...v, ...page.assets] : page.assets));
      setAssetNext(page.next);
      setPurpose(s.kind === "library" ? "manual-pattern" : "wearer-photo");
    } catch {
      if (gen === epoch.current) setFailed(true);
    } finally {
      if (gen === epoch.current) setBusy(false);
    }
  }
  async function loadOrders(before?: string) {
    const gen = ++epoch.current;
    setBusy(true);
    try {
      const p = await listAcceptedOrders(shopId, before);
      if (gen === epoch.current) {
        setOrders((v) => (before ? [...v, ...p.orders] : p.orders));
        setOrderNext(p.next);
      }
    } catch {
      if (gen === epoch.current) setFailed(true);
    } finally {
      if (gen === epoch.current) setBusy(false);
    }
  }
  function begin(previous?: DesignMediaSubject, record?: DraftRecord) {
    if (
      current.current &&
      !current.current.confirmLeave(() => window.confirm(t.close))
    )
      return;
    if (current.current) scope.current?.release(current.current);
    const c = scope.current?.open({
      workflow: "design.reference",
      schemaVersion: 1,
      ...(record ? { record } : {}),
      initial: record?.payload ?? {
        kind,
        orderId: kind === "private" ? orderId : null,
        pieceId: kind === "private" ? pieceId : null,
        category:
          kind === "library" ? (profile?.content.category ?? null) : null,
        previousId: previous?.id ?? null,
        sourceKind:
          previous?.sourceKind ??
          (kind === "library" ? "shop-created" : "customer-provided"),
        sourceText: previous?.sourceText ?? "",
        sourceDate: previous?.sourceDate ?? null,
        rightsBasis: previous?.rightsBasis ?? "unknown",
        rightsEvidence: previous?.rightsEvidence ?? "",
        reason: "",
      },
      committed: (r) => {
        if (r.lifecycle === "promoted") {
          void load();
        }
      },
    });
    current.current = c;
    setEditor(c);
  }
  return (
    <section className="owner-form" aria-label={t.source}>
      <h3>{t.source}</h3>
      <p>{t.rightsHint}</p>
      <p>{t.reviseHint}</p>
      <label>
        {t.source}
        <select
          aria-label={t.source}
          disabled={!!editor || busy}
          value={kind}
          onChange={(e) => {
            epoch.current++;
            setKind(e.target.value === "library" ? "library" : "private");
            setSubjects([]);
            setSelected(undefined);
            setAssets([]);
            setUpload(undefined);
            setNext(null);
            callback.current(undefined);
          }}
        >
          <option value="private">{t.private}</option>
          <option value="library">{t.library}</option>
        </select>
      </label>
      {kind === "private" && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void loadOrders()}
          >
            {t.choose}
          </Button>
          <label>
            {t.source}
            <select
              aria-label={t.source}
              value={browseOrder}
              disabled={busy}
              onChange={(e) => {
                const id = e.target.value,
                  gen = ++epoch.current;
                setBrowseOrder(id);
                setBrowsePiece(null);
                setSubjects([]);
                setSelected(undefined);
                setAssets([]);
                callback.current(undefined);
                void readOrderPieces(shopId, id)
                  .then((p) => {
                    if (gen === epoch.current) setPieces(p);
                  })
                  .catch(() => {
                    if (gen === epoch.current) setFailed(true);
                  });
              }}
            >
              <option value={orderId}>{t.private}</option>
              {orders
                .filter((o) => o.id !== orderId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}
                  </option>
                ))}
            </select>
          </label>
          {orderNext && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void loadOrders(orderNext)}
            >
              {t.more}
            </Button>
          )}
          <label>
            {t.component}
            <select
              aria-label={t.component}
              value={browsePiece ?? ""}
              onChange={(e) => {
                epoch.current++;
                setBrowsePiece(e.target.value || null);
                setSubjects([]);
                setSelected(undefined);
                setAssets([]);
                callback.current(undefined);
              }}
            >
              <option value="">{t.whole}</option>
              {pieces?.identities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void load()}
      >
        {t.refresh}
      </Button>
      {next && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void load(next)}
        >
          {t.more}
        </Button>
      )}
      {!subjects.length && <p>{t.empty}</p>}
      {subjects.map((s) => (
        <div key={s.id}>
          <Button
            type="button"
            variant="outline"
            disabled={s.redacted || busy}
            onClick={() => void files(s)}
          >
            {sourceName(s, t)}
          </Button>
          {s.kind === "library" && !s.redacted && (
            <Button
              type="button"
              variant="outline"
              disabled={!!editor || busy}
              onClick={() => begin(s)}
            >
              {t.sourceRevision}
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        disabled={
          !!editor || busy || (kind === "library" && !profile?.content.category)
        }
        onClick={() => begin()}
      >
        {t.create}
      </Button>
      {sourceDrafts.map((d, i) => (
        <Button
          type="button"
          key={d.id}
          variant="outline"
          disabled={!!editor || busy}
          onClick={() => begin(undefined, d)}
        >
          {locale === "ta" ? "மூல வரைவைக் மீண்டும் திற" : "Reopen source draft"}{" "}
          {i + 1}
        </Button>
      ))}
      {editor && (
        <>
          <SourceEditor controller={editor} locale={locale} guard={guard} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!editor.confirmLeave(() => window.confirm(t.close))) return;
              scope.current?.release(editor);
              setEditor(undefined);
              current.current = undefined;
            }}
          >
            {t.close}
          </Button>
        </>
      )}
      {selected && (
        <>
          <h4>{sourceName(selected, t)}</h4>
          <p>{selected.rightsEvidence}</p>
          <label>
            {t.purpose}
            <select
              aria-label={t.purpose}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as MediaPurpose)}
            >
              {(selected.kind === "library"
                ? [
                    ["manual-pattern", t.manual],
                    ["order-document", t.document],
                    ["voice-note", t.voice],
                  ]
                : [
                    ["wearer-photo", t.photo],
                    ["private-fitting", t.fitting],
                    ["order-document", t.document],
                    ["voice-note", t.voice],
                  ]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {upload && (
            <SourceUpload
              key={upload.scopeKey}
              upload={upload}
              locale={locale}
            />
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void files(selected)}
          >
            {t.refresh}
          </Button>
          {assets.map((a) => (
            <div key={a.id}>
              <p>
                {a.contentType} · {a.size} B ·{" "}
                {a.status === "ready" ? t.ready : a.status} ·{" "}
                {new Date(a.createdAt).toLocaleString(
                  locale === "ta" ? "ta-IN" : "en-IN",
                )}
              </p>
              {a.status !== "ready" && <p>{t.pending}</p>}
              <Button
                type="button"
                variant="outline"
                disabled={a.status !== "ready" || busy}
                onClick={() =>
                  callback.current({ asset: a, subject: selected })
                }
              >
                {t.candidate}
              </Button>
            </div>
          ))}
          {assetNext && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void files(selected, assetNext)}
            >
              {t.more}
            </Button>
          )}
        </>
      )}
      {failed && <p role="alert">{t.failed}</p>}
    </section>
  );
}

function DraftReferenceReview({
  reference,
  shopId,
  draftId,
  locale,
  saved,
  known,
  previous,
}: {
  reference: DesignReferenceDraft;
  shopId: string;
  draftId: string;
  locale: Locale;
  saved: boolean;
  known: ReferenceCandidate | undefined;
  previous: DesignReferenceSnapshot | undefined;
}) {
  const t = designReferenceMessages[locale],
    epoch = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    [info, setInfo] = useState<DesignReferenceSnapshot>(),
    [preview, setPreview] = useState<string>(),
    [download, setDownload] = useState<{ url: string; filename: string }>(),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const clear = () => {
      epoch.current++;
      clearTimeout(timer.current);
      setInfo(undefined);
      setPreview(undefined);
      setDownload(undefined);
    };
    const stop = onOwnerInvalidation(clear);
    return () => {
      clear();
      stop();
    };
  }, []);
  async function load(image: boolean) {
    const gen = ++epoch.current;
    setBusy(true);
    setFailed(false);
    clearTimeout(timer.current);
    setPreview(undefined);
    setDownload(undefined);
    try {
      const result = await readDesignDraftReferenceBytes(
        shopId,
        draftId,
        reference.id,
        image ? "thumbnail" : undefined,
      );
      if (gen !== epoch.current) return;
      setInfo(result.reference);
      if (image) setPreview(result.access.url);
      else
        setDownload({
          url: result.access.url,
          filename: result.access.filename,
        });
      timer.current = setTimeout(
        () => {
          if (gen === epoch.current) {
            setInfo(undefined);
            setPreview(undefined);
            setDownload(undefined);
            setFailed(true);
          }
        },
        Math.max(0, Date.parse(result.access.expiresAt) - Date.now()),
      );
    } catch {
      if (gen === epoch.current) {
        setInfo(undefined);
        setFailed(true);
      }
    } finally {
      if (gen === epoch.current) setBusy(false);
    }
  }
  const source = info?.subject ?? known?.subject,
    type = info?.contentType ?? known?.asset.contentType;
  return (
    <div className="owner-form">
      <p>
        {t.attachment}: {type ?? t.reviewRequired} ·{" "}
        {reference.assetId.slice(-8)}
      </p>
      {source && (
        <p>
          {sourceName(source, t)} · {rightsLabel(source.rightsBasis, t)}
        </p>
      )}
      {previous && previous.assetId !== reference.assetId && (
        <p>
          {t.oldAttachment}: {previous.contentType} ·{" "}
          {previous.assetId.slice(-8)} → {t.newAttachment}:{" "}
          {reference.assetId.slice(-8)}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={!saved || busy}
        onClick={() => void load(false)}
      >
        {t.reviewAttachment}
      </Button>
      {!saved && <p>{t.saveBeforeReview}</p>}
      {info?.display && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void load(true)}
        >
          {t.view}
        </Button>
      )}
      {preview && (
        // biome-ignore lint/performance/noImgElement: exact private capability bypasses public image optimizers and their caches
        <img
          className="reference-preview"
          src={preview}
          alt={reference.caption || t.display}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      {download && (
        <a
          href={download.url}
          download={download.filename}
          referrerPolicy="no-referrer"
        >
          {t.download}
        </a>
      )}
      {failed && <p role="status">{t.failed}</p>}
    </div>
  );
}
function SavedReference({
  r,
  versionId,
  shopId,
  locale,
  component,
}: {
  r: DesignReferenceSnapshot;
  versionId: string;
  shopId: string;
  locale: Locale;
  component: string;
}) {
  const t = designReferenceMessages[locale],
    epoch = useRef(0),
    [preview, setPreview] = useState<string>(),
    [download, setDownload] = useState<{ url: string; filename: string }>(),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const clear = () => {
      epoch.current++;
      clearTimeout(timer.current);
      setPreview(undefined);
      setDownload(undefined);
    };
    const stop = onOwnerInvalidation(clear);
    return () => {
      clear();
      stop();
    };
  }, []);
  async function load(image: boolean) {
    const gen = ++epoch.current;
    setBusy(true);
    setFailed(false);
    setPreview(undefined);
    setDownload(undefined);
    clearTimeout(timer.current);
    try {
      const cap = await readDesignReferenceBytes(
        shopId,
        versionId,
        r.id,
        image ? "thumbnail" : undefined,
      );
      if (gen !== epoch.current) return;
      if (image) setPreview(cap.url);
      else setDownload({ url: cap.url, filename: cap.filename });
      timer.current = setTimeout(
        () => {
          if (gen === epoch.current) {
            setPreview(undefined);
            setDownload(undefined);
            setFailed(true);
          }
        },
        Math.max(0, Date.parse(cap.expiresAt) - Date.now()),
      );
    } catch {
      if (gen === epoch.current) setFailed(true);
    } finally {
      if (gen === epoch.current) setBusy(false);
    }
  }
  if (r.redacted || r.subject.redacted) return <p>{t.erased}</p>;
  return (
    <div className="owner-form">
      <h4>{r.caption || r.contentType}</h4>
      <p>
        {t.component}: {component}
      </p>
      <p>{r.intent === "instruction" ? t.instruction : t.inspiration}</p>
      <p>
        {sourceName(r.subject, t)} · {rightsLabel(r.subject.rightsBasis, t)}
      </p>
      <p>{r.subject.rightsEvidence}</p>
      <details>
        <summary>{t.provenance}</summary>
        <p>
          {t.attachment}: {r.contentType} · {r.assetId}
        </p>
        <p>
          {t.recorded}: {r.subject.actorId} ·{" "}
          {new Date(r.subject.recordedAt).toLocaleString(
            locale === "ta" ? "ta-IN" : "en-IN",
          )}
        </p>
        <p>
          {t.uploaded}: {r.uploaderId} ·{" "}
          {new Date(r.uploadedAt).toLocaleString(
            locale === "ta" ? "ta-IN" : "en-IN",
          )}
        </p>
        <p>
          {t.content}: <span className="reference-hash">{r.sha256}</span>
        </p>
        {r.display && (
          <p>
            {t.display}: {r.display.width} × {r.display.height} ·{" "}
            <span className="reference-hash">{r.display.sha256}</span>
          </p>
        )}
      </details>
      {r.annotations.map((n, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: frozen annotation positions are stable within this exact version
        <p key={`${r.id}-${i}`}>
          {n.note}
          {n.anchor.kind !== "note"
            ? ` · ${n.anchor.kind === "point" ? t.point : t.rectangle} (${n.anchor.x}, ${n.anchor.y}${n.anchor.kind === "rectangle" ? `, ${n.anchor.width} × ${n.anchor.height}` : ""})`
            : ""}
        </p>
      ))}
      {r.display && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void load(true)}
        >
          {t.view}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void load(false)}
      >
        {t.download}
      </Button>
      {preview && (
        // biome-ignore lint/performance/noImgElement: exact private signed bytes must not enter a public image optimizer or cache
        <img
          className="reference-preview"
          src={preview}
          alt={r.caption || t.display}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      {download && (
        <a
          href={download.url}
          download={download.filename}
          referrerPolicy="no-referrer"
        >
          {t.download}
        </a>
      )}
      {failed && (
        <p role="status">
          {t.failed} {t.expired}
        </p>
      )}
    </div>
  );
}
export function SavedReferences({
  version,
  shopId,
  locale,
}: {
  version: DesignSpecificationVersion;
  shopId: string;
  locale: Locale;
}) {
  const t = designReferenceMessages[locale];
  return version.referenceItems.length ? (
    <section className="owner-form" aria-label={t.title}>
      <h3>{t.title}</h3>
      {version.referenceItems.map((r) => (
        <SavedReference
          key={`${version.id}-${r.id}`}
          r={r}
          versionId={version.id}
          shopId={shopId}
          locale={locale}
          component={
            r.questionId && version.profile.content.kind === "profile"
              ? (() => {
                  const q = version.profile.content.questions.find(
                    (q) => q.id === r.questionId,
                  );
                  return q ? text(q, locale) : t.erased;
                })()
              : t.whole
          }
        />
      ))}
    </section>
  ) : null;
}
