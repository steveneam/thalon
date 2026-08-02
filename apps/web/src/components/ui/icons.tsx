import type { SVGProps } from "react";

/**
 * The canonical workspace icon grammar (Phase D spine design, s59): 17px
 * default, 1.8px stroke, no fills, one metaphor per feature. The rail, the
 * nav registry, and the Cmd-K palette all draw from this set — a surface
 * that reaches for a local icon variant of a registered feature is a defect
 * (workspace-phase-d-designs.md §icon cleanup).
 */

export type WorkspaceIcon = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

function Glyph({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

/** The journey spine: stations on the line. */
export function IconJourney(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="4" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="20" cy="12" r="1.6" />
      <path d="M5.6 12h4.8M13.6 12h4.8" />
    </Glyph>
  );
}

/** Intel: the radar sweep. */
export function IconIntel(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4.5 19.5A15 15 0 0 1 19.5 4.5" />
      <path d="M4.5 19.5a8.5 8.5 0 0 1 8.5-8.5" />
      <path d="M4.5 19.5 13 11" />
      <circle cx="16" cy="13" r="1.4" />
    </Glyph>
  );
}

/** Leads: a person with their record lines. */
export function IconLeads(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 8h5M16 12h5" />
    </Glyph>
  );
}

/** Create: the spark. */
export function IconCreate(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 3.5 13.9 10.1 20.5 12 13.9 13.9 12 20.5 10.1 13.9 3.5 12 10.1 10.1Z" />
    </Glyph>
  );
}

/** Library: book spines on the shelf. */
export function IconLibrary(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4 5h4v14H4zM10 5h4v14h-4zM16.5 5.5l3.5 1-3 13-3.5-1z" />
    </Glyph>
  );
}

/** Videos: the player. */
export function IconVideos(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10.5l5-3v9l-5-3z" />
    </Glyph>
  );
}

/** Sites: the browser frame — a page output you can visit. */
export function IconSites(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
      <path d="M6 7h.01M9 7h.01" />
    </Glyph>
  );
}

/** Approve: the double nod. */
export function IconApprove(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M2.5 13.5l4 4L15 8.5" />
      <path d="M11.5 15.5l2 2L21.5 8.5" />
    </Glyph>
  );
}

/** Runs: the trend line. */
export function IconRuns(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4 17l5-5 4 3 7-8" />
      <path d="M15 7h5v5" />
    </Glyph>
  );
}

/** Analytics: the measure — four bars, the sheet's rail metaphor. */
export function IconAnalytics(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M4.5 20v-5.5M10 20V8M15.5 20v-7.5M21 20V4.5" />
    </Glyph>
  );
}

/** Calendar: the month sheet. */
export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
      <path d="M7.5 14h1.5M11.25 14h1.5M15 14h1.5M7.5 17h1.5M11.25 17h1.5" />
    </Glyph>
  );
}

/** Profiles: the person. */
export function IconProfiles(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
    </Glyph>
  );
}

/** Settings: the gear. */
export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </Glyph>
  );
}
