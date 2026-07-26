import "@/components/videos/dossier.css";
import Link from "next/link";

/**
 * Video dossier — STEP 1 of the two-step rebuild (s73 execution rules): the
 * pure port of docs/research/mock-sheets/Video Dossier.dc.html. The sheet's
 * own markup, its own classes, its own placeholder content — zero wiring.
 * This is the founder's structural verdict point; step 2 puts the real
 * project record behind these bands and deletes the old browser.
 *
 * The sheet's bands, top to bottom: the title row (back door · headline ·
 * state pill · editor door · the Approve door) · the attributed VERSIONS
 * strip, each version naming what changed it, with the re-brief tile last ·
 * the two-column body — player over the clips strip on the left, "The
 * record" fact list on the right, every fact a door · the closing
 * one-dimension-per-band line.
 *
 * Thumbnails stay the sheet's striped PLACEHOLDER on purpose (founder s75:
 * "also have placeholder until bmedia ready").
 */

interface Version {
  thumb: string;
  title: string;
  attribution: string;
  on: boolean;
}

/** The sheet's own version strip — placeholder content until step 2. */
const VERSIONS: Version[] = [
  { thumb: "brief", title: "Brief · master", attribution: "your prompt · 20 Jul", on: false },
  {
    thumb: "cut v1",
    title: "Cut v1 · 42.3s",
    attribution: "one-prompt run · 9 takes · today",
    on: true,
  },
  { thumb: "v2", title: "Cut v2", attribution: "re-brief · composing · beat 2/8", on: false },
];

interface Clip {
  thumb: string;
  caption: string;
  kind: string;
  platforms: { text: string; className: string }[];
}

/** The sheet's own four clip cards — placeholder content until step 2. */
const CLIPS: Clip[] = [
  {
    thumb: "hook · 16:9",
    caption: "Hook clip · 0:09",
    kind: "cut-down · beats 01–02",
    platforms: [
      { text: "LinkedIn ✓ live", className: "pchip pill-ok" },
      { text: "X ✓ live", className: "pchip pill-ok" },
    ],
  },
  {
    thumb: "mid · 9:16",
    caption: "Mid excerpt · 0:15",
    kind: "cut-down · beats 03–05",
    platforms: [{ text: "TikTok · draft", className: "pchip pill-idle" }],
  },
  {
    thumb: "close · 1:1",
    caption: "Close sting · 0:06",
    kind: "cut-down · beat 08",
    platforms: [{ text: "Instagram · queued", className: "pchip pill-idle" }],
  },
  {
    thumb: "teaser · 9:16",
    caption: "Standalone teaser · 0:12",
    kind: "own brief · not from the cut",
    platforms: [{ text: "in Approve", className: "pchip pill-warn" }],
  },
];

/** The sheet's own record rows — placeholder content until step 2. */
const FACTS: { key: string; value: string }[] = [
  { key: "Prompt & brief", value: "“a 40s film of the one-prompt flow…”" },
  { key: "Grounding", value: "3 sources · cited verbatim" },
  { key: "Judge", value: "cut v1 passed screen + final — gates, never rewrites" },
  { key: "Runs", value: "9 takes rendered · 94 cr · reasons on record" },
  { key: "Published", value: "2 posts live · each with its way back" },
  { key: "Media used", value: "6 generated · 2 imported — your music bed under the cut" },
];

export function VideoDossier() {
  return (
    <div className="content dossier-surface" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="card-link" href="/app/videos">
          ← Videos
        </Link>
        <h1 className="t-headline">One-prompt launch film</h1>
        <span className="pill pill-warn">in Approve</span>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm">
          Open in editor
        </button>
        <button type="button" className="btn btn-primary btn-sm">
          Send cut to Approve
        </button>
      </div>

      <div className="card">
        <div className="card-head" style={{ padding: "9px 16px" }}>
          <span className="t-title">Versions</span>
          <span className="t-label">attributed — every version names what changed it</span>
          <div style={{ flex: 1 }} />
          <span className="card-link">Cut history →</span>
        </div>
        <div className="ver-strip">
          {VERSIONS.map((version, i) => (
            <span key={version.title} style={{ display: "contents" }}>
              {i > 0 && <span className="ver-arrow">→</span>}
              <div className={version.on ? "ver on" : "ver"}>
                <div className="thumb-sm">
                  <span>{version.thumb}</span>
                </div>
                <div>
                  <div className="ver-t">{version.title}</div>
                  <div className="ver-a">{version.attribution}</div>
                </div>
              </div>
            </span>
          ))}
          <div className="ver" style={{ borderStyle: "dashed", background: "transparent" }}>
            <div>
              <div className="ver-t" style={{ color: "var(--n-800)" }}>
                + Re-brief
              </div>
              <div className="ver-a">new version, old ones kept</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dgrid">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="player">
            <div className="play-btn">
              <div className="play-tri" />
            </div>
            <div className="scrub">
              <span className="t-data" style={{ color: "var(--n-1000)" }}>
                0:00.0
              </span>
              <div className="bar-trough" style={{ flex: 1, height: 5 }}>
                <div className="bar-fill" style={{ width: "0%", background: "var(--act)" }} />
              </div>
              <span className="t-data">0:42.3</span>
            </div>
          </div>

          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">Clips — from cut v1</span>
              <span className="t-label">4 · each a recorded derivation, recut per platform</span>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn btn-ghost btn-sm">
                + Clip from this cut
              </button>
            </div>
            <div className="strip">
              {CLIPS.map((clip) => (
                <div key={clip.caption} className="clipcard">
                  <div className="thumb-md" style={{ width: 148, height: 84 }}>
                    <span>{clip.thumb}</span>
                  </div>
                  <div>
                    <div className="clip-cap">{clip.caption}</div>
                    <div className="clip-kind">{clip.kind}</div>
                  </div>
                  <div className="platrow">
                    {clip.platforms.map((platform) => (
                      <span key={platform.text} className={platform.className}>
                        {platform.text}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <span className="t-title">The record</span>
            <span className="t-label">every fact is a door</span>
          </div>
          {FACTS.map((fact) => (
            <div key={fact.key} className="fact-row">
              <div style={{ flex: 1 }}>
                <div className="fact-k">{fact.key}</div>
                <div className="fact-v">{fact.value}</div>
              </div>
              <span className="tile-arrow">→</span>
            </div>
          ))}
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">
              Imported media keeps “by you” provenance · publish gates apply the same
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <span className="t-label">
          One dimension per band — versions across time, clips per version, platforms per clip. The
          family never flattens into a matrix.
        </span>
      </div>
    </div>
  );
}
