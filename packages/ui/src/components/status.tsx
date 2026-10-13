import { cva, type VariantProps } from "class-variance-authority";
import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

const statusVariants = cva("ui-status", {
  variants: {
    tone: {
      success: "bg-success text-success-foreground",
      warning: "bg-warning text-warning-foreground",
      info: "bg-info text-info-foreground",
      error: "bg-error text-error-foreground",
    },
  },
  defaultVariants: { tone: "info" },
});
const icons = {
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  info: InfoIcon,
  error: CircleXIcon,
};
function Status({
  tone = "info",
  children,
  className,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof statusVariants>) {
  const Icon = icons[tone ?? "info"];
  return (
    <span
      data-slot="status"
      className={cn(statusVariants({ tone }), className)}
      {...props}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </span>
  );
}

export { Status };
