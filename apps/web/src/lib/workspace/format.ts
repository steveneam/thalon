/** Compact relative time for a FUTURE instant ("in 3h") — the forward twin of timeAgo; a due/past instant reads "now". */
export function timeUntil(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.floor((then - now) / 1000);
  if (seconds <= 30) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `in ${days}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Compact WAIT duration ("26h", "16d") — bare, no "ago"; the queue-age grammar
 * the sheets draw at "26h". Hours hold below 48h (the recorded decision: 26
 * hours is a day-and-a-bit of someone waiting and "1d" would hide it) and roll
 * to days at 48h, where raw hours ("380h") start hiding the magnitude they were
 * meant to expose — the feed rows on the same screen already say "15d ago".
 */
export function waitLabel(hours: number): string {
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

/** Compact relative time for feed rows ("2m ago") — coarse on purpose, no live re-render ticker. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Display casing for platform names — wire values are lowercase driver ids.
 *
 * ONE HOME (lead consolidation, s74): the three parallel rebuild lanes each
 * grew their own copy of this (dashboard, approve, create) with subtly
 * different maps and fallbacks — the predictable cost of file-disjoint lanes
 * touching the same idea. They agreed on every key they shared; this is the
 * union, with the Title-case fallback two of the three already used, so an
 * unknown driver still renders rather than disappearing.
 */
const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  tiktok: "TikTok",
  youtube: "YouTube",
  bluesky: "Bluesky",
  reddit: "Reddit",
  blog: "Blog",
  web: "Blog",
};

export function platformLabel(platform: string): string {
  const key = platform.toLowerCase();
  return PLATFORM_LABELS[key] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}
