import "@/components/settings/settings.css";

/**
 * Settings → Integrations — STEP 1 of the two-step rebuild (s73 execution
 * rules): the pure port of docs/research/mock-sheets/Integrations.dc.html.
 * The sheet's own markup, its own classes, its own placeholder content —
 * zero wiring. This is the founder's structural verdict point; step 2 puts
 * the engine's card derivation behind these bands and deletes the old panel.
 *
 * The sheet's bands: the breadcrumbed headline with the published-ledger
 * door · the three-column destination grid, each card a platform glyph +
 * name + state pill over its one honest sub-line and its actions · the
 * "Your AI" card with a seat row per model seat.
 */

/** The sheet's own nine fixture cards — placeholder content until step 2. */
const CARDS: {
  glyph: string;
  name: string;
  pill: string;
  state: string;
  sub: string;
  actions: { label: string; variant: "btn-ghost" | "btn-quiet" }[];
}[] = [
  {
    glyph: "in",
    name: "LinkedIn",
    pill: "pill pill-ok",
    state: "Connected",
    sub: "Posting as Steven · validated against the live API version",
    actions: [
      { label: "Validate", variant: "btn-ghost" },
      { label: "Disconnect", variant: "btn-quiet" },
    ],
  },
  {
    glyph: "f",
    name: "Facebook",
    pill: "pill pill-ok",
    state: "Connected",
    sub: "Posting to the MacTechDish page",
    actions: [
      { label: "Validate", variant: "btn-ghost" },
      { label: "Disconnect", variant: "btn-quiet" },
    ],
  },
  {
    glyph: "𝕏",
    name: "X",
    pill: "pill pill-idle",
    state: "Connected via env",
    sub: "OAuth 1.0a keys from the environment — vault connect available",
    actions: [{ label: "Move into vault", variant: "btn-ghost" }],
  },
  {
    glyph: "ig",
    name: "Instagram",
    pill: "pill pill-idle",
    state: "Almost ready",
    sub: "Needs public image URLs — shipping — then the Graph connect",
    actions: [{ label: "Set up", variant: "btn-ghost" }],
  },
  {
    glyph: "yt",
    name: "YouTube",
    pill: "pill pill-ok",
    state: "Intel connected",
    sub: "Feeding trend sweeps · posting arrives with the video door",
    actions: [{ label: "Validate", variant: "btn-ghost" }],
  },
  {
    glyph: "tk",
    name: "TikTok",
    pill: "pill pill-idle",
    state: "Not connected",
    sub: "Official API only — connect when the app review clears",
    actions: [{ label: "Set up", variant: "btn-ghost" }],
  },
  {
    glyph: "bl",
    name: "Blog · your site",
    pill: "pill pill-ok",
    state: "Live",
    sub: "First-class destination — 4 published, RSS on",
    actions: [{ label: "Open /blog ↗", variant: "btn-ghost" }],
  },
  {
    glyph: "bs",
    name: "Bluesky",
    pill: "pill pill-ok",
    state: "Intel connected",
    sub: "Feeding trend sweeps · posting driver ready to arm",
    actions: [{ label: "Validate", variant: "btn-ghost" }],
  },
  {
    glyph: "@",
    name: "Email · outreach",
    pill: "pill pill-ok",
    state: "Connected",
    sub: "Drafts only by doctrine — sending stays two-key armed",
    actions: [{ label: "Validate", variant: "btn-ghost" }],
  },
];

/** The sheet's own three model seats — placeholder content until step 2. */
const SEATS = [
  { label: "Draft seat", value: "opus-5 · via your subscription" },
  { label: "Judge seat", value: "opus-5 · via your subscription" },
  { label: "Embed seat", value: "gateway · metered per tenant" },
];

export function Integrations() {
  return (
    <div className="content settings-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="t-label">Settings ›</span>
        <h1 className="t-headline">Integrations</h1>
        <div style={{ flex: 1 }} />
        <button type="button" className="card-link">
          Published · 4 items →
        </button>
      </div>

      <div className="int-grid">
        {CARDS.map((card) => (
          <div key={card.name} className="int-card">
            <div className="int-head">
              <div className="plat-ico">{card.glyph}</div>
              <span className="int-name">{card.name}</span>
              <span className={card.pill}>{card.state}</span>
            </div>
            <span className="int-sub">{card.sub}</span>
            <div className="int-actions">
              {card.actions.map((action) => (
                <button key={action.label} type="button" className={`btn ${action.variant} btn-sm`}>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="t-title">Your AI</span>
          <span className="pill pill-idle">3 model seats</span>
          <div style={{ flex: 1 }} />
          <span className="t-label">bring-your-own connect arrives with the BYO-AI bucket</span>
        </div>
        {SEATS.map((seat) => (
          <div key={seat.label} className="seat-row">
            <span style={{ width: 110, color: "var(--n-900)", fontSize: 12.5 }}>{seat.label}</span>
            <span style={{ flex: 1 }}>{seat.value}</span>
            <span className="pill pill-idle">env</span>
          </div>
        ))}
      </div>
    </div>
  );
}
