import "@/components/profiles/profiles.css";

/**
 * Profiles — STEP 1 OF THE TWO-STEP REBUILD (founder-ratified s73): the PURE
 * PORT of docs/research/mock-sheets/Profiles.dc.html. Every band, class,
 * style and string below is the sheet's own, and the content is the sheet's
 * placeholder content (its step 2, Voice) — this commit is the structural
 * verdict point, with zero old-design contamination and zero data wiring.
 *
 * Step 2 wires the real profile behind this chrome: the six wizard steps over
 * the live config, the save that CARRIES the non-form-backed blocks (icp ·
 * cadence · routing · outreach · social — dropping them has disarmed scoring
 * and the publish doors twice on staging), and the version history behind the
 * header pill. It also deletes the old implementation (profile-editor.tsx).
 *
 * `.profiles-surface` beside `.content` is the anchor every rule in
 * ./profiles.css hangs off — a per-surface stylesheet is still global, and
 * `.step`/`.field`/`.input`/`.on` are names other sheets reuse.
 */
export function ProfilesSurface() {
  return (
    <div className="content profiles-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Profiles</h1>
        <span className="pill pill-idle">editing → v5</span>
        <div style={{ flex: 1 }} />
        <span className="t-label">runs pin the version they used — nothing rewrites history</span>
      </div>

      <div className="wiz-grid">
        <div
          className="card"
          style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}
        >
          <div className="step done">
            <span className="step-dot">✓</span>Company
          </div>
          <div className="step on">
            <span className="step-dot">2</span>Voice
          </div>
          <div className="step">
            <span className="step-dot">3</span>Topics &amp; audience
          </div>
          <div className="step">
            <span className="step-dot">4</span>Platforms &amp; cadence
          </div>
          <div className="step">
            <span className="step-dot">5</span>Guardrails
          </div>
          <div className="step">
            <span className="step-dot">6</span>Review · save v5
          </div>
        </div>

        <div
          className="card"
          style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <div className="t-title" style={{ fontSize: 15 }}>
              How should Thalon sound?
            </div>
            <div className="t-label" style={{ marginTop: 3 }}>
              Pick the register, then let it learn from writing you already like.
            </div>
          </div>
          <div className="field">
            <span className="field-label">Tone — pick up to three</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="tone-chip on">Confident</span>
              <span className="tone-chip on">Concrete</span>
              <span className="tone-chip">Playful</span>
              <span className="tone-chip on">No hype</span>
              <span className="tone-chip">Technical</span>
              <span className="tone-chip">Warm</span>
              <span className="tone-chip">Contrarian</span>
            </div>
          </div>
          <div className="field">
            <span className="field-label">
              Voice sample — paste a post or paragraph that sounds like you
            </span>
            <div className="input" style={{ minHeight: 74, lineHeight: 1.55 }}>
              Our launch video has no editor file. It has a build step. We rendered the whole thing
              from HTML — every scene a component, every cut a commit.
            </div>
            <span className="t-label">
              The engine drafts in this register — it never copies the sample.
            </span>
          </div>
          <div className="field">
            <span className="field-label">Or point at writing you admire</span>
            <div className="input">
              <span className="ph">Paste a URL — a post, a newsletter issue, an article…</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
            <div className="btn btn-ghost">Back</div>
            <div style={{ flex: 1 }} />
            <span className="t-label">saved as you go</span>
            <div className="btn btn-primary">Continue → Topics</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="t-title">What this profile powers</span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>Intel</b> — your topics become watched areas; the ranker scores trends against
              them.
            </span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>Leads</b> — audience + company shape the ICP; every lead score cites them.
            </span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>Create</b> — voice + tone drive every draft; discoverability terms fall back to
              your topics.
            </span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>The judge</b> — guardrails become the denylist gate; nothing ships that crosses
              them.
            </span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>Calendar</b> — platform cadence caps the fan-out plan.
            </span>
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">Change anything later — a new version, never a rewrite.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
