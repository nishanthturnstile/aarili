import type { CustomerPolicy } from "@aarili/contracts/customers";
import { wearerNoticeEn, wearerNoticeTa } from "./wearer-notice-text.js";
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
