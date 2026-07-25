import Link from "next/link";

/**
 * STEP 1 — the pure port of `docs/research/mock-sheets/Library.dc.html`
 * (DOCTRINE 0: the sheet is the blueprint, not inspiration). Markup and
 * classes are the sheet's own, React-ized; the content is still the
 * SHEET'S placeholder content — this is the structural verdict point, and
 * step 2 wires the library clients through the same bands.
 *
 * Bands, in the sheet's order: headline + source count + the grounding
 * label · the ingest band (box + Ingest) · one `.card` of source rows
 * carrying thumb → lead/excerpt → copy/export doors → the day stamp · the
 * per-tenant grounding footer.
 */
export function Library() {
  return (
    <div className="content" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Library</h1>
        <span className="pill pill-idle">5 sources</span>
        <div style={{ flex: 1 }} />
        <span className="t-label">
          everything here is grounding — the judge cites these verbatim
        </span>
      </div>

      <div className="ingest">
        <div className="ingest-box">
          Paste a video URL or drop a file — transcript in, chunked, ready to ground on…
        </div>
        <div className="btn btn-primary">Ingest</div>
      </div>

      <div className="card">
        <div className="row">
          <div className="thumb-sm">
            <span>video</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="src-lead">Build-step pipeline walkthrough</div>
            <div className="excerpt">
              Video · 12:40 · 84 chunks · grounds <Link href="/app/approve">3 drafts</Link>
            </div>
          </div>
          <div className="btn btn-ghost btn-sm">Copy transcript</div>
          <div className="btn btn-quiet btn-sm">Export</div>
          <span className="t-data">Tue</span>
        </div>
        <div className="row">
          <div className="thumb-sm">
            <span>clip frame</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="src-lead">Launch film · cut v1</div>
            <div className="excerpt">
              Video · 0:42 · own render · grounds <Link href="/app/approve">the clip plan</Link>
            </div>
          </div>
          <div className="btn btn-ghost btn-sm">Copy transcript</div>
          <div className="btn btn-quiet btn-sm">Export</div>
          <span className="t-data">Mon</span>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="src-lead">Deterministic rendering docs</div>
            <div className="excerpt">
              Article · 2,100 words · 31 chunks · grounds <Link href="/app/approve">2 drafts</Link>
            </div>
          </div>
          <div className="btn btn-ghost btn-sm">Copy text</div>
          <div className="btn btn-quiet btn-sm">Export</div>
          <span className="t-data">18 Jul</span>
        </div>
        <div className="row">
          <div className="thumb-sm">
            <span>post media</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="src-lead">Bluesky capture · @framecraft.example thread</div>
            <div className="excerpt">
              Intel capture · from the dossier · grounds <Link href="/app/approve">1 draft</Link> ·{" "}
              <a href="https://bsky.app/" target="_blank" rel="noreferrer">
                original post ↗
              </a>
            </div>
          </div>
          <div className="btn btn-ghost btn-sm">Copy text</div>
          <div className="btn btn-quiet btn-sm">Export</div>
          <span className="t-data">today</span>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="src-lead">Voice sample · the founder&rsquo;s register</div>
            <div className="excerpt">
              Text · seasons the profile voice · lives on{" "}
              <Link href="/app/profiles">profile v4</Link>
            </div>
          </div>
          <div className="btn btn-quiet btn-sm">Open profile</div>
          <span className="t-data">14 Jul</span>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <span className="t-label">
          Sources are per-tenant, chunked and embedded once — drafts cite them; nothing generates
          ungrounded.
        </span>
      </div>
    </div>
  );
}
