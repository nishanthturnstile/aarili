"use client";

import { Button } from "@aarili/ui/components/button";
import { Card, DenseRow } from "@aarili/ui/components/card";
import { Field, FieldLabel } from "@aarili/ui/components/field";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
  ShirtIcon,
  UsersIcon,
} from "@aarili/ui/components/icons";
import { Input } from "@aarili/ui/components/input";
import { Status } from "@aarili/ui/components/status";
import { useRef, useState } from "react";

const words = {
  en: {
    foundations: "Grounded Editorial · experimental candidate",
    disclaimer:
      "Synthetic design samples only. These screens do not create orders, record payments, save measurements, or send messages. Tamil wording is for rendering review, pending owner review.",
    typography: "Type and content specimens",
    note: "Boat neck blouse · முன்புற அளவுகளைச் சரிபார்க்கவும். Keep the original garment notes visible, even when they wrap across several lines.",
    states: "Additional component states",
    readonly: "Recorded reference (read-only)",
    unavailable: "Unavailable action",
    reason: "This action is unavailable in the design preview.",
    empty: "No garments in this sample view",
    emptyHelp: "Choose Today below to inspect the synthetic working day.",
    failure: "The sample list could not load.",
    retry: "Retry sample",
    recovered: "Sample list is visible again. Nothing was saved.",
    selected: "Selected sample",
    ready: "Ready for handover",
    progress: "Trial ready",
    neutral: "Awaiting measurements",
    today: "Today",
    garments: "Garments",
    customers: "Customers",
    lookbook: "Lookbook",
    boutique: "Navodhai Boutique",
    date: "Wednesday, 14 October 2026 · fixed preview date",
    day: "Today's work",
    newOrder: "New order",
    find: "Find customer",
    future:
      "Order creation, customer search, lookbook, and trial feedback are unavailable in this preview.",
    commitment: "Next commitment",
    trial: "Trial · 14 Oct, 4:30 pm",
    relative: "In 2 hours · preview clock fixed at 2:30 pm, Asia/Kolkata",
    booking: "Booking BK-SAMPLE-014 · 2 garment orders",
    open: "Open Meera's garment order",
    tomorrow: "Due tomorrow",
    deepika: "Deepika · Churidar alteration",
    due: "15 October · sleeve length review",
    kavitha: "Kavitha · Cotton blouse",
    paid: "Paid",
    anitha: "Anitha · Blouse",
    back: "Back to sample Today",
    detail: "Meera's garment order",
    order: "Garment order ORD-SAMPLE-0142 · 1 of 2 in this booking",
    second: "Other garment order: ORD-SAMPLE-0143 · second blouse",
    production: "Production",
    schedule: "Schedule",
    delivery: "Delivery · 16 October",
    design: "Design reference ND-BL-014",
    garment: "Boat neck blouse",
    image: "Reference image not supplied",
    measurements: "Finished garment measurements",
    measurementContext:
      "Synthetic display values · inches (in) · preview version 1, 14 October 2026. Not verified cutting instructions.",
    length: "Length (in)",
    waist: "Waistband (in)",
    sleeve: "Sleeve length (in)",
    missing: "Not recorded",
    body: "Body profile is a separate measurement record. No ease or tolerance has been specified.",
    finance: "Booking-wide payment summary",
    total: "Booking total",
    received: "Advance received",
    balance: "Balance remaining",
    allocations:
      "These totals cover both garment orders. Per-order payment allocations are not supplied.",
    feedback: "Record trial feedback",
    feedbackHelp:
      "Unavailable: the trial-feedback workflow has not been implemented.",
  },
  ta: {
    foundations: "Grounded Editorial · சோதனை வடிவமைப்பு",
    disclaimer:
      "இவை கற்பனை வடிவமைப்பு மாதிரிகள் மட்டுமே. ஆர்டர்கள், பணப்பதிவுகள், அளவுகள் அல்லது செய்திகள் உருவாக்கப்படாது. தமிழ் சொற்கள் உரிமையாளரின் மதிப்பாய்வுக்காக உள்ளன.",
    typography: "எழுத்துரு மற்றும் உரை மாதிரிகள்",
    note: "Boat neck blouse · முன்புற அளவுகளைச் சரிபார்க்கவும். நீண்ட குறிப்புகள் முழுமையாகத் தெரிய வேண்டும்; அளவுகள் அல்லது தேவைகளை மறைக்க வேண்டாம்.",
    states: "கூடுதல் கட்டுப்பாட்டு நிலைகள்",
    readonly: "பதிவு செய்யப்பட்ட குறிப்பு (படிக்க மட்டும்)",
    unavailable: "செயல் கிடைக்கவில்லை",
    reason: "இந்த வடிவமைப்பு மாதிரியில் இந்தச் செயல் கிடைக்காது.",
    empty: "இந்த மாதிரிக் காட்சியில் ஆடைகள் இல்லை",
    emptyHelp: "கற்பனை வேலைநாளைக் காண கீழே இன்றைய பணிகளைத் தேர்ந்தெடுக்கவும்.",
    failure: "மாதிரிப் பட்டியலை ஏற்ற முடியவில்லை.",
    retry: "மாதிரியை மீண்டும் காட்டு",
    recovered: "மாதிரிப் பட்டியல் மீண்டும் தெரிகிறது. எதுவும் சேமிக்கப்படவில்லை.",
    selected: "தேர்ந்தெடுத்த மாதிரி",
    ready: "ஒப்படைக்கத் தயார்",
    progress: "அணிந்து பார்க்கத் தயார்",
    neutral: "அளவுகள் தேவை",
    today: "இன்றைய பணிகள்",
    garments: "ஆடைகள்",
    customers: "வாடிக்கையாளர்கள்",
    lookbook: "வடிவமைப்புகள்",
    boutique: "நவோதய் பொட்டிக்",
    date: "புதன்கிழமை, 14 அக்டோபர் 2026 · நிலையான மாதிரித் தேதி",
    day: "இன்றைய வேலைகளை நிதானமாகத் தொடருங்கள்",
    newOrder: "புதிய ஆர்டர்",
    find: "வாடிக்கையாளரைத் தேடு",
    future:
      "ஆர்டர் உருவாக்கம், வாடிக்கையாளர் தேடல், வடிவமைப்புகள் மற்றும் அணிந்து பார்த்த கருத்துப் பதிவு இந்த மாதிரியில் கிடைக்காது.",
    commitment: "அடுத்த சந்திப்பு",
    trial: "அணிந்து பார்க்க · 14 அக்., மாலை 4:30",
    relative: "இன்னும் 2 மணி நேரம் · மாதிரி நேரம் மதியம் 2:30, Asia/Kolkata",
    booking: "முன்பதிவு BK-SAMPLE-014 · 2 ஆடை ஆர்டர்கள்",
    open: "மீராவின் ஆடை ஆர்டரைக் காட்டு",
    tomorrow: "நாளை முடிக்க வேண்டியவை",
    deepika: "தீபிகா · சுடிதார் திருத்தம்",
    due: "15 அக்டோபர் · கை நீளத்தைச் சரிபார்க்கவும்",
    kavitha: "கவிதா · பருத்தி ரவிக்கை",
    paid: "பணம் பெறப்பட்டது",
    anitha: "அனிதா · ரவிக்கை",
    back: "மாதிரி இன்றைய பணிகளுக்குத் திரும்பு",
    detail: "மீராவின் ஆடை ஆர்டர்",
    order: "ஆடை ஆர்டர் ORD-SAMPLE-0142 · முன்பதிவில் 2 இல் 1",
    second: "மற்ற ஆடை ஆர்டர்: ORD-SAMPLE-0143 · இரண்டாவது ரவிக்கை",
    production: "தயாரிப்பு",
    schedule: "அட்டவணை",
    delivery: "ஒப்படைப்பு · 16 அக்டோபர்",
    design: "வடிவமைப்புக் குறிப்பு ND-BL-014",
    garment: "படகு கழுத்து ரவிக்கை",
    image: "குறிப்புப் படம் வழங்கப்படவில்லை",
    measurements: "தைக்கப்பட்ட ஆடையின் அளவுகள்",
    measurementContext:
      "கற்பனைக் காட்சி மதிப்புகள் · அங்குலம் (in) · மாதிரிப் பதிப்பு 1, 14 அக்டோபர் 2026. வெட்டுவதற்கான சரிபார்க்கப்பட்ட வழிமுறைகள் அல்ல.",
    length: "நீளம் (in)",
    waist: "இடுப்புப் பட்டை (in)",
    sleeve: "கை நீளம் (in)",
    missing: "பதிவு செய்யப்படவில்லை",
    body: "உடல் அளவுகள் தனிப் பதிவு. தளர்வு அல்லது சகிப்புத்தன்மை குறிப்பிடப்படவில்லை.",
    finance: "முன்பதிவு முழுவதற்குமான பணச் சுருக்கம்",
    total: "முன்பதிவின் மொத்தம்",
    received: "பெற்ற முன்பணம்",
    balance: "பெற வேண்டிய தொகை",
    allocations:
      "இந்தத் தொகைகள் இரண்டு ஆடை ஆர்டர்களுக்கும் சேர்த்தவை. தனித்தனி பண ஒதுக்கீடு வழங்கப்படவில்லை.",
    feedback: "அணிந்து பார்த்த கருத்தைப் பதிவு செய்",
    feedbackHelp: "கிடைக்கவில்லை: கருத்துப் பதிவு வசதி இன்னும் உருவாக்கப்படவில்லை.",
  },
};

const swatches = [
  ["Canvas", "bg-background"],
  ["Card", "bg-card"],
  ["Forest action", "bg-primary"],
  ["Selected", "bg-accent"],
  ["Progress", "bg-progress"],
  ["Attention", "bg-warning"],
  ["Error", "bg-error"],
] as const;

function BilingualIdentity({
  locale,
  extended = false,
}: {
  locale: "en" | "ta";
  extended?: boolean;
}) {
  const en = extended
    ? "Meenakshi Sundaravalli Krishnamurthy"
    : "Meera Krishnan";
  const ta = extended ? "திருமதி மீனாட்சி சுந்தரவல்லி கிருஷ்ணமூர்த்தி" : "மீரா கிருஷ்ணன்";
  const first = extended ? "ta" : locale;
  return (
    <>
      <span lang={first}>{first === "en" ? en : ta}</span>
      {" · "}
      <span lang={first === "en" ? "ta" : "en"}>
        {first === "en" ? ta : en}
      </span>
    </>
  );
}

export function DesignSpecimens({ locale }: { locale: "en" | "ta" }) {
  const t = words[locale];
  const [detail, setDetail] = useState(false);
  const [retried, setRetried] = useState(false);
  const [selected, setSelected] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  function showDetail(value: boolean) {
    setDetail(value);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <section aria-labelledby="candidate-title" data-testid="design-specimens">
      <h2 id="candidate-title" className="editorial text-2xl">
        {t.foundations}
      </h2>
      <p className="lab-note my-4">{t.disclaimer}</p>
      <div className="lab-swatches" lang="en">
        {swatches.map(([label, color]) => (
          <div key={label} className="lab-swatch">
            <div aria-hidden="true" className={`lab-swatch-sample ${color}`} />
            <p className="p-3 text-sm">{label}</p>
          </div>
        ))}
      </div>
      <section className="preview-section" aria-labelledby="type-specimens">
        <h3 id="type-specimens">{t.typography}</h3>
        <p className="editorial text-2xl my-3" data-testid="editorial-specimen">
          <BilingualIdentity locale={locale} extended />
        </p>
        <p className="max-w-prose">{t.note}</p>
        <p className="lab-money my-3">₹1,400.50 · ₹12,34,56,789.50</p>
      </section>
      <section className="preview-section" aria-labelledby="extra-states">
        <h3 id="extra-states" className="mb-4">
          {t.states}
        </h3>
        <div className="preview-grid">
          <Field>
            <FieldLabel htmlFor="reference-readonly">{t.readonly}</FieldLabel>
            <Input id="reference-readonly" readOnly value="ND-BL-014" />
          </Field>
          <div>
            <Button disabled aria-describedby="unavailable-reason">
              {t.unavailable}
            </Button>
            <p id="unavailable-reason" className="text-sm mt-2">
              {t.reason}
            </p>
          </div>
        </div>
        <div className="preview-controls my-4">
          <Status tone="neutral">{t.neutral}</Status>
          <Status tone="progress">{t.progress}</Status>
          <Button
            variant="outline"
            aria-pressed={selected}
            onClick={() => setSelected(!selected)}
          >
            {t.selected}
          </Button>
        </div>
        <div className="preview-grid">
          <div className="lab-note">
            <h4>{t.empty}</h4>
            <p className="mt-2">{t.emptyHelp}</p>
          </div>
          <div className="lab-note">
            <p role="status">{retried ? t.recovered : t.failure}</p>
            {!retried && (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => setRetried(true)}
              >
                {t.retry}
              </Button>
            )}
          </div>
        </div>
      </section>
      <section
        className="preview-section"
        aria-labelledby="workspace-heading"
        data-testid="sample-workspace"
      >
        <h2 id="workspace-heading" className="mb-3">
          {locale === "en" ? "Working-day composition" : "வேலைநாள் வடிவமைப்பு"}
        </h2>
        <p className="text-sm text-muted-foreground">{t.future}</p>
        <div className="lab-workspace" data-view={detail ? "detail" : "today"}>
          <div className="lab-workspace-main">
            <header className="lab-workspace-header">
              <div>
                <p className="font-semibold">{t.boutique}</p>
                <p className="text-sm text-muted-foreground">
                  aarili · {t.date}
                </p>
              </div>
              {detail ? (
                <Button variant="outline" onClick={() => showDetail(false)}>
                  <ArrowLeftIcon aria-hidden="true" />
                  {t.back}
                </Button>
              ) : (
                <Button disabled>
                  <PlusIcon aria-hidden="true" />
                  {t.newOrder}
                </Button>
              )}
            </header>
            <h3
              ref={heading}
              tabIndex={-1}
              className="editorial my-5"
              data-testid="composition-heading"
            >
              {detail ? t.detail : t.day}
            </h3>
            {detail ? (
              <>
                <p className="editorial text-xl">
                  <BilingualIdentity locale={locale} />
                </p>
                <p className="text-sm my-2">{t.order}</p>
                <p className="text-sm text-muted-foreground">{t.booking}</p>
                <p className="text-sm text-muted-foreground">{t.second}</p>
                <div className="preview-controls my-5">
                  <div>
                    <p className="text-sm mb-2">{t.production}</p>
                    <Status tone="progress">{t.progress}</Status>
                  </div>
                  <div>
                    <p className="text-sm">{t.schedule}</p>
                    <p>{t.trial}</p>
                    <p>{t.delivery}</p>
                  </div>
                </div>
                <div className="lab-record">
                  <div>
                    <h4 className="editorial mb-2">{t.garment}</h4>
                    <p className="text-sm mb-4">{t.design}</p>
                    <div className="lab-thumbnail">
                      <ImageIcon
                        aria-hidden="true"
                        className="size-6 mx-auto mb-2"
                      />
                      <p>{t.image}</p>
                    </div>
                    <p className="my-4 max-w-prose">{t.note}</p>
                    <section
                      className="lab-specification"
                      aria-labelledby="measurement-heading"
                    >
                      <h4 id="measurement-heading" className="font-semibold">
                        {t.measurements}
                      </h4>
                      <p className="text-sm mt-2">{t.measurementContext}</p>
                      <div className="lab-measurements">
                        {[
                          [t.length, "14.5"],
                          [t.waist, "31.0"],
                          [t.sleeve, t.missing],
                        ].map(([label, value], i) => (
                          <Field key={label}>
                            <FieldLabel htmlFor={`sample-measurement-${i}`}>
                              {label}
                            </FieldLabel>
                            {i === 2 ? (
                              <output
                                id={`sample-measurement-${i}`}
                                className="ui-input"
                              >
                                {value}
                              </output>
                            ) : (
                              <Input
                                id={`sample-measurement-${i}`}
                                readOnly
                                value={value}
                              />
                            )}
                          </Field>
                        ))}
                      </div>
                      <p className="text-sm">{t.body}</p>
                    </section>
                  </div>
                  <section
                    aria-labelledby="booking-finance"
                    data-testid="booking-finance"
                  >
                    <h4 id="booking-finance" className="font-semibold">
                      {t.finance}
                    </h4>
                    <dl className="lab-money my-3">
                      {[
                        [t.total, "₹2,400"],
                        [t.received, "₹1,000"],
                        [t.balance, "₹1,400"],
                      ].map(([label, value]) => (
                        <DenseRow key={label}>
                          <dt>{label}</dt>
                          <dd className="font-semibold">{value}</dd>
                        </DenseRow>
                      ))}
                    </dl>
                    <p className="text-sm text-muted-foreground">
                      {t.allocations}
                    </p>
                    <div className="lab-note mt-5">
                      <Button disabled aria-describedby="feedback-unavailable">
                        {t.feedback}
                      </Button>
                      <p id="feedback-unavailable" className="text-sm mt-3">
                        {t.feedbackHelp}
                      </p>
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <>
                <div className="preview-controls mb-5">
                  <Button variant="outline" disabled>
                    <SearchIcon aria-hidden="true" />
                    {t.find}
                  </Button>
                </div>
                <h4 className="font-semibold">{t.commitment}</h4>
                <div className="lab-work-list">
                  <Card>
                    <div className="lab-order-heading">
                      <h5 className="editorial text-xl">
                        <BilingualIdentity locale={locale} />
                      </h5>
                      <Status tone="progress">{t.progress}</Status>
                    </div>
                    <p>{t.trial}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.relative}
                    </p>
                    <p className="text-sm my-3">{t.booking}</p>
                    <Button onClick={() => showDetail(true)}>{t.open}</Button>
                  </Card>
                  <div>
                    <h4 className="mb-2 font-semibold">{t.tomorrow}</h4>
                    <DenseRow>
                      <div>
                        <p>{t.deepika}</p>
                        <p className="text-sm text-muted-foreground">{t.due}</p>
                      </div>
                    </DenseRow>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">{t.ready}</h4>
                    <DenseRow>
                      <p>{t.kavitha}</p>
                      <Status tone="success">{t.paid}</Status>
                    </DenseRow>
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold">{t.neutral}</h4>
                    <DenseRow>
                      <p>{t.anitha}</p>
                      <Status tone="neutral">{t.neutral}</Status>
                    </DenseRow>
                  </div>
                </div>
              </>
            )}
          </div>
          {!detail && (
            <nav
              className="lab-bottom"
              aria-label={
                locale === "en" ? "Sample navigation" : "மாதிரி வழிசெலுத்தல்"
              }
            >
              <Button
                variant="secondary"
                aria-current="page"
                onClick={() => showDetail(false)}
              >
                <CalendarDaysIcon aria-hidden="true" />
                <span>{t.today}</span>
              </Button>
              <Button variant="ghost" disabled>
                <ShirtIcon aria-hidden="true" />
                <span>{t.garments}</span>
              </Button>
              <Button variant="ghost" disabled>
                <UsersIcon aria-hidden="true" />
                <span>{t.customers}</span>
              </Button>
              <Button variant="ghost" disabled>
                <BookOpenIcon aria-hidden="true" />
                <span>{t.lookbook}</span>
              </Button>
            </nav>
          )}
        </div>
      </section>
    </section>
  );
}
