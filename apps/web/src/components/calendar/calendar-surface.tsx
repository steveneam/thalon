"use client";

import "@/components/calendar/calendar.css";

/**
 * Calendar — STEP 1 OF THE TWO-STEP REBUILD (founder-ratified s73): the PURE
 * PORT of docs/research/mock-sheets/Calendar.dc.html. Every band, class and
 * string below is the sheet's own; the content is the sheet's placeholder
 * content, deliberately — this commit is the structural verdict point, with
 * zero old-design contamination and zero data wiring.
 *
 * Step 2 wires the real reads (the plan payload's assets, planned slots,
 * sweep pointer and cadence rules) behind this byte-true resting chrome,
 * weaves the keeper engine back in (month/week/agenda densities, the
 * tenant-wide saved view), and deletes the old implementation.
 */
export function CalendarSurface() {
  return (
    <div className="content calendar-surface" style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 className="t-headline">Calendar</h1>
        <div className="btn btn-ghost btn-sm" style={{ padding: "0 8px" }}>
          ‹
        </div>
        <span className="t-title">21 – 27 July</span>
        <div className="btn btn-ghost btn-sm" style={{ padding: "0 8px" }}>
          ›
        </div>
        <div className="seg">
          <span className="seg-opt on">Week</span>
          <span className="seg-opt">Month</span>
          <span className="seg-opt">Agenda</span>
        </div>
        <div className="seg">
          <span className="seg-opt on">All</span>
          <span className="seg-opt">Plans</span>
          <span className="seg-opt">Needs you</span>
          <span className="seg-opt">⚑ Flagged</span>
        </div>
        <div style={{ flex: 1 }} />
        <span className="pill pill-idle">3 planned</span>
        <span className="t-label">drag to reschedule — snaps to cadence-legal slots</span>
      </div>

      <div className="cal">
        <div className="cal-days">
          <div />
          <div className="cal-dh">
            <b>Mon</b>
            <span>21</span>
          </div>
          <div className="cal-dh">
            <b>Tue</b>
            <span>22</span>
          </div>
          <div className="cal-dh">
            <b>Wed</b>
            <span>23</span>
          </div>
          <div className="cal-dh">
            <b>Thu</b>
            <span>24</span>
          </div>
          <div className="cal-dh today">
            <b>Fri</b>
            <span>25 · today</span>
          </div>
          <div className="cal-dh">
            <b>Sat</b>
            <span>26</span>
          </div>
          <div className="cal-dh">
            <b>Sun</b>
            <span>27</span>
          </div>
        </div>

        <div className="allday">
          <div className="allday-gut">waiting</div>
          <div className="allday-cell" />
          <div className="allday-cell" />
          <div className="allday-cell">
            <span className="amber-chip">LinkedIn · your review · 26h →</span>
          </div>
          <div className="allday-cell" />
          <div className="allday-cell" />
          <div className="allday-cell" />
          <div className="allday-cell" />
        </div>

        <div className="quiet">
          <div className="allday-gut">00–06</div>
          <div className="quiet-band">
            quiet hours · collapsed — nothing scheduled ·{" "}
            <a className="card-link" href="#" style={{ fontSize: 10.5 }}>
              expand
            </a>
          </div>
        </div>

        <div className="grid-wrap">
          <div className="nowline" style={{ top: 348 }} />
          <div className="gut">
            <span style={{ top: 0 }}>06:00</span>
            <span style={{ top: 88 }}>08:00</span>
            <span style={{ top: 176 }}>10:00</span>
            <span style={{ top: 264 }}>12:00</span>
            <span style={{ top: 352 }}>14:00</span>
            <span style={{ top: 440 }}>16:00</span>
            <span style={{ top: 528 }}>18:00</span>
            <span style={{ top: 616 }}>20:00</span>
          </div>
          <div className="dcol">
            <div className="ev done ev-ok" style={{ top: 22, height: 38 }}>
              <b>Sweep · ran ✓</b>06:30 · 4 cards in
            </div>
          </div>
          <div className="dcol" />
          <div className="dcol" />
          <div className="dcol">
            <div className="ev done ev-ok" style={{ top: 455, height: 38 }}>
              <b>Blog · published ✓</b>16:20 · view live ↗
            </div>
          </div>
          <div className="dcol today">
            <div className="ev" style={{ top: 374, height: 38 }}>
              <b>Sweep · engine</b>14:30 · YouTube + Bluesky
            </div>
            <div className="ev ev-plan" style={{ top: 528, height: 42 }}>
              <span className="grip">⋮⋮</span>
              <b>
                Planned · Facebook <span className="flag">⚑</span>
              </b>
              18:00 · launch film post
            </div>
          </div>
          <div className="dcol">
            <div className="ev ev-plan" style={{ top: 220, height: 42 }}>
              <span className="grip">⋮⋮</span>
              <b>Planned · X</b>11:00 · export-queue post
            </div>
            <div className="ghost" style={{ top: 396 }}>
              drop · 15:00 ✓ cadence-legal
            </div>
          </div>
          <div className="dcol">
            <div className="ev ev-plan sel" style={{ top: 154, height: 42 }}>
              <span className="grip">⋮⋮</span>
              <b>Planned · LinkedIn</b>09:30 · pipeline thread
            </div>
          </div>

          <div className="detail" style={{ top: 208, right: 2, width: 184, padding: "11px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="t-title" style={{ fontSize: 12.5 }}>
                Planned · LinkedIn
              </span>
              <div style={{ flex: 1 }} />
              <span className="flag" title="flag this slot">
                ⚑
              </span>
              <span style={{ color: "var(--n-800)", cursor: "pointer" }}>×</span>
            </div>
            <span className="t-label" style={{ fontSize: 11 }}>
              Sun 27 · 09:30 · door unarmed — a plan
            </span>
            <div className="excerpt" style={{ whiteSpace: "normal", fontSize: 11.5 }}>
              <em>“The pipeline thread — what deterministic video changes…”</em>
            </div>
            <a className="card-link" href="#" style={{ whiteSpace: "nowrap" }}>
              Open draft →
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="btn btn-ghost btn-sm" style={{ flex: 1, padding: "0 6px" }}>
                Reschedule
              </div>
              <div className="btn btn-danger btn-sm" style={{ padding: "0 7px" }}>
                Remove
              </div>
            </div>
            <span className="t-label" style={{ fontSize: 10.5 }}>
              illegal slots refuse the drop
            </span>
          </div>
        </div>

        <div className="quiet" style={{ borderBottom: "none", borderTop: "1px solid var(--n-400)" }}>
          <div className="allday-gut">21–24</div>
          <div className="quiet-band">
            quiet hours · collapsed ·{" "}
            <a className="card-link" href="#" style={{ fontSize: 10.5 }}>
              expand
            </a>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="t-label">Cadence — LinkedIn ≤ 2/day · X ≤ 4/day · 90m gap</span>
        <div style={{ flex: 1 }} />
        <span className="t-label">Plans, not uploads — each platform’s door arms on your GO.</span>
      </div>
    </div>
  );
}
