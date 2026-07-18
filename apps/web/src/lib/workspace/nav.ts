import {
  IconApprove,
  IconCalendar,
  IconCreate,
  IconIntel,
  IconJourney,
  IconLeads,
  IconLibrary,
  IconProfiles,
  IconRuns,
  IconSettings,
  IconVideos,
  type WorkspaceIcon,
} from "@/components/ui/icons";

/**
 * The ONE registry of workspace surfaces (docs/FRONTEND.md §3 shell) — the
 * icon rail, the Cmd-K palette, and the journey spine all route from this
 * list so a surface can never exist in one and be missing from another.
 * Icons come from the canonical set (components/ui/icons.tsx) — one
 * metaphor per feature, everywhere.
 */
export interface NavSurface {
  label: string;
  href: string;
  icon: WorkspaceIcon;
  /** One line: what the operator does here — palette/omnibox subtitle. */
  hint: string;
  /** Omnibox/palette match terms beyond the label. */
  keywords: string[];
  /**
   * Where the surface lives in the shell (Phase D spine design): journey
   * surfaces are stations ON the spine and leave the rail entirely; "main"
   * rail entries are the extras strip; "foot" pins to the rail's foot.
   */
  rail?: "main" | "foot";
  /** The Approve entry renders the needs-you count next to its label. */
  showsNeedsYou?: boolean;
}

export const NAV_SURFACES: NavSurface[] = [
  {
    label: "Dashboard",
    href: "/app",
    icon: IconJourney,
    hint: "The journey spine — every asset walks the line",
    keywords: ["home", "pulse", "overview", "journey", "spine", "pipeline"],
  },
  {
    label: "Intel",
    href: "/app/intel",
    icon: IconIntel,
    hint: "Trends rising on social · demand rising on search",
    keywords: ["trends", "search", "areas", "keywords", "horizon", "seo", "monitor"],
  },
  {
    label: "Leads",
    href: "/app/leads",
    icon: IconLeads,
    hint: "Contacts scored against your ICP — with the reasons spelled out",
    keywords: ["crm", "leads", "contacts", "prospects", "icp", "waitlist", "import", "csv"],
    rail: "main",
  },
  {
    label: "Create",
    href: "/app/create",
    icon: IconCreate,
    hint: "Post, video, or page from one prompt",
    keywords: ["generate", "draft", "prompt", "video", "post", "page", "new"],
  },
  {
    label: "Library",
    href: "/app/library",
    icon: IconLibrary,
    hint: "Paste a video URL — transcript in, ready to copy, export, and ground on",
    keywords: ["transcript", "video", "url", "youtube", "ingest", "captions", "srt", "csv", "sources"],
    rail: "main",
  },
  {
    label: "Videos",
    href: "/app/videos",
    icon: IconVideos,
    hint: "Video projects — takes, versioned cuts, and the reasons on record",
    keywords: ["projects", "takes", "cuts", "rejects", "edl", "film", "editor", "provenance"],
    rail: "main",
  },
  {
    label: "Approve",
    href: "/app/approve",
    icon: IconApprove,
    hint: "Review queued drafts — nothing ships without your click",
    keywords: ["queue", "review", "drafts", "judge", "publish"],
    showsNeedsYou: true,
  },
  {
    label: "Calendar",
    href: "/app/calendar",
    icon: IconCalendar,
    hint: "The fan-out plan — what will go out, when, where",
    keywords: ["schedule", "fanout", "slots", "month", "week", "agenda", "reschedule"],
  },
  {
    label: "Runs",
    href: "/app/runs",
    icon: IconRuns,
    hint: "Run history, status, and failure triage",
    keywords: ["history", "fanout", "errors", "lastError", "triage"],
    rail: "main",
  },
  {
    label: "Profiles",
    href: "/app/profiles",
    icon: IconProfiles,
    hint: "Brand identity, voice, platforms, denylist, topics",
    keywords: ["brand", "identity", "voice", "denylist", "topics", "tenant"],
    rail: "foot",
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: IconSettings,
    hint: "Watchlists, budget caps, driver seams",
    keywords: ["config", "budget", "drivers", "seams", "watchlist", "env"],
    rail: "foot",
  },
];

/** The journey surfaces — stations on the spine, deliberately absent from the rail. */
export const JOURNEY_HREFS = new Set(
  NAV_SURFACES.filter((s) => s.rail === undefined).map((s) => s.href),
);

/** Longest-prefix match so /app/intel highlights Intel, not Dashboard. */
export function activeSurface(pathname: string): NavSurface | undefined {
  return NAV_SURFACES.filter(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}
