"use client";

import { useEffect, useRef, useState } from "react";
import type { AudioCue, Edl } from "@thalon/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mediaUrl } from "@/lib/videos/client";
import { NumField } from "./num-field";

/**
 * B-ve.3 music lane: the measured-alignment op (s44 method) as UI. One cue,
 * three knobs — source offset, STATIC gain, anti-click tail easing — over a
 * wavesurfer waveform (charter seat, BSD-3). Clicking the waveform sets the
 * offset (the in-point) and auditions from it; the amber marker is the
 * signal channel showing where the cut enters the track. `copy` mode is a
 * verbatim stream-copy — no knobs, by contract.
 */

/** The wavesurfer surface this lane uses (v7); dynamic-imported so the editor bundle stays lean. */
interface WaveSurferHandle {
  destroy(): void;
  getDuration(): number;
  setTime(seconds: number): void;
  playPause(): Promise<void> | void;
  on(event: "interaction" | "ready", cb: (value: number) => void): void;
}

export function MusicLane({
  projectId,
  edl,
  playable,
  onPatch,
}: {
  projectId: string;
  edl: Edl;
  playable: boolean;
  onPatch: (patch: Partial<Pick<AudioCue, "offset" | "gainDb" | "fadeOut">>) => void;
}) {
  const cue = edl.audio[0];
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Music</CardTitle>
        <CardDescription>
          {!cue
            ? "Silent cut — no music lane on this EDL."
            : cue.mode === "copy"
              ? "Stream-copied verbatim from the source — no knobs by contract."
              : "Offset is measured, gain is static, the tail eases — never ducking, never a manufactured ending."}
        </CardDescription>
      </CardHeader>
      {cue && (
        <CardContent className="flex flex-col gap-3">
          <p className="break-all font-mono text-xs text-muted-foreground">{cue.source.ref}</p>
          {cue.mode === "encode" && (
            <>
              {playable && (
                <Waveform
                  src={mediaUrl(projectId, cue.source.ref)}
                  offset={cue.offset}
                  onOffset={(offset) => onPatch({ offset })}
                />
              )}
              <MusicKnobs cue={cue} edl={edl} onPatch={onPatch} />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function MusicKnobs({
  cue,
  edl,
  onPatch,
}: {
  cue: AudioCue;
  edl: Edl;
  onPatch: (patch: Partial<Pick<AudioCue, "offset" | "gainDb" | "fadeOut">>) => void;
}) {
  const fadeOut = cue.fadeOut;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <NumField label="offset (s)" value={cue.offset} min={0} onCommit={(offset) => onPatch({ offset })} />
      <NumField label="gain (dB)" value={cue.gainDb} step={0.5} onCommit={(gainDb) => onPatch({ gainDb })} />
      {fadeOut ? (
        <>
          <NumField
            label="fade-out at (s)"
            value={fadeOut.start}
            min={0}
            onCommit={(start) => onPatch({ fadeOut: { ...fadeOut, start } })}
          />
          <NumField
            label="fade length (s)"
            value={fadeOut.duration}
            min={0.1}
            onCommit={(duration) => onPatch({ fadeOut: { ...fadeOut, duration } })}
          />
          <Button variant="ghost" size="sm" onClick={() => onPatch({ fadeOut: undefined })}>
            Remove easing
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onPatch({ fadeOut: { start: Math.max(0, edl.output.duration - 2), duration: 1.5 } })
          }
        >
          Add tail easing
        </Button>
      )}
    </div>
  );
}

function Waveform({
  src,
  offset,
  onOffset,
}: {
  src: string;
  offset: number;
  onOffset: (seconds: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurferHandle | null>(null);
  const [trackDuration, setTrackDuration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let ws: WaveSurferHandle | null = null;
    void import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (cancelled || !containerRef.current) return;
      ws = WaveSurfer.create({
        container: containerRef.current,
        url: src,
        height: 64,
        waveColor: "var(--muted-foreground)",
        progressColor: "var(--primary)",
        cursorColor: "var(--primary)",
      }) as unknown as WaveSurferHandle;
      ws.on("ready", (duration) => setTrackDuration(duration));
      // Click = set the in-point AND audition from it — one gesture, measured.
      ws.on("interaction", (newTime) => onOffset(Math.round(newTime * 100) / 100));
      wsRef.current = ws;
    });
    return () => {
      cancelled = true;
      ws?.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-create only when the source changes; onOffset is stable enough per render
  }, [src]);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative min-w-0 rounded-md border border-border bg-muted/40 p-1">
        <div ref={containerRef} aria-label="Music waveform — click to set the offset" />
        {trackDuration > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-1 w-0.5 bg-signal"
            style={{ left: `${Math.min(100, (offset / trackDuration) * 100)}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Click the waveform to set where the track enters; playback auditions from the click.
        </p>
        <Button variant="ghost" size="sm" onClick={() => void wsRef.current?.playPause()}>
          Play / pause
        </Button>
      </div>
    </div>
  );
}
