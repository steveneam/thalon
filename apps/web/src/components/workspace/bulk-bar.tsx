"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface BulkBarProps {
  /** Size of the multi-select; the bar renders nothing at 0. */
  count: number;
  busy: boolean;
  /** The action button's content — lead with the surface's Four-Verbs word. */
  actionLabel: ReactNode;
  /**
   * The ONE named confirm (FRONTEND §0: destructive bulk ops confirm once
   * with a count, never per item). Built by the surface so it names the
   * count and the noun, e.g. `Delete 3 transcripts from the library?`.
   */
  confirmMessage: string;
  /** Four-Verbs dress: Delete wears destructive; Dismiss stays quiet outline. */
  destructive?: boolean;
  onAction: () => void;
  onClear: () => void;
}

/**
 * The ONE bulk-actions bar (s40 consistency slice; FRONTEND §0 standing QoL
 * convention). Appears when a multi-select is non-empty: the count, the mass
 * action behind one named confirm, and Clear. Leads was the precedent —
 * library (bulk Delete) and intel trends (bulk Dismiss) reuse it.
 */
export function BulkBar({
  count,
  busy,
  actionLabel,
  confirmMessage,
  destructive,
  onAction,
  onClear,
}: BulkBarProps) {
  if (count === 0) return null;
  return (
    <div
      role="group"
      aria-label="Bulk actions"
      className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2"
    >
      <span className="text-xs u-tabular">{count} selected</span>
      <Button
        size="sm"
        variant={destructive ? "destructive" : "outline"}
        disabled={busy}
        onClick={() => {
          if (window.confirm(confirmMessage)) onAction();
        }}
      >
        {actionLabel}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
