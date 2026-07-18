"use client";

import { EmptyArt } from "@/components/ui/empty-art";
import { cn } from "@/lib/utils";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import type { FeedRun, GridDraft } from "@/lib/approve-queue/types";

export type QueueStatus = "loading" | "error" | "success";

/** One row of the flat approve queue: the draft plus the run it belongs to (lineage + seats context). */
export interface QueueItem {
  draft: GridDraft;
  run: FeedRun;
}

/**
 * Wire statuses → the operator words the queue speaks (design: waiting /
 * blocked are the two triage states; terminal and in-flight states keep
 * their own honest words). Blocked wears the signal channel — the engine
 * flagged it; everything else is neutral wash.
 */
export function queueStatusWord(status: string): { word: string; signal: boolean } {
  if (status === "queued") return { word: "waiting", signal: false };
  if (status === "blocked") return { word: "blocked", signal: true };
  return { word: status, signal: false };
}

/** Compact age for the queue rows ("26h" in the design) — exact time in the title attr. */
export function formatAge(iso: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** First line of the draft body — the row's title (bodies open with the hook). */
function rowTitle(body: string): string {
  const firstLine = body.split("\n", 1)[0];
  return firstLine.length > 0 ? firstLine : "(empty draft)";
}

interface QueueListProps {
  status: QueueStatus;
  items: QueueItem[];
  selectedDraftId: string | null;
  onSelect: (draftId: string) => void;
}

/**
 * The approve queue as a LIST (the s58 board decision: stages are
 * engine-derived, drag would fake agency — list + detail, never a board).
 * Oldest first (FIFO triage); bounded region per the Bounded-List Rule:
 * internal scroll past ~9 rows, count stated in the footer.
 */
export function QueueList({ status, items, selectedDraftId, onSelect }: QueueListProps) {
  return (
    <section aria-label="Approve queue" className="flex min-h-0 flex-col border-b border-border md:border-r md:border-b-0">
      {status === "loading" && <p className="p-4 text-sm text-muted-foreground">Loading the queue…</p>}
      {status === "error" && <p className="p-4 text-sm text-destructive">Couldn&rsquo;t load the queue.</p>}
      {status === "success" && items.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-8">
          <EmptyArt asset="emptyApprove" />
          <p className="text-sm text-muted-foreground">No drafts yet — new drafts land here the moment a fan-out runs.</p>
        </div>
      )}
      {status === "success" && items.length > 0 && (
        <>
          <ul className="max-h-[30rem] overflow-y-auto">
            {items.map(({ draft, run }) => {
              const st = queueStatusWord(draft.status);
              return (
                <li key={draft.id} className="border-t border-border first:border-t-0">
                  <button
                    type="button"
                    aria-label={`Select ${draft.platform} draft ${draft.id}`}
                    aria-pressed={draft.id === selectedDraftId}
                    onClick={() => onSelect(draft.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border border-transparent px-3.5 py-2.5 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      draft.id === selectedDraftId && SELECTED_ROW,
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-px font-mono text-2xs tracking-wider uppercase",
                        st.signal ? "bg-signal text-signal-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {st.word}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{rowTitle(draft.body)}</span>
                      <span className="u-eyebrow block text-muted-foreground normal-case">
                        {draft.platform}
                        {draft.format && draft.format !== "post" ? ` · ${draft.format}` : ""} · run #{run.id.slice(0, 8)}
                      </span>
                    </span>
                    <span
                      className="u-eyebrow shrink-0 text-muted-foreground"
                      title={new Date(draft.createdAt).toLocaleString()}
                    >
                      {formatAge(draft.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="u-eyebrow border-t border-border px-3.5 py-2 text-muted-foreground">
            {items.length} of {items.length} · list is bounded — scrolls internally past 9
          </p>
        </>
      )}
    </section>
  );
}
