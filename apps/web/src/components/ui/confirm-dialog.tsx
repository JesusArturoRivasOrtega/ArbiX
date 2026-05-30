"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0a0d12]/96 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)] animate-toast-in">
        <div className="flex items-start gap-3">
          <div
            className={
              destructive
                ? "flex h-9 w-9 items-center justify-center rounded-md border border-danger/35 bg-danger/10"
                : "flex h-9 w-9 items-center justify-center rounded-md border border-warning/35 bg-warning/10"
            }
          >
            <AlertTriangle className={destructive ? "h-4 w-4 text-danger" : "h-4 w-4 text-warning"} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">{title}</h3>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "default"} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
