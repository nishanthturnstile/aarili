"use client";
// Disposable synthetic review only. Normal routes import the same measurement
// workspace through customer/order screens, never this fixture shell.
import { clearOwnerState } from "@aarili/api/client";
import type { AcceptedOrder } from "@aarili/contracts/orders";
import { Button } from "@aarili/ui/components/button";
import { useState } from "react";
import { MeasurementSessions } from "../src/app/measurement-sessions";
import { createWorkGuard } from "../src/app/pwa-runtime";
export default function Host({
  shopId,
  customerId,
  wearerId,
  order,
}: {
  shopId: string;
  customerId: string;
  wearerId: string;
  order: AcceptedOrder;
}) {
  const [locale, setLocale] = useState<"en" | "ta">("en"),
    [guard] = useState(createWorkGuard);
  return (
    <main className="aarili-main">
      <h1>Aarili — SYNTHETIC private fitting research</h1>
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
      <h2>Measurement review</h2>
      <MeasurementSessions
        shopId={shopId}
        customerId={customerId}
        wearerId={wearerId}
        order={order}
        locale={locale}
        guard={guard}
      />
    </main>
  );
}
