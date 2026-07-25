"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NeedsYouRow } from "@/components/dashboard/dashboard-model";
import { useListKeys } from "@/lib/workspace/keyboard";
import { timeAgo } from "@/lib/workspace/format";

export type NeedsYouStatus = "loading" | "error" | "success";

/**
 * The "Needs you" card, rebuilt exactly from the Dashboard sheet: one row
 * per waiting draft — amber dot, thumb where the draft carries media (the
 * media-first grammar; text posts carry none), the lead line, the body
 * excerpt as a quote (blocked rows show the judge's reason in the error
 * channel instead of pretending), the wait time. OLDEST FIRST, stated in
 * the footer beside the one list keyboard grammar (j/k move · ↵ open).
 */
export function NeedsYouCard({
  rows,
  count,
  status,
  onRetry,
  now,
}: {
  rows: NeedsYouRow[];
  count: number;
  status: NeedsYouStatus;
  onRetry?: () => void;
  /** Injectable clock for tests; renders default to the real one. */
  now?: Date;
}) {
  const router = useRouter();
  const clock = (now ?? new Date()).getTime();
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
    <section className="card" style={{ display: "flex", flexDirection: "column" }} aria-label="Needs you">
      <div className="card-head">
        <span className="t-title">Needs you</span>
        {count > 0 && <span className="pill pill-warn">{count}</span>}
        <div style={{ flex: 1 }} />
        <Link className="card-link" href="/app/approve">
          Open approve →
        </Link>
      </div>
      <div className="card-rows">
        {status === "loading" && (
          <div className="row">
            <span className="t-label">Reading the queue…</span>
          </div>
        )}
        {status === "error" && (
          <div className="row">
            {/* A read failure is never a quiet day (critique P0, 2026-07-14). */}
            <span className="t-label" style={{ color: "var(--err)" }} role="alert">
              Couldn’t read what needs you — this is a read failure, not a quiet day.
            </span>
            <div style={{ flex: 1 }} />
            {onRetry && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        )}
        {status === "success" && rows.length === 0 && (
          <div className="row">
            <span className="t-label">Queue clear — nothing waits on you.</span>
          </div>
        )}
        {status === "success" &&
          rows.map((row, i) => (
            <div
              key={row.draftId}
              role="button"
              tabIndex={0}
              className={i === active ? "row sel" : "row"}
              style={{ cursor: "pointer" }}
              onClick={() => router.push(row.href)}
              onFocus={() => setSelected(i)}
              onKeyDown={(event) => {
                if (event.key === "Enter") router.push(row.href);
              }}
            >
              <span className="dot" style={{ background: "var(--warn)" }} />
              {row.thumb && (
                <div className="thumb-sm">
                  <span>{row.thumb}</span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ny-lead">{row.lead}</div>
                <div className="excerpt">
                  {row.reason ? (
                    <>
                      “{row.excerpt}” — <span style={{ color: "var(--err)" }}>{row.reason}</span>
                    </>
                  ) : (
                    <em>“{row.excerpt}”</em>
                  )}
                </div>
              </div>
              <span className="t-data">{timeAgo(row.at.toISOString(), clock)}</span>
            </div>
          ))}
      </div>
      {status === "success" && rows.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderTop: "1px solid var(--n-400)",
          }}
        >
          <span className="t-label">oldest first</span>
          <div style={{ flex: 1 }} />
          <span className="kbd">j</span>
          <span className="kbd">k</span>
          <span className="t-label">move</span>
          <span className="kbd">↵</span>
          <span className="t-label">open</span>
        </div>
      )}
    </section>
  );
}
