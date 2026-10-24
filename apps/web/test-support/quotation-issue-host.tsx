"use client";
import { clearOwnerState } from "@aarili/api/client";
import { Button } from "@aarili/ui/components/button";
import { useRef, useState } from "react";
import { createWorkGuard } from "../src/app/pwa-runtime";
import { QuotationIssues } from "../src/app/quotation-issues";
export default function Host({
  shopId,
  proposalId,
}: {
  shopId: string;
  proposalId: string;
}) {
  const [locale, setLocale] = useState<"en" | "ta">("en"),
    [guard] = useState(createWorkGuard),
    [open, setOpen] = useState(true),
    navigation = useRef(() => true);
  return (
    <main className="aarili-main">
      <h1>Aarili — SYNTHETIC quotation review</h1>
      <div className="owner-actions">
        <Button
          onClick={() => {
            const next = locale === "en" ? "ta" : "en";
            setLocale(next);
            document.documentElement.lang = next;
          }}
        >
          English / தமிழ்
        </Button>
        <Button
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          Theme
        </Button>
        <Button onClick={() => clearOwnerState()}>End access</Button>
        <Button
          onClick={() => {
            if (navigation.current()) setOpen(false);
          }}
        >
          Leave proposal
        </Button>
      </div>
      <h2>SYNTHETIC reviewed proposal</h2>
      {open && (
        <QuotationIssues
          shopId={shopId}
          proposalId={proposalId}
          locale={locale}
          guard={guard}
          navigation={navigation}
        />
      )}
    </main>
  );
}
