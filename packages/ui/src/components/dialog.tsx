"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

function DialogContent({
  className,
  children,
  closeLabel,
  closeDisabled = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  closeLabel: string;
  closeDisabled?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="ui-dialog-overlay" />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn("ui-dialog", className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          disabled={closeDisabled}
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
            />
          }
          aria-label={closeLabel}
        >
          <XIcon aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
};
