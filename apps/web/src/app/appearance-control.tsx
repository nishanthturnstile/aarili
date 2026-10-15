"use client";

import { Button } from "@aarili/ui/components/button";
import { useEffect, useState } from "react";
import { appearanceKey } from "./appearance";

export function AppearanceControl({
  lightLabel,
  darkLabel,
}: {
  lightLabel: string;
  darkLabel: string;
}) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);
  return (
    <Button
      variant="outline"
      disabled={!ready}
      onClick={() => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        setDark(next);
        try {
          localStorage.setItem(appearanceKey, next ? "dark" : "light");
        } catch {
          /* Restricted storage must not prevent an in-page change. */
        }
      }}
    >
      {dark ? lightLabel : darkLabel}
    </Button>
  );
}
