import type { CSSProperties } from "react";
import type { Feature } from "@/lib/landing/copy";

/**
 * Lightweight placeholder loops for the feature popouts (docs/FRONTEND.md
 * §2): pure CSS/SVG, seamless infinite cycles, a few hundred bytes each.
 * B6.3 swaps these for real Hyperframes renders — Thalon rendering its own
 * demos — behind the same `FeatureLoop` seam, so only this file changes.
 */

function cycle(delaySec: number, periodSec = 6, name = "vignette-glow"): CSSProperties {
  return { animation: `${name} ${periodSec}s ease-in-out ${delaySec}s infinite both` };
}

/** Rising trend cards with an outlier badge — the intel story. */
function IntelLoop() {
  return (
    <div className="flex h-full items-center justify-center gap-3 p-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-24 rounded-lg border bg-background/70 p-2.5 sm:w-28">
          <svg viewBox="0 0 60 24" className="w-full" aria-hidden="true">
            <polyline
              points={i === 1 ? "2,20 16,17 30,12 44,8 58,2" : "2,18 16,16 30,14 44,12 58,9"}
              fill="none"
              stroke={i === 1 ? "var(--primary)" : "var(--muted-foreground)"}
              strokeWidth="2"
              strokeLinecap="round"
              className={i === 1 ? "anim-dash" : undefined}
            />
          </svg>
          <div className="mt-2 h-1.5 w-4/5 rounded bg-muted" />
          <div className="mt-1 h-1.5 w-3/5 rounded bg-muted" />
          {i === 1 && (
            <span
              className="u-eyebrow mt-2 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-primary"
              style={cycle(0.6, 4, "vignette-pulse")}
            >
              rising
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** One prompt line, three format chips taking shape — the create story. */
function CreateLoop() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <p className="anim-caret font-mono text-sm text-foreground">
        <span className="text-primary">›</span> one prompt
      </p>
      <div className="flex gap-3">
        {["post", "video", "page"].map((f, i) => (
          <span
            key={f}
            className="u-eyebrow rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary"
            style={cycle(i * 0.9, 5.4, "vignette-pulse")}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A judged draft radiating to platform dots — the everywhere story. */
function EverywhereLoop() {
  return (
    <div className="flex h-full items-center justify-center gap-5 p-6">
      <div className="w-28 rounded-lg border border-primary/30 bg-background/70 p-2.5">
        <div className="flex items-center gap-1">
          <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
            <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="var(--primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="u-eyebrow text-primary">approved</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded bg-muted" />
        <div className="mt-1 h-1.5 w-2/3 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["in", "x", "ig", "fb", "tt", "yt"].map((p, i) => (
          <span
            key={p}
            className="flex size-8 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[10px] text-primary"
            style={cycle(i * 0.5, 6, "vignette-pulse")}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FeatureLoop({ feature }: { feature: Feature["key"] }) {
  if (feature === "intel") return <IntelLoop />;
  if (feature === "create") return <CreateLoop />;
  return <EverywhereLoop />;
}
