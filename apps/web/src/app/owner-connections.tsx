import {
  disconnectOwnerGoogle,
  type readGoogleConnection,
  startOwnerGoogle,
} from "@aarili/api/client";
import { Button } from "@aarili/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@aarili/ui/components/dialog";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { OwnerFeedback, type OwnerRequest } from "./owner-feedback";
import type { createOwnerQueries } from "./owner-query";
export function OwnerConnections({
  queries,
  request,
  leave,
}: {
  queries: ReturnType<typeof createOwnerQueries>;
  request: OwnerRequest;
  leave: (action: () => Promise<string>) => Promise<void>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { busy, failure, setFailure, setNotice } = request;
  const [connection, setConnection] =
    useState<Awaited<ReturnType<typeof readGoogleConnection>>>();
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const disconnectRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (failure) setConfirmDisconnect(false);
  }, [failure]);
  useEffect(() => {
    if (reload > 0) setFailure("");
    let active = true;
    const unsubscribe = queries.onInvalidate(() => {
      active = false;
      setConnection(undefined);
      setConfirmDisconnect(false);
    });
    setLoading(true);
    queries
      .connection()
      .then((value) => {
        if (active) setConnection(value);
      })
      .catch(() => {
        if (active) setFailure("loadError");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queries, reload, setFailure]);
  useEffect(() => {
    const result = window.location.hash;
    window.history.replaceState(null, "", window.location.pathname);
    if (result === "#google-linked") setNotice("googleLinked");
    if (result === "#google-denied") setFailure("googleDenied");
  }, [setNotice, setFailure]);
  return (
    <>
      <div ref={noticeRef} tabIndex={-1}>
        <OwnerFeedback request={request} />
      </div>
      {loading && <p role="status">{t("loading")}</p>}
      {!loading && !connection && (
        <Button
          onClick={() => {
            setFailure("");
            setReload((value) => value + 1);
          }}
        >
          {t("retry")}
        </Button>
      )}
      {
        <>
          <p>{t("googleHelp")}</p>
          {connection && (
            <section aria-labelledby="google-heading" className="owner-form">
              <h2 id="google-heading">Google</h2>
              <p>
                {t(
                  connection.linked ? "googleConnected" : "googleNotConnected",
                )}
              </p>
              {!connection.enabled && <p>{t("googleUnavailable")}</p>}
              {!connection.linked && connection.enabled && (
                <Button
                  disabled={busy}
                  onClick={() => void leave(async () => startOwnerGoogle(true))}
                >
                  {busy ? t("working") : t("googleLink")}
                </Button>
              )}
              {connection.linked && (
                <>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setFailure("");
                      setConfirmDisconnect(true);
                    }}
                    ref={disconnectRef}
                  >
                    {t("googleDisconnect")}
                  </Button>
                  <Dialog
                    open={confirmDisconnect}
                    onOpenChange={(open, details) => {
                      if (busy) details.cancel();
                      else setConfirmDisconnect(open);
                    }}
                  >
                    <DialogContent
                      lang={locale}
                      closeLabel={t("close")}
                      closeDisabled={busy}
                      initialFocus={confirmRef}
                      finalFocus={() =>
                        failure
                          ? noticeRef.current?.querySelector<HTMLElement>(
                              '[role="alert"]',
                            )
                          : disconnectRef.current
                      }
                    >
                      <DialogTitle className="ui-dialog-title font-semibold">
                        {t("googleDisconnect")}
                      </DialogTitle>
                      <DialogDescription className="text-muted-foreground">
                        {t("googleDisconnectHelp")}
                      </DialogDescription>
                      <Button
                        ref={confirmRef}
                        disabled={busy}
                        onClick={() =>
                          void leave(async () => {
                            await disconnectOwnerGoogle();
                            return "/sign-in#google-disconnected";
                          })
                        }
                      >
                        {busy ? t("working") : t("googleConfirmDisconnect")}
                      </Button>
                      <DialogClose
                        render={<Button variant="ghost" disabled={busy} />}
                      >
                        {t("cancel")}
                      </DialogClose>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              <a href="/reauthenticate">{t("reauthenticateLink")}</a>
            </section>
          )}
          <p>
            <a href="/dashboard">{t("backToOwner")}</a>
          </p>
        </>
      }
    </>
  );
}
