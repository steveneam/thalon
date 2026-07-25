import "@/components/approve/approve.css";

/**
 * STEP 1 — the PURE PORT of `docs/research/mock-sheets/Approve.dc.html`
 * (DOCTRINE 0, ui-overhaul-plan §5; the two-step rule in
 * docs/research/old-design-keepers.md): the sheet's own markup and its own
 * placeholder content, React-ized, with the helmet atomics in
 * ./approve.css and every shared class taken from workspace.css as-is.
 * No data, no behaviour — this is the founder's structural verdict point,
 * screenshot-diffed against the sheet before step 2 wires it.
 *
 * The rail/topbar chrome around this belongs to the shell (already ported
 * at s73) — the surface owns the sheet's `.content` band downward, exactly
 * as the Dashboard rebuild does.
 */
export function ApproveSurface() {
  return (
    <div className="content">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 className="t-headline">Approve</h1>
        <span className="pill pill-warn">3 waiting</span>
        <span className="pill pill-err">1 blocked</span>
        <div style={{ flex: 1 }} />
        <div className="btn btn-ghost btn-sm sel-ctl">
          Oldest first
          <span className="chev" />
        </div>
        <div className="btn btn-ghost btn-sm sel-ctl">
          All drafts
          <span className="chev" />
        </div>
        <div className="btn btn-primary btn-sm">Approve all waiting (3)</div>
      </div>
      <div className="split">
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div className="row sel q-row">
              <div className="thumb-sm">
                <span>clip frame</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="q-title">Our launch video has no editor file. It has a build step.</div>
                <div className="excerpt">
                  LinkedIn · clip 0:12–0:47 ·{" "}
                  <em>“We rendered the whole thing from HTML — every scene a component…”</em>
                </div>
              </div>
              <span className="pill pill-warn">Waiting</span>
              <span className="t-data">4 Jul, 09:00</span>
            </div>
            <div className="row q-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="q-title">
                  The export queue disappeared the day video became a build artifact
                </div>
                <div className="excerpt">
                  X · post · <em>“No timeline. No render farm. A rebuild.”</em>
                </div>
              </div>
              <span className="pill pill-warn">Waiting</span>
              <span className="t-data">4 Jul, 08:41</span>
            </div>
            <div className="row q-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="q-title">Works with every platform — one pipeline, every destination</div>
                <div className="excerpt">
                  LinkedIn · post ·{" "}
                  <span style={{ color: "var(--err)" }}>grounding failed — no source supports the claim</span>
                </div>
              </div>
              <span className="pill pill-err">Blocked</span>
              <span className="t-data">3 Jul, 17:22</span>
            </div>
            <div className="row q-row">
              <div className="thumb-sm">
                <span>post image</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="q-title">Render your launch film from HTML — the deterministic pipeline</div>
                <div className="excerpt">
                  Facebook · post ·{" "}
                  <em>“The same system that drafts our posts renders the film…”</em>
                </div>
              </div>
              <span className="pill pill-warn">Waiting</span>
              <span className="t-data">3 Jul, 16:05</span>
            </div>
            <div className="row q-row">
              <div className="thumb-sm">
                <span>page hero</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="q-title">From HTML to launch film: inside the build-step pipeline</div>
                <div className="excerpt">
                  Blog · article · <em>2,100 words · 4 sections · hero image attached</em>
                </div>
              </div>
              <span className="pill pill-ok">Approved</span>
              <span className="t-data">2 Jul, 11:14</span>
            </div>
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
            <span className="t-label">5 of 5</span>
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
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="card-head">
            <span className="pill pill-warn">Waiting</span>
            <span className="t-title">LinkedIn draft · clip plan</span>
            <span className="t-label">0:12–0:47 · 35s</span>
            <div style={{ flex: 1 }} />
            <span className="t-data" title="Deep link · draft 3f9a2c1e">
              #3f9a2c1e
            </span>
          </div>
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              padding: "18px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div className="ver-strip">
              <span className="ver-dot" />
              <span>
                <b style={{ fontWeight: 600 }}>v1</b> · engine draft
              </span>
              <span style={{ color: "var(--n-700)" }}>→</span>
              <span className="ver-dot" style={{ background: "var(--act)" }} />
              <span style={{ color: "var(--n-1000)" }}>
                <b style={{ fontWeight: 600 }}>v2</b> · edited by you · 2h ago
              </span>
              <span style={{ color: "var(--n-700)" }}>→</span>
              <span>judge re-ran on v2</span>
              <div style={{ flex: 1 }} />
              <a className="card-link" href="#">
                View diff →
              </a>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div className="thumb-md" style={{ width: 200, height: 112 }}>
                <span>clip frame · 0:14</span>
              </div>
              <div className="draft-body" style={{ flex: 1 }}>
                <p>Our launch video has no editor file. It has a build step.</p>
                <p>
                  We rendered the whole thing from HTML — every scene is a component, every cut a
                  commit. No timeline editor, no export queue: the same AI pipeline that drafts our
                  posts renders the film, and a re-render is just a rebuild.
                </p>
                <p>
                  Deterministic video means the launch clip gets code-reviewed like everything else
                  that ships.
                </p>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                padding: "12px 14px",
                background: "var(--ok-subtle)",
                borderRadius: 8,
              }}
            >
              <span className="check" title="g1">
                <span className="ck">✓</span>Denylist
              </span>
              <span className="check" title="g3_screen">
                <span className="ck">✓</span>Grounding — screen
              </span>
              <span className="check" title="g3_final">
                <span className="ck">✓</span>Grounding — final
              </span>
              <span
                className="check check-warn"
                title="discoverability · advisory — warns, never blocks · targets: AI · content automation · build-step video · deterministic video"
              >
                <span className="ck">◐</span>Discoverability — 3 of 4 · “content automation” not in
                the body
              </span>
              <div style={{ flex: 1 }} />
              <span className="t-label">reasons on record →</span>
            </div>
            <div className="src-line">
              <span>From</span>
              <a href="#">@framecraft.example on Bluesky ↗</a>
              <span>·</span>
              <span>run 4 Jul, 09:00</span>
              <span>·</span>
              <span>profile v4</span>
              <span>·</span>
              <span>drafted opus-5 · judged opus-5</span>
              <span>·</span>
              <span style={{ color: "var(--n-800)" }}>the judge gates — it never rewrites</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 24px",
              borderTop: "1px solid var(--n-400)",
            }}
          >
            <div className="btn btn-primary">Approve</div>
            <div className="btn btn-ghost">Edit</div>
            <span className="t-label" style={{ marginLeft: 6 }}>
              recorded — nothing publishes until the door arms
            </span>
            <div style={{ flex: 1 }} />
            <div className="btn btn-danger">Reject…</div>
          </div>
        </div>
      </div>
    </div>
  );
}
