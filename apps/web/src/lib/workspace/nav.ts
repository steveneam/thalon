import {
  CheckCheck,
  LayoutDashboard,
  ListChecks,
  Radar,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The ONE registry of workspace surfaces (docs/FRONTEND.md §3 shell) — the
 * sidebar, the Cmd-K palette, and the dashboard omnibox all route from this
 * list so a surface can never exist in one and be missing from another.
 */
export interface NavSurface {
  label: string;
  href: string;
  icon: LucideIcon;
  /** One line: what the operator does here — palette/omnibox subtitle. */
  hint: string;
  /** Omnibox/palette match terms beyond the label. */
  keywords: string[];
  /** The Approve entry renders the needs-you count next to its label. */
  showsNeedsYou?: boolean;
}

export const NAV_SURFACES: NavSurface[] = [
  {
    label: "Dashboard",
    href: "/app",
    icon: LayoutDashboard,
    hint: "What needs you, what the engine is doing, what to do next",
    keywords: ["home", "pulse", "overview", "activity"],
  },
  {
    label: "Intel",
    href: "/app/intel",
    icon: Radar,
    hint: "Trends rising on social · demand rising on search",
    keywords: ["trends", "search", "areas", "keywords", "horizon", "seo", "monitor"],
  },
  {
    label: "Create",
    href: "/app/create",
    icon: Sparkles,
    hint: "Post, video, or page from one prompt",
    keywords: ["generate", "draft", "prompt", "video", "post", "page", "new"],
  },
  {
    label: "Approve",
    href: "/app/approve",
    icon: CheckCheck,
    hint: "Review queued drafts — nothing ships without your click",
    keywords: ["queue", "review", "drafts", "judge", "publish"],
    showsNeedsYou: true,
  },
  {
    label: "Profiles",
    href: "/app/profiles",
    icon: Users,
    hint: "Brand identity, voice, platforms, denylist, topics",
    keywords: ["brand", "identity", "voice", "denylist", "topics", "tenant"],
  },
  {
    label: "Runs",
    href: "/app/runs",
    icon: ListChecks,
    hint: "Run history, status, and failure triage",
    keywords: ["history", "fanout", "errors", "lastError", "triage"],
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: Settings,
    hint: "Watchlists, budget caps, driver seams",
    keywords: ["config", "budget", "drivers", "seams", "watchlist", "env"],
  },
];

/** Longest-prefix match so /app/intel highlights Intel, not Dashboard. */
export function activeSurface(pathname: string): NavSurface | undefined {
  return NAV_SURFACES.filter(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}
