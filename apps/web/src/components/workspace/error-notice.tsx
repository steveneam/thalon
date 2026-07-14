"use client";

import { Button } from "@/components/ui/button";

/**
 * The one failed-read vocabulary (critique 2026-07-14, heuristic 9 — "every
 * failed fetch is a dead end"): a failure names itself AND offers the way
 * back. Surfaces pass their reload; a notice without a retry is reserved for
 * failures the operator genuinely can't re-drive from here.
 */
export function ErrorNotice({
  message,
  onRetry,
  retryLabel = "Try again",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-destructive"
    >
      <span>{message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
