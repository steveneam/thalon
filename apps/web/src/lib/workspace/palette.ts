import { NAV_SURFACES } from "./nav";

/**
 * Cmd-K palette + dashboard omnibox logic (B6.2 [+]) — pure and testable.
 * Palette items come from the ONE nav registry plus the cross-surface
 * actions; the omnibox's family routing is a transparent deterministic
 * heuristic, not model vibes.
 */
export interface PaletteItem {
  label: string;
  hint: string;
  href: string;
  keywords: string[];
  group: "surfaces" | "actions";
}

const ACTION_ITEMS: PaletteItem[] = [
  {
    label: "Add a monitored area",
    hint: "Describe what Intel should watch",
    href: "/app/intel",
    keywords: ["watch", "trend", "niche", "monitor"],
    group: "actions",
  },
  {
    label: "Add a keyword target",
    hint: "A search query to win",
    href: "/app/intel?tab=search",
    keywords: ["seo", "search", "keyword", "query"],
    group: "actions",
  },
  {
    label: "Walk the staged video demo",
    hint: "Structure → scenes → polish, zero spend",
    href: "/app/approve",
    keywords: ["video", "staged", "storyboard", "demo"],
    group: "actions",
  },
  {
    label: "Create from a prompt",
    hint: "Post, video, or page",
    href: "/app/create",
    keywords: ["generate", "new", "draft", "prompt"],
    group: "actions",
  },
  {
    label: "Save a new profile version",
    hint: "Identity, voice, denylist, topics",
    href: "/app/profiles",
    keywords: ["brand", "identity", "voice"],
    group: "actions",
  },
];

export function buildPaletteItems(): PaletteItem[] {
  return [
    ...NAV_SURFACES.map<PaletteItem>((s) => ({
      label: s.label,
      hint: s.hint,
      href: s.href,
      keywords: s.keywords,
      group: "surfaces",
    })),
    ...ACTION_ITEMS,
  ];
}

/** Rank: label prefix > label substring > keyword/hint substring; stable within tiers. */
export function filterPalette(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const tier = (item: PaletteItem): number => {
    const label = item.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (label.includes(q)) return 1;
    if (item.keywords.some((k) => k.toLowerCase().includes(q)) || item.hint.toLowerCase().includes(q)) return 2;
    return -1;
  };
  return items
    .map((item, i) => ({ item, t: tier(item), i }))
    .filter((e) => e.t >= 0)
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((e) => e.item);
}

/**
 * Omnibox → Create-family routing. Deterministic keyword heuristic (the
 * operator sees the family picker pre-set and can change it — reaction over
 * authoring).
 */
export function routeForPrompt(prompt: string): string {
  const p = prompt.trim();
  if (!p) return "/app/create";
  const family = /\b(video|clip|reel|short|render)\b/i.test(p)
    ? "video"
    : /\b(page|landing|seo|article|blog|faq)\b/i.test(p)
      ? "page"
      : "post";
  return `/app/create?prompt=${encodeURIComponent(p)}&family=${family}`;
}
