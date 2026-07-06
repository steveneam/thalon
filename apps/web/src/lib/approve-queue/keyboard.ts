/**
 * Keyboard-triage guard (B6.2 [+]): single-letter shortcuts must never fire
 * while the operator is typing. Shared by the queue (j/k/a/r) and the panel
 * (e / Escape-cancel).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
