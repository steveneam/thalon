"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FlowStage } from "@/lib/staged-flow/types";

interface StageRailProps {
  stages: FlowStage[];
  viewIndex: number;
  onView: (index: number) => void;
}

/**
 * The plan's ordered stages as a rail (count is CONFIG — this renders
 * whatever the stage plan carries, 3 today). Done stages stay clickable so
 * the operator can revisit/tweak earlier artifacts; locked stages are inert
 * until the flow advances into them.
 */
export function StageRail({ stages, viewIndex, onView }: StageRailProps) {
  return (
    <ol aria-label="Stages" className="flex flex-wrap items-center gap-1.5">
      {stages.map((stage, i) => {
        const locked = stage.status === "locked";
        return (
          <li key={stage.def.key} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-muted-foreground">→</span>}
            <button
              type="button"
              aria-label={`View stage ${i + 1}: ${stage.def.title}`}
              aria-pressed={i === viewIndex}
              disabled={locked}
              onClick={() => onView(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-sm transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                i === viewIndex && "bg-muted font-medium",
              )}
            >
              <span className="text-xs text-muted-foreground">{i + 1}</span>
              {stage.def.title}
              {stage.status === "done" && <Badge variant="outline">done</Badge>}
              {stage.status === "current" && <Badge>current</Badge>}
              {stage.draft && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {stage.draft.status}
                </Badge>
              )}
              {!stage.draft && stage.candidates && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  pick 1 of {stage.candidates.length}
                </Badge>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
