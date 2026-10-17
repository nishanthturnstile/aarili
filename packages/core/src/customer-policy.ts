import type { CustomerPolicy } from "@aarili/contracts/customers";
// Original Aarili review draft; no production approval. Only explicit synthetic composition enables it.
export const blockedCustomerPolicy: CustomerPolicy = {
  enabled: false,
  synthetic: false,
  notice: null,
};
export const syntheticCustomerPolicy: CustomerPolicy = {
  enabled: true,
  synthetic: true,
  notice: {
    id: "019e70b1-0000-7000-8000-000000000001",
    version: "cw-privacy-draft-2026-10-17-v1",
    titleEn: "DRAFT - synthetic testing only",
    titleTa: "DRAFT - தையல் சேவைக்காக உங்கள் விவரங்கள்",
    textEn:
      "**Your details for tailoring service**\n\nWe use your name and any contact details you choose to provide to identify you,\ncontact you about your tailoring service and keep the relevant service records.\nWe keep the contact or payer and the person wearing the garment as separate\npeople. Sharing a phone number or paying for an order does not give access to\nanother person's measurements or private photos.\n\nYou do not need to provide a date of birth, identity document or body photo for a\nnormal tailoring order. Measurements and private fitting photos, when offered,\nare handled under their applicable notice and permission. For a wearer under 18,\nwe must first record the parent or legal guardian's applicable consent before\nstoring measurements or photos. We never publish a minor's images or use their\ndata for marketing targeting.\n\nMarketing, promotional publication and optional private photos have separate\nchoices. Refusing marketing does not prevent ordinary service. You can ask the\nboutique owner to correct or export your details, review deletion, or record a\nconsent withdrawal. We will track your request and explain what can be removed\nand what must be kept, with the reason; withdrawal is not a promise that all\nrecords or previously shared copies disappear immediately.\n\n**Draft information still awaiting approval:** The owner must confirm the named\ngrievance contact and contact method, retention periods for each record type,\nprocessor/location disclosures and the request-verification procedure before\nreal-data use. No real customer registration is enabled by this draft.",
    textTa:
      "**தையல் சேவைக்காக உங்கள் விவரங்கள்**\n\nஉங்களை அடையாளம் காணவும், உங்கள் தையல் சேவை தொடர்பாக உங்களைத் தொடர்புகொள்ளவும்,\nஅந்தச் சேவைப் பதிவுகளை வைத்திருக்கவும் உங்கள் பெயரையும், நீங்கள் விரும்பி வழங்கும்\nதொடர்பு விவரங்களையும் பயன்படுத்துகிறோம். தொடர்புகொள்பவர் அல்லது பணம் செலுத்துபவர்,\nஆடையை அணிபவர் ஆகியோரைத் தனித்தனி நபர்களாகப் பதிவு செய்கிறோம். ஒரே தொலைபேசி எண்ணைப்\nபயன்படுத்துவதோ, பணம் செலுத்துவதோ மற்றொருவரின் அளவுகள் அல்லது தனிப்பட்ட புகைப்படங்களைப்\nபார்க்க அனுமதி அளிக்காது.\n\nவழக்கமான தையல் ஆர்டருக்கு பிறந்த தேதி, அடையாள ஆவணம் அல்லது உடல் புகைப்படம் வழங்கத்\nதேவையில்லை. அளவுகள் மற்றும் தனிப்பட்ட பொருத்தப் புகைப்படங்களைப் பதிவு செய்யும் வசதி\nவழங்கப்படும்போது, அவற்றுக்கான அறிவிப்பும் அனுமதியும் தனியாகக் கையாளப்படும். ஆடையை\nஅணிபவர் 18 வயதுக்குக் குறைவானவர் என்றால், அவரின் அளவுகள் அல்லது புகைப்படங்களைச்\nசேமிப்பதற்கு முன் பெற்றோர் அல்லது சட்டப்பூர்வ பாதுகாவலரின் பொருந்தும் ஒப்புதலைப் பதிவு\nசெய்ய வேண்டும். சிறார்களின் படங்களை வெளியிடுவதோ, அவர்களின் தரவுகளை இலக்கு\nவிளம்பரத்திற்குப் பயன்படுத்துவதோ கிடையாது.\n\nவிளம்பரம், விளம்பர நோக்கில் படங்களை வெளியிடுதல், விருப்பத் தனிப்பட்ட புகைப்படங்கள்\nஆகியவற்றுக்குத் தனித்தனி தேர்வுகள் உண்டு. விளம்பரத்திற்கு மறுப்பதால் வழக்கமான சேவை\nமறுக்கப்படாது. உங்கள் விவரங்களைத் திருத்த, அவற்றின் நகலைப் பெற, நீக்கக் கோரிக்கை விடுக்க\nஅல்லது ஒப்புதலைத் திரும்பப் பெற கடை உரிமையாளரிடம் தெரிவிக்கலாம். கோரிக்கையின் நிலையைப்\nபதிவு செய்து, எதை நீக்கலாம், எதை வைத்திருக்க வேண்டும், அதற்கான காரணம் என்ன என்பதைத்\nதெரிவிப்போம். ஒப்புதலைத் திரும்பப் பெறுவது எல்லாப் பதிவுகளும் ஏற்கெனவே பகிரப்பட்ட\nநகல்களும் உடனடியாக நீங்கிவிடும் என்ற உறுதிமொழி அல்ல.\n\n**இன்னும் ஒப்புதல் பெற வேண்டிய வரைவு விவரங்கள்:** உண்மையான வாடிக்கையாளர் தரவுகளைப்\nபயன்படுத்துவதற்கு முன், குறைதீர்ப்புத் தொடர்பாளர் மற்றும் தொடர்பு முறை, ஒவ்வொரு வகைப்\nபதிவையும் வைத்திருக்கும் காலம், தரவைக் கையாளும் சேவை வழங்குநர்கள் மற்றும் இருப்பிடங்கள்,\nகோரிக்கை விடுப்பவரை உறுதிப்படுத்தும் முறை ஆகியவற்றை உரிமையாளர் உறுதி செய்ய வேண்டும்.\nஇந்த வரைவு உண்மையான வாடிக்கையாளர் பதிவை அனுமதிக்காது.",
    digest: "fecf896cb061f57d994024b31e96a08e49e707fd25159b0b79ccd46ff994b1a7",
  },
};
