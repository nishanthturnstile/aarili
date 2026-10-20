import {
  emptyMeasurementFormContent,
  measurementFormsCommandSchema,
} from "@aarili/contracts/measurement-forms";
import {
  emptyQuickOrder,
  quickOrderCommandSchema,
  quickOrderDraftSchema,
} from "@aarili/contracts/orders";
import { emptyCatalogueContent } from "@aarili/contracts/service-catalogue";
import { emptyServiceTemplateContent } from "@aarili/contracts/service-templates";
import {
  emptyServiceOrder,
  emptyServiceProfile,
  type ServiceProfileContent,
  type ServiceProfileRevision,
  serviceOrderCommandSchema,
  serviceOrderDraftSchema,
  serviceProfileCommandSchema,
  serviceProfileDraftSchema,
} from "@aarili/contracts/small-services";
import {
  type MeasurementFormsContext,
  measurementFormsDraftWorkflow,
} from "@aarili/core/measurement-forms";
import { previewServiceRequirements } from "@aarili/core/service-templates";
import {
  projectServiceRequirements,
  serviceCapacity,
} from "@aarili/core/small-services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const id = "019a14b0-0000-7000-8000-000000000001";
function at<T>(values: T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw Error("Fixture index missing");
  return value;
}
function profile(): ServiceProfileContent {
  return {
    ...emptyServiceProfile(id).content,
    labelEn: "Finishing",
    labelTa: "வேலை",
    manifest: { entryId: id, revisionId: id, definitionId: id },
    wearerRequirement: "not-required",
    wearerReason: "Non-fit finishing",
    capacityUnit: "garments",
    lines: [
      {
        key: "fall",
        addonKey: "fall",
        optional: false,
        taskKey: null,
        coverageKey: "saree",
        quantity: 1,
      },
      {
        key: "pico",
        addonKey: "pico",
        optional: true,
        taskKey: null,
        coverageKey: "saree",
        quantity: 1,
      },
    ],
  };
}
describe("1.2.3a / SS-01/02/09 strict service intake", () => {
  it("SS-01/05/13 reviewed alteration can omit body capture while custom stitching retains its measurement requirement", async () => {
    const command = {
      entryId: id,
      baseVersion: 0,
      baseRevisionId: null,
      operation: "definition",
      available: true,
      reason: "Reviewed intake scope",
      content: {
        ...emptyMeasurementFormContent(),
        code: "no-body-capture",
        labelEn: "No body capture",
        labelTa: "உடல் அளவுகள் இல்லை",
        service: { entryId: id, revisionId: id },
        decision: "not-required",
        decisionReason:
          "Only adjust the marked customer garment; no body values collected",
      },
    };
    for (const serviceKind of [
      "alteration",
      "small-service",
      "stitching",
    ] as const) {
      const target = {
        available: true,
        definition: {
          id,
          content: { ...emptyCatalogueContent("service"), serviceKind },
        },
      };
      const ctx = {
        shopId: id,
        actorId: id,
        synthetic: true,
        repository: {
          lock: async () => {},
          current: async () => undefined,
          codeOwner: async () => null,
          fieldSemantics: async () => [],
        },
        catalogue: {
          repository: { lock: async () => {}, current: async () => target },
        },
      } as unknown as MeasurementFormsContext;
      const revalidate = measurementFormsDraftWorkflow(ctx).revalidate(
        command,
        id,
      );
      if (serviceKind === "stitching")
        await expect(revalidate).rejects.toMatchObject({ status: 409 });
      else await expect(revalidate).resolves.toBeUndefined();
    }
    const missingReason = structuredClone(command);
    missingReason.content.decisionReason = "";
    expect(measurementFormsCommandSchema.safeParse(missingReason).success).toBe(
      false,
    );
  });
  it("SS-02/07/14 excludes only reviewed optional addon task scope without recording execution or completing active work", async () => {
    const definition = emptyServiceTemplateContent();
    definition.addons = ["fall", "pico"].map((key) => ({
      entryId: id,
      revisionId: id,
      key,
      applicability: "applicable" as const,
      reason: "Reviewed optional finishing",
    }));
    definition.sections.tasks = {
      decision: "applicable",
      reason: "Reviewed task-linked finishing",
    };
    definition.tasks = ["fall", "pico"].map((key) => ({
      key: `${key}-task`,
      labelEn: key,
      labelTa: key,
      required: true,
      applicability: "applicable" as const,
      applicabilityReason: "",
      scope: { pieceKey: null, addonKey: key },
      instructionEn: "",
      instructionTa: "",
      milestone: "work" as const,
      assignee: "owner" as const,
      predecessors: [],
      prerequisites: [],
    }));
    const original = await previewServiceRequirements(
      {
        actorId: id,
        repository: { definition: async () => undefined },
        catalogue: { repository: { definition: async () => undefined } },
        forms: { repository: { definition: async () => undefined } },
      },
      definition,
    );
    const p: ServiceProfileRevision = {
      id,
      entryId: id,
      version: 1,
      previousId: null,
      actorId: id,
      effectiveAt: "2026-10-20T00:00:00.000Z",
      originDraftId: id,
      content: profile(),
      available: true,
      reason: "Reviewed",
      authority: "synthetic-fixture",
      digest: "0".repeat(64),
    };
    const selected = await projectServiceRequirements(original, p, [
      { key: "fall", notRequired: false },
      { key: "pico", notRequired: true },
    ]);
    expect(selected.items.find((i) => i.key === "fall-task")?.state).toBe(
      "unresolved",
    );
    expect(selected.items.find((i) => i.key === "pico-task")).toMatchObject({
      state: "not-required",
      applicability: "not-applicable",
      source: `service-profile:${id}:not-selected:pico`,
    });
    expect(selected.milestones.find((m) => m.key === "work")).toMatchObject({
      state: "unresolved",
      requiredBlockers: ["fall-task"],
    });
    expect(original.items.every((i) => i.state === "unresolved")).toBe(true);
    expect(selected.definition).toEqual(original.definition);
    expect(selected.fingerprint).not.toBe(original.fingerprint);
    const allExcluded = await projectServiceRequirements(original, p, []);
    expect(allExcluded.milestones.find((m) => m.key === "work")).toMatchObject({
      state: "not-applicable",
      requiredBlockers: [],
    });
    expect(allExcluded.items.every((i) => i.state === "not-required")).toBe(
      true,
    );
    expect(
      allExcluded.milestones.find((m) => m.key === "handed-over")?.state,
    ).toBe("lifecycle");
    expect(allExcluded.effects).toBe("none");
  });
  it("SS-09 counts one physical garment coverage once across independently selected lines", () => {
    const c = profile();
    expect(
      serviceCapacity(c, [
        { key: "fall", notRequired: false },
        { key: "pico", notRequired: false },
      ]),
    ).toBe(1);
    expect(
      serviceCapacity(c, [
        { key: "pico", notRequired: false },
        { key: "fall", notRequired: false },
      ]),
    ).toBe(1);
  });
  it("SS-09 sums distinct reviewed incremental effort coverage, ignoring explicitly not-required work", () => {
    const c = profile();
    c.capacityUnit = "effort-points";
    at(c.lines, 0).coverageKey = "fall-effort";
    at(c.lines, 0).quantity = 3;
    at(c.lines, 1).coverageKey = "pico-effort";
    at(c.lines, 1).quantity = 2;
    expect(
      serviceCapacity(c, [
        { key: "fall", notRequired: false },
        { key: "pico", notRequired: false },
      ]),
    ).toBe(5);
    expect(
      serviceCapacity(c, [
        { key: "fall", notRequired: false },
        { key: "pico", notRequired: true },
      ]),
    ).toBe(3);
  });
  it("SS-09 fails closed for missing mappings, unknown units/quantities, inconsistent coverage and zero demand", () => {
    const selected = [
      { key: "fall", notRequired: false },
      { key: "pico", notRequired: false },
    ];
    let c = profile();
    c.capacityUnit = null;
    expect(serviceCapacity(c, selected)).toBeNull();
    c = profile();
    at(c.lines, 1).quantity = null;
    expect(serviceCapacity(c, selected)).toBeNull();
    c = profile();
    at(c.lines, 1).quantity = 2;
    expect(serviceCapacity(c, selected)).toBeNull();
    c = profile();
    c.lines.forEach((l) => {
      l.quantity = 0;
    });
    expect(serviceCapacity(c, selected)).toBeNull();
    expect(
      serviceCapacity(profile(), [{ key: "foreign", notRequired: false }]),
    ).toBeNull();
    expect(
      serviceCapacity(
        profile(),
        selected.map((l) => ({ ...l, notRequired: true })),
      ),
    ).toBeNull();
  });
  it("SS-09 coverage quantity is invariant to same-coverage line ordering", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000000 }), (n) => {
        const c = profile();
        c.lines.forEach((l) => {
          l.quantity = n;
        });
        expect(
          serviceCapacity(c, [
            { key: "fall", notRequired: false },
            { key: "pico", notRequired: false },
          ]),
        ).toBe(n);
        expect(
          serviceCapacity(c, [
            { key: "pico", notRequired: false },
            { key: "fall", notRequired: false },
          ]),
        ).toBe(n);
      }),
    );
  });
  it("SS-10 allows incomplete profile and order drafts while command schemas require explicit review", () => {
    const p = emptyServiceProfile(id);
    p.content.lines = [
      {
        key: "",
        addonKey: null,
        optional: false,
        taskKey: null,
        coverageKey: "",
        quantity: null,
      },
    ];
    expect(serviceProfileDraftSchema.safeParse(p).success).toBe(true);
    expect(serviceProfileCommandSchema.safeParse(p).success).toBe(false);
    expect(
      serviceOrderDraftSchema.safeParse(emptyServiceOrder(id)).success,
    ).toBe(true);
    expect(
      serviceOrderCommandSchema.safeParse(emptyServiceOrder(id)).success,
    ).toBe(false);
  });
  it("SS-09 permits a reviewed profile with unknown capacity, which intake resolution blocks", () => {
    const p = {
      ...emptyServiceProfile(id),
      content: profile(),
      reason: "Reviewed applicability; capacity unresolved",
    };
    p.content.capacityUnit = null;
    p.content.lines.forEach((l) => {
      l.quantity = null;
    });
    expect(serviceProfileCommandSchema.safeParse(p).success).toBe(true);
    expect(
      serviceCapacity(p.content, [{ key: "fall", notRequired: false }]),
    ).toBeNull();
  });
  it("SS-05 requires an exact explanation for the reviewed wearer exemption", () => {
    const p = {
      ...emptyServiceProfile(id),
      content: profile(),
      reason: "Reviewed",
    };
    expect(serviceProfileCommandSchema.safeParse(p).success).toBe(true);
    p.content.wearerReason = "";
    expect(serviceProfileCommandSchema.safeParse(p).success).toBe(false);
    p.content.wearerRequirement = "unresolved";
    expect(serviceProfileCommandSchema.safeParse(p).success).toBe(false);
  });
  it("SS-02/03 retains separate line ids and missing versus explicit zero quote", () => {
    const v = {
      ...emptyServiceOrder(id),
      customerId: id,
      profile: { entryId: id, revisionId: id },
      subjectDescription: "Blue customer saree",
      deliveryDate: "2026-12-01",
      lines: [
        {
          id,
          key: "fall",
          requestedWork: "Add fall",
          priceState: "quoted" as const,
          priceText: "0",
          notRequired: false,
          notRequiredReason: "",
        },
        {
          id: "019a14b0-0000-7000-8000-000000000002",
          key: "pico",
          requestedWork: "Pico edge",
          priceState: "to-be-quoted" as const,
          priceText: "",
          notRequired: false,
          notRequiredReason: "",
        },
      ],
    };
    expect(serviceOrderCommandSchema.safeParse(v).success).toBe(true);
    at(v.lines, 0).priceText = "";
    expect(serviceOrderCommandSchema.safeParse(v).success).toBe(false);
    at(v.lines, 0).priceText = "0";
    at(v.lines, 1).id = id;
    expect(serviceOrderCommandSchema.safeParse(v).success).toBe(false);
  });
  it("SS-13 preserves strict legacy Quick Order wearer requirement and rejects service fields", () => {
    const q = {
      ...emptyQuickOrder(),
      customerId: id,
      manifest: { entryId: id, revisionId: id, definitionId: id },
      deliveryDate: "2026-12-01",
    };
    expect(quickOrderCommandSchema.safeParse(q).success).toBe(false);
    expect(
      quickOrderCommandSchema.safeParse({ ...q, wearerId: id }).success,
    ).toBe(true);
    expect(
      quickOrderDraftSchema.safeParse({ ...q, subjectId: id }).success,
    ).toBe(false);
    expect(
      serviceOrderDraftSchema.safeParse({
        ...emptyServiceOrder(id),
        custody: "received",
      }).success,
    ).toBe(false);
  });
});
