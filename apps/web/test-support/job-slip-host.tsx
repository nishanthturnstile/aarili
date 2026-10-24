"use client";
import { clearOwnerState } from "@aarili/api/client";
import { Button } from "@aarili/ui/components/button";
import { useState } from "react";
import { JobSlips } from "../src/app/job-slips";
import { createWorkGuard } from "../src/app/pwa-runtime";
export default function Host({
  shopId,
  orderId,
}: {
  shopId: string;
  orderId: string;
}) {
  const [locale, setLocale] = useState<"en" | "ta">("en"),
    [guard] = useState(createWorkGuard);
  return (
    <main className="aarili-main">
      <h1>Aarili — SYNTHETIC job slip review</h1>
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
      </div>
      <JobSlips
        shopId={shopId}
        orderId={orderId}
        locale={locale}
        guard={guard}
      />
    </main>
  );
}
