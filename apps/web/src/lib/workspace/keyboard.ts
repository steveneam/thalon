import { useEffect } from "react";

/**
 * Keyboard-triage guard (B6.2 [+], promoted workspace-wide s40): single-letter
 * shortcuts must never fire while the operator is typing. Shared by every
 * triage list (approve j/k/a/r, leads, library) and the approve panel
 * (e / Escape-cancel).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * The ONE list keyboard grammar (s40 consistency slice — the approve queue's
 * B6.2 triage generalized): j/k move the selected row, x picks it for bulk,
 * other single letters act on it using the surface's own Four-Verbs word.
 * Central guards live here — never while typing, never with a modifier held;
 * a binding that actually acts calls `event.preventDefault()` itself, so an
 * unhandled key still scrolls/types as the browser intends.
 *
 * Re-registers per render on purpose (the approve queue's recorded rationale):
 * the listener is cheap and every closure stays fresh.
 */
export function useListKeys(opts: {
  /** Master gate — pass false while busy or while another surface owns the screen. */
  enabled: boolean;
  /** key → handler; handlers own preventDefault when they act. */
  bindings: Record<string, (event: KeyboardEvent) => void>;
}): void {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!opts.enabled || isTypingTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      opts.bindings[event.key]?.(event);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
