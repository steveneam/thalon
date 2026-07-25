"use client";

import "@/components/board/board.css";
import { useRouter } from "next/navigation";

/**
 * Pipeline board — STEP 1 OF THE TWO-STEP REBUILD (founder-ratified s73): the
 * PURE PORT of docs/research/mock-sheets/Board.dc.html. Every band, class and
 * string below is the sheet's own; the content is the sheet's placeholder
 * content, deliberately — this commit is the structural verdict point, with
 * zero old-design contamination and zero data wiring.
 *
 * The sheet draws this as HOME's second tab (its rail marks Home, its header
 * is "Today" with the Overview·Board control), so it lives at /app/board and
 * the Dashboard's Board option — a dead label until now — becomes its door.
 *
 * Step 2 wires the real reads (the plan payload's assets and planned slots,
 * the intel cards) behind this byte-true resting chrome.
 */
export function BoardSurface() {
  const router = useRouter();
  return (
    <div className="content board-surface" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Today</h1>
        <div className="seg">
          {/* A button, not a Link: `.screen a` paints anchors accent-blue and
              workspace.css is the shell contract (the week card's control sets
              the same precedent). */}
          <button type="button" className="seg-opt" onClick={() => router.push("/app")}>
            Overview
          </button>
          <span className="seg-opt on">Board</span>
        </div>
        <div style={{ flex: 1 }} />
        <span className="t-label">the pipeline as columns — cards move when the work moves</span>
      </div>

      <div className="cols">
        <div className="col">
          <div className="col-hd">
            Intel picks<span className="col-ct">2</span>
          </div>
          <div className="col-bd">
            <div className="k-card">
              <div className="k-thumb">
                <span>post media</span>
              </div>
              <div className="k-title">
                Rendered our whole launch video from HTML — a build step
              </div>
              <div className="k-meta">
                <span className="pill pill-heat-hot" style={{ height: 17, fontSize: 10 }}>
                  Hot
                </span>
                <span>picked · video</span>
              </div>
            </div>
            <div className="k-card">
              <div className="k-thumb">
                <span>yt thumb</span>
              </div>
              <div className="k-title">Agent-driven editing: the timeline learns to cut</div>
              <div className="k-meta">
                <span className="pill pill-heat-rising" style={{ height: 17, fontSize: 10 }}>
                  Rising
                </span>
                <span>unpicked</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="col-hd">
            Composing<span className="col-ct">1</span>
          </div>
          <div className="col-bd">
            <div className="k-card">
              <div className="k-title">Deterministic-video explainer · LinkedIn</div>
              <div className="k-meta">
                <span>drafting · 24s in</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="col-hd">
            At the judge<span className="col-ct">1</span>
          </div>
          <div className="col-bd">
            <div className="k-card">
              <div className="k-title">Build-step guide · blog</div>
              <div className="k-meta">
                <span>4 gates · running</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="col"
          style={{ borderColor: "color-mix(in oklab, var(--warn) 35%, var(--n-400))" }}
        >
          <div className="col-hd">
            Waiting on you
            <span
              className="col-ct"
              style={{ background: "var(--warn-subtle)", color: "var(--warn)" }}
            >
              4
            </span>
          </div>
          <div className="col-bd">
            <div className="k-card">
              <div className="k-thumb">
                <span>clip frame</span>
              </div>
              <div className="k-title">Our launch video has no editor file</div>
              <div className="k-meta">
                <span>LinkedIn · 26h</span>
              </div>
            </div>
            <div className="k-card">
              <div className="k-title">The export queue disappeared…</div>
              <div className="k-meta">
                <span>X · 2h</span>
              </div>
            </div>
            <div className="k-card">
              <div className="k-thumb">
                <span>post image</span>
              </div>
              <div className="k-title">Render your launch film from HTML</div>
              <div className="k-meta">
                <span>Facebook · 45m</span>
              </div>
            </div>
            <div className="k-card">
              <div className="k-title" style={{ color: "var(--err)" }}>
                Works with every platform — blocked
              </div>
              <div className="k-meta">
                <span>needs your edit · 1h</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="col-hd">
            Approved<span className="col-ct">2</span>
          </div>
          <div className="col-bd">
            <div className="k-card">
              <div className="k-thumb">
                <span>page hero</span>
              </div>
              <div className="k-title">Blog · inside the build-step pipeline</div>
              <div className="k-meta">
                <span>published ↗</span>
              </div>
            </div>
            <div className="k-card">
              <div className="k-title">Facebook · launch film post</div>
              <div className="k-meta">
                <span>ready to plan</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="col-hd">
            Planned<span className="col-ct">3</span>
          </div>
          <div className="col-bd">
            <div className="k-card">
              <div className="k-title">Friday 18:00 · Facebook</div>
              <div className="k-meta">
                <span>door unarmed — a plan</span>
              </div>
            </div>
            <div className="k-card">
              <div className="k-title">Saturday 11:00 · X</div>
              <div className="k-meta">
                <span>door unarmed — a plan</span>
              </div>
            </div>
            <div className="k-card">
              <div className="k-title">Sunday 09:30 · LinkedIn</div>
              <div className="k-meta">
                <span>door unarmed — a plan</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
