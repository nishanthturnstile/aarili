"use client";
// Synthetic component-state host only. API/renderer transactions are proved
// independently by real PG/S3/render tests; no normal route imports this file.
import type { DocumentStatus } from "@aarili/contracts/documents";
import { Button } from "@aarili/ui/components/button";
import { useState } from "react";
import { PrivateDocumentStatus } from "../src/app/document-status";
export default function DocumentStatusHost() {
  const [locale, setLocale] = useState<"en" | "ta">("en"),
    [state, setState] = useState<DocumentStatus["state"]>("pending"),
    [requests, setRequests] = useState(0);
  const status: DocumentStatus = {
    docId: "019a5e59-1111-7000-8000-000000000001",
    revision: 1,
    language: locale,
    paper: "A4",
    version: 1,
    state,
    canRetry: state === "failed",
    failure: state === "failed" ? "RETRIES_EXHAUSTED" : null,
    sha256: state === "ready" ? "0".repeat(64) : null,
  };
  return (
    <main className="aarili-main">
      <h1>Aarili — synthetic PDF states</h1>
      <p>Component states only; no document is issued here.</p>
      <div className="owner-actions">
        <Button onClick={() => setLocale(locale === "en" ? "ta" : "en")}>
          English / தமிழ்
        </Button>
        <Button
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          Theme
        </Button>
      </div>
      <div className="owner-form">
        <label htmlFor="synthetic-pdf-state">Synthetic processing state</label>
        <select
          className="ui-input"
          id="synthetic-pdf-state"
          value={state}
          onChange={(e) => setState(e.target.value as DocumentStatus["state"])}
        >
          {["pending", "rendering", "failed", "ready"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <PrivateDocumentStatus
        status={status}
        locale={locale}
        onCheck={() => setRequests((n) => n + 1)}
        onRetry={() => {
          setRequests((n) => n + 1);
          setState("pending");
        }}
      />
      <p data-testid="pdf-requests">{requests}</p>
    </main>
  );
}
