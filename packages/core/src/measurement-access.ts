import type { CustomerPolicy } from "@aarili/contracts/customers";
import type { MeasurementSessionsRepository } from "@aarili/db/repositories/measurement-sessions";
import type {
  GuardianRepository,
  WearerRepository,
} from "@aarili/db/repositories/wearers";
import { DraftFailure } from "./drafts.js";

export type MeasurementAuthority = {
  wearers: WearerRepository;
  guardians: GuardianRepository;
  measurements: MeasurementSessionsRepository;
  policy: CustomerPolicy;
};
function denied(status: 404 | 409 = 404): never {
  throw new DraftFailure(status, {
    error: {
      code: status === 404 ? "NOT_FOUND" : "REQUEST_CONFLICT",
      message: "Review current measurement and private photo authority",
    },
  });
}
export async function authorizeMeasurementIdentity(
  ctx: MeasurementAuthority,
  v: { customerId: string; wearerId: string },
  photo = false,
) {
  if (!ctx.policy.enabled || !ctx.policy.synthetic || !ctx.policy.notice)
    denied(409);
  await ctx.wearers.lockCustomer(v.customerId);
  await ctx.wearers.lockWearer(v.wearerId);
  if (!(await ctx.wearers.customer(v.customerId))) denied();
  const p = await ctx.wearers.read(v.customerId, v.wearerId);
  if (
    !p?.relationship.authorised ||
    !p.relationship.informed ||
    p.relationship.authorisationDeclined ||
    p.relationship.informedDeclined ||
    p.age === "unknown"
  )
    denied();
  if (p.age === "adult") {
    for (const purpose of photo ? ["service", "private-media"] : ["service"])
      if (
        !p.purposes.some(
          (e) => e.purpose === purpose && e.decision === "grant" && e.eligible,
        )
      )
        denied();
  } else {
    const g = await ctx.guardians.read(p.id, true);
    if (!g.authority?.verifiedCurrent) denied();
    for (const purpose of photo
      ? ["measurement", "private-photo"]
      : ["measurement"])
      if (
        !g.purposes.some(
          (e) =>
            e.purpose === purpose &&
            e.decision === "grant" &&
            e.eligible &&
            e.authorityId === g.authority?.id,
        )
      )
        denied();
  }
  if (await ctx.measurements.erased(v.wearerId)) denied();
  return p;
}
