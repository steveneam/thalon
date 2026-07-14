"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CapturedEdit } from "@/lib/staged-flow/types";

interface CaptureLogProps {
  captures: CapturedEdit[];
}

/**
 * The telemetry strip: every interaction on this surface became an
 * edit_diff row (verbatim RFC-6902 payload) — visible so the wiring is
 * felt, not trusted. Advanced-mode captures are what train one-prompt
 * mode's defaults.
 */
export function CaptureLog({ captures }: CaptureLogProps) {
  const [open, setOpen] = useState(false);
  const recent = open ? [...captures].reverse() : [];

  return (
    <section aria-label="Captured edits" className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {captures.length} {captures.length === 1 ? "interaction" : "interactions"} captured as
          replayable edit records — advanced-mode telemetry trains one-prompt defaults.
        </p>
        {captures.length > 0 && (
          <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((prev) => !prev)}>
            {open ? "Hide" : "Show"}
          </Button>
        )}
      </div>
      {open && (
        <ul className="flex flex-col gap-1">
          {recent.map((capture) => (
            <li key={capture.id} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-mono text-2xs">{capture.kind}</Badge>
              <span className="font-mono text-2xs">{capture.stageKey}</span>
              {capture.note && <span>{capture.note}</span>}
              <span className="text-2xs">
                {capture.patch.length} op{capture.patch.length === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
