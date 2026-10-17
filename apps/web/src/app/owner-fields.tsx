import { Button } from "@aarili/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@aarili/ui/components/field";
import { Input } from "@aarili/ui/components/input";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function OwnerField({
  id,
  type = "text",
  autoComplete = "off",
  hint,
  error,
  defaultValue,
  onValueChange,
}: {
  id: string;
  type?: string;
  autoComplete?: string;
  hint?: string | undefined;
  error?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
}) {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);
  const password = type === "password" && id !== "token";
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t(id)}</FieldLabel>
      <div className={password ? "access-password" : undefined}>
        <Input
          id={id}
          name={id}
          type={password && visible ? "text" : type}
          autoComplete={autoComplete}
          required
          defaultValue={defaultValue}
          onChange={(event) => onValueChange?.(event.target.value)}
          maxLength={
            id === "password" || id === "newPassword"
              ? 128
              : id === "email"
                ? 254
                : id === "token"
                  ? 512
                  : id === "code"
                    ? 256
                    : id === "resetCode"
                      ? 24
                      : 120
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [hint && `${id}-hint`, error && `${id}-error`]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        {password && (
          <Button
            type="button"
            variant="ghost"
            aria-controls={id}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {t(visible ? "hidePassword" : "showPassword")}
          </Button>
        )}
      </div>
      {hint && <FieldDescription id={`${id}-hint`}>{t(hint)}</FieldDescription>}
      {error && <FieldError id={`${id}-error`}>{t(error)}</FieldError>}
    </Field>
  );
}

export function validationErrors(issues: { path: PropertyKey[] }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const id = String(issue.path[0] ?? "");
    errors[id] =
      id === "email"
        ? "invalidEmail"
        : id === "password" || id === "newPassword"
          ? "passwordHelp"
          : id === "name" || id === "shopName"
            ? "invalidName"
            : "invalidCode";
  }
  return errors;
}
export function focusInvalid(
  form: HTMLFormElement,
  errors: Record<string, string>,
) {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement && errors[element.name]) {
      element.focus();
      break;
    }
  }
}
