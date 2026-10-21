export const orderPieceMessages = {
  en: {
    title: "Outfit pieces",
    booked: "Booked — requirements unresolved",
    excluded: "Not required",
    unknown: "Applicability unresolved",
    none: "This order has no separate outfit pieces.",
    shared: "Shared order requirements",
    form: "Measurement form definition",
    noForm: "No piece form selected",
    unavailable: "Production, custody and handover are not available here.",
    legacy:
      "Historical preview from the original accepted definition. Prepare stable piece records before later work.",
    prepare: "Prepare piece records",
    reason: "Reason for preparing historical pieces",
    confirm: "Confirm preparation",
    cancel: "Cancel",
    review: "Review historical pieces",
    preview:
      "This preserves the accepted order, its promises, price and capacity demand.",
    unsupported:
      "The historical piece definition cannot be resolved. The order remains unchanged; review its original sources.",
    error: "Pieces could not be loaded. Retry when connected.",
    checking:
      "Checking whether piece records were prepared. Retry the same request.",
    stale: "The order changed. Reload the order and review its pieces again.",
    conflict:
      "The piece records or source changed. Reload the order before trying again.",
    retry: "Retry",
    loading: "Loading pieces…",
    prepared: "Piece records prepared",
    history: "Preparation history",
    original: "Original piece definition",
    unresolved: "Unresolved",
    detail: "Requirement details",
    sharedHint:
      "Shared order requirements also apply. An unresolved item stays visible in both views.",
  },
  ta: {
    title: "ஆடையின் பகுதிகள்",
    booked: "பதிவு செய்யப்பட்டது — தேவைகள் இன்னும் தீர்க்கப்படவில்லை",
    excluded: "தேவையில்லை",
    unknown: "பொருந்துமா என்பது இன்னும் முடிவு செய்யப்படவில்லை",
    none: "இந்த ஆடைக்குத் தனிப் பகுதிகள் இல்லை.",
    shared: "ஆடைக்கான பொதுத் தேவைகள்",
    form: "அளவுப் படிவ வரையறை",
    noForm: "பகுதிக்கான படிவம் தேர்ந்தெடுக்கப்படவில்லை",
    unavailable: "உற்பத்தி, பொருள் பொறுப்பு மற்றும் ஒப்படைப்பு இங்கே கிடைக்காது.",
    legacy:
      "முதலில் ஏற்றுக்கொண்ட வரையறையிலிருந்து பழைய பதிவின் முன்னோட்டம். அடுத்த வேலைகளுக்கு முன் பகுதிப் பதிவுகளைத் தயாரிக்கவும்.",
    prepare: "பகுதிப் பதிவுகளைத் தயாரிக்கவும்",
    reason: "பழைய ஆடையின் பகுதிப் பதிவுகளைத் தயாரிப்பதற்கான காரணம்",
    confirm: "தயாரிப்பை உறுதிசெய்யவும்",
    cancel: "ரத்துசெய்",
    review: "பழைய ஆடையின் பகுதிகளை மதிப்பாய்வு செய்",
    preview: "ஏற்றுக்கொண்ட ஆடை, வாக்குறுதி தேதிகள், விலை மற்றும் திறன் தேவை மாற்றப்படாது.",
    unsupported:
      "பழைய பகுதிகளின் வரையறையைத் தீர்மானிக்க முடியவில்லை. ஆடைப் பதிவு மாறவில்லை; அதன் அசல் ஆதாரங்களை மதிப்பாய்வு செய்யவும்.",
    error: "பகுதிகளை ஏற்ற முடியவில்லை. இணைப்பு வந்ததும் மீண்டும் முயலவும்.",
    checking:
      "பகுதிப் பதிவுகள் தயாரானதா எனச் சரிபார்க்கிறோம். அதே கோரிக்கையை மீண்டும் முயலவும்.",
    stale: "ஆடைப் பதிவு மாறியுள்ளது. அதை மீண்டும் ஏற்றி பகுதிகளை மதிப்பாய்வு செய்யவும்.",
    conflict:
      "பகுதிப் பதிவுகள் அல்லது ஆதாரம் மாறியுள்ளது. மீண்டும் முயலும் முன் ஆடைப் பதிவை ஏற்றவும்.",
    retry: "மீண்டும் முயல்",
    loading: "பகுதிகள் ஏற்றப்படுகின்றன…",
    prepared: "பகுதிப் பதிவுகள் தயாராகின",
    history: "தயாரிப்பு வரலாறு",
    original: "அசல் பகுதி வரையறை",
    unresolved: "தீர்க்கப்படவில்லை",
    detail: "தேவையின் விவரங்கள்",
    sharedHint:
      "ஆடைக்கான பொதுத் தேவைகளும் பொருந்தும். தீர்க்கப்படாத தேவை இரு காட்சிகளிலும் தெரியும்.",
  },
} as const;
