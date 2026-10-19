import { randomUUID } from "node:crypto";
import {
  emptyServiceTemplateContent,
  presentServiceRequirements,
  serviceTemplatesCommandSchema,
  serviceTemplatesDraftSchema,
  templateSections,
} from "@aarili/contracts/service-templates";
import { previewServiceRequirements } from "@aarili/core/service-templates";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const row = (key: string) => ({
  key,
  labelEn: key,
  labelTa: "செயற்கை",
  required: true,
  applicability: "applicable" as const,
  applicabilityReason: "",
  scope: { pieceKey: null, addonKey: null },
  instructionEn: "",
  instructionTa: "",
});
function task(
  v: {
    tasks: {
      key: string;
      labelEn: string;
      labelTa: string;
      required: boolean | null;
      applicability: "unresolved" | "applicable" | "not-applicable";
      applicabilityReason: string;
      scope: { pieceKey: string | null; addonKey: string | null };
      instructionEn: string;
      instructionTa: string;
      milestone: "cutting" | "work" | "trial" | "ready";
      assignee: "owner";
      predecessors: string[];
      prerequisites: (
        | "design"
        | "measurement"
        | "manual-method"
        | "material"
        | "quality"
      )[];
    }[];
  },
  n: number,
) {
  const t = v.tasks[n];
  if (!t) throw Error("Missing fixture task");
  return t;
}
const value = () => {
  const c = emptyServiceTemplateContent();
  c.code = "synthetic";
  c.labelEn = "Synthetic";
  c.labelTa = "செயற்கை";
  c.service = { entryId: randomUUID(), revisionId: randomUUID() };
  for (const name of templateSections)
    c.sections[name] = {
      decision: "not-applicable",
      reason: `SYNTHETIC ${name} not needed`,
    };
  c.sections.tasks = { decision: "applicable", reason: "" };
  c.tasks = [
    {
      ...row("craft"),
      milestone: "work",
      assignee: "owner",
      predecessors: [],
      prerequisites: [],
    },
    {
      ...row("cut"),
      milestone: "cutting",
      assignee: "owner",
      predecessors: ["craft"],
      prerequisites: [],
    },
  ];
  return {
    entryId: randomUUID(),
    baseVersion: 0,
    baseRevisionId: null,
    operation: "definition" as const,
    content: c,
    available: false,
    reason: "SYNTHETIC review",
  };
};
describe("ST-03/04/07 bounded manifests and honest requirements", () => {
  it("ST-05/06 property: repeated disclosure switches retain exact canonical definitions, dependencies, unresolved values and actor", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 2, maxLength: 80 }),
        fc.integer({ min: 1, max: 30 }),
        async (switches, n) => {
          const c = value().content;
          c.tasks = Array.from({ length: n }, (_, i) => ({
            ...row(`task-${i}`),
            milestone: i % 2 ? ("work" as const) : ("cutting" as const),
            assignee: "owner" as const,
            predecessors: i ? [`task-${i - 1}`] : [],
            prerequisites: ["measurement" as const],
          }));
          const actorId = randomUUID();
          const ctx = {
            actorId,
            forms: { repository: { definition: async () => undefined } },
            repository: { definition: async () => undefined },
            catalogue: { repository: { definition: async () => undefined } },
          };
          const canonical = await previewServiceRequirements(ctx, c),
            snapshot = JSON.stringify(canonical);
          for (const detailed of switches) {
            const view = presentServiceRequirements(
              canonical,
              detailed ? "detailed" : "simple",
            );
            expect(JSON.stringify(canonical)).toBe(snapshot);
            expect(
              view.items
                .filter((x) => x.section === "tasks")
                .every((x) => x.assigneeId === actorId),
            ).toBe(true);
            expect(
              view.items.filter((x) => x.required && x.state === "unresolved"),
            ).toEqual(
              canonical.items.filter(
                (x) => x.required && x.state === "unresolved",
              ),
            );
            expect(
              view.milestones
                .filter((m) => m.state === "lifecycle")
                .map((m) => m.key),
            ).toEqual(["booked", "handed-over"]);
          }
          expect(canonical.definition).toEqual(c);
          expect(
            canonical.milestones.find((m) => m.key === "trial")?.state,
          ).toBe("not-applicable");
          expect(canonical.items.every((x) => x.state === "unresolved")).toBe(
            true,
          );
        },
      ),
      { numRuns: 50 },
    );
  });
  it("keeps incomplete draft distinct from publishable not-applicable decisions", () => {
    const v = { ...value(), content: emptyServiceTemplateContent() };
    expect(serviceTemplatesDraftSchema.safeParse(v).success).toBe(true);
    expect(serviceTemplatesCommandSchema.safeParse(v).success).toBe(false);
    expect(serviceTemplatesCommandSchema.safeParse(value()).success).toBe(true);
    const missingReason = value();
    missingReason.content.sections.materials.reason = "";
    expect(serviceTemplatesCommandSchema.safeParse(missingReason).success).toBe(
      false,
    );
  });
  it("permits independently reviewed craft before or after cutting and parallel tasks", () => {
    for (const before of [true, false]) {
      const v = value();
      task(v.content, 0).predecessors = before ? [] : ["cut"];
      task(v.content, 1).predecessors = before ? ["craft"] : [];
      v.content.tasks.push({
        ...task(v.content, 0),
        key: "parallel",
        predecessors: [],
      });
      expect(serviceTemplatesCommandSchema.safeParse(v).success).toBe(true);
    }
  });
  it("rejects duplicate keys, self/missing edges, cycles and optional predecessor bypass", () => {
    for (const change of [
      (v: ReturnType<typeof value>) => {
        task(v.content, 0).predecessors = ["craft"];
      },
      (v: ReturnType<typeof value>) => {
        task(v.content, 0).predecessors = ["missing"];
      },
      (v: ReturnType<typeof value>) => {
        task(v.content, 0).predecessors = ["cut"];
      },
      (v: ReturnType<typeof value>) => {
        task(v.content, 0).required = false;
      },
      (v: ReturnType<typeof value>) => {
        task(v.content, 1).key = "craft";
      },
    ]) {
      const v = value();
      change(v);
      expect(serviceTemplatesCommandSchema.safeParse(v).success).toBe(false);
    }
  });
  it("allows only supported customer tokens and excludes scripts and internal text", () => {
    for (const text of [
      "{{margin}}",
      "{{constructor}}",
      "{{price_basis.value}}",
      "<script>x</script>",
      "javascript:alert(1)",
      "private margin",
      "லாபம்",
    ]) {
      const v = value();
      v.content.sections.confirmation.decision = "applicable";
      v.content.confirmation = [
        { ...row("summary"), topic: "price-basis", instructionEn: text },
      ];
      expect(serviceTemplatesCommandSchema.safeParse(v).success).toBe(false);
    }
    const v = value();
    v.content.sections.confirmation.decision = "applicable";
    v.content.confirmation = [
      {
        ...row("summary"),
        topic: "date",
        instructionEn: "{{ready_date}} {{price_basis}}",
      },
    ];
    expect(serviceTemplatesCommandSchema.safeParse(v).success).toBe(true);
  });
  it("ST-04 required work cannot bypass a predecessor scoped to unselected optional work", () => {
    const v = value();
    v.content.addons.push({
      entryId: randomUUID(),
      revisionId: randomUUID(),
      key: "optional-craft",
      applicability: "not-applicable",
      reason: "Reviewed not selected",
    });
    task(v.content, 0).scope.addonKey = "optional-craft";
    task(v.content, 0).applicability = "unresolved";
    expect(serviceTemplatesCommandSchema.safeParse(v).success).toBe(false);
  });
  it("ST-04 property: every forward DAG is valid and a back edge produces a cycle", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 40 }), (n) => {
        const v = value();
        v.content.tasks = Array.from({ length: n }, (_, i) => ({
          ...row(`task-${i}`),
          milestone: "work",
          assignee: "owner",
          predecessors: i ? [`task-${i - 1}`] : [],
          prerequisites: [],
        }));
        expect(serviceTemplatesCommandSchema.safeParse(v).success).toBe(true);
        task(v.content, 0).predecessors = [`task-${n - 1}`];
        expect(serviceTemplatesCommandSchema.safeParse(v).success).toBe(false);
      }),
      { numRuns: 60 },
    );
  });
  it("ST-03/12 preview never invents completion, price/date or optional not-required state", async () => {
    const v = value();
    task(v.content, 0).required = false;
    task(v.content, 0).applicability = "unresolved";
    v.content.confirmation = [
      {
        ...row("summary"),
        topic: "date",
        instructionEn: "{{ready_date}} {{price_basis}}",
      },
    ];
    const ctx = {
      actorId: randomUUID(),
      forms: { repository: { definition: async () => undefined } },
      repository: { definition: async () => undefined },
      catalogue: { repository: { definition: async () => undefined } },
    };
    const preview = await previewServiceRequirements(ctx, v.content);
    expect(preview.effects).toBe("none");
    expect(preview.activation).toBe("unavailable");
    expect(preview.items.every((x) => x.state === "unresolved")).toBe(true);
    expect(
      preview.items.find((x) => x.key === "summary")?.unresolvedTokens,
    ).toEqual(["ready_date", "price_basis"]);
    const old = preview.fingerprint;
    v.content.labelTa = "மாற்றம்";
    expect(
      (await previewServiceRequirements(ctx, v.content)).fingerprint,
    ).not.toBe(old);
    const c = value().content;
    task(c, 0).applicability = "not-applicable";
    expect((await previewServiceRequirements(ctx, c)).items[0]?.state).toBe(
      "unresolved",
    );
    task(c, 0).applicabilityReason = "Reviewed no craft";
    expect((await previewServiceRequirements(ctx, c)).items[0]?.state).toBe(
      "not-required",
    );
    c.tasks = [];
    expect(
      (await previewServiceRequirements(ctx, c)).milestones
        .filter((m) => m.state !== "lifecycle")
        .every((m) => m.state === "unresolved"),
    ).toBe(true);
  });
});
