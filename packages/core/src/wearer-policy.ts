import type { CustomerPolicy } from "@aarili/contracts/customers";
import { guardianNoticeEn, guardianNoticeTa } from "./guardian-notice-text.js";
import { wearerNoticeEn, wearerNoticeTa } from "./wearer-notice-text.js";
export const syntheticGuardianPolicy: CustomerPolicy = {
  enabled: true,
  synthetic: true,
  notice: {
    id: "019e70b1-0000-7000-8000-000000000080",
    version: "cw-guardian-draft-2026-10-17-v1",
    titleEn: "DRAFT - synthetic guardian permissions",
    titleTa: "வரைவு - செயற்கைப் பாதுகாவலர் அனுமதிகள்",
    textEn: guardianNoticeEn,
    textTa: guardianNoticeTa,
    digest: "45878879da4347a6bdf89283f1f7acf3bbc879700ccf6b504151bd0a270d92da",
  },
};
// Original bilingual review draft. No production approval or activation.
export const syntheticWearerPolicy: CustomerPolicy = {
  enabled: true,
  synthetic: true,
  notice: {
    id: "019e70b1-0000-7000-8000-000000000079",
    version: "cw-wearer-draft-2026-10-17-v1",
    titleEn: "DRAFT - synthetic wearer permissions",
    titleTa: wearerNoticeTa.split("\n")[0] ?? "DRAFT",
    textEn: wearerNoticeEn,
    textTa: wearerNoticeTa,
    digest: "293ad99464b92c1c7d9eee2bc3fddb01da3a689370cca39601303e645ee738a1",
  },
};
