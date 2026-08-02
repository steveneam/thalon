/**
 * The rail's icon set — the mock sheets' own inline SVGs, ported verbatim
 * (DOCTRINE 0: the sheet's bytes win). Keyed by surface label; the rail is
 * the only consumer until other chrome rebuilds adopt them.
 */

function Ico({ children, joins = false }: { children: React.ReactNode; joins?: boolean }) {
  return (
    <svg
      aria-hidden
      className="nav-ico"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin={joins ? "round" : undefined}
    >
      {children}
    </svg>
  );
}

export const RAIL_ICONS: Record<string, React.ReactNode> = {
  Home: (
    <Ico joins>
      <path d="M3 8.5 8 4l5 4.5" />
      <path d="M4.5 7.5V13h7V7.5" />
    </Ico>
  ),
  Intel: (
    <Ico>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v2.2M8 12v2.2M1.8 8H4M12 8h2.2" />
    </Ico>
  ),
  Create: (
    <Ico>
      <path d="M8 3.5v9M3.5 8h9" />
    </Ico>
  ),
  Approve: (
    <Ico joins>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8.2 7.3 10l3.4-3.6" />
    </Ico>
  ),
  // Keyed by the CURRENT nav label — this sat as `Calendar` after the
  // Calendar→Schedule rename, so the Schedule rail item rendered iconless
  // (found s92: the board screenshot showed it, the analytics lane named it).
  Schedule: (
    <Ico>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </Ico>
  ),
  Analytics: (
    <Ico joins>
      <path d="M2.8 13.2V9.6M6.6 13.2V5.4M10.4 13.2v-5M14.2 13.2V3.2" />
    </Ico>
  ),
  Leads: (
    <Ico>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" />
    </Ico>
  ),
  Transcription: (
    <Ico>
      <rect x="3" y="2.5" width="3.4" height="11" rx="0.8" />
      <rect x="8.2" y="2.5" width="3.4" height="11" rx="0.8" transform="rotate(7 9.9 8)" />
    </Ico>
  ),
  Videos: (
    <Ico joins>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
      <path d="M7 6.2v3.6L10 8z" />
    </Ico>
  ),
  Sites: (
    <Ico>
      <circle cx="8" cy="8" r="5.7" />
      <path d="M2.5 8h11M8 2.5c2 1.8 2 9.2 0 11" />
    </Ico>
  ),
  Runs: (
    <Ico>
      <circle cx="8" cy="8" r="5.7" />
      <path d="M8 5v3.2l2.2 1.4" />
    </Ico>
  ),
  Profiles: (
    <Ico>
      <circle cx="8" cy="6" r="2.4" />
      <rect x="3.5" y="10.2" width="9" height="3.4" rx="1.7" />
    </Ico>
  ),
  Settings: (
    <Ico>
      <path d="M3 5.2h10M3 10.8h10" />
      <circle cx="6.2" cy="5.2" r="1.6" />
      <circle cx="9.8" cy="10.8" r="1.6" />
    </Ico>
  ),
};
