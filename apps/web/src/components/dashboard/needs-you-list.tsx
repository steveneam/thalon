"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { useListKeys } from "@/lib/workspace/keyboard";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import { timeAgo } from "@/lib/workspace/format";
import { waitingSince } from "@/lib/workspace/week";
import { cn } from "@/lib/utils";
import type { PipelineAsset, PlanPayload, PulseCounts } from "@/lib/workspace/types";

export type NeedsYouStatus = "loading" | "error" | "success";

interface NeedsYouListProps {
  counts: PulseCounts;
  status: NeedsYouStatus;
  plan: PlanPayload | null;
  onRetry?: () => void;
  /** Injectable clock for tests; renders default to the real one. */
  now?: Date;
}

interface Row {
  key: string;
  kind: string;
  text: string;
  at: Date;
  href: string;
}

function assetHref(asset: PipelineAsset): string {
  return `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`;
}

/** Every queued draft is its own row; the blocked set folds into one teaching row. */
export function needsYouRows(assets: PipelineAsset[]): Row[] {
  const queued = assets
    .filter((a) => a.status === "queued")
    .sort((a, b) => waitingSince(a).getTime() - waitingSince(b).getTime())
    .map((a) => ({
      key: a.draftId,
      kind: "approve",
      text: `${a.platform}${a.format ? ` · ${a.format}` : ""} — your review`,
      at: waitingSince(a),
      href: assetHref(a),
    }));
  const blocked = assets
    .filter((a) => a.status === "blocked")
    .sort((a, b) => waitingSince(a).getTime() - waitingSince(b).getTime());
  if (blocked.length === 0) return queued;
  return [
    ...queued,
    {
      key: "blocked-group",
      kind: "judge",
      text: `${blocked.length} ${blocked.length === 1 ? "draft" : "drafts"} blocked — reasons attached`,
      at: waitingSince(blocked[0]),
      href: assetHref(blocked[0]),
    },
  ];
}

/**
 * The needs-you list (Phase D spine design): everything waiting on the
 * operator, in one BOUNDED region — fixed 16rem internal scroll, count in
 * the header, the bound stated in the footer (Bounded-List Rule). j/k move
 * the selected row, Enter opens it (the one list keyboard grammar).
 */
export function NeedsYouList({ counts, status, plan, onRetry, now }: NeedsYouListProps) {
  const router = useRouter();
  const clock = (now ?? new Date()).getTime();
  const rows = plan ? needsYouRows(plan.assets) : [];
  const [selected, setSelected] = useState(0);
  const active = Math.min(selected, Math.max(0, rows.length - 1));

  useListKeys({
    enabled: status === "success" && rows.length > 0,
    bindings: {
      j: (event) => {
        event.preventDefault();
        setSelected((i) => Math.min(i + 1, rows.length - 1));
      },
      k: (event) => {
        event.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
      },
      Enter: (event) => {
        if (rows[active]) {
          event.preventDefault();
          router.push(rows[active].href);
        }
      },
    },
  });

  return (
    <section
      aria-label="Needs you"
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
        <h2 className="text-base font-semibold">Needs you</h2>
        {counts.queued + counts.blocked > 0 && (
          <Badge variant="signal">{counts.queued + counts.blocked}</Badge>
        )}
        <span className="ml-auto font-mono text-2xs tracking-wide text-muted-foreground">
          <kbd className="rounded border border-border bg-card px-1">j</kbd>/
          <kbd className="rounded border border-border bg-card px-1">k</kbd> move ·{" "}
          <kbd className="rounded border border-border bg-card px-1">enter</kbd> open
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {status === "loading" && (
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
            Reading the queue…
          </p>
        )}
        {status === "error" && (
          <div className="border-t border-border px-4 py-3">
            <ErrorNotice message="Couldn’t read what needs you." onRetry={onRetry} />
          </div>
        )}
        {status === "success" && rows.length === 0 && (
          <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            {/* Muted, not blue: the icon is not clickable and blue means act (Two-Channel). */}
            <CircleCheck aria-hidden className="size-4 shrink-0" />
            Queue clear — nothing waits on you.
          </p>
        )}
        {status === "success" &&
          rows.map((row, i) => (
            <button
              key={row.key}
              type="button"
              onClick={() => router.push(row.href)}
              onFocus={() => setSelected(i)}
              className={cn(
                "flex w-full items-center gap-3 border-t px-4 py-2.5 text-left",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50",
                i === active ? cn("border-t-transparent", SELECTED_ROW) : "border-border hover:bg-muted",
              )}
            >
              <span className="u-eyebrow w-14 shrink-0 text-muted-foreground">{row.kind}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{row.text}</span>
              <span className="u-eyebrow shrink-0 text-muted-foreground">
                {timeAgo(row.at.toISOString(), clock)}
              </span>
            </button>
          ))}
      </div>
      {/* The count lives in the header chip; the footer states only the
          bound (a row can fold several items, so a second number would lie). */}
      {status === "success" && rows.length > 0 && (
        <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
          the list is bounded — the page never grows with it
        </p>
      )}
    </section>
  );
}
