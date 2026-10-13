import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

const cardVariants = cva("ui-card", {
  variants: { density: { default: "", dense: "ui-card-dense" } },
  defaultVariants: { density: "default" },
});
function Card({
  className,
  density,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ density }), className)}
      {...props}
    />
  );
}
function DenseRow({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="row" className={cn("ui-row", className)} {...props} />;
}

export { Card, DenseRow };
