import {
  initialShopProfile,
  shopProfileDraftSchema,
  shopProfileInputSchema,
} from "@aarili/contracts/shop-profile";
import { shopBrandingPolicy } from "@aarili/core/shop-profile";
import { describe, expect, it } from "vitest";

describe("SS-01/08 profile scope and shop-branding authority", () => {
  it("keeps incomplete optional identity unknown and rejects release activation, external logos and effective-time input", () => {
    const profile = initialShopProfile("Synthetic தமிழ் shop");
    expect(shopProfileInputSchema.parse(profile).legalName).toBe("");
    expect(
      shopProfileDraftSchema.safeParse({ ...profile, displayName: "" }).success,
    ).toBe(true);
    expect(
      shopProfileInputSchema.safeParse({ ...profile, displayName: "  " })
        .success,
    ).toBe(false);
    for (const field of [
      { currency: "USD" },
      { timezone: "UTC" },
      { billingRegime: "GST" },
      { retail: true },
      { ai: true },
      { effectiveAt: "2020-01-01T00:00:00Z" },
      { logoUrl: "https://example.test/logo.png" },
    ])
      expect(
        shopProfileInputSchema.safeParse({ ...profile, ...field }).success,
      ).toBe(false);
  });
  it("grants only the verified shop subject and retains other-purpose denial", async () => {
    const policy = shopBrandingPolicy("019a5e55-2222-7000-8000-000000000001", {
      authorize: async () => null,
    });
    const input = {
      action: "upload" as const,
      purpose: "shop-branding" as const,
      subjectId: "019A5E55-2222-7000-8000-000000000001",
      contentType: "image/png" as const,
    };
    expect(await policy.authorize(input)).toEqual({
      minor: false,
      guardianConsent: false,
    });
    expect(
      await policy.authorize({
        ...input,
        subjectId: "019a5e55-2222-7000-8000-000000000002",
      }),
    ).toBeNull();
    expect(
      await policy.authorize({ ...input, contentType: "application/pdf" }),
    ).toBeNull();
    expect(
      await policy.authorize({ ...input, purpose: "private-fitting" }),
    ).toBeNull();
  });
});
