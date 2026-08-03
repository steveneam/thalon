import {
  blueskyPostSettingsSchema,
  facebookPostSettingsSchema,
  instagramPostSettingsSchema,
  linkedinPostSettingsSchema,
  redditPostSettingsSchema,
  tiktokPostSettingsSchema,
  xPostSettingsSchema,
  youtubePostSettingsSchema,
} from "@thalon/contracts";
import { briefTopic } from "@/components/runs/runs-model";
import type { FitResponse } from "@/components/approve/queue-client";
import type { CreateRunWire } from "@/lib/create/client";
import type { GridDraft } from "@/lib/approve-queue/types";
import { platformLabel } from "@/lib/workspace/format";

/**
 * Pure derivations behind the Composer (B-create.4 — Composer.dc.html, the
 * s90c iteration; W2 verdicted). The run-scoped checkpoint between Generate
 * and Approve: what was built · what it looks like per destination · based
 * on what · whether it will pass and how it should do. Nothing here
 * publishes, and nothing here rewrites — the judge gates, the operator (or
 * the judged AI-edit door) edits.
 */

export type TabDot = "ok" | "warn" | "err";

export interface ComposerTab {
  draftId: string;
  platform: string;
  label: string;
  /** The at-a-glance status dot that makes tabs honest (sheet open-call (a)). */
  dot: TabDot;
}

/**
 * err = the judge blocked it, or the platform refuses the post outright;
 * warn = it ships but not whole (a cut, a trim); ok = it ships as written.
 * `fit === null` = not measured yet — the dot stays ok rather than inventing
 * a warning nobody computed.
 */
export function tabDot(draft: GridDraft, fit: FitResponse | "failed" | null): TabDot {
  if (draft.status === "blocked") return "err";
  // An unmeasurable destination is a warning, not a clean bill (s99).
  if (fit === "failed") return "warn";
  if (fit === null || !("supported" in fit) || fit.supported === false) return "ok";
  if (fit.fit.media.required && fit.fit.media.count === 0) return "err";
  if (!fit.fit.fits || fit.fit.text.overBy > 0) return "warn";
  return "ok";
}

export function composerTabs(
  drafts: GridDraft[],
  fits: Record<string, FitResponse | "failed" | null>,
): ComposerTab[] {
  return drafts.map((draft) => ({
    draftId: draft.id,
    platform: draft.platform,
    label: platformLabel(draft.platform),
    dot: tabDot(draft, fits[draft.id] ?? null),
  }));
}

/** "Launch film — 5 destinations", from the run's own brief. */
export function composerHeadline(run: CreateRunWire, draftCount: number): string {
  const topic = briefTopic(run.brief) ?? `${run.family} run`;
  return `${topic} — ${draftCount} destination${draftCount === 1 ? "" : "s"}`;
}

export function wouldBlockCount(drafts: GridDraft[]): number {
  return drafts.filter((d) => d.status === "blocked").length;
}

/**
 * The judge's named term, when its reason quotes one — what lets the body
 * mark the hit IN the text ("a gate that points at a word belongs next to
 * the word"). No quoted term = no mark, and the strip still names the
 * reason verbatim; a guessed mark would be worse than none.
 */
export function hitTerm(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const match = /[“"]([^”"]{1,60})[”"]/.exec(reason);
  return match ? match[1] : null;
}

/** Split the body at the hit's first occurrence — [before, hit, after], or null. */
export function markBody(body: string, term: string | null): [string, string, string] | null {
  if (!term) return null;
  const at = body.toLowerCase().indexOf(term.toLowerCase());
  if (at === -1) return null;
  return [body.slice(0, at), body.slice(at, at + term.length), body.slice(at + term.length)];
}

export interface FitLineWords {
  /** "2,412 / 3,000" · "refuses" · "—" (unsupported/unmeasured). */
  count: string;
  /** The reason in words — refusal messages verbatim (the honesty grammar). */
  why: string;
  tone: "ok" | "warn" | "err" | "none";
}

const NUM = new Intl.NumberFormat("en-GB");

/**
 * The fit line: a counter WITH its refusal reason, never a bare count
 * (sheet rule). Every refusal message rides verbatim from the one engine
 * validator the queue producer also refuses on — one rule, one owner.
 */
export function fitWords(fit: FitResponse | "failed" | null): FitLineWords {
  // s99: a FAILED measure is its own fact — "measuring…" that never resolves
  // is the same lie the verdict strip's eternal "reading…" was.
  if (fit === "failed")
    return { count: "—", why: "couldn’t measure this destination", tone: "err" };
  if (fit === null) return { count: "—", why: "measuring…", tone: "none" };
  if (!fit.supported) {
    // A platform outside the social enum (the blog, the site) has no
    // ceiling row — the engine's own words say so.
    return { count: "no limit", why: fit.reason, tone: "none" };
  }
  const { text, media } = fit.fit;
  if (media.required && media.count === 0) {
    const message =
      fit.fit.problems.map((p) => p.message).find(Boolean) ??
      "This platform refuses the post without media.";
    return { count: "refuses", why: message, tone: "err" };
  }
  const count = `${NUM.format(text.billedChars)} / ${NUM.format(text.maxChars)}`;
  if (text.overBy > 0) {
    const message =
      fit.fit.problems.map((p) => p.message).find(Boolean) ??
      `Over by ${NUM.format(text.overBy)} — the tail gets cut.`;
    return { count, why: message, tone: "warn" };
  }
  if (!fit.fit.fits) {
    const message = fit.fit.problems.map((p) => p.message).find(Boolean) ?? "Doesn’t fit as written.";
    return { count, why: message, tone: "err" };
  }
  return { count, why: "Fits. The body posts whole — no cut.", tone: "ok" };
}

export interface StripStatus {
  word: string;
  pill: "pill-ok" | "pill-idle" | "pill-err";
  /** What happens NEXT, in the ladder's own truth — never a stale "next". */
  line: string;
}

/**
 * s99 — THE STRIP'S STATUS, all seven eras. It read blocked / judging /
 * "else", so an APPROVED and even a PUBLISHED variant wore "passes · queued
 * for Approve — the human gate is next": a next that had already happened
 * (found live on the s98 dogfood draft, which was published to Bluesky).
 * The ladder is DRAFT_STATUSES / DRAFT_TRANSITIONS in @thalon/contracts.
 */
export function stripStatus(status: string, failingLabel: string | null): StripStatus {
  switch (status) {
    case "blocked":
      return {
        word: "would block",
        pill: "pill-err",
        line: failingLabel ?? "blocked — the judge’s reason is on the record",
      };
    case "rejected":
      return {
        word: "rejected",
        pill: "pill-err",
        line: "you rejected this variant — the correction is on record as an eval row",
      };
    case "judging":
      return { word: "at the judge", pill: "pill-idle", line: "gates running on the current body" };
    case "generated":
      return {
        word: "generated",
        pill: "pill-idle",
        line: "not judged yet — the gates run before it can queue",
      };
    case "approved":
      return {
        word: "approved",
        pill: "pill-ok",
        line: "you approved it — publishing is the queue’s own door",
      };
    case "published":
      return { word: "published", pill: "pill-ok", line: "this variant is out — nothing left to do here" };
    default:
      return {
        word: "passes",
        pill: "pill-ok",
        line: "queued for Approve — the human gate is next",
      };
  }
}

export interface Discoverability {
  have: number;
  total: number;
  /** The first miss, named — the warn line's content. */
  missing: string | null;
}

/** Target-term coverage of the CURRENT body — warns, never blocks (s70c lens). */
export function discoverability(terms: string[], body: string): Discoverability | null {
  if (terms.length === 0) return null;
  const lower = body.toLowerCase();
  const missing = terms.filter((t) => !lower.includes(t.toLowerCase()));
  return {
    have: terms.length - missing.length,
    total: terms.length,
    missing: missing[0] ?? null,
  };
}

/**
 * s99 — THE CUT BEHIND A VIDEO VARIANT. The media band states "video — the
 * run's cut" as a fact with nowhere to go, while the run's own children carry
 * the `video_project` id the V-arc built all its evidence on (the Dossier's
 * versions, verdicts and render clocks). Every fact is a door.
 */
export function videoProjectHref(run: CreateRunWire): string | null {
  const child = run.children.find((c) => c.kind === "video_project" && !c.error);
  return child ? `/app/videos/${child.id}` : null;
}

/** The Approve queue, scoped to this run's own drafts — the checkpoint's exit. */
export function sendToApproveHref(run: CreateRunWire): string {
  const fanout = run.children.find((c) => c.kind === "fanout_run" && !c.error);
  return fanout ? `/app/approve?run=${encodeURIComponent(fanout.id)}` : "/app/approve";
}

export interface ProvenancePart {
  text: string;
  href?: string;
}

/**
 * BASED ON WHAT — the provenance line (s90c; the Approve detail's src-line
 * grammar). Only facts the wire actually carries: the run's door and family,
 * the intel capture when one seeded a draft, the grounding-source count from
 * the active draft's own meta. Models and profile version are not on this
 * wire — absent, not invented.
 */
export function provenanceParts(run: CreateRunWire, active: GridDraft | null): ProvenancePart[] {
  const parts: ProvenancePart[] = [
    { text: `From the ${briefTopic(run.brief) ?? run.family} run`, href: "/app/runs" },
    { text: `${run.family} · ${run.mode === "wizard" ? "guided" : "one prompt"}` },
  ];
  const meta =
    active?.meta && typeof active.meta === "object" ? (active.meta as Record<string, unknown>) : null;
  /*
   * s99 — the Intel pick was read ONLY off `draft.captureId`, which the
   * fan-out leaves null; the capture that actually seeded the run sits on
   * `run.brief.context` on the very same wire, so the door never fired on a
   * run that plainly came from Intel (found live on the s98 dogfood).
   */
  const context =
    run.brief && typeof run.brief === "object"
      ? ((run.brief as { context?: unknown }).context as
          | { captureId?: unknown; title?: unknown }
          | undefined)
      : undefined;
  const captureId =
    typeof active?.captureId === "string" && active.captureId
      ? active.captureId
      : typeof context?.captureId === "string" && context.captureId
        ? context.captureId
        : null;
  if (captureId !== null) {
    const title = typeof context?.title === "string" && context.title ? context.title : null;
    parts.push({
      text: title ? `from an Intel pick — “${title}”` : "from an Intel pick",
      href: "/app/intel",
    });
  }
  // The profile VERSION the fan-out stamped: the exact voice this body was
  // written against (the sheet's "profile v4"). It is on the wire.
  const profileVersion = meta?.brandProfileVersion;
  if (typeof profileVersion === "number") {
    parts.push({ text: `profile v${profileVersion}`, href: "/app/profiles" });
  }
  const grounding = Array.isArray(meta?.groundingSourceIds) ? meta.groundingSourceIds.length : 0;
  if (grounding > 0) {
    parts.push({ text: `${grounding} grounding source${grounding === 1 ? "" : "s"}` });
  }
  return parts;
}

/** The platform's own action-row verbs — the preview draws the object being shipped. */
export function previewActions(platform: string): string[] {
  switch (platform) {
    case "linkedin":
      return ["Like", "Comment", "Repost", "Send"];
    case "facebook":
      return ["Like", "Comment", "Share"];
    case "instagram":
      return ["Like", "Comment", "Share"];
    case "x":
      return ["Reply", "Repost", "Like"];
    case "bluesky":
      return ["Reply", "Repost", "Like"];
    case "reddit":
      return ["Upvote", "Comment", "Share"];
    default:
      // The blog/site preview is an article, not a feed object — no action row.
      return [];
  }
}

/**
 * The D3 settings slice, per destination — the rail really is generated
 * from each platform's own schema (a video destination declares more), so a
 * platform with no `firstComment` field simply has no such row rather than
 * a ghosted lie.
 */
const PLATFORM_SETTINGS_SHAPES: Record<string, Record<string, unknown>> = {
  linkedin: linkedinPostSettingsSchema.shape,
  x: xPostSettingsSchema.shape,
  facebook: facebookPostSettingsSchema.shape,
  instagram: instagramPostSettingsSchema.shape,
  tiktok: tiktokPostSettingsSchema.shape,
  reddit: redditPostSettingsSchema.shape,
  bluesky: blueskyPostSettingsSchema.shape,
  youtube: youtubePostSettingsSchema.shape,
};

export function settingsFieldNames(platform: string): string[] {
  const shape = PLATFORM_SETTINGS_SHAPES[platform];
  return shape ? Object.keys(shape) : [];
}

/** "firstComment" → "First comment" — schema keys as operator words. */
export function fieldLabel(key: string): string {
  const words = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function hasFirstComment(platform: string): boolean {
  return settingsFieldNames(platform).includes("firstComment");
}

/** The long tail behind "More settings ▾ · N" — everything but the rail's own knobs. */
export function moreSettingsFields(platform: string): string[] {
  return settingsFieldNames(platform).filter((k) => k !== "firstComment");
}

/** First media ref on the draft's meta, when generation attached one. */
export function firstMediaKind(draft: GridDraft): string | null {
  const meta = draft.meta && typeof draft.meta === "object" ? (draft.meta as Record<string, unknown>) : null;
  const refs = meta?.mediaRefs;
  if (!Array.isArray(refs) || refs.length === 0) return null;
  const first = refs[0] as Record<string, unknown> | string;
  if (typeof first === "string") return "media";
  const mime = typeof first?.mime === "string" ? first.mime : null;
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("image/")) return "image";
  return "media";
}
