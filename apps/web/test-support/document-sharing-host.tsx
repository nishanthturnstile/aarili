"use client";
// Explicit synthetic host only. Never imported by a normal application route.
import { clearOwnerState } from "@aarili/api/client";
import { Button } from "@aarili/ui/components/button";
import { useState } from "react";
import { PrivateDocumentSharing } from "../src/app/document-sharing";
export default function DocumentSharingHost({
  selection,
}: {
  selection: { shopId: string; docId: string; revision: number };
}) {
  const [locale, setLocale] = useState<"en" | "ta">("en"),
    [selected, setSelected] = useState(true);
  return (
    <main className="aarili-main">
      <h1>Aarili — synthetic PDF sharing</h1>
      <p>
        Synthetic test document. No customer data or active business template.
      </p>
      <div className="owner-actions">
        <Button onClick={() => setLocale(locale === "en" ? "ta" : "en")}>
          English / தமிழ்
        </Button>
        <Button
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          Theme
        </Button>
        <Button onClick={() => clearOwnerState()}>
          Sign out / switch shop
        </Button>
        <Button onClick={() => setSelected((x) => !x)}>Select document</Button>
      </div>
      <PrivateDocumentSharing
        locale={locale}
        selection={selected ? selection : null}
        recipient={{
          phone: "919999999999",
        }}
      />
    </main>
  );
}
