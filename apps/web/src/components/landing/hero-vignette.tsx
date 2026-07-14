import type { CSSProperties } from "react";
import { BrandMark } from "@/components/brand/marks";

/**
 * The hero's animated product vignette (docs/FRONTEND.md §2 [+]): a prompt
 * materializes → three artifacts fan out → the judge ticks → approve → the
 * platforms light up. Pure CSS/SVG on a shared 12s loop — ZERO client JS,
 * server-rendered into the static shell, halted by prefers-reduced-motion
 * (globals.css). Decorative: the copy beside it tells the same story, so
 * the whole scene is aria-hidden.
 */

const LOOP = "12s";

/** One beat on the shared loop. */
function beat(delaySec: number, name = "vignette-appear"): CSSProperties {
  return { animation: `${name} ${LOOP} cubic-bezier(0.22, 1, 0.36, 1) ${delaySec}s infinite both` };
}

function ArtifactCard({ label, delaySec }: { label: string; delaySec: number }) {
  return (
    <div style={beat(delaySec)} className="rounded-lg border bg-background/60 p-3">
      <p className="u-eyebrow text-primary">{label}</p>
      <div className="mt-2.5 space-y-1.5">
        <div className="h-1.5 w-full rounded bg-muted" />
        <div className="h-1.5 w-4/5 rounded bg-muted" />
        <div className="h-1.5 w-3/5 rounded bg-muted" />
      </div>
    </div>
  );
}

function JudgeTick({ label, delaySec }: { label: string; delaySec: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={beat(delaySec)}>
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
        <path
          d="M3 8.5 L6.5 12 L13 4.5"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="24"
          style={beat(delaySec, "vignette-draw")}
        />
      </svg>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

const PLATFORM_DOTS = ["in", "x", "ig", "fb", "tt", "yt"];

export function HeroVignette() {
  return (
    <div data-vignette aria-hidden="true" className="relative">
      {/* amber bloom behind the deck */}
      <div className="absolute -inset-8 rounded-[2rem] bg-[radial-gradient(55%_55%_at_50%_40%,oklch(0.78_0.14_76/12%),transparent_70%)]" />

      <div className="relative rounded-xl border bg-card/85 shadow-[0_24px_80px_-24px_oklch(0_0_0/60%)] backdrop-blur">
        {/* deck chrome */}
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <BrandMark className="size-3.5 text-primary" />
          <span className="u-eyebrow text-muted-foreground">thalon · run</span>
          <span className="u-eyebrow ml-auto inline-flex items-center gap-1.5 text-primary">
            <span
              className="size-1.5 rounded-full bg-primary"
              style={{ animation: `vignette-pulse 2.4s ease-in-out infinite` }}
            />
            live
          </span>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {/* beat 1 — the prompt */}
          <p style={beat(0.3)} className="anim-caret font-mono text-sm text-foreground">
            <span className="text-primary">›</span> announce the v2 launch
          </p>

          {/* beat 2 — three artifacts fan out */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <ArtifactCard label="Post" delaySec={1.3} />
            <ArtifactCard label="Video" delaySec={1.65} />
            <ArtifactCard label="Page" delaySec={2.0} />
          </div>

          {/* beat 3 — the judge gate */}
          <div
            style={beat(2.9)}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
          >
            <span className="u-eyebrow text-primary">judge</span>
            <JudgeTick label="grounded" delaySec={3.3} />
            <JudgeTick label="on-voice" delaySec={3.7} />
            <JudgeTick label="denylist clean" delaySec={4.1} />
          </div>

          {/* beat 4 — approve, then the platforms light up */}
          <div className="flex items-center justify-between gap-3">
            <span
              style={beat(5.0)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-4px] shadow-primary/50"
            >
              Approve
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                <path d="M2 6h7M6 2.5 9.5 6 6 9.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex items-center gap-1.5 sm:gap-2" style={beat(5.4)}>
              {PLATFORM_DOTS.map((p, i) => (
                <span key={p} className="relative flex size-7 items-center justify-center rounded-full border bg-background font-mono text-2xs text-muted-foreground">
                  {p}
                  <span
                    className="absolute inset-0 flex items-center justify-center rounded-full border border-primary/60 bg-primary/15 font-mono text-2xs text-primary"
                    style={beat(5.9 + i * 0.28, "vignette-glow")}
                  >
                    {p}
                  </span>
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
