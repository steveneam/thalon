import "@/components/leads/leads.css";

/**
 * Leads — STEP 1 OF THE TWO-STEP REBUILD (founder-ratified s73): the PURE
 * PORT of docs/research/mock-sheets/Leads.dc.html. Every band, class, style
 * and string below is the sheet's own, and the content is the sheet's
 * placeholder content, deliberately — this commit is the structural verdict
 * point, with zero old-design contamination and zero data wiring.
 *
 * Step 2 wires the real reads (the leads queue, its scores and reasons, the
 * outreach compose door) behind this byte-true resting chrome, weaves the
 * lead-score provenance keeper back in as state behind it, and deletes the
 * old implementation (lead-card.tsx, weights-provenance.tsx).
 *
 * `.leads-surface` beside `.content` is the anchor every rule in ./leads.css
 * hangs off — a per-surface stylesheet is still a global stylesheet, and this
 * sheet's `.split`/`.reason` values differ from Approve's and Intel's.
 */
export function LeadsSurface() {
  return (
    <div className="content leads-surface">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 className="t-headline">Leads</h1>
        <span className="pill pill-idle">12 scored</span>
        <span className="pill pill-warn">2 hot · follow up</span>
        <div style={{ flex: 1 }} />
        <div className="seg">
          <span className="seg-opt on">List</span>
          <span className="seg-opt">Board</span>
        </div>
        <div className="btn btn-ghost btn-sm">Import contacts</div>
      </div>

      <div className="split">
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div className="row sel">
              <div className="mono-badge">MK</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lead-name">Mara Kessler · Fieldline Robotics</div>
                <div className="excerpt">
                  Ops lead · asked about content automation on the webinar
                </div>
              </div>
              <div className="score-chip">
                <div className="bar-trough" style={{ width: 44 }}>
                  <div className="bar-fill" style={{ width: "88%", background: "var(--heat-hot)" }} />
                </div>
                <span className="t-data">0.88</span>
              </div>
            </div>
            <div className="row">
              <div className="mono-badge">JT</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lead-name">Jonah Tran · Brightpath Clinics</div>
                <div className="excerpt">Marketing manager · downloaded the pipeline article</div>
              </div>
              <div className="score-chip">
                <div className="bar-trough" style={{ width: 44 }}>
                  <div className="bar-fill" style={{ width: "81%", background: "var(--heat-hot)" }} />
                </div>
                <span className="t-data">0.81</span>
              </div>
            </div>
            <div className="row">
              <div className="mono-badge">RS</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lead-name">Rhea Solano · Copperline Cafés</div>
                <div className="excerpt">Owner · replied to the LinkedIn launch post</div>
              </div>
              <div className="score-chip">
                <div className="bar-trough" style={{ width: 44 }}>
                  <div
                    className="bar-fill"
                    style={{ width: "64%", background: "var(--heat-rising)" }}
                  />
                </div>
                <span className="t-data">0.64</span>
              </div>
            </div>
            <div className="row">
              <div className="mono-badge">DA</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lead-name">Dev Anand · Northgate Legal</div>
                <div className="excerpt">Partner · site visit from the horizon keyword</div>
              </div>
              <div className="score-chip">
                <div className="bar-trough" style={{ width: 44 }}>
                  <div
                    className="bar-fill"
                    style={{ width: "52%", background: "var(--heat-warm)" }}
                  />
                </div>
                <span className="t-data">0.52</span>
              </div>
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
            <span className="t-label">best fit first · reasons on every score</span>
            <div style={{ flex: 1 }} />
            <span className="kbd">j</span>
            <span className="kbd">k</span>
            <span className="t-label">move</span>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="card-head">
            <span className="t-title">Mara Kessler · Fieldline Robotics</span>
            <span className="pill pill-warn">follow up</span>
            <div style={{ flex: 1 }} />
            <span className="t-data" title="lead 8c31f2aa">
              #8c31f2aa
            </span>
          </div>
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="sec-label">Why this score</span>
                <div className="reason">
                  <span className="rname">ICP fit 0.92</span>
                  <div className="bar-trough">
                    <div
                      className="bar-fill"
                      style={{ width: "92%", background: "var(--heat-hot)" }}
                    />
                  </div>
                  <span>ops lead at a 40-person robotics firm</span>
                </div>
                <div className="reason">
                  <span className="rname">Intent 0.86</span>
                  <div className="bar-trough">
                    <div
                      className="bar-fill"
                      style={{ width: "86%", background: "var(--heat-hot)" }}
                    />
                  </div>
                  <span>asked about automation · webinar Q&amp;A</span>
                </div>
                <div className="reason">
                  <span className="rname">Recency 0.78</span>
                  <div className="bar-trough">
                    <div
                      className="bar-fill"
                      style={{ width: "78%", background: "var(--heat-rising)" }}
                    />
                  </div>
                  <span>last touch 3 days ago</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="sec-label">Activity</span>
                <div className="act-row">
                  <span className="dot" style={{ background: "var(--n-700)", marginTop: 5 }} />
                  <span style={{ flex: 1 }}>
                    Webinar question on content automation
                    <br />
                    <span className="t-data">Tue · 22 Jul</span>
                  </span>
                </div>
                <div className="act-row">
                  <span className="dot" style={{ background: "var(--n-700)", marginTop: 5 }} />
                  <span style={{ flex: 1 }}>
                    Opened the launch email · clicked the film
                    <br />
                    <span className="t-data">Mon · 21 Jul</span>
                  </span>
                </div>
                <div className="act-row">
                  <span className="dot" style={{ background: "var(--n-700)", marginTop: 5 }} />
                  <span style={{ flex: 1 }}>
                    First seen — pipeline article visit
                    <br />
                    <span className="t-data">Fri · 18 Jul</span>
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="sec-label">Drafted outreach — draft-only, never auto-sent</span>
                <div style={{ flex: 1 }} />
                <span className="pill pill-ok">judge passed</span>
              </div>
              <div className="mail">
                <div>
                  <span style={{ color: "var(--n-900)" }}>To</span>&nbsp; Mara Kessler
                  &lt;mara@fieldline.example&gt;
                </div>
                <div>
                  <span style={{ color: "var(--n-900)" }}>Subject</span>&nbsp; Your webinar question
                  — the build-step answer
                </div>
                <div style={{ color: "var(--n-900)", lineHeight: 1.6 }}>
                  You asked whether launch content can run as a pipeline instead of a project. We
                  just shipped ours that way — the film in this link was rendered from HTML by the
                  same system that drafts our posts…
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="btn btn-primary btn-sm">Copy body</div>
                <div className="btn btn-ghost btn-sm">Copy subject</div>
                <div className="btn btn-ghost btn-sm">Open in your mail client</div>
                <div className="btn btn-quiet btn-sm">Log a call</div>
                <div style={{ flex: 1 }} />
                <span className="t-label">you send it — from your own mailbox</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
