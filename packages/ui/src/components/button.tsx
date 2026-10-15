"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "ui-button inline-flex items-center justify-center gap-2 border border-transparent font-medium disabled:cursor-not-allowed [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:enabled:bg-accent hover:enabled:text-accent-foreground",
        outline:
          "border-input bg-card text-card-foreground hover:enabled:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:enabled:bg-accent",
        ghost: "text-foreground hover:enabled:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:enabled:bg-error hover:enabled:text-error-foreground",
      },
      size: { default: "", icon: "ui-button-icon" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
