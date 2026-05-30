"use client";

import { create } from "zustand";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect } from "react";

export type ToastVariant = "success" | "info" | "warning" | "danger";

type ToastItem = {
  id: string;
  title: string;
  description: string | undefined;
  variant: ToastVariant;
  createdAt: number;
};

type ToastState = {
  toasts: ToastItem[];
  push: (toast: { title: string; description?: string | undefined; variant: ToastVariant; id?: string }) => string;
  dismiss: (id: string) => void;
};

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ id, title, description, variant }) => {
    const finalId = id ?? Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts, { id: finalId, createdAt: Date.now(), title, description, variant }].slice(-4)
    }));
    return finalId;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: "success" }),
  info: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: "info" }),
  warning: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: "warning" }),
  danger: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: "danger" })
};

const VARIANT_STYLE: Record<ToastVariant, { border: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  success: { border: "border-success/35", bg: "bg-success/10", text: "text-success", icon: CheckCircle2 },
  info: { border: "border-info/35", bg: "bg-info/10", text: "text-info", icon: Info },
  warning: { border: "border-warning/35", bg: "bg-warning/10", text: "text-warning", icon: AlertTriangle },
  danger: { border: "border-danger/35", bg: "bg-danger/10", text: "text-danger", icon: AlertTriangle }
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismiss(toast.id), 4500)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
      {toasts.map((toast) => {
        const style = VARIANT_STYLE[toast.variant];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border ${style.border} ${style.bg} bg-[#0a0d12]/95 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl animate-toast-in`}
          >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{toast.title}</div>
              {toast.description ? <div className="mt-0.5 text-xs text-muted-foreground">{toast.description}</div> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
