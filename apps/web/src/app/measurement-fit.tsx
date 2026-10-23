import { OwnerRequestError, onOwnerInvalidation } from "@aarili/api/client";
import {
  readMeasurementFit,
  readMeasurementFitAssets,
  readMeasurementFitBytes,
} from "@aarili/api/measurement-sessions-client";
import type { DraftCursor, DraftRecord } from "@aarili/contracts/drafts";
import {
  type MeasurementFitReference,
  measurementFitReferenceCommandSchema,
  measurementFitReferenceDraftSchema,
  measurementFitSubjectDraftSchema,
} from "@aarili/contracts/measurement-fit";
import type { MeasurementVersion } from "@aarili/contracts/measurement-sessions";
import type { MediaRecord } from "@aarili/contracts/media";
import { type Locale, measurementFitMessages } from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DraftForm } from "./draft-form";
import type { DraftRecovery } from "./draft-recovery";
import { createDraftScope } from "./draft-scope";
import { createPrivateUpload, type PrivateUpload } from "./media-upload";
import { PrivateUploadForm } from "./media-upload-form";
import type { OwnerGuard } from "./owner-feedback";

function accessLost(e: unknown) {
  return (
    e instanceof OwnerRequestError &&
    [
      "NOT_FOUND",
      "UNAUTHENTICATED",
      "SHOP_ACCESS_DENIED",
      "MEDIA_ACCESS_DENIED",
    ].includes(e.code)
  );
}
function FitImage({
  shopId,
  reference,
  locale,
  onDenied,
}: {
  shopId: string;
  reference: MeasurementFitReference;
  locale: Locale;
  onDenied: () => void;
}) {
  const t = measurementFitMessages[locale],
    generation = useRef(0);
  const [access, setAccess] =
      useState<Awaited<ReturnType<typeof readMeasurementFitBytes>>["access"]>(),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!access) return;
    const timer = window.setTimeout(
      () => setAccess(undefined),
      Math.max(0, Date.parse(access.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [access]);
  async function show() {
    const g = ++generation.current;
    setBusy(true);
    setFailed(false);
    setAccess(undefined);
    try {
      const r = await readMeasurementFitBytes(shopId, {
        measurementVersionId: reference.measurementVersionId,
        referenceId: reference.id,
        variant: "display",
      });
      if (g === generation.current) setAccess(r.access);
    } catch (e) {
      if (g === generation.current) {
        if (accessLost(e)) onDenied();
        else setFailed(true);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => (access ? setAccess(undefined) : void show())}
      >
        {access ? t.hide : t.view}
      </Button>
      {busy && <p role="status">{t.loading}</p>}
      {failed && <p role="alert">{t.unavailable}</p>}
      {access && (
        // biome-ignore lint/performance/noImgElement: exact private signed bytes must not enter a public image optimizer or cache
        <img
          src={access.url}
          className="reference-preview"
          alt={reference.caption || t.imageAlt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setAccess(undefined);
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}
function FitEditor({
  controller,
  assets,
  locale,
  guard,
  onDenied,
}: {
  controller: DraftRecovery;
  assets: MediaRecord[];
  locale: Locale;
  guard: OwnerGuard;
  onDenied: () => void;
}) {
  const s = useSyncExternalStore(
      controller.subscribe,
      controller.snapshot,
      controller.snapshot,
    ),
    t = measurementFitMessages[locale];
  useEffect(() => {
    if (s.status === "denied" || s.error === "NOT_FOUND") onDenied();
  }, [s.status, s.error, onDenied]);
  const subject = measurementFitSubjectDraftSchema.safeParse(s.values).success;
  if (subject)
    return (
      <DraftForm
        controller={controller}
        schema={measurementFitSubjectDraftSchema}
        locale={locale}
        guard={guard}
        promotionLabel={t.prepare}
      >
        {() => <p>{t.prepareHint}</p>}
      </DraftForm>
    );
  return (
    <>
      {s.error === "VERSION_STALE" && <p role="alert">{t.conflict}</p>}
      <DraftForm
        controller={controller}
        schema={measurementFitReferenceDraftSchema}
        locale={locale}
        guard={guard}
        canPromote={
          measurementFitReferenceCommandSchema.safeParse(s.values).success
        }
        promotionLabel={t.publish}
      >
        {(form) => (
          <div className="owner-form">
            <label>
              {t.image}
              <select
                aria-label={t.image}
                value={form.watch("assetId") ?? ""}
                onChange={(e) =>
                  form.setValue("assetId", e.target.value || null, {
                    shouldDirty: true,
                  })
                }
              >
                <option value="">{t.choose}</option>
                {assets
                  .filter((a) => a.status === "ready")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.contentType} · {a.createdAt} · {a.id.slice(-8)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t.caption}
              <textarea
                className="ui-input"
                aria-label={t.caption}
                maxLength={1000}
                {...form.register("caption")}
              />
            </label>
            <label>
              {t.reason}
              <textarea
                className="ui-input"
                aria-label={t.reason}
                maxLength={1000}
                {...form.register("reason")}
              />
            </label>
          </div>
        )}
      </DraftForm>
    </>
  );
}
export function MeasurementFitImages({
  shopId,
  version,
  locale,
  guard,
  onAccessChange,
}: {
  shopId: string;
  version: MeasurementVersion;
  locale: Locale;
  guard: OwnerGuard;
  onAccessChange?: () => void;
}) {
  const accessCallback = useRef(onAccessChange);
  accessCallback.current = onAccessChange;
  const t = measurementFitMessages[locale],
    prefix = useId(),
    generation = useRef(0),
    scope = useRef<ReturnType<typeof createDraftScope> | undefined>(undefined),
    current = useRef<DraftRecovery | undefined>(undefined),
    uploadRef = useRef<PrivateUpload | undefined>(undefined);
  const [opened, setOpened] = useState(false),
    [page, setPage] =
      useState<Awaited<ReturnType<typeof readMeasurementFit>>>(),
    [assets, setAssets] = useState<MediaRecord[]>([]),
    [assetNext, setAssetNext] = useState<string | null>(null),
    [drafts, setDrafts] = useState<DraftRecord[]>([]),
    [editor, setEditor] = useState<DraftRecovery>(),
    [upload, setUpload] = useState<PrivateUpload>(),
    [denied, setDenied] = useState(false),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [imageEpoch, setImageEpoch] = useState(0);
  const endAccess = useCallback(() => {
    generation.current++;
    setImageEpoch((n) => n + 1);
    setPage(undefined);
    setAssets([]);
    setDrafts([]);
    setEditor(undefined);
    setDenied(true);
    setBusy(false);
    if (current.current) {
      current.current.invalidate();
      scope.current?.release(current.current);
      current.current = undefined;
    }
    uploadRef.current?.dispose();
    uploadRef.current = undefined;
    setUpload(undefined);
    accessCallback.current?.();
  }, []);
  useEffect(() => {
    const own = createDraftScope(shopId, guard);
    scope.current = own;
    const stop = onOwnerInvalidation(endAccess);
    return () => {
      generation.current++;
      stop();
      own.dispose();
      uploadRef.current?.dispose();
    };
  }, [shopId, guard, endAccess]);
  const load = useCallback(
    async (before?: string) => {
      const g = ++generation.current;
      setBusy(true);
      setFailed(false);
      setImageEpoch((n) => n + 1);
      try {
        const p = await readMeasurementFit(shopId, {
          measurementVersionId: version.id,
          ...(before ? { before } : {}),
        });
        const a = p.subject
          ? await readMeasurementFitAssets(shopId, {
              measurementVersionId: version.id,
            })
          : { assets: [], next: null };
        const ds: DraftRecord[] = [];
        let cursor: DraftCursor | undefined;
        do {
          const d = await scope.current?.list(cursor);
          if (!d) break;
          ds.push(...d.drafts);
          cursor = d.next ?? undefined;
        } while (cursor);
        if (g !== generation.current) return;
        setPage((previous) => ({
          ...p,
          references: before
            ? [...(previous?.references ?? []), ...p.references]
            : p.references,
        }));
        setAssets(a.assets);
        setAssetNext(a.next);
        setDenied(false);
        setDrafts(
          ds.filter(
            (d) =>
              ["measurement.fit-subject", "measurement.fit-reference"].includes(
                d.workflow,
              ) &&
              d.payload.measurementVersionId === version.id &&
              d.lifecycle === "active",
          ),
        );
      } catch (e) {
        if (g === generation.current) {
          if (accessLost(e)) endAccess();
          else setFailed(true);
        }
      } finally {
        if (g === generation.current) setBusy(false);
      }
    },
    [shopId, version.id, endAccess],
  );
  useEffect(() => {
    if (opened) void load();
  }, [opened, load]);
  useEffect(() => {
    if (!opened) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [opened, load]);
  const subjectId = page?.subject?.id;
  useEffect(() => {
    if (!subjectId || denied) return;
    const c = createPrivateUpload({
      shopId,
      subjectId,
      purpose: "private-fitting",
      guard,
      onAccessDenied: endAccess,
    });
    uploadRef.current = c;
    setUpload(c);
    return () => {
      c.dispose();
      if (uploadRef.current === c) uploadRef.current = undefined;
    };
  }, [shopId, subjectId, guard, denied, endAccess]);
  async function moreAssets() {
    if (!assetNext) return;
    const g = generation.current;
    setBusy(true);
    try {
      const a = await readMeasurementFitAssets(shopId, {
        measurementVersionId: version.id,
        before: assetNext,
      });
      if (g === generation.current) {
        setAssets((v) => [...v, ...a.assets]);
        setAssetNext(a.next);
      }
    } catch (e) {
      if (g === generation.current) {
        if (accessLost(e)) endAccess();
        else setFailed(true);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  function begin(previous?: MeasurementFitReference, record?: DraftRecord) {
    if (
      current.current &&
      !current.current.confirmLeave(() => window.confirm(t.close))
    )
      return;
    if (current.current) scope.current?.release(current.current);
    const subject = !page?.subject,
      workflow =
        record?.workflow ??
        (subject ? "measurement.fit-subject" : "measurement.fit-reference");
    const initial = record?.payload ?? {
      customerId: version.customerId,
      wearerId: version.wearerId,
      measurementVersionId: version.id,
      erased: false,
      ...(workflow === "measurement.fit-reference"
        ? {
            assetId: previous?.assetId ?? null,
            previousId: previous?.id ?? null,
            baseVersion: previous?.version ?? 0,
            caption: previous?.caption ?? "",
            reason: "",
          }
        : {}),
    };
    const c = scope.current?.open({
      workflow,
      schemaVersion: 1,
      initial,
      ...(record ? { record } : {}),
      editableTargetConflict: true,
      committed: (r) => {
        if (r.lifecycle === "promoted") void load();
      },
    });
    current.current = c;
    setEditor(c);
    // This preparation draft has no editable fields to start autosave.
    if (c && !record && workflow === "measurement.fit-subject") void c.save();
  }
  function close() {
    if (
      current.current &&
      !current.current.confirmLeave(() => window.confirm(t.close))
    )
      return;
    if (current.current) scope.current?.release(current.current);
    current.current = undefined;
    setEditor(undefined);
  }
  if (version.redacted) return null;
  return (
    <details
      className="measurement-fit"
      onToggle={(e) => {
        setOpened(e.currentTarget.open);
        if (!e.currentTarget.open) setImageEpoch((n) => n + 1);
      }}
    >
      <summary>{t.title}</summary>
      <p>{t.optional}</p>
      <p>{t.separate}</p>
      {opened && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void load()}
          >
            {t.load}
          </Button>
          {busy && <p role="status">{t.loading}</p>}
          {failed && <p role="alert">{t.unavailable}</p>}
          {denied && <p role="alert">{t.denied}</p>}
          {!denied && page && (
            <>
              <p>{t.sessionOnly}</p>
              {!page.references.length && <p>{t.empty}</p>}
              {!editor && (
                <Button type="button" variant="outline" onClick={() => begin()}>
                  {page.subject ? t.attach : t.prepare}
                </Button>
              )}
              {upload && (
                <PrivateUploadForm
                  controller={upload}
                  locale={locale}
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  idPrefix={`fit-${prefix}`}
                  imageOnly
                />
              )}
              {page.subject && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void load()}
                  >
                    {t.refreshAssets}
                  </Button>
                  {!assets.some((a) => a.status === "ready") && (
                    <p>{t.noImages}</p>
                  )}
                  {assetNext && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void moreAssets()}
                    >
                      {t.moreAssets}
                    </Button>
                  )}
                </>
              )}
              {editor && (
                <>
                  <FitEditor
                    controller={editor}
                    assets={assets}
                    locale={locale}
                    guard={guard}
                    onDenied={endAccess}
                  />
                  <Button type="button" variant="outline" onClick={close}>
                    {t.close}
                  </Button>
                </>
              )}
              {!editor &&
                drafts.map((d) => (
                  <Button
                    key={d.id}
                    type="button"
                    variant="outline"
                    onClick={() => begin(undefined, d)}
                  >
                    {t.resume} · {d.id.slice(-8)}
                  </Button>
                ))}
              {page.references.map((ref) => (
                <details key={ref.id}>
                  <summary>
                    {t.version} {ref.version} · {ref.recordedAt} ·{" "}
                    {ref.id.slice(-8)}
                  </summary>
                  <dl>
                    <dt>{t.caption}</dt>
                    <dd>{ref.caption}</dd>
                    <dt>{t.reason}</dt>
                    <dd>{ref.reason}</dd>
                    <dt>{t.actor}</dt>
                    <dd>{ref.actorId.slice(-8)}</dd>
                    <dt>{t.recorded}</dt>
                    <dd>{ref.recordedAt}</dd>
                    <dt>{t.previous}</dt>
                    <dd>{ref.previousId?.slice(-8) ?? "—"}</dd>
                    <dt>{t.current}</dt>
                    <dd>{ref.headId.slice(-8)}</dd>
                  </dl>
                  {!ref.redacted && (
                    <FitImage
                      key={`${ref.id}-${imageEpoch}`}
                      shopId={shopId}
                      reference={ref}
                      locale={locale}
                      onDenied={endAccess}
                    />
                  )}
                  {ref.id === ref.headId && !editor && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => begin(ref)}
                    >
                      {t.replace}
                    </Button>
                  )}
                </details>
              ))}
              {page.next && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void load(page.next ?? undefined)}
                >
                  {t.moreHistory}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </details>
  );
}
