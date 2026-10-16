export const documentMessages = {
  en: {
    title: "Private PDF",
    pending: "Document saved; PDF is waiting to render",
    rendering: "Preparing the PDF",
    ready: "PDF ready; the saved version will stay unchanged",
    failed: "PDF preparation did not finish; your document is still saved",
    unavailable:
      "PDF status could not be confirmed. Check again while connected.",
    retrying:
      "A temporary failure occurred. Processing will retry automatically.",
    exhausted:
      "Automatic retries ended. Retry preparation of this saved document.",
    restore:
      "This PDF needs an authorized retry after recovery controls allow processing.",
    check: "Check PDF status",
    retry: "Retry PDF",
    unknown:
      "The request outcome is unknown. Check the same document before trying again.",
  },
  ta: {
    title: "தனிப்பட்ட PDF",
    pending: "ஆவணம் சேமிக்கப்பட்டது; PDF தயாராகக் காத்திருக்கிறது",
    rendering: "PDF தயாராகிறது",
    ready: "PDF தயார்; சேமிக்கப்பட்ட பதிப்பு மாறாது",
    failed: "PDF தயாரிப்பு முடியவில்லை; உங்கள் ஆவணம் சேமிக்கப்பட்டுள்ளது",
    unavailable:
      "PDF நிலையை உறுதிப்படுத்த முடியவில்லை. இணைப்புடன் மீண்டும் சரிபார்க்கவும்.",
    retrying: "தற்காலிகத் தோல்வி ஏற்பட்டது. செயலாக்கம் தானாக மீண்டும் முயலும்.",
    exhausted:
      "தானியங்கு மறுமுயற்சிகள் முடிந்தன. சேமிக்கப்பட்ட இந்த ஆவணத்தை மீண்டும் தயாரிக்கவும்.",
    restore:
      "மீட்புக் கட்டுப்பாடுகள் அனுமதித்த பிறகு இந்த PDF-ஐ மீண்டும் தயாரிக்க அங்கீகாரம் தேவை.",
    check: "PDF நிலையைச் சரிபார்க்கவும்",
    retry: "PDF-ஐ மீண்டும் தயாரிக்கவும்",
    unknown:
      "கோரிக்கையின் முடிவு தெரியவில்லை. மீண்டும் முயல்வதற்கு முன் அதே ஆவணத்தைச் சரிபார்க்கவும்.",
  },
} as const;
