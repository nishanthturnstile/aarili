export const documentMessages = {
  en: {
    title: "Private PDF",
    layoutFailure:
      "Label content does not fit its cell. Review the source field before issuing a new revision:",
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
    layoutFailure:
      "\u0b9a\u0bc0\u0b9f\u0bcd\u0b9f\u0bbf\u0ba9\u0bcd \u0b89\u0bb3\u0bcd\u0bb3\u0b9f\u0b95\u0bcd\u0b95\u0bae\u0bcd \u0b87\u0b9f\u0ba4\u0bcd\u0ba4\u0bbf\u0bb2\u0bcd \u0baa\u0bca\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bb5\u0bbf\u0bb2\u0bcd\u0bb2\u0bc8. \u0baa\u0bc1\u0ba4\u0bbf\u0baf \u0baa\u0ba4\u0bbf\u0baa\u0bcd\u0baa\u0bc1\u0b95\u0bcd\u0b95\u0bc1 \u0bae\u0bc1\u0ba9\u0bcd \u0bae\u0bc2\u0bb2\u0baa\u0bcd \u0baa\u0bc1\u0bb2\u0ba4\u0bcd\u0ba4\u0bc8\u0b9a\u0bcd \u0b9a\u0bb0\u0bbf\u0baa\u0bbe\u0bb0\u0bcd\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd:",
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
