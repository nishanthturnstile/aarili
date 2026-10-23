import { OwnerRequestError, onOwnerInvalidation } from "@aarili/api/client";
import {
  readPatternAssets,
  readPatternBytes,
  reviewPatternReuse,
} from "@aarili/api/manual-patterns-client";
import type {
  PatternPage,
  PatternReferenceV2Draft,
  PatternVersion,
} from "@aarili/contracts/manual-patterns";
import {
  type Locale,
  manualPatternMessages,
  mediaMessages,
} from "@aarili/i18n";
import { Button } from "@aarili/ui/components/button";
import { Input } from "@aarili/ui/components/input";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPrivateUpload, type PrivateUpload } from "./media-upload";
import { PrivateUploadForm } from "./media-upload-form";
import type { OwnerGuard } from "./owner-feedback";

const denied = (e: unknown) =>
  e instanceof OwnerRequestError &&
  [
    "NOT_FOUND",
    "UNAUTHENTICATED",
    "SHOP_ACCESS_DENIED",
    "MEDIA_ACCESS_DENIED",
  ].includes(e.code);
type Scope = { orderId: string; pieceId: string | null };
export function PatternUploads({
  shopId,
  scope,
  locale,
  guard,
  refreshKey,
  onPrepare,
  onDenied,
  disabled,
  onWorking,
}: {
  shopId: string;
  scope: Scope;
  locale: Locale;
  guard: OwnerGuard;
  refreshKey: number;
  onPrepare: () => void;
  onDenied: () => void;
  disabled: boolean;
  onWorking: (working: boolean) => void;
}) {
  const t = manualPatternMessages[locale],
    prefix = useId(),
    generation = useRef(0),
    uploadRef = useRef<PrivateUpload | undefined>(undefined);
  const [opened, setOpened] = useState(false),
    [page, setPage] = useState<Awaited<ReturnType<typeof readPatternAssets>>>(),
    [upload, setUpload] = useState<PrivateUpload>(),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    const g = ++generation.current;
    setBusy(true);
    setFailed(false);
    try {
      const p = await readPatternAssets(shopId, {
        orderId: scope.orderId,
        pieceId: scope.pieceId,
      });
      if (g === generation.current) setPage(p);
    } catch (e) {
      if (g === generation.current) {
        if (denied(e)) onDenied();
        else setFailed(true);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }, [shopId, scope.orderId, scope.pieceId, onDenied]);
  useEffect(() => {
    if (opened) {
      void refreshKey;
      void load();
    }
  }, [opened, load, refreshKey]);
  useEffect(() => {
    const end = () => {
      generation.current++;
      setPage(undefined);
      uploadRef.current?.dispose();
      uploadRef.current = undefined;
      setUpload(undefined);
    };
    const stop = onOwnerInvalidation(end);
    return () => {
      stop();
      end();
    };
  }, []);
  const subjectId = page?.subject?.id;
  useEffect(() => {
    if (!opened || !subjectId) return;
    const c = createPrivateUpload({
      shopId,
      subjectId,
      purpose: "manual-pattern",
      guard,
      onAccessDenied: onDenied,
    });
    uploadRef.current = c;
    setUpload(c);
    const sync = () => {
      const s = c.snapshot();
      onWorking(s.busy || s.state === "selected" || s.state === "uncertain");
    };
    const stop = c.subscribe(sync);
    sync();
    return () => {
      stop();
      onWorking(false);
      c.dispose();
      if (uploadRef.current === c) uploadRef.current = undefined;
    };
  }, [shopId, subjectId, opened, guard, onDenied, onWorking]);
  return (
    <details
      className="pattern-uploads"
      onToggle={(e) => setOpened(e.currentTarget.open)}
    >
      <summary>{t.outputs}</summary>
      <p>{t.outputHelp}</p>
      {opened && (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={busy}
          >
            {t.refreshOutputs}
          </Button>
          {busy && <p role="status">{t.loading}</p>}
          {failed && <p role="alert">{t.fileUnavailable}</p>}
          {page && !page.subject && (
            <Button type="button" onClick={onPrepare} disabled={disabled}>
              {t.prepareOutput}
            </Button>
          )}
          {upload && (
            <PrivateUploadForm
              controller={upload}
              locale={locale}
              idPrefix={`${prefix}-pattern`}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              limitsText={t.outputLimits}
              guidanceText={t.outputGuidance}
              unsupportedText={t.outputUnsupported}
            />
          )}
          <p>{t.pendingOutput}</p>
        </>
      )}
    </details>
  );
}
export function PatternOutputFields({
  shopId,
  page,
  value,
  onChange,
  locale,
  onDenied,
}: {
  shopId: string;
  page: PatternPage;
  value: PatternReferenceV2Draft;
  onChange: (patch: Partial<PatternReferenceV2Draft>) => void;
  locale: Locale;
  onDenied: () => void;
}) {
  const t = manualPatternMessages[locale],
    m = mediaMessages[locale],
    prefix = useId(),
    generation = useRef(0);
  const [assets, setAssets] =
      useState<Awaited<ReturnType<typeof readPatternAssets>>>(),
    [sourceId, setSourceId] = useState(value.reuse?.referenceId ?? ""),
    [source, setSource] =
      useState<Awaited<ReturnType<typeof reviewPatternReuse>>>(),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function load(more = false) {
    const g = ++generation.current;
    setBusy(true);
    setFailed(false);
    try {
      const r = await readPatternAssets(shopId, {
        orderId: page.state.orderId,
        pieceId: page.state.pieceId,
        ...(more && assets?.next ? { before: assets.next } : {}),
      });
      if (g === generation.current)
        setAssets((old) => ({
          ...r,
          assets: more ? [...(old?.assets ?? []), ...r.assets] : r.assets,
        }));
    } catch (e) {
      if (g === generation.current) {
        if (denied(e)) onDenied();
        else setFailed(true);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function review() {
    const g = ++generation.current;
    setBusy(true);
    setFailed(false);
    setSource(undefined);
    try {
      const r = await reviewPatternReuse(shopId, {
        orderId: page.state.orderId,
        pieceId: page.state.pieceId,
        referenceId: sourceId,
      });
      if (g === generation.current) setSource(r);
    } catch {
      if (g === generation.current) {
        setFailed(true);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  return (
    <details className="pattern-output-fields">
      <summary>
        {t.outputs} ·{" "}
        {value.reuse ? t.sourceLineage : value.assetId ? t.output : t.noOutput}
      </summary>
      <div className="owner-form">
        <p>{t.outputHelp}</p>
        <p>{t.pendingOutput}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={busy}
        >
          {t.refreshOutputs}
        </Button>
        {assets && (
          <>
            <label htmlFor={`${prefix}-output`}>{t.chooseOutput}</label>
            <select
              className="ui-input"
              id={`${prefix}-output`}
              value={value.assetId ?? ""}
              onChange={(e) =>
                onChange({
                  assetId: e.target.value || null,
                  reuse: null,
                  acknowledged: false,
                  evidence: "",
                })
              }
            >
              <option value="">{t.noOutput}</option>
              {assets.assets.map((a) => (
                <option key={a.id} value={a.id} disabled={a.status !== "ready"}>
                  {a.contentType} · {a.id} ·{" "}
                  {
                    m[
                      a.status === "pending_upload"
                        ? "uploading"
                        : a.status === "quarantined"
                          ? "rejected"
                          : a.status === "expired" || a.status === "deleted"
                            ? "unavailable"
                            : a.status
                    ]
                  }
                </option>
              ))}
            </select>
            {assets.next && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void load(true)}
              >
                {t.moreOutputs}
              </Button>
            )}
          </>
        )}
        {value.assetId && (
          <p>
            {t.output}: {value.assetId}
          </p>
        )}
        <p>{t.reuseHelp}</p>
        <label htmlFor={`${prefix}-source`}>{t.sourceReference}</label>
        <Input
          id={`${prefix}-source`}
          maxLength={36}
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            setSource(undefined);
            if (value.reuse)
              onChange({ reuse: null, acknowledged: false, evidence: "" });
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || !sourceId}
          onClick={() => void review()}
        >
          {t.reviewSource}
        </Button>
        {source && (
          <>
            <dl>
              <dt>{t.sourceLineage}</dt>
              <dd>{source.source.id}</dd>
              <dt>{t.locator}</dt>
              <dd>{source.source.content?.locator || t.notRecorded}</dd>
              <dt>{t.sourceVersion}</dt>
              <dd>{source.source.content?.sourceVersion || t.unknown}</dd>
              <dt>{t.rights}</dt>
              <dd>
                {source.source.content?.rights === "private-fulfilment"
                  ? t.private
                  : source.source.content?.rights === "shop-owned"
                    ? t.owned
                    : t.licensed}
              </dd>
              <dt>{t.rightsEvidence}</dt>
              <dd>{source.source.content?.rightsEvidence || t.notRecorded}</dd>
              <dt>{t.sourceInputs}</dt>
              <dd>
                {source.source.content?.design.state === "known"
                  ? source.source.content.design.versionId
                  : t.unknown}{" "}
                ·{" "}
                {source.source.content?.measurement.state === "known"
                  ? source.source.content.measurement.versionId
                  : t.unknown}
              </dd>
              <dt>{t.declaredScale}</dt>
              <dd>{source.source.content?.declaredScale || t.unknown}</dd>
              <dt>{t.assumptions}</dt>
              <dd>{source.source.content?.assumptions || t.unknown}</dd>
              <dt>{t.checks}</dt>
              <dd>{source.source.content?.checks || t.unknown}</dd>
            </dl>
            <p>{t.scaleWarning}</p>
            <p>{t.formulaWarning}</p>
            <p>{t.cuttingWarning}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onChange({
                  assetId: null,
                  reuse: {
                    referenceId: source.source.id,
                    digest: source.digest,
                  },
                  method: source.source.method,
                  ...(source.source.content
                    ? {
                        content: {
                          ...source.source.content,
                          design: value.content.design,
                          measurement: value.content.measurement,
                          notes: value.content.notes,
                        },
                      }
                    : {}),
                  acknowledged: false,
                  evidence: "",
                })
              }
            >
              {t.reuseSource}
            </Button>
          </>
        )}
        {value.reuse && (
          <>
            <p>
              {t.sourceLineage}: {value.reuse.referenceId}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onChange({ reuse: null, acknowledged: false, evidence: "" })
              }
            >
              {t.removeSource}
            </Button>
            <label>
              {t.reuseEvidence}
              <textarea
                className="ui-input"
                maxLength={2000}
                value={value.evidence}
                onChange={(e) => onChange({ evidence: e.target.value })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={value.acknowledged}
                onChange={(e) => onChange({ acknowledged: e.target.checked })}
              />
              {t.reuseHelp}
            </label>
          </>
        )}
        {busy && <p role="status">{t.loading}</p>}
        {failed && <p role="alert">{t.fileUnavailable}</p>}
      </div>
    </details>
  );
}
export function PatternOutputView({
  shopId,
  reference,
  locale,
  onDenied,
}: {
  shopId: string;
  reference: PatternVersion;
  locale: Locale;
  onDenied: () => void;
}) {
  const t = manualPatternMessages[locale],
    generation = useRef(0),
    [access, setAccess] =
      useState<Awaited<ReturnType<typeof readPatternBytes>>>(),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const end = () => {
      generation.current++;
      setAccess(undefined);
    };
    const stop = onOwnerInvalidation(end);
    return () => {
      stop();
      end();
    };
  }, []);
  useEffect(() => {
    if (!access) return;
    const timer = window.setTimeout(
      () => setAccess(undefined),
      Math.max(0, Date.parse(access.access.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [access]);
  async function show() {
    const g = ++generation.current;
    setBusy(true);
    setFailed(false);
    try {
      const r = await readPatternBytes(shopId, {
        orderId: reference.orderId,
        pieceId: reference.pieceId,
        referenceId: reference.id,
        variant: "display",
      });
      if (g === generation.current) setAccess(r);
    } catch (e) {
      if (g === generation.current) {
        if (denied(e)) onDenied();
        else setFailed(true);
      }
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  if (!reference.output || reference.redacted) return null;
  return (
    <div>
      <p>
        {t.output}: {reference.output.contentType}
      </p>
      <p>
        {t.outputEvidence}: {reference.output.originalSha256}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => (access ? setAccess(undefined) : void show())}
      >
        {access ? t.outputHide : t.outputView}
      </Button>
      {busy && <p role="status">{t.loading}</p>}
      {failed && <p role="alert">{t.fileUnavailable}</p>}
      {access &&
        (reference.output.contentType === "application/pdf" ? (
          <p>
            <a
              href={access.access.url}
              download={access.access.filename}
              rel="noreferrer"
            >
              {t.download}
            </a>
          </p>
        ) : (
          <>
            {/* biome-ignore lint/performance/noImgElement: authorized signed bytes must not enter the public image optimizer/cache */}
            <img
              className="reference-preview"
              src={access.access.url}
              alt={t.imageAlt}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => {
                setAccess(undefined);
                setFailed(true);
              }}
            />
          </>
        ))}
    </div>
  );
}
