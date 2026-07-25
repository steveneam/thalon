import type { FeedRun } from "@/lib/approve-queue/types";
import type { CreateContext, CreateFamily } from "@/lib/intel/types";
import type { ProfileWire } from "@/lib/profiles/types";

/**
 * Create's read-model — the pure functions behind the rebuilt surface
 * (Create.dc.html). Kept out of the component so the honesty rules (never a
 * fabricated default, never a real-looking zero) are unit-testable without
 * a DOM.
 */

/** The families the sheet's segmented control offers, in the sheet's order. */
export const FAMILIES: ReadonlyArray<{ id: CreateFamily; label: string }> = [
  { id: "post", label: "Post" },
  { id: "video", label: "Video" },
  { id: "page", label: "Page" },
  { id: "email", label: "Email" },
];

/** The pre-seeded prompt: angle + hook, never re-asked (workspace-ux-v2 §3.5). */
export function seedPrompt(context: CreateContext | null | undefined, initialPrompt: string): string {
  if (initialPrompt) return initialPrompt;
  if (!context) return "";
  const parts: string[] = [];
  if (context.hook) parts.push(`Open on the hook: “${context.hook}”`);
  if (context.angle) parts.push(`Angle: ${context.angle}.`);
  return parts.join(" ");
}

/**
 * Which context fields actually rode in — the sheet's pick chip names them
 * ("title + angle + hook attached"), so the chip states the truth about this
 * capture rather than a fixed string.
 */
export function attachedFields(context: CreateContext): string[] {
  const named: Array<[keyof CreateContext, string]> = [
    ["title", "title"],
    ["angle", "angle"],
    ["hook", "hook"],
    ["sourceUrl", "source"],
    ["areaName", "area"],
    ["keyword", "keyword"],
    ["company", "company"],
    ["contact", "contact"],
    ["role", "role"],
    ["painPoint", "pain point"],
    ["text", "source text"],
  ];
  return named
    .filter(([key]) => {
      const v = context[key];
      return typeof v === "string" && v.length > 0;
    })
    .map(([, label]) => label);
}

/**
 * Platform keys are stored lowercase ids; the sheet's pills wear display
 * names. An unknown key renders VERBATIM — a missing label is never a
 * reason to hide or rename a platform the profile actually carries.
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
  blog: "Blog",
};

export function platformLabel(key: string): string {
  return PLATFORM_LABELS[key.toLowerCase()] ?? key;
}

/** A one-line reading of the profile's free-form voice record. */
export function voiceSummary(voice: Record<string, unknown>): string | null {
  for (const key of ["tone", "style", "persona"]) {
    const v = voice[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  const first = Object.values(voice).find((v): v is string => typeof v === "string" && v.length > 0);
  return first ?? null;
}

/** The active profile's identity topics — last-priority discoverability fill. */
export function profileTopics(profile: ProfileWire | null): string[] {
  const topics = profile?.config.identity.topics;
  if (!Array.isArray(topics)) return [];
  return topics.filter((t): t is string => typeof t === "string" && t.length > 0);
}

/**
 * The discoverability inputs Create can HONESTLY show before generation: the
 * capture's own keyword/area and the profile's topics. The final declared
 * list is derived engine-side at generation (fanout/target-terms.ts) with
 * the shell's canonical subject entity FIRST — which is why nothing here is
 * marked primary: that entity does not exist yet.
 */
export function discoverabilityInputs(
  context: CreateContext | null | undefined,
  profile: ProfileWire | null,
): string[] {
  const fromCapture = [context?.keyword, context?.areaName].filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );
  const seen = new Set<string>();
  return [...fromCapture, ...profileTopics(profile)].filter((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface RunRow {
  id: string;
  title: string;
  /** The honest one-liner under the title — a recorded failure wins the slot. */
  detail: string;
  isError: boolean;
  at: string;
}

/** The sheet's "Latest runs" card draws three rows; the feed is newest-first. */
export const LATEST_RUNS = 3;

/**
 * Feed → the sheet's run rows. A run reads as WHAT it did (the Runs surface's
 * grammar), never as its id; a recorded lastError renders verbatim, because
 * that message is the triage evidence.
 */
export function runRows(runs: readonly FeedRun[]): RunRow[] {
  return runs.slice(0, LATEST_RUNS).map((run) => {
    const platforms = Array.isArray(run.platforms) ? (run.platforms as string[]) : [];
    const waiting = run.waiting > 0 ? `${run.waiting} waiting on you` : null;
    const detail = run.lastError
      ? run.lastError
      : [
          platforms.length > 0 ? `${platforms.length} platform${platforms.length === 1 ? "" : "s"}` : null,
          waiting,
          run.draftsComplete ? null : "incomplete fan-out",
        ]
          .filter(Boolean)
          .join(" · ") || run.status;
    return {
      id: run.id,
      title:
        platforms.length > 0
          ? `Fan-out · ${platforms.map(platformLabel).join(" · ")}`
          : "Fan-out run",
      detail,
      isError: Boolean(run.lastError),
      at: run.createdAt,
    };
  });
}
