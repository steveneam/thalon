"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";
import { cn } from "@/lib/utils";

/**
 * THE PREVIEW SEAM (B5.4). This component's PROPS are the stable contract;
 * its internals are a deterministic low-res stub: an aspect-correct frame
 * showing the selected scene's on-screen text / visual direction, over a
 * duration-proportional scene timeline the operator scrubs by clicking.
 *
 * Follow-up (recorded in the lane wrap): once B5.1's render driver emits
 * real HTML compositions and the lead installs `@hyperframes/player` in
 * main (a dep add is a stop-and-report, not a lane call), the stub body
 * swaps for the 3 KB `<hyperframes-player>` web component — live in-queue
 * playback with NO render — and, with `@hyperframes/sdk`, its RFC-6902
 * commit patches feed the same capture path this surface already writes.
 * Nothing outside this file changes.
 */

export interface PreviewScene {
  heading: string;
  onScreenText: string | null;
  /** The visual direction line — null until the scenes/effects stage fills it. */
  visual: string | null;
  motion: string | null;
  durationMs: number;
}

interface StagePreviewProps {
  aspect: "16:9" | "9:16" | "1:1";
  scenes: PreviewScene[];
  /** Extra chrome note, e.g. that a storyboard's aspect is set at the scenes stage. */
  note?: string;
}

const ASPECT_RATIO: Record<StagePreviewProps["aspect"], string> = {
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "1:1": "1 / 1",
};

export function StagePreview({ aspect, scenes, note }: StagePreviewProps) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const selected = scenes[Math.min(sceneIndex, scenes.length - 1)];
  const totalMs = scenes.reduce((sum, scene) => sum + scene.durationMs, 0);

  if (!selected) return null;

  return (
    <section aria-label="Stage preview" className="flex flex-col gap-2 rounded-lg border border-border p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Preview (low-res stub)</h3>
        <span className="text-[11px] text-muted-foreground">
          {aspect} · {formatMsAsClock(totalMs)}
        </span>
      </div>
      <div
        className={cn(
          "relative mx-auto flex w-full flex-col items-center justify-center overflow-hidden rounded-md border border-border bg-zinc-900 p-4 text-center",
          aspect === "9:16" && "max-w-56",
          aspect === "1:1" && "max-w-72",
        )}
        style={{ aspectRatio: ASPECT_RATIO[aspect] }}
      >
        <span className="absolute top-2 left-2 max-w-full truncate text-2xs text-zinc-500">{selected.heading}</span>
        {selected.motion && (
          <Badge variant="outline" className="absolute top-2 right-2 border-zinc-700 text-2xs text-zinc-400">
            {selected.motion}
          </Badge>
        )}
        <p className="text-lg leading-snug font-semibold break-words text-zinc-100">
          {selected.onScreenText ?? "—"}
        </p>
        <p className="absolute right-3 bottom-2 left-3 truncate text-2xs text-zinc-500 italic">
          {selected.visual ?? "visual direction pending — filled at the scenes/effects stage"}
        </p>
      </div>
      <div className="flex h-6 w-full gap-0.5" role="group" aria-label="Scene timeline">
        {scenes.map((scene, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Preview scene ${i + 1}: ${scene.heading}`}
            aria-pressed={i === sceneIndex}
            title={`${scene.heading} (${formatMsAsClock(scene.durationMs)})`}
            onClick={() => setSceneIndex(i)}
            className={cn(
              "min-w-4 rounded-sm border border-border bg-muted text-2xs text-muted-foreground transition-colors hover:bg-accent focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              i === sceneIndex && "border-ring bg-accent font-medium text-foreground",
            )}
            style={{ flexGrow: Math.max(scene.durationMs, 1) }}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </section>
  );
}
