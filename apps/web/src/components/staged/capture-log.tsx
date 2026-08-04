"use client";

import { useState } from "react";
import type { CapturedEdit } from "@/lib/staged-flow/types";

interface CaptureLogProps {
  captures: CapturedEdit[];
}

/**
 * The telemetry strip: every interaction on this surface became an edit_diff
 * row (verbatim RFC-6902 payload) — visible so the wiring is felt, not
 * trusted. Advanced-mode captures are what train one-prompt mode's defaults.
 *
 * Rebuilt s101 as ONE quiet foot line rather than a bordered card. Under the
 * founder's minimal-interaction doctrine (s90) this is exactly the "extra
 * info" that should be tucked: it changes no decision the operator is making,
 * so it states its count and keeps its detail one click behind.
 */
export function CaptureLog({ captures }: CaptureLogProps) {
  const [open, setOpen] = useState(false);
  const recent = open ? [...captures].reverse() : [];

  return (
    <section aria-label="Captured edits" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="cap">
        <span className="t-data">
          {captures.length} {captures.length === 1 ? "interaction" : "interactions"} captured as
          replayable edit records
        </span>
        <div style={{ flex: 1 }} />
        {captures.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {open && (
        <ul className="cap-list">
          {recent.map((capture) => (
            <li key={capture.id} className="t-data" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "var(--act)" }}>{capture.kind}</span>
              <span>{capture.stageKey}</span>
              {capture.note && <span>{capture.note}</span>}
              <span>
                {capture.patch.length} op{capture.patch.length === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
