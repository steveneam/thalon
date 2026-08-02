import {
  IconAnalytics,
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
  IconSites,
  IconVideos,
  type WorkspaceIcon,
} from "@/components/ui/icons";

/**
 * The ONE registry of workspace surfaces — the labeled side nav, the Cmd-K
 * palette, and the topbar title all route from this list so a surface can
 * never exist in one and be missing from another. Order and labels are the
 * founder-verdicted wave-0 mock's, verbatim (kickoff step 3), plus the D4
 * ratified rail addition (2026-07-29 sweep — Analytics joins under Schedule):
 * Home · Intel · Create · Approve(count) · Schedule · Analytics ┃ Leads ·
 * Library · Videos · Sites · Runs ┃ Profiles · Settings. (The s74
 * "Transcription" rename retired s94 — the §5.3 ruling put the sheets' own
 * "Library" back once the shelf widened beyond transcripts.)
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
   * Which nav group the surface sits in (the mock's three clusters):
   * "work" = the operating spine · "outputs" = what the engine made ·
   * "account" = whose workspace and how it's wired.
   */
  section: "work" | "outputs" | "account";
  /** The Approve entry renders the needs-you count next to its label. */
  showsNeedsYou?: boolean;
}

export const NAV_SURFACES: NavSurface[] = [
  {
    label: "Home",
    href: "/app",
    icon: IconJourney,
    hint: "What needs you, what's running, the week ahead",
    keywords: ["home", "dashboard", "pulse", "overview", "journey", "spine", "pipeline"],
    section: "work",
  },
  {
    label: "Intel",
    href: "/app/intel",
    icon: IconIntel,
    hint: "Trends rising on social · demand rising on search",
    keywords: ["trends", "search", "areas", "keywords", "horizon", "seo", "monitor"],
    section: "work",
  },
  {
    label: "Create",
    href: "/app/create",
    icon: IconCreate,
    hint: "Post, video, or page from one prompt",
    keywords: ["generate", "draft", "prompt", "video", "post", "page", "new"],
    section: "work",
  },
  {
    label: "Approve",
    href: "/app/approve",
    icon: IconApprove,
    hint: "Review queued drafts — nothing ships without your click",
    keywords: ["queue", "review", "drafts", "judge", "publish"],
    section: "work",
    showsNeedsYou: true,
  },
  {
    label: "Schedule",
    href: "/app/schedule",
    icon: IconCalendar,
    hint: "The fan-out plan — what will go out, when, where",
    keywords: ["schedule", "fanout", "slots", "month", "week", "agenda", "reschedule"],
    section: "work",
  },
  {
    // s92: the D4 ratified rail — Analytics directly under Schedule, so the
    // rail reads as the loop it is (Intel measures the market → Create →
    // Approve → Schedule → Analytics measures us).
    label: "Analytics",
    href: "/app/analytics",
    icon: IconAnalytics,
    hint: "What YOUR posts did — reach, engagement, and the honest gaps",
    keywords: ["metrics", "reach", "engagement", "impressions", "performance", "measure", "posts"],
    section: "work",
  },
  {
    label: "Leads",
    href: "/app/leads",
    icon: IconLeads,
    hint: "Contacts scored against your ICP — with the reasons spelled out",
    keywords: ["crm", "leads", "contacts", "prospects", "icp", "waitlist", "import", "csv"],
    section: "outputs",
  },
  {
    label: "Library",
    href: "/app/library",
    icon: IconLibrary,
    hint: "The grounding shelf — every ingested source, by kind, ready to cite",
    keywords: ["library", "transcript", "transcription", "video", "url", "youtube", "ingest", "captions", "srt", "sources", "grounding", "article"],
    section: "outputs",
  },
  {
    label: "Videos",
    href: "/app/videos",
    icon: IconVideos,
    hint: "Video projects — takes, versioned cuts, and the reasons on record",
    keywords: ["projects", "takes", "cuts", "rejects", "edl", "film", "editor", "provenance"],
    section: "outputs",
  },
  {
    label: "Sites",
    href: "/app/sites",
    icon: IconSites,
    hint: "The page outputs — every built site, its record, and its preview",
    keywords: ["sites", "pages", "landing", "portfolio", "templates", "gallery"],
    section: "outputs",
  },
  {
    label: "Runs",
    href: "/app/runs",
    icon: IconRuns,
    hint: "Run history, status, and failure triage",
    keywords: ["history", "fanout", "errors", "lastError", "triage"],
    section: "outputs",
  },
  {
    label: "Profiles",
    href: "/app/profiles",
    icon: IconProfiles,
    hint: "Brand identity, voice, platforms, denylist, topics",
    keywords: ["brand", "identity", "voice", "denylist", "topics", "tenant"],
    section: "account",
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: IconSettings,
    hint: "Integrations, budget caps, driver seams",
    keywords: [
      "config",
      "budget",
      "drivers",
      "seams",
      "watchlist",
      "env",
      "integrations",
      "connect",
      "destinations",
      "accounts",
      "credentials",
    ],
    section: "account",
  },
];

/** The nav's three clusters, in render order, with a11y-only group names. */
export const NAV_SECTIONS: Array<{ id: NavSurface["section"]; title: string }> = [
  { id: "work", title: "Work" },
  { id: "outputs", title: "Outputs" },
  { id: "account", title: "Account" },
];

/** Longest-prefix match so /app/intel highlights Intel, not Home. */
export function activeSurface(pathname: string): NavSurface | undefined {
  return NAV_SURFACES.filter(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}
