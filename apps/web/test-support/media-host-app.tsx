"use client";
// Disposable verification host only. Never imported by normal app routes.
import { clearOwnerState } from "@aarili/api/client";
import { Button } from "@aarili/ui/components/button";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createPrivateUpload,
  type PrivateUpload,
} from "../src/app/media-upload";
import { PrivateUploadForm } from "../src/app/media-upload-form";
import { createWorkGuard } from "../src/app/pwa-runtime";
export default function MediaHost({
  shopId,
  subjectId,
}: {
  shopId: string;
  subjectId: string;
}) {
  const [locale, setLocale] = useState<"en" | "ta">("en"),
    [controller, setController] = useState<PrivateUpload>();
  const [guard] = useState(createWorkGuard),
    safe = useSyncExternalStore(guard.subscribe, guard.safe, () => true);
  useEffect(() => {
    const current = createPrivateUpload({
      shopId,
      subjectId,
      purpose: "manual-pattern",
      guard,
    });
    setController(current);
    return () => current.dispose();
  }, [shopId, subjectId, guard]);
  return (
    <main className="aarili-main">
      <h1>Aarili — synthetic private media</h1>
      <div className="owner-actions">
        <Button
          type="button"
          onClick={() => setLocale(locale === "en" ? "ta" : "en")}
        >
          English / தமிழ்
        </Button>
        <Button
          type="button"
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          Theme
        </Button>
        <Button type="button" onClick={() => clearOwnerState()}>
          End access
        </Button>
      </div>
      <p data-testid="update-safety">{safe ? "Update safe" : "Work active"}</p>
      {controller ? (
        <PrivateUploadForm controller={controller} locale={locale} />
      ) : null}
    </main>
  );
}
