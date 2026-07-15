"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface ToastState {
  message: string;
  /**
   * Optional link back to where the item now lives (e.g. the Dismissed tab).
   * True undo-after-terminal rides the queued B-crm approve/reject contract
   * change — until then this is the honest cheap half: confirm + a way back,
   * never a promised "Undo" that doesn't exist.
   */
  action?: { label: string; onClick: () => void };
}

/**
 * The ONE terminal-action toast (s40 consistency slice): after an operator
 * commits a terminal verb (Approve/Reject/Dismiss/Delete), this confirms it
 * happened — essential for keyboard triage, where the only other feedback is
 * a badge quietly changing. `role="status"` announces politely; auto-clears
 * after 6s; the entrance halts under prefers-reduced-motion (.anim-toast).
 */
export function ActionToast({ toast, onClear }: { toast: ToastState | null; onClear: () => void }) {
  // Latest-callback ref so the auto-clear timer keys on the toast alone —
  // an inline onClear prop must not reset the countdown every render.
  const onClearRef = useRef(onClear);
  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => onClearRef.current(), 6_000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="anim-toast fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-md"
    >
      <span className="min-w-0">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onClear();
          }}
          className="shrink-0 font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onClear}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
