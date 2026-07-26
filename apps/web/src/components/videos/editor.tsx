import "@/components/videos/editor.css";
import Link from "next/link";

/**
 * Video editor — STEP 1 of the two-step rebuild (s73 execution rules): the
 * pure port of docs/research/mock-sheets/Videos.dc.html. The sheet's own
 * markup, its own classes, its own placeholder content — zero wiring. This
 * is the founder's structural verdict point; step 2 puts the real cut
 * behind these bands and deletes the old editor.
 *
 * The sheet's bands, top to bottom: the title row (back door · headline ·
 * cut + takes pills · the aspect segmented control · Propose edits · the
 * Approve door) · the COPILOT band, the agent-native front door (founder
 * s72: the agent answers with a proposal on the timeline, never a silent
 * change) · the two-column body — player, then the timeline card with its
 * proposal row and three lanes (video beats · music with measured
 * crescendos · caption plates), then the takes strip for the picked beat;
 * the beats rail on the right.
 *
 * Thumbnails stay the sheet's striped PLACEHOLDER on purpose (founder s75:
 * "also have placeholder until bmedia ready").
 */

/** The sheet's own beat lane — placeholder content until step 2. */
const BLOCKS = [
  { label: "01", width: "11%", state: "" },
  { label: "02 · take 1", width: "13%", state: "on" },
  { label: "03", width: "12%", state: "" },
  { label: "04", width: "14%", state: "prop", tag: "−0.8s" },
  { label: "05", width: "11%", state: "" },
  { label: "06", width: "13%", state: "" },
  { label: "07", width: "12%", state: "" },
  { label: "08", width: "11%", state: "" },
];

/** The sheet's own caption plates — placeholder content until step 2. */
const PLATES = [
  { width: "9%", marginLeft: undefined as string | undefined, on: false },
  { width: "7%", marginLeft: "2%", on: false },
  { width: "10%", marginLeft: "3%", on: true },
  { width: "8%", marginLeft: "4%", on: false },
  { width: "9%", marginLeft: "3%", on: false },
  { width: "7%", marginLeft: "5%", on: false },
  { width: "10%", marginLeft: "4%", on: false },
  { width: "8%", marginLeft: "3%", on: false },
];

/** The sheet's own take strip — placeholder content until step 2. */
const TAKES = [
  { thumb: "take 1 · keeper", caption: "5.1s · first-take", on: true },
  { thumb: "take 2", caption: "5.0s · text drift", on: false },
  { thumb: "take 3", caption: "5.2s · flat motion", on: false },
];

/** The sheet's own beats rail — placeholder content until step 2. */
const BEATS = [
  { label: "01 · Hook — the empty timeline", duration: "4.8s", on: false },
  { label: "02 · The prompt goes in", duration: "5.1s", on: true },
  { label: "03 · Drafts fan out", duration: "5.4s", on: false },
  { label: "04 · The judge gate", duration: "6.0s", on: false },
  { label: "05 · Approve — your click", duration: "4.9s", on: false },
  { label: "06 · The calendar fills", duration: "5.6s", on: false },
  { label: "07 · Live on three platforms", duration: "5.3s", on: false },
  { label: "08 · Close — the mark", duration: "5.2s", on: false },
];

/** The sheet's own copilot chips — placeholder content until step 2. */
const CHIPS = ["Tighten to 30s", "Recut 9:16", "Swap music", "Retake a beat"];

export function VideoEditor() {
  return (
    <div className="content editor-surface" style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="card-link" href="/app/videos">
          ← Videos
        </Link>
        <h1 className="t-headline">One-prompt launch film</h1>
        <span className="pill pill-idle">cut v1 · 42.3s</span>
        <span className="pill pill-ok">9 takes rendered</span>
        <div style={{ flex: 1 }} />
        <div className="seg">
          <span className="seg-opt on">16:9</span>
          <span className="seg-opt">9:16</span>
          <span className="seg-opt">1:1</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm">
          Propose edits
        </button>
        <button type="button" className="btn btn-primary btn-sm">
          Send cut to Approve
        </button>
      </div>

      <div className="copilot">
        <div className="cop-box">
          Direct the edit — <em>“tighten beat 04, land the crescendo on the close, recut for
          9:16”</em> — the agent answers with a proposal on the timeline, never a silent change.
        </div>
        {CHIPS.map((chip) => (
          <span key={chip} className="chipbtn">
            {chip}
          </span>
        ))}
        <button type="button" className="btn btn-primary btn-sm">
          Propose
        </button>
      </div>

      <div className="ed-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div className="player">
            <div className="play-btn">
              <div className="play-tri" />
            </div>
            <div className="scrub">
              <span className="t-data" style={{ color: "var(--n-1000)" }}>
                0:14.2
              </span>
              <div className="bar-trough" style={{ flex: 1, height: 5 }}>
                <div className="bar-fill" style={{ width: "34%", background: "var(--act)" }} />
              </div>
              <span className="t-data">0:42.3</span>
            </div>
          </div>

          <div className="card">
            <div className="prop-row">
              <span className="pill pill-warn">proposal</span>
              <span style={{ flex: 1 }}>
                Trim beat 04 by 0.8s and re-time its captions — from your “tighten the middle” note
                · nothing applies until you say so
              </span>
              <span className="card-link">Review diff →</span>
              <button type="button" className="btn btn-ghost btn-sm">
                Apply
              </button>
              <button type="button" className="btn btn-quiet btn-sm">
                Dismiss
              </button>
            </div>

            <div className="tl-head">
              <span className="t-title">Timeline</span>
              <span className="pill pill-idle">Snap · magnetic</span>
              <span className="t-label">drag to reorder · trim at edges · blocks close ranks</span>
              <div style={{ flex: 1 }} />
              <div className="seg">
                <span className="seg-opt">−</span>
                <span className="seg-opt on">fit</span>
                <span className="seg-opt">+</span>
              </div>
            </div>

            <div className="tl-body">
              <div className="playhead" />
              <div className="lane">
                <div className="lane-hd">
                  Video<small>beats · takes</small>
                </div>
                <div className="lane-tr">
                  {BLOCKS.map((block) => (
                    <div
                      key={block.label}
                      className={block.state === "" ? "blk" : `blk ${block.state}`}
                      style={{ width: block.width }}
                    >
                      {block.label}
                      {block.tag && <span className="prop-tag">{block.tag}</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="lane">
                <div className="lane-hd">
                  Music<small>cue · waveform</small>
                </div>
                <div className="lane-tr">
                  <div
                    className="blk-music"
                    style={{ width: "100%" }}
                    title="one cue · offset 0:00 · gain −6dB under captions"
                  >
                    <div className="cresc" style={{ left: "24%" }} title="measured crescendo · aligns beat 03" />
                    <div className="cresc" style={{ left: "62%" }} title="measured crescendo · aligns beat 06" />
                    <div className="cresc" style={{ left: "88%" }} title="measured crescendo · aligns the close" />
                  </div>
                </div>
              </div>
              <div className="lane">
                <div className="lane-hd">
                  Captions<small>plates · fades</small>
                </div>
                <div className="lane-tr" style={{ alignItems: "center" }}>
                  {PLATES.map((plate, i) => (
                    <div
                      key={i}
                      className={plate.on ? "blk-cap on" : "blk-cap"}
                      style={{ width: plate.width, marginLeft: plate.marginLeft }}
                      title={plate.on ? "“No timeline editor. A build step.” · fade 200ms" : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                borderTop: "1px solid var(--n-400)",
              }}
            >
              <span className="t-label">
                Every edit is a recorded EDL change — the agent proposes, you approve · cuts are
                versioned · .otio export
              </span>
              <div style={{ flex: 1 }} />
              <span className="card-link">Cut history →</span>
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">Takes — beat 02</span>
              <span className="t-label">3 takes · keeper picked</span>
              <div style={{ flex: 1 }} />
              <span className="card-link">All takes →</span>
            </div>
            <div className="strip">
              {TAKES.map((take) => (
                <div key={take.thumb} className={take.on ? "take on" : "take"}>
                  <div className="thumb-md">
                    <span>{take.thumb}</span>
                  </div>
                  <span className="take-cap">{take.caption}</span>
                </div>
              ))}
              <div className="take">
                <div className="thumb-md" style={{ borderStyle: "dashed", background: "transparent" }}>
                  <span>+ retake</span>
                </div>
                <span className="take-cap">re-brief this beat</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <span className="t-title">Beats</span>
            <span className="t-label">8 · 42.3s planned</span>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {BEATS.map((beat) => (
              <div key={beat.label} className={beat.on ? "beat-row on" : "beat-row"}>
                <div className="beat-thumb" />
                <span style={{ flex: 1 }}>{beat.label}</span>
                <span className="t-data">{beat.duration}</span>
                <span style={{ color: "var(--ok)" }}>✓</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">
              From one prompt · screen text code-drawn · every take’s reason on record
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
