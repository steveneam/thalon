"use client";

import { useState } from "react";
import type { MediaResolution } from "@/lib/media/resolve";
import "@/components/media/source-thumb.css";

/**
 * `<SourceThumb>` — the one thumbnail component (B-media.0, spec: the
 * founder-verdicted `mock-sheets/Source Media.dc.html`).
 *
 * It replaces the hand-rolled `<img>` in `transcription.tsx`,
 * `intel/rising-card.tsx` and `intel/dossier-card.tsx`, which had grown three
 * copies of the same block and NONE of them an `onError` — so a dead poster
 * painted a browser broken-image glyph inside the striped box, the one state
 * that reads as a bug rather than an honesty.
 *
 * **Rule 6 discipline, and the reason this renders `thumb-sm` rather than the
 * sheet's own `.tb`:** `.thumb-sm`/`.thumb-md` are shared shell classes that
 * four surfaces legitimately override — Approve nudges its margin, the editor
 * re-sizes takes to 118×68, the video dossier to 52×33, the site dossier to
 * 148×92. Consolidating the `<img>` must not flatten sizing a surface has
 * earned, so the shared box class is what gets rendered and every new state
 * hangs off the additive `.src-thumb` hook. `workspace.css` is untouched.
 */

export type SourceThumbSize = "sm" | "md" | "lg";

export interface SourceThumbProps {
  resolution: MediaResolution;
  /** The word inside an empty box — "video", "article", the trend's own label. */
  legend?: string;
  size?: SourceThumbSize;
}

export function SourceThumb({ resolution, legend = "media", size = "sm" }: SourceThumbProps) {
  /**
   * `broken` is detected at the EDGE, not probed: no checker daemon, no new
   * table, no HEAD request per row. The image either loads or it doesn't, and
   * `onError` is the whole cost of telling those two apart.
   */
  const [failed, setFailed] = useState(false);
  const src = resolution.state === "resolved" ? resolution.src : null;

  // A row recycled to different media must not inherit the previous src's
  // failure — otherwise one dead poster poisons every row that reuses the
  // node. Adjusted DURING render (React's documented pattern for resetting
  // state when a prop changes) rather than in an effect: an effect would
  // paint the stale broken box for a frame first, then cascade a re-render.
  const [seenSrc, setSeenSrc] = useState(src);
  if (src !== seenSrc) {
    setSeenSrc(src);
    setFailed(false);
  }

  const box = `thumb-${size} src-thumb`;

  if (resolution.state === "loading") {
    return (
      <div className={`${box} src-thumb-load`} aria-busy="true">
        <span className="src-thumb-shimmer" />
      </div>
    );
  }

  if (resolution.state === "broken" || (resolution.state === "resolved" && failed)) {
    return <BrokenBox className={box} />;
  }

  if (resolution.state === "empty") {
    // The shared class already paints the stripe, so empty is the bare box —
    // which is exactly what ships today and what the sheet keeps.
    return (
      <div className={box}>
        <span>{legend}</span>
      </div>
    );
  }

  const portrait = resolution.orientation === "portrait";
  const alt = resolution.envelope.alt;

  return (
    <div className={box}>
      {/*
        Portrait media is CONTAINED against a blurred dim of itself, never
        cover-cropped: a 9:16 Short cropped into a 1.6 box loses ~65% of its
        height and reliably decapitates the subject. Landscape keeps cover —
        it loses ~10% of its width, inside the central-80% safe area creators
        already design for. The box never changes size either way, so a list
        of forty rows holds its rhythm.
      */}
      {portrait && (
        // eslint-disable-next-line @next/next/no-img-element -- remote platform media, unoptimized by design
        <img className="src-thumb-backdrop" src={resolution.src} alt="" aria-hidden="true" loading="lazy" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- remote platform media, unoptimized by design */}
      <img
        className={portrait ? "src-thumb-contain" : "src-thumb-cover"}
        src={resolution.src}
        // Absent alt means decorative, and decorative means hidden from the
        // reader rather than announced as an unlabelled image.
        alt={alt ?? ""}
        {...(alt ? {} : { "aria-hidden": true as const })}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/** "We had a poster and it died" — deliberately unlike the striped never-had-one box. */
function BrokenBox({ className }: { className: string }) {
  return (
    <div className={`${className} src-thumb-broken`} title="The poster this source carried is no longer reachable.">
      <span className="src-thumb-legend">
        <span className="src-thumb-slash" />
        gone
      </span>
    </div>
  );
}
