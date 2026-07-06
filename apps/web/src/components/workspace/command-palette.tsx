"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command, CornerDownLeft } from "lucide-react";
import { buildPaletteItems, filterPalette } from "@/lib/workspace/palette";
import { cn } from "@/lib/utils";

/**
 * Cmd-K command palette (B6.2 [+]) over the ONE nav registry + actions —
 * every surface and common action, one keystroke away. Plain overlay (no
 * <dialog>) keeps focus handling simple and jsdom-testable.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setIndex(0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const filtered = filterPalette(buildPaletteItems(), query);
  const active = Math.min(index, Math.max(0, filtered.length - 1));

  function run(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Command aria-hidden className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            aria-label="Search commands"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((i) => Math.min(i + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter" && filtered[active]) {
                event.preventDefault();
                run(filtered[active].href);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Jump to a surface or action…"
            className="h-11 flex-1 bg-transparent text-sm focus:outline-none"
          />
          <kbd className="u-eyebrow text-muted-foreground">esc</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5" role="listbox" aria-label="Commands">
          {filtered.length === 0 && (
            <li className="px-2.5 py-3 text-sm text-muted-foreground">No matches.</li>
          )}
          {filtered.map((item, i) => (
            <li key={`${item.group}:${item.label}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => run(item.href)}
                onMouseMove={() => setIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
                  i === active ? "bg-accent text-accent-foreground" : "text-foreground",
                )}
              >
                <span className="flex-1">
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <span className="u-eyebrow text-muted-foreground">{item.group}</span>
                {i === active && <CornerDownLeft aria-hidden className="size-3.5 text-muted-foreground" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
