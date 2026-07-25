import "@/components/sites/sites.css";

/**
 * Sites — STEP 1 of the two-step rebuild (s73 execution rules): the pure
 * port of docs/research/mock-sheets/Sites.dc.html. The sheet's own markup,
 * its own classes, its own placeholder content — zero wiring. This is the
 * founder's structural verdict point; step 2 puts the real catalog behind
 * these bands and deletes the old gallery.
 *
 * The sheet's bands, top to bottom: the headline row with its two count
 * pills · the build card (prompt box + primary button + the portfolio
 * category chips) · the three-column site grid, each card a striped preview
 * shot over a meta row (name · state pill · dossier door) · the closing
 * record line.
 */

/** The sheet's own chip vocabulary — placeholder content until step 2. */
const CATEGORIES = [
  "Café · warm",
  "Trades · competence",
  "Restaurant · cinematic",
  "Distributor · editorial",
  "Studio · kinetic",
  "More →",
];

/** The sheet's own six fixture cards — placeholder content until step 2. */
const SITES: { name: string; state: "Live" | "Draft" }[] = [
  { name: "Sparkwright", state: "Live" },
  { name: "Ridge & Valley", state: "Draft" },
  { name: "First Crack", state: "Draft" },
  { name: "Stem & Vow", state: "Draft" },
  { name: "Sprig & Barrow", state: "Live" },
  { name: "Hartline", state: "Draft" },
];

export function Sites() {
  return (
    <div className="content sites-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Sites</h1>
        <span className="pill pill-idle">17 built</span>
        <span className="pill pill-ok">2 live</span>
        <div style={{ flex: 1 }} />
      </div>

      <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="prompt-box">
            A landing page for… describe the business in one line; the engine picks the register.
          </div>
          <button type="button" className="btn btn-primary">
            Build site
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="t-label" style={{ marginRight: 2 }}>
            Or start from the portfolio —
          </span>
          {CATEGORIES.map((category) => (
            <span key={category} className="cat-chip">
              {category}
            </span>
          ))}
        </div>
      </div>

      <div className="site-grid">
        {SITES.map((site) => (
          <div key={site.name} className="site-card">
            <div className="site-shot">
              <span>site preview · hero</span>
            </div>
            <div className="site-meta">
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{site.name}</span>
              <span className={site.state === "Live" ? "pill pill-ok" : "pill pill-idle"}>
                {site.state}
              </span>
              <span className="card-link">Dossier →</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex" }}>
        <span className="t-label">
          Every site carries its record — prompt, plan, mint ledger, verdicts — in its dossier.
        </span>
      </div>
    </div>
  );
}
