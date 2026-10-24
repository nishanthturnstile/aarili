export const quotationIssueMessages = {
  en: {
    discard:
      "Discard unsaved quotation issue or response input? Pending requests must be resolved first.",
    blockers: {
      "proposal-source-changed-or-incomplete":
        "Proposal sources changed or selling prices are incomplete. Revise and save the proposal.",
      "proposal-not-current": "Select this proposal as current before issuing.",
      "proposal-already-issued":
        "This proposal was already issued. Open its history or save a new proposal revision.",
      "shop-profile-incomplete":
        "Review the non-tax shop identity, address and contact details.",
      "validity-policy-unreviewed":
        "Review the quotation validity policy in Rates.",
      "validity-date-invalid":
        "Choose today or a later expiry date, or review the policy's calendar days.",
    },
    title: "Issue quotation",
    review: "Review issuance",
    issue: "Issue numbered quotation",
    language: "Document language",
    expiry: "Explicit expiry date (optional)",
    customer: "Customer-facing name (optional)",
    reason: "Issue / revision reason",
    ack: "I reviewed the scope, non-tax template, terms and validity",
    checking: "Checking outcome — retry the original request",
    retry: "Resolve original request",
    error: "Request failed. Your input is retained.",
    stale: "Source or revision changed. Review again; your input is retained.",
    unknown: "Pending response",
    historical:
      "Historical response only — expired, withdrawn, alternative or superseded",
    boundary:
      "Quotation — not a bill. Responses do not confirm an agreement or payment.",
    history: "Issued quotation history",
    open: "Open issued quotation",
    response: "Record owner-attested response",
    kind: "Reported response",
    approved: "Approved",
    rejected: "Rejected",
    withdrawn: "Withdraw previous response",
    issueWithdrawn: "Withdraw issued quotation",
    channel: "Response channel",
    verbal: "Verbal",
    message: "Manual message",
    written: "Written",
    reported: "Reported response time",
    evidence: "Minimal evidence note / reference",
    responseReason: "Response / correction reason",
    respondent: "Responding customer",
    record: "Record response",
    refresh: "Reload response history",
    attest:
      "I attest this response concerns this exact revision; it is not a digital signature",
    phone: "Phone for optional WhatsApp text",
    version: "Revision",
    issued: "Issued",
    through: "Valid through (inclusive)",
    reviewed: "Reviewed. Source changes require another review.",
    blocked: "Issuance blocked",
    respondentNone: "No respondent (withdrawal only)",
  },
  ta: {
    discard:
      "சேமிக்காத வெளியீடு அல்லது பதில் உள்ளீட்டை நீக்கவா? நிலுவைக் கோரிக்கையின் முடிவை முதலில் உறுதி செய்ய வேண்டும்.",
    blockers: {
      "proposal-source-changed-or-incomplete":
        "மூலம் மாறியுள்ளது அல்லது விற்பனை விலை முழுமையாக இல்லை. விலைப்புள்ளியைத் திருத்திச் சேமிக்கவும்.",
      "proposal-not-current":
        "வெளியிடும் முன் இதை நடப்பு விலைப்புள்ளியாகத் தேர்ந்தெடுக்கவும்.",
      "proposal-already-issued":
        "இது ஏற்கெனவே வெளியிடப்பட்டது. வரலாற்றைத் திறக்கவும் அல்லது புதிய திருத்தப் பதிப்பைச் சேமிக்கவும்.",
      "shop-profile-incomplete":
        "வரியற்ற கடையின் பெயர், முகவரி மற்றும் தொடர்பு விவரங்களை ஆய்வு செய்யவும்.",
      "validity-policy-unreviewed":
        "விலை அமைப்புகளில் விலைப்புள்ளியின் செல்லுபடிக் காலக் கொள்கையை ஆய்வு செய்யவும்.",
      "validity-date-invalid":
        "இன்றைய நாள் அல்லது அதற்குப் பிந்தைய இறுதி நாளைத் தேர்ந்தெடுக்கவும்; அல்லது கொள்கையின் நாட்களை ஆய்வு செய்யவும்.",
    },
    title: "விலைப்புள்ளியை வெளியிடு",
    review: "வெளியீட்டை ஆய்வு செய்",
    issue: "எண்ணிட்ட விலைப்புள்ளியை வெளியிடு",
    language: "ஆவண மொழி",
    expiry: "குறிப்பிட்ட இறுதி நாள் (விருப்பம்)",
    customer: "வாடிக்கையாளருக்குத் தெரியும் பெயர் (விருப்பம்)",
    reason: "வெளியீடு / திருத்தக் காரணம்",
    ack: "வேலை, வரியற்ற மாதிரி, நிபந்தனைகள் மற்றும் செல்லுபடிக் காலத்தை ஆய்வு செய்தேன்",
    checking: "முடிவைச் சரிபார்க்கிறது — அசல் கோரிக்கையை மீண்டும் முயல்க",
    retry: "அசல் கோரிக்கையின் முடிவை உறுதி செய்",
    error: "கோரிக்கை தோல்வி. உள்ளீடு பாதுகாக்கப்பட்டுள்ளது.",
    stale:
      "மூலம் அல்லது பதிப்பு மாறியுள்ளது. மீண்டும் ஆய்வு செய்க; உள்ளீடு பாதுகாக்கப்பட்டுள்ளது.",
    unknown: "பதில் நிலுவையில் உள்ளது",
    historical:
      "வரலாற்றுப் பதில் மட்டுமே — காலாவதி, திரும்பப் பெறப்பட்டது, மாற்று அல்லது முந்தைய பதிப்பு",
    boundary:
      "விலைப்புள்ளி — கட்டணப் பட்டியல் அல்ல. பதில் ஒப்பந்தம் அல்லது பணம் செலுத்தலை உறுதி செய்யாது.",
    history: "வெளியிட்ட விலைப்புள்ளிகளின் வரலாறு",
    open: "வெளியிட்ட விலைப்புள்ளியைத் திற",
    response: "உரிமையாளர் சான்றளிக்கும் பதிலைப் பதிவு செய்",
    kind: "தெரிவித்த பதில்",
    approved: "ஒப்புதல்",
    rejected: "நிராகரிப்பு",
    withdrawn: "முந்தைய பதிலைத் திரும்பப் பெறு",
    issueWithdrawn: "வெளியிட்ட விலைப்புள்ளியைத் திரும்பப் பெறு",
    channel: "பதில் வழி",
    verbal: "வாய்மொழி",
    message: "கைமுறைச் செய்தி",
    written: "எழுத்து",
    reported: "பதில் தெரிவித்த நேரம்",
    evidence: "குறைந்தபட்ச ஆதாரக் குறிப்பு",
    responseReason: "பதில் / திருத்தக் காரணம்",
    respondent: "பதிலளித்த வாடிக்கையாளர்",
    record: "பதிலைப் பதிவு செய்",
    refresh: "பதில் வரலாற்றை மீண்டும் ஏற்று",
    attest:
      "இந்தப் பதில் இந்தப் பதிப்பிற்கே உரியது எனச் சான்றளிக்கிறேன்; இது மின்னணுக் கையொப்பம் அல்ல",
    phone: "விருப்ப WhatsApp உரைக்கான தொலைபேசி",
    version: "பதிப்பு",
    issued: "வெளியிட்ட நாள்",
    through: "செல்லுபடியாகும் இறுதி நாள் (உட்பட)",
    reviewed: "ஆய்வு செய்யப்பட்டது. மூலம் மாறினால் மீண்டும் ஆய்வு தேவை.",
    blocked: "வெளியீடு தடுக்கப்பட்டுள்ளது",
    respondentNone: "பதிலளிப்பவர் இல்லை (திரும்பப் பெறுதல் மட்டும்)",
  },
};
