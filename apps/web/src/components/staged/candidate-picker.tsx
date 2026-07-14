"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";
import type { StageCandidate } from "@/lib/staged-flow/types";

interface CandidatePickerProps {
  stageTitle: string;
  candidates: StageCandidate[];
  busy: boolean;
  onPick: (candidateId: string) => void;
}

/**
 * Pick-from-2-3-candidates per stage: the operator reacts to visible,
 * summarized takes — never a blank prompt box. Each card shows the take's
 * angle plus the concrete numbers (scenes, duration, feel) and the first
 * scene's direction as a taste of the whole.
 */
export function CandidatePicker({ stageTitle, candidates, busy, onPick }: CandidatePickerProps) {
  return (
    <div aria-label={`${stageTitle} candidates`} role="group" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {candidates.length} takes for <span className="font-medium text-foreground">{stageTitle}</span> — pick one to
        continue. Every pick is captured (it trains one-prompt mode&rsquo;s defaults).
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {candidates.map((candidate) => {
          const doc = candidate.doc;
          const scenes = doc?.scenes ?? candidate.storyboard?.scenes ?? [];
          const totalMs = doc ? doc.scenes.reduce((sum, s) => sum + s.durationMs, 0) : null;
          const firstVisual = doc?.scenes[0]?.visual;
          return (
            <div key={candidate.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">{candidate.label}</h4>
                {doc && (
                  <Badge variant="secondary" className="font-mono text-2xs">
                    {doc.scenes[0]?.motion}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{candidate.summary}</p>
              <p className="text-[11px] text-muted-foreground">
                {scenes.length} scenes
                {totalMs !== null && ` · ${formatMsAsClock(totalMs)}`}
                {doc && ` · ${doc.aspect} · ${doc.pacing} pacing`}
              </p>
              {firstVisual && (
                <p className="text-xs text-foreground italic">
                  Scene 1: {firstVisual}
                </p>
              )}
              <Button
                size="sm"
                className="mt-auto"
                disabled={busy}
                aria-label={`Pick candidate ${candidate.label}`}
                onClick={() => onPick(candidate.id)}
              >
                Use this take
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
