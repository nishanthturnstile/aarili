"use client";
// Synthetic loopback review; production uses ManualPatterns in garment detail.
import { clearOwnerState } from "@aarili/api/client";
import type { AcceptedOrder } from "@aarili/contracts/orders";
import { Button } from "@aarili/ui/components/button";
import { useState } from "react";
import { ManualPatterns } from "../src/app/manual-patterns";
import { createWorkGuard } from "../src/app/pwa-runtime";
export default function Host({
  shopId,
  order,
}: {
  shopId: string;
  order: AcceptedOrder;
}) {
  const [locale, setLocale] = useState<"en" | "ta">("en"),
    [guard] = useState(createWorkGuard);
  return (
    <main className="aarili-main">
      <h1>Aarili — SYNTHETIC manual pattern review</h1>
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
      <ManualPatterns
        order={order}
        shopId={shopId}
        locale={locale}
        guard={guard}
      />
    </main>
  );
}
