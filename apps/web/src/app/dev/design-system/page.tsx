import { notFound } from "next/navigation";
import { DesignPreview } from "./preview";

export const dynamic = "force-dynamic";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <DesignPreview
      initialCandidate={
        process.env.AARILI_DESIGN_TRIAL === "grounded-editorial"
      }
    />
  );
}
