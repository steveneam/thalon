"use client";

import { useEffect, useState } from "react";

/**
 * B-ve.3 editor field: a labelled number input that keeps local text state
 * and COMMITS on blur/Enter (the direction-editor idiom) — half-typed values
 * never reach the EDL, and the committed value round-trips back into the
 * field. Timeline numbers are seconds unless the label says otherwise.
 */
export function NumField({
  label,
  value,
  onCommit,
  step = 0.1,
  min,
  className = "w-24",
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  min?: number;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  // Committed-value changes (a swap, a save round-trip) reset the draft text —
  // adjusted during render, not in an effect (react.dev/you-might-not-need-an-effect).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }
  const commit = () => {
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || text.trim() === "") {
      setText(String(value));
      return;
    }
    onCommit(parsed);
  };
  return (
    <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {label}
      <input
        type="number"
        step={step}
        min={min}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`u-tabular rounded-md border border-border bg-background p-1.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${className}`}
      />
    </label>
  );
}
