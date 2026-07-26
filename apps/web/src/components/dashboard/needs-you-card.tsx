"use client";

import { useEffect, useRef, useState } from "react";
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
  // The selection is a DRAFT, not a position. The card re-reads on the
  // dashboard's pulse, so an index silently re-points at whatever row
  // took that slot — j/k/↵ would then open a draft the operator never
  // chose (keyed-by-entity sweep, s78). Falls back to row 0 when the
  // selected draft leaves the list.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = selectedId ? rows.findIndex((row) => row.draftId === selectedId) : -1;
  const active = selectedIndex >= 0 ? selectedIndex : 0;
  const moveTo = (index: number) => {
    const row = rows[Math.max(0, Math.min(index, rows.length - 1))];
    if (row) setSelectedId(row.draftId);
  };

  // The row region is a bounded scroll box (workspace.css:182 — the card shares
  // the week card's height with a zero flex-basis, so the list can never grow
  // to fit). j/k moved the highlight and nothing followed it: measured live at
  // 1440×940, twelve presses put the selected row 743px down a 419px box with
  // scrollTop still 0 — the cursor works for ~5 presses and then goes silent,
  // and ↵ then opens a draft the operator cannot see.
  //
  // Keyed on selectedId, NOT on `active`: the card re-reads on the dashboard's
  // pulse, so the index moves without an operator action and an `active`-keyed
  // effect would yank the box while they are reading further down. `block:
  // "nearest"` for the same reason — it is a no-op when the row is already
  // visible, where "center" re-centres on every keypress. Optional call: jsdom
  // implements no layout and no scrollIntoView (the house pattern).
  const selectedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (selectedId) selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  useListKeys({
    enabled: status === "success" && rows.length > 0,
    bindings: {
      j: (event) => {
        event.preventDefault();
        moveTo(active + 1);
      },
      k: (event) => {
        event.preventDefault();
        moveTo(active - 1);
      },
      Enter: (event) => {
        // A FOCUSED CONTROL OWNS ITS OWN ENTER. This binding is on `window`,
        // so without the guard it stole Enter from every control while the
        // Dashboard was mounted — including the shell's own side-nav — and
        // `preventDefault` cancelled the activation click before navigating.
        // Verified live before the fix (s79): Enter on the focused "Board" seg
        // button landed on /app/approve?run=…&draft=…, not /app/board, and
        // Enter on "Open approve →" (href /app/approve) did the same.
        // `[role=button]` is load-bearing here and the narrower `button, a`
        // form four siblings use is NOT enough: this card's rows are
        // role="button" divs with their own Enter handler, so they would
        // double-push the same href. Runs (runs.tsx:200) is the precedent.
        if ((event.target as HTMLElement | null)?.closest("button, a, [role=button]")) return;
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
              ref={i === active ? selectedRef : undefined}
              role="button"
              tabIndex={0}
              className={i === active ? "row sel" : "row"}
              style={{ cursor: "pointer" }}
              onClick={() => router.push(row.href)}
              onFocus={() => setSelectedId(row.draftId)}
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
          {/* TWO READS, TWO WINDOWS — state the bound, never chase the number.
              The pill is the pulse's count (50 runs, uncapped); the rows come
              from the plan read (20 runs / 40 assets), so the card can list
              fewer than it counts — 21 of 25 on today's data, and the four it
              drops are the OLDEST, directly under a footer promising "oldest
              first". Feeding the pill from rows.length instead would be worse:
              the topbar chip and the rail badge both render the pulse's number
              on this same screen, so it would trade one visible disagreement
              for two invisible ones. Reconciling PLAN_RUN_WINDOW with
              PULSE_RUN_WINDOW is a shared-lib read-cost call (the lead's, s78
              lane 1 raised the same split on Board). The house grammar for a
              bound is this: N of M, with a door. */}
          {count > rows.length && (
            <>
              <span className="t-label">·</span>
              <span className="t-label">
                {rows.length} of {count} shown —{" "}
                <Link className="card-link" href="/app/approve">
                  the oldest wait in the queue →
                </Link>
              </span>
            </>
          )}
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
