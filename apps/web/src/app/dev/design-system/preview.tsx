"use client";

import { Button } from "@aarili/ui/components/button";
import { Card, DenseRow } from "@aarili/ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@aarili/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { Status } from "@aarili/ui/components/status";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DesignSpecimens } from "./specimens";

const copy = {
  en: {
    title: "Aarili controls",
    intro:
      "A shared foundation for thoughtful, everyday work. Development samples only.",
    actions: "Actions",
    primary: "Continue to review",
    secondary: "Back",
    outline: "Cancel",
    destructive: "Remove sample",
    disabled: "Unavailable",
    loading: "Working…",
    fields: "Fields & feedback",
    label: "Sample text (optional)",
    hint: "Type in Tamil or English. Text stays in this open preview only.",
    placeholder: "Enter sample text",
    invalid: "Invalid field example",
    error: "Enter a value to continue. This is sample feedback.",
    statuses: "Text & status",
    success: "Ready",
    warning: "Needs review",
    info: "In progress",
    failure: "Could not save",
    rows: "Dense rows & cards",
    row1: "தமிழ் எழுத்துகள் · Tamil lettering",
    row2: "Long labels stay readable on a phone",
    card: "Comfortable spacing",
    cardText:
      "The same tokens shape this surface, its controls and its typography.",
    dialog: "Open sample dialog",
    dialogTitle: "Review this sample",
    dialogText:
      "This dialog demonstrates focus and cancellation. It does not change a business record.",
    close: "Close",
    theme: "Switch to dark",
    light: "Switch to light",
  },
  ta: {
    title: "ஆரிலி கட்டுப்பாடுகள்",
    intro: "அன்றாட வேலைக்கான பகிரப்பட்ட அடித்தளம். உருவாக்கச் சோதனை மாதிரிகள் மட்டும்.",
    actions: "செயல்கள்",
    primary: "சரிபார்க்கத் தொடரவும்",
    secondary: "பின்னால்",
    outline: "ரத்து செய்",
    destructive: "மாதிரியை நீக்கு",
    disabled: "கிடைக்கவில்லை",
    loading: "செயல்படுகிறது…",
    fields: "உள்ளீடும் விளக்கமும்",
    label: "மாதிரி உரை (விருப்பம்)",
    hint: "தமிழிலோ ஆங்கிலத்திலோ தட்டச்சு செய்யவும். உரை இந்தத் திறந்த மாதிரியில் மட்டுமே இருக்கும்.",
    placeholder: "மாதிரி உரையை உள்ளிடவும்",
    invalid: "பிழையான உள்ளீட்டு மாதிரி",
    error: "தொடர ஒரு மதிப்பை உள்ளிடவும். இது மாதிரி விளக்கம்.",
    statuses: "உரையும் நிலையும்",
    success: "தயார்",
    warning: "சரிபார்க்க வேண்டும்",
    info: "நடைபெறுகிறது",
    failure: "சேமிக்க முடியவில்லை",
    rows: "வரிசைகளும் அட்டைகளும்",
    row1: "தமிழ் எழுத்துகள் · Tamil lettering",
    row2: "நீண்ட பெயர்களும் கைப்பேசியில் முழுமையாகத் தெரியும்",
    card: "வசதியான இடைவெளி",
    cardText:
      "இந்தப் பரப்பு, கட்டுப்பாடுகள், எழுத்துகள் அனைத்தும் ஒரே வடிவமைப்பு மதிப்புகளைப் பயன்படுத்துகின்றன.",
    dialog: "மாதிரி உரையாடலைத் திற",
    dialogTitle: "இந்த மாதிரியைச் சரிபார்க்கவும்",
    dialogText:
      "கவனக் கட்டுப்பாட்டையும் ரத்து செய்வதையும் இந்த மாதிரி காட்டுகிறது. வணிகப் பதிவை மாற்றாது.",
    close: "மூடு",
    theme: "இருண்ட தோற்றம்",
    light: "ஒளிர்ந்த தோற்றம்",
  },
};

export function DesignPreview({
  initialCandidate = false,
}: {
  initialCandidate?: boolean;
}) {
  const [locale, setLocale] = useState<"en" | "ta">("en");
  const [dark, setDark] = useState(false);
  const [candidate, setCandidate] = useState(initialCandidate);
  const t = copy[locale];
  useEffect(() => {
    const root = document.documentElement;
    const previous = {
      dark: root.classList.contains("dark"),
      lang: root.lang,
      theme: root.getAttribute("data-aarili-theme"),
    };
    return () => {
      root.classList.toggle("dark", previous.dark);
      root.lang = previous.lang;
      if (previous.theme === null) root.removeAttribute("data-aarili-theme");
      else root.setAttribute("data-aarili-theme", previous.theme);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.lang = locale;
    if (candidate && !dark)
      root.setAttribute("data-aarili-theme", "grounded-editorial");
    else root.removeAttribute("data-aarili-theme");
  }, [locale, dark, candidate]);
  return (
    <main className="aarili-main" lang={locale}>
      <header className="preview-header">
        <div className="preview-controls justify-between">
          <h1 className="editorial">{t.title}</h1>
          <div className="preview-controls">
            <Button
              variant="outline"
              onClick={() => setLocale(locale === "en" ? "ta" : "en")}
              lang={locale === "en" ? "ta" : "en"}
            >
              {locale === "en" ? "தமிழ்" : "English"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDark(!dark)}
              aria-pressed={dark}
            >
              {dark ? t.light : t.theme}
            </Button>
          </div>
        </div>
        <p className="mt-3 max-w-prose text-muted-foreground">{t.intro}</p>
      </header>
      <fieldset
        className="lab-switches"
        aria-label="Theme comparison"
        lang="en"
      >
        {(["Current light", "Candidate light", "Current dark"] as const).map(
          (name) => (
            <Button
              key={name}
              variant="outline"
              aria-pressed={
                name === "Current dark"
                  ? dark
                  : !dark &&
                    (name === "Candidate light" ? candidate : !candidate)
              }
              onClick={() => {
                setDark(name === "Current dark");
                setCandidate(name === "Candidate light");
              }}
            >
              {name}
            </Button>
          ),
        )}
        <Link
          href="/sign-in"
          className="ui-button inline-flex items-center bg-secondary text-secondary-foreground"
        >
          Review sign-in screen
        </Link>
      </fieldset>
      <DesignSpecimens locale={locale} />
      <section className="preview-section" aria-labelledby="actions-title">
        <h2 id="actions-title" className="mb-4">
          {t.actions}
        </h2>
        <div className="preview-controls">
          <Button>{t.primary}</Button>
          <Button variant="secondary">{t.secondary}</Button>
          <Button variant="outline">{t.outline}</Button>
          <Button variant="destructive">{t.destructive}</Button>
          <Button disabled>{t.disabled}</Button>
          <Button disabled aria-busy="true">
            {t.loading}
          </Button>
        </div>
      </section>
      <section className="preview-section" aria-labelledby="fields-title">
        <h2 id="fields-title" className="mb-4">
          {t.fields}
        </h2>
        <div className="preview-grid">
          <Field>
            <FieldLabel htmlFor="sample-text">{t.label}</FieldLabel>
            <Input
              id="sample-text"
              placeholder={t.placeholder}
              aria-describedby="sample-hint"
            />
            <FieldDescription id="sample-hint">{t.hint}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="invalid-text">{t.invalid}</FieldLabel>
            <Input
              id="invalid-text"
              aria-invalid="true"
              aria-describedby="sample-error"
            />
            <FieldError id="sample-error">{t.error}</FieldError>
          </Field>
        </div>
      </section>
      <section className="preview-section" aria-labelledby="statuses-title">
        <h2 id="statuses-title" className="mb-4">
          {t.statuses}
        </h2>
        <div className="preview-controls">
          <Status tone="success">{t.success}</Status>
          <Status tone="warning">{t.warning}</Status>
          <Status>{t.info}</Status>
          <Status tone="error">{t.failure}</Status>
        </div>
      </section>
      <section className="preview-section" aria-labelledby="rows-title">
        <h2 id="rows-title" className="mb-4">
          {t.rows}
        </h2>
        <div className="preview-grid">
          <Card density="dense">
            <DenseRow>
              <span lang="ta">{t.row1}</span>
              <Status tone="success">{t.success}</Status>
            </DenseRow>
            <DenseRow>
              <span>{t.row2}</span>
              <Status tone="warning">{t.warning}</Status>
            </DenseRow>
          </Card>
          <Card>
            <h3>{t.card}</h3>
            <p className="mt-2 text-muted-foreground">{t.cardText}</p>
          </Card>
        </div>
      </section>
      <div className="preview-section">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            {t.dialog}
          </DialogTrigger>
          <DialogContent closeLabel={t.close}>
            <DialogTitle className="ui-dialog-title font-semibold">
              {t.dialogTitle}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t.dialogText}
            </DialogDescription>
            <DialogClose render={<Button variant="secondary" />}>
              {t.close}
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
