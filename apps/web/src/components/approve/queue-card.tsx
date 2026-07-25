"use client";

import {
  formatStamp,
  platformLabel,
  formatWord,
  rowQuote,
  rowTitle,
  statusPill,
  thumbLabel,
  type QueueItem,
} from "@/components/approve/approve-model";

export type QueueStatus = "loading" | "error" | "success";

interface QueueCardProps {
  status: QueueStatus;
  /** The rows in VIEW order (sort + filter already applied). */
  items: QueueItem[];
  /** Unfiltered queue size — the footer tells a filtered view from a truly empty queue. */
  totalCount: number;
  selectedDraftId: string | null;
  /** Blocked drafts' failing judge reasons, keyed by draft id — the sheet quotes the first one in red. */
  reasons: Record<string, string[]>;
  /** True when the shell pulse says nothing waits anywhere (the zero-inbox state). */
  inboxZero: boolean;
  onSelect: (draftId: string) => void;
  onRetry: () => void;
}

/**
 * The queue card, ported from `Approve.dc.html`: media-first rows (thumb
 * placeholder · title · platform/format/excerpt · status pill · exact
 * stamp) over a bounded scroll region, with the sheet's count + keyboard
 * legend on the footer rail. Order and filter are the surface's view state.
 *
 * Honest states live INSIDE the sheet's card rather than replacing it: a
 * read that failed says so and offers a retry — it is never an empty queue.
 */
export function QueueCard({
  status,
  items,
  totalCount,
  selectedDraftId,
  reasons,
  inboxZero,
  onSelect,
  onRetry,
}: QueueCardProps) {
  return (
    <section
      className="card"
      aria-label="Approve queue"
      style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
    >
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
        {status === "success" && items.length === 0 && (
          <div style={{ padding: "14px 16px" }}>
            <p className="t-title">
              {inboxZero ? "Inbox zero." : totalCount > 0 ? "Nothing matches this view" : "No drafts yet"}
            </p>
            <span className="t-label" style={{ display: "block", marginTop: 4 }}>
              {inboxZero
                ? "Nothing waits on you — new drafts land here the moment the judge passes them."
                : totalCount > 0
                  ? "Switch the filter to see the rest of the queue."
                  : "New drafts land here the moment a fan-out runs."}
            </span>
          </div>
        )}
        {status === "success" &&
          items.map(({ draft }) => {
            const pill = statusPill(draft.status);
            const thumb = thumbLabel(draft);
            const quote = rowQuote(draft.body);
            const blockedReason = draft.status === "blocked" ? reasons[draft.id]?.[0] : undefined;
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
                    {`${platformLabel(draft.platform)} · ${formatWord(draft)}`}
                    {blockedReason ? (
                      <>
                        {" · "}
                        <span style={{ color: "var(--err)" }}>{blockedReason}</span>
                      </>
                    ) : quote ? (
                      <>
                        {" · "}
                        <em>“{quote}”</em>
                      </>
                    ) : null}
                  </div>
                </div>
                <span className={`pill ${pill.cls}`}>{pill.word}</span>
                <span className="t-data">{formatStamp(draft.createdAt)}</span>
              </button>
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
        <span className="t-label">{`${items.length} of ${totalCount}`}</span>
        <div style={{ flex: 1 }} />
        <span className="kbd">j</span>
        <span className="kbd">k</span>
        <span className="t-label">row</span>
        <span className="kbd">a</span>
        <span className="t-label">approve</span>
        <span className="kbd">r</span>
        <span className="t-label">reject</span>
        <span className="kbd">e</span>
        <span className="t-label">edit</span>
      </div>
    </section>
  );
}
