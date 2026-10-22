"use client";
// Disposable synthetic browser fixture only; normal application routes never import it.
import { clearOwnerState } from "@aarili/api/client";
import type { AcceptedOrder } from "@aarili/contracts/orders";
import { Button } from "@aarili/ui/components/button";
import { useState } from "react";
import { DesignSpecifications } from "../src/app/design-specifications";
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
      <h1>Aarili — synthetic design references</h1>
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
      <DesignSpecifications
        order={order}
        shopId={shopId}
        locale={locale}
        guard={guard}
      />
    </main>
  );
}
