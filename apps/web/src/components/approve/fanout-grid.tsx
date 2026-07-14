"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMsAsClock, parseClipPlanMeta } from "@/lib/approve-queue/formats/clip-plan";
import { cn } from "@/lib/utils";
import type { GridDraft } from "@/lib/approve-queue/types";

export type GridStatus = "idle" | "loading" | "error" | "success";

/** Sprint-1's first platform targets (charter ratified decision 6) — any other platform a tenant's fan-out profile produces still gets its own column. */
const PLATFORM_COLUMNS = ["linkedin", "x"] as const;

interface FanoutGridProps {
  status: GridStatus;
  drafts: GridDraft[];
  selectedDraftId: string | null;
  onSelect: (draftId: string) => void;
  busy: boolean;
  queuedCount: number;
  onBatchApprove: () => void;
}

/** Zone 2: per-platform fan-out grid for the selected run. */
export function FanoutGrid({
  status,
  drafts,
  selectedDraftId,
  onSelect,
  busy,
  queuedCount,
  onBatchApprove,
}: FanoutGridProps) {
  const columns = [
    ...PLATFORM_COLUMNS,
    ...Array.from(new Set(drafts.map((d) => d.platform))).filter(
      (p) => !(PLATFORM_COLUMNS as readonly string[]).includes(p),
    ),
  ];

  return (
    <section aria-label="Per-platform fan-out grid" className="flex flex-1 flex-col gap-3 border-b border-border p-3 md:border-b-0">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Fan-out</h2>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || queuedCount === 0}
          title={
            queuedCount === 0
              ? "No queued drafts in this run — batch approve acts on judge-passed drafts only."
              : "Approve every queued draft in this run (each records its own approval)."
          }
          onClick={onBatchApprove}
        >
          Approve all queued ({queuedCount})
        </Button>
      </div>
      <p className="u-eyebrow text-muted-foreground">
        keys · j/k select · a approve · r reject · e edit
      </p>
      {status === "idle" && <p className="text-sm text-muted-foreground">Select a run to see its drafts.</p>}
      {status === "loading" && <p className="text-sm text-muted-foreground">Loading drafts…</p>}
      {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t load drafts.</p>}
      {status === "success" && drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">This run has no drafts yet.</p>
      )}
      {status === "success" && drafts.length > 0 && (
        <div className="grid flex-1 auto-cols-fr grid-flow-col gap-3 overflow-x-auto">
          {columns.map((platform) => (
            <div key={platform} className="flex min-w-56 flex-col gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{platform}</h3>
              {drafts
                .filter((d) => d.platform === platform)
                .map((draft) => {
                  const clipPlan = draft.format === "clip_plan" ? parseClipPlanMeta(draft.meta) : null;
                  return (
                    <button
                      key={draft.id}
                      type="button"
                      aria-label={`Select ${draft.platform} draft ${draft.id}`}
                      aria-pressed={draft.id === selectedDraftId}
                      onClick={() => onSelect(draft.id)}
                      className={cn(
                        "flex flex-col gap-1 rounded-lg border border-border p-2 text-left text-sm transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        draft.id === selectedDraftId && "bg-muted",
                      )}
                    >
                      <span className="line-clamp-3 text-foreground">{draft.body}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{draft.status}</Badge>
                        {draft.format && draft.format !== "post" && (
                          <Badge variant="secondary" className="font-mono text-2xs">
                            {draft.format}
                          </Badge>
                        )}
                        {clipPlan && (
                          <Badge variant="outline" className="font-mono text-2xs">
                            {formatMsAsClock(clipPlan.startMs)}–{formatMsAsClock(clipPlan.endMs)}
                          </Badge>
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
