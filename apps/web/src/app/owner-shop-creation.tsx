import { completeOwnerShop } from "@aarili/api/client";
import { createOwnerShopSchema } from "@aarili/contracts";
import { Button } from "@aarili/ui/components/button";
import { useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";
import type { OwnerRequest } from "./owner-feedback";
import { focusInvalid, OwnerField, validationErrors } from "./owner-fields";
import type { createOwnerQueries } from "./owner-query";

export function ShopCreation({
  suggestedName,
  queries,
  request,
  completed,
  onNameChange,
}: {
  suggestedName?: string | undefined;
  queries: ReturnType<typeof createOwnerQueries>;
  request: OwnerRequest;
  completed: (shop: Awaited<ReturnType<typeof queries.shop>>) => void;
  onNameChange: (value: string) => void;
}) {
  const t = useTranslations();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const attempt = useRef({ name: "", key: "" });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = createOwnerShopSchema.safeParse({
      shopName: String(new FormData(form).get("shopName") ?? ""),
    });
    if (!input.success) {
      const next = validationErrors(input.error.issues);
      setErrors(next);
      focusInvalid(form, next);
      return;
    }
    setErrors({});
    void request.run(async () => {
      const expected = queries.version();
      if (attempt.current.name !== input.data.shopName)
        attempt.current = {
          name: input.data.shopName,
          key: crypto.randomUUID(),
        };
      try {
        await completeOwnerShop(input.data, attempt.current.key);
      } catch (error) {
        // A dropped response may already have committed. Resolve current state
        // before offering retry, without automatically resubmitting a command.
        try {
          const current = await queries.shop();
          if (
            queries.isCurrent(expected) &&
            current.state === "complete" &&
            current.name === input.data.shopName
          ) {
            request.cleared();
            completed(current);
            return;
          }
        } catch {
          /* Original request failure remains the actionable signal. */
        }
        throw error;
      }
      const current = await queries.shop();
      if (queries.isCurrent(expected)) {
        request.cleared();
        completed(current);
      }
    });
  }
  return (
    <form
      method="post"
      noValidate
      className="owner-form access-form"
      onSubmit={submit}
      onInput={() => {
        request.changed();
        setErrors({});
        request.setFailure("");
      }}
    >
      <OwnerField
        id="shopName"
        autoComplete="organization"
        hint="shopNameHelp"
        defaultValue={suggestedName}
        onValueChange={onNameChange}
        error={errors.shopName}
      />
      <Button type="submit" disabled={request.busy}>
        {t(request.busy ? "working" : "openShop")}
      </Button>
    </form>
  );
}
