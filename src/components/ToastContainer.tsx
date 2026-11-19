import React from "react";
import { CheckCircle2, Info, AlertTriangle, RefreshCw, X } from "lucide-react";
import { ToastItem } from "../types";

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notificações"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[430px] z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const tone = toast.tone || "success";
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-xl px-4 py-3 border shadow-xl shadow-slate-900/12 dark:shadow-black/70 backdrop-blur-md flex items-start gap-3 text-sm transition-all ${
              tone === "warning"
                ? "bg-amber-50/95 dark:bg-[#1C1612]/95 border-amber-300 dark:border-amber-500/60 text-amber-950 dark:text-amber-100"
                : tone === "info"
                ? "bg-white/95 dark:bg-[#151518]/95 border-[#CBD5E1] dark:border-[#3A3A42] text-[#0F172A] dark:text-white"
                : "bg-white/95 dark:bg-[#151518]/95 border-[#FF6B00]/60 text-[#0F172A] dark:text-white"
            }`}
          >
            {tone === "warning" ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            ) : tone === "info" ? (
              <Info className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-medium leading-snug break-words">{toast.message}</p>
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    const action = toast.onAction;
                    onDismiss(toast.id);
                    action?.();
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-lg bg-[#FF6B00] hover:bg-[#F97316] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{toast.actionLabel}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Fechar notificação"
              className="text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
