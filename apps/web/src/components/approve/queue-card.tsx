"use client";

import {
  formatStamp,
  formatWord,
  QUEUE_TABS,
  queueTabCounts,
  rowQuote,
  rowTitle,
  runGroupLabel,
  statusPill,
  thumbLabel,
  type QueueFilter,
  type QueueItem,
  type RunGroup,
} from "@/components/approve/approve-model";
import { PlatMark } from "@/components/approve/plat-mark";

export type QueueStatus = "loading" | "error" | "success";

interface QueueCardProps {
  status: QueueStatus;
  /** The view's rows grouped by CONSECUTIVE run (sort + filters already applied). */
  groups: RunGroup[];
  /** The unfiltered queue — the tabs' live counts and the footer's honest total. */
  allItems: QueueItem[];
  filter: QueueFilter;
  onFilter: (filter: QueueFilter) => void;
  selectedDraftId: string | null;
  /** Blocked drafts' failing judge reasons, keyed by draft id — the sheet's red `.why` chip. */
  reasons: Record<string, string[]>;
  /**
   * Reasons the operator stated on THIS session's rejects, keyed by draft id
   * — the sheet's "your reason → eval:" chip. No read exposes a recorded
   * rejection reason yet, so rows rejected before this mount honestly carry
   * no chip (the "diff not on the wire" precedent).
   */
  rejectReasons: Record<string, string>;
  /** True when the shell pulse says nothing waits anywhere (the zero-inbox state). */
  inboxZero: boolean;
  /**
   * True when the selected row is a stage artifact, whose detail pane has no
   * approve/reject/edit door — so the legend must not advertise a/r/e as if
   * it did. j/k are never gated: navigation is never owned by the detail pane.
   */
  actionsDisabled: boolean;
  /** Disables the run bands' batch verbs while an action is in flight. */
  busy: boolean;
  onSelect: (draftId: string) => void;
  /** The run band's "Approve run · N" (Deel) — the surface owns the named confirm. */
  onApproveRun: (group: RunGroup) => void;
  /** How many of a group's drafts the run verb would act on (queued, non-staged). */
  runBatchCount: (group: RunGroup) => number;
  onRetry: () => void;
}

/**
 * The queue card, ported from `Approve.dc.html` (AMENDED s89/W1): the state
 * tabs with live counts (Reddit's mod queue), run-group bands with the
 * batch verb carrying its count (Deel), media-first rows with a REAL
 * platform mark (house rule since Analytics) · title · format/excerpt ·
 * status pill · exact stamp, over a bounded scroll region, with the
 * sheet's count + keyboard legend on the footer rail.
 *
 * Honest states live INSIDE the sheet's card rather than replacing it: a
 * read that failed says so and offers a retry — it is never an empty queue.
 */
export function QueueCard({
  status,
  groups,
  allItems,
  filter,
  onFilter,
  selectedDraftId,
  reasons,
  rejectReasons,
  inboxZero,
  actionsDisabled,
  busy,
  onSelect,
  onApproveRun,
  runBatchCount,
  onRetry,
}: QueueCardProps) {
  const counts = queueTabCounts(allItems);
  const viewCount = groups.reduce((n, g) => n + g.items.length, 0);
  const totalCount = allItems.length;
  return (
    <section
      className="card"
      aria-label="Approve queue"
      style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      {/* Drawn as the sheet's tabs; semantically PRESSED FILTER BUTTONS —
          the ARIA tab pattern demands arrow-key management and tabpanels
          these chips don't have, and claiming it would be its own lie. */}
      <div className="qtabs" role="group" aria-label="Queue state">
        {QUEUE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={filter === tab.value}
            className={`qtab${filter === tab.value ? " on" : ""}`}
            onClick={() => onFilter(tab.value)}
          >
            {tab.label}
            <span className="n">{counts[tab.value]}</span>
          </button>
        ))}
      </div>
      <div className="q-scroll">
        {status === "loading" && (
          <div style={{ padding: "14px 16px" }}>
            <span className="t-label">Reading the queue…</span>
          </div>
        )}
        {status === "error" && (
          <div style={{ padding: "14px 16px" }} role="alert">
            <p className="t-title">Couldn’t read the queue</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              <span className="t-label">
                This is a read failure, not an empty queue — nothing has been decided.
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
                Try again
              </button>
            </div>
          </div>
        )}
        {status === "success" && viewCount === 0 && (
          <div style={{ padding: "14px 16px" }}>
            <p className="t-title">
              {inboxZero ? "Inbox zero." : totalCount > 0 ? "Nothing matches this view" : "No drafts yet"}
            </p>
            <span className="t-label" style={{ display: "block", marginTop: 4 }}>
              {inboxZero
                ? "Nothing waits on you — new drafts land here the moment the judge passes them."
                : totalCount > 0
                  ? "Switch the tab or family to see the rest of the queue."
                  : "New drafts land here the moment a fan-out runs."}
            </span>
          </div>
        )}
        {status === "success" &&
          groups.map((group) => {
            const batchable = runBatchCount(group);
            return (
              <div key={`${group.run.id}:${group.items[0].draft.id}`}>
                <div
                  className="run-hd"
                  // The sheet's fixture also names the run's subject — not on
                  // this read yet, so the band carries only what is true.
                  title="grouped by run — the run's source subject isn't on this read yet"
                >
                  <span>{runGroupLabel(group)}</span>
                  <div style={{ flex: 1 }} />
                  {batchable > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm run-approve"
                      disabled={busy}
                      title="Approve this run's waiting drafts (each records its own approval)."
                      onClick={() => onApproveRun(group)}
                    >
                      {`Approve run · ${batchable}`}
                    </button>
                  )}
                </div>
                {group.items.map(({ draft }) => {
                  const pill = statusPill(draft.status);
                  const thumb = thumbLabel(draft);
                  const quote = rowQuote(draft.body);
                  const blockedReason = draft.status === "blocked" ? reasons[draft.id]?.[0] : undefined;
                  const rejectReason = draft.status === "rejected" ? rejectReasons[draft.id] : undefined;
                  return (
                    <button
                      key={draft.id}
                      type="button"
                      aria-label={`Select ${draft.platform} draft ${draft.id}`}
                      aria-pressed={draft.id === selectedDraftId}
                      onClick={() => onSelect(draft.id)}
                      className={`row q-row q-btn${draft.id === selectedDraftId ? " sel" : ""}`}
                    >
                      {thumb && (
                        <div className="thumb-sm">
                          <span>{thumb}</span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="q-title">{rowTitle(draft.body)}</div>
                        <div className="excerpt">
                          <PlatMark platform={draft.platform} /> {formatWord(draft)}
                          {blockedReason ? (
                            <>
                              {" · "}
                              <span className="why">{blockedReason}</span>
                            </>
                          ) : rejectReason ? (
                            <>
                              {" · "}
                              <span
                                className="why why-warn"
                                title="your stated reason — it became the eval row"
                              >{`your reason → eval: ${rejectReason}`}</span>
                            </>
                          ) : quote ? (
                            <>
                              {" · "}
                              <em>“{quote}”</em>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <span className={pill.cls ? `pill ${pill.cls}` : "pill"}>{pill.word}</span>
                      <span className="t-data">{formatStamp(draft.createdAt)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderTop: "1px solid var(--n-400)",
        }}
      >
        <span className="t-label">{`${viewCount} of ${totalCount}`}</span>
        <div style={{ flex: 1 }} />
        {/* The sheet's own legend, kept byte-for-byte at rest. A legend that
            advertises a key which does nothing is the same defect as a dead
            door, so a/r/e wear the off state — and say why — whenever the
            selected row's detail pane has no such verb. */}
        {actionsDisabled && (
          <span className="t-label">a · r · e aren’t wired for a staged draft</span>
        )}
        <span className="kbd">j</span>
        <span className="kbd">k</span>
        <span className="t-label">row</span>
        <span className={actionsDisabled ? "kbd kbd-off" : "kbd"}>a</span>
        <span className="t-label">approve</span>
        <span className={actionsDisabled ? "kbd kbd-off" : "kbd"}>r</span>
        <span className="t-label">reject</span>
        <span className={actionsDisabled ? "kbd kbd-off" : "kbd"}>e</span>
        <span className="t-label">edit</span>
      </div>
    </section>
  );
}
