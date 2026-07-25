import Link from "next/link";

/**
 * STEP 1 — the pure port of `docs/research/mock-sheets/Runs.dc.html`
 * (DOCTRINE 0: the sheet is the blueprint, not inspiration). Markup and
 * classes are the sheet's own, React-ized; the content is still the
 * SHEET'S placeholder content — this is the structural verdict point, and
 * step 2 wires the /api/runs feed through the same bands.
 *
 * Bands, in the sheet's order: headline + the week/failed pills + the
 * All/Failed/Published segmented control · one `.day-hd` + `.card` per day,
 * rows carrying thumb → lead/excerpt → status pill → time → door · the
 * receipts footer.
 */
export function Runs() {
  return (
    <div className="content" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 className="t-headline">Runs</h1>
        <span className="pill pill-idle">18 this week</span>
        <span className="pill pill-err">1 failed</span>
        <div style={{ flex: 1 }} />
        <div className="seg">
          <span className="seg-opt on">All</span>
          <span className="seg-opt">Failed</span>
          <span className="seg-opt">Published</span>
        </div>
      </div>

      <div className="day-hd">Today · Friday 25 July</div>
      <div className="card">
        <div className="row">
          <div className="thumb-sm">
            <span>clip frame</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="run-lead">Launch film · LinkedIn + X + Facebook</div>
            <div className="excerpt">
              One prompt → 3 drafts · 2 passed the judge · 1 waiting on you
            </div>
          </div>
          <span className="pill pill-warn">1 waits</span>
          <span className="t-data">09:00</span>
          <Link className="card-link" href="/app/approve">
            Open →
          </Link>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="run-lead">X post · deterministic-video thread</div>
            <div className="excerpt" style={{ color: "var(--err)" }}>
              Gateway timeout at generation — nothing was drafted; the run kept its receipts
            </div>
          </div>
          <span className="pill pill-err">Failed</span>
          <span className="t-data">08:41</span>
          <button type="button" className="btn btn-ghost btn-sm">
            Retry
          </button>
        </div>
      </div>

      <div className="day-hd">Thursday 24 July</div>
      <div className="card">
        <div className="row">
          <div className="thumb-sm">
            <span>page hero</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="run-lead">Blog article · inside the build-step pipeline</div>
            <div className="excerpt">
              Published · <Link href="/blog/build-step-video">/blog/build-step-video ↗</Link>
            </div>
          </div>
          <span className="pill pill-ok">Published</span>
          <span className="t-data">16:20</span>
          <Link className="card-link" href="/app/approve">
            Open →
          </Link>
        </div>
        <div className="row">
          <div className="thumb-sm">
            <span>post image</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="run-lead">Facebook post · render your launch film</div>
            <div className="excerpt">Approved · planned slot Friday 18:00</div>
          </div>
          <span className="pill pill-ok">Approved</span>
          <span className="t-data">11:05</span>
          <Link className="card-link" href="/app/approve">
            Open →
          </Link>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="run-lead">LinkedIn post · works with every platform</div>
            <div className="excerpt" style={{ color: "var(--err)" }}>
              Blocked by the judge — grounding failed, reasons attached
            </div>
          </div>
          <span className="pill pill-err">Blocked</span>
          <span className="t-data">10:22</span>
          <Link className="card-link" href="/app/approve">
            Open →
          </Link>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <span className="t-label">
          Every run keeps its receipts — prompt, sources, judge verdicts, model seats, cost — one
          click deep.
        </span>
      </div>
    </div>
  );
}
