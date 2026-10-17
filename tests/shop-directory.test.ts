import {
  directoryCommandSchema,
  directoryDraftSchema,
  summarizeDirectory,
} from "@aarili/contracts/shop-directory";
import { describe, expect, it } from "vitest";

const id = "00000000-0000-7000-8000-000000000001";
const account = {
  kind: "account" as const,
  label: "Synthetic family",
  active: true,
  method: "upi" as const,
  recipient: "family" as const,
  upiId: "synthetic@invalid",
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  ifsc: "",
};
const draft = (content: unknown) => ({
  entryId: id,
  baseVersion: 0,
  baseRevisionId: null,
  content,
});
describe("SET-07/08 SS-03 receiving and vendor configuration", () => {
  it("retains incomplete server drafts but rejects incomplete publication", () => {
    expect(
      directoryDraftSchema.safeParse(draft({ ...account, upiId: "" })).success,
    ).toBe(true);
    expect(
      directoryCommandSchema.safeParse(draft({ ...account, upiId: "" }))
        .success,
    ).toBe(false);
    expect(directoryCommandSchema.safeParse(draft(account)).success).toBe(true);
  });
  it("rejects hidden identifiers from a different method and unsupported settings", () => {
    expect(
      directoryCommandSchema.safeParse(draft({ ...account, method: "cash" }))
        .success,
    ).toBe(false);
    expect(
      directoryCommandSchema.safeParse(
        draft({ ...account, password: "secret" }),
      ).success,
    ).toBe(false);
    expect(
      directoryCommandSchema.safeParse(
        draft({ kind: "methods", enabled: ["upi", "upi"] }),
      ).success,
    ).toBe(false);
    expect(
      directoryCommandSchema.safeParse(draft({ kind: "methods", enabled: [] }))
        .success,
    ).toBe(true);
  });
  it("allows one vendor to supply materials and craft without duplicated identity", () => {
    const vendor = {
      kind: "vendor",
      label: "Synthetic artisan",
      active: true,
      phone: "",
      capability: "Aari",
      artisan: true,
      supplier: true,
    };
    expect(directoryCommandSchema.safeParse(draft(vendor)).success).toBe(true);
    expect(
      directoryCommandSchema.safeParse(
        draft({ ...vendor, artisan: false, supplier: false }),
      ).success,
    ).toBe(false);
  });
  it("masks overview identifiers and excludes contacts", () => {
    const r = {
      id,
      entryId: id,
      version: 1,
      previousId: null,
      actorId: id,
      effectiveAt: "2026-10-17T00:00:00.000Z",
      originDraftId: id,
      content: account,
    };
    const summary = summarizeDirectory(r);
    expect(summary.maskedIdentifier).toBe("••••@invalid");
    expect(JSON.stringify(summary)).not.toContain("synthetic@invalid");
    expect(summary).not.toHaveProperty("phone");
  });
});
