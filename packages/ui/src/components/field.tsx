import type { ComponentProps } from "react";
import { cn } from "../lib/utils";

function Field({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="field" className={cn("ui-field", className)} {...props} />
  );
}
function FieldLabel({
  htmlFor,
  children,
  ...props
}: ComponentProps<"label"> & { htmlFor: string }) {
  return (
    <label
      data-slot="field-label"
      className="font-medium"
      htmlFor={htmlFor}
      {...props}
    >
      {children}
    </label>
  );
}
function FieldDescription(props: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className="text-sm text-muted-foreground"
      {...props}
    />
  );
}
function FieldError(props: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      className="text-sm text-destructive"
      {...props}
    />
  );
}

export { Field, FieldDescription, FieldError, FieldLabel };
