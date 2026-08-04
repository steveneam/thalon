import {
  platformCapability,
  readDraftMediaRefs,
  socialPlatformSchema,
  type PlatformCapability,
  type SocialPlatform,
} from "@thalon/contracts";

/**
 * C1 (s82): the capability matrix's VALIDATOR — the deterministic
 * pre-publish fit check, and the judge's sibling. The judge gates what a
 * post CLAIMS (denylist + grounding); this gates whether it FITS. Before
 * it, a 400-character X body reached the platform call before anything
 * refused it: our drivers carry zero such constraints, so every fit
 * refusal was spent as a live API call that failed.
 *
 * Pure, clock-free, network-free, and total over the platform enum — it
 * consumes the FROZEN `PLATFORM_CAPABILITIES` (packages/contracts) and
 * returns a measurement plus zero or more refusals, each naming its own
 * numbers in the honest-doors grammar. It decides nothing about arming,
 * cadence or content: those are other rungs with other owners.
 *
 * ⚠ THE ONE DISTINCTION THIS FILE MUST NOT BLUR (contracts
 * platform-capability.ts states it at length): the matrix is the
 * platform's CEILING — a fact no tenant config may exceed — while
 * `platformProfiles[platform].charLimit` is an AUTHORING BUDGET, a style
 * opinion freely tuned per tenant. Facebook's shipped budget is 5000
 * against a platform that accepts 63,206, and that gap is correct. This
 * validator reads the ceiling ONLY; a post inside the ceiling but over the
 * authoring budget is a generation-quality question, never a refusal here.
 *
 * Consumed in exactly three places (s82 plan §2 lane C): at generation
 * beside `targetTerms` (provenance — never a block), at Approve as a
 * visible fit line + platform-true preview (via the fit route, so the
 * numbers can never drift from these), and at the queue producer, which
 * refuses to enqueue what the platform will bounce.
 */

/** Machine-readable refusal codes — stable, and the only thing persisted. */
export const PLATFORM_FIT_CODES = [
  "text_empty",
  "text_over_ceiling",
  "media_required",
  "video_required",
  "too_many_images",
  "unsupported_image_type",
  "too_many_hashtags",
] as const;
export type PlatformFitCode = (typeof PLATFORM_FIT_CODES)[number];

export interface PlatformFitProblem {
  code: PlatformFitCode;
  /** The operator-facing sentence: the numbers, verbatim, and the knob that moves them. */
  message: string;
}

/**
 * One piece of the body as the PLATFORM reads it. `billed` is what the
 * segment costs against the ceiling, which is the whole reason segments
 * exist: on X a 100-character link costs 23, so a naive `body.length` is
 * wrong for exactly one platform and right for the rest — data in the
 * matrix (`text.urlWeight`), never a branch in this code.
 */
export interface PlatformTextSegment {
  kind: "text" | "link" | "hashtag";
  text: string;
  billed: number;
}

export interface PlatformTextMeasure {
  /** Characters as authored. */
  rawChars: number;
  /** Characters as the platform counts them — `rawChars` unless a `urlWeight` applies. */
  billedChars: number;
  maxChars: number;
  /** Billed characters past the ceiling; 0 when it fits. */
  overBy: number;
  /**
   * Index into the body where the platform's ceiling falls — `body.length`
   * when the body fits. A link is atomic: the cut lands BEFORE a link that
   * would straddle the ceiling, because half a URL is not a shorter URL.
   */
  cutIndex: number;
  /** `null` = links are counted verbatim, like any other characters. */
  urlWeight: number | null;
  links: string[];
  hashtags: string[];
  /** `null` = the platform sets no hashtag cap (style policy lives in the authoring profile). */
  maxHashtags: number | null;
  /** The body split as the platform reads it — what the Approve preview renders. */
  segments: PlatformTextSegment[];
}

export interface PlatformFit {
  platform: SocialPlatform;
  /** True when NO problem was found — the queue producer's whole question. */
  fits: boolean;
  problems: PlatformFitProblem[];
  text: PlatformTextMeasure;
  media: {
    count: number;
    required: boolean;
    maxImages: number;
    imageContentTypes: readonly string[];
  };
  /** The matrix row this verdict was measured against, including its `verifiedOn` stamp. */
  capability: PlatformCapability;
}

/** What the caller knows about an attached image — bytes are the publish door's business, never this one's. */
export interface PlatformFitMedia {
  contentType: string;
}

export interface PlatformFitInput {
  platform: SocialPlatform | string;
  /** The judged body verbatim (post format: body IS the authored copy). */
  body: string;
  /** The draft's attached media, if any — `meta.mediaRefs` shaped; absent = a text-only post. */
  media?: ReadonlyArray<PlatformFitMedia>;
}

/**
 * Links, conservatively. Only the two unambiguous forms are treated as
 * links: an explicit scheme, and a `www.` host. A bare `example.com/x`
 * stays plain text and is counted VERBATIM — which on X under-counts a
 * short bare domain the platform would bill at 23, so the tail of the
 * regex is deliberately narrow rather than clever: "e.g." and "v1.2" must
 * never become links. The asymmetry costs at most (urlWeight − length)
 * characters on one platform, and never invents a link that isn't one.
 */
const LINK_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;

/**
 * A hashtag must start the body or follow whitespace, so the `#fragment`
 * of a URL is never counted as one. Unicode-aware: a non-Latin hashtag is
 * still a hashtag.
 */
const HASHTAG_RE = /(^|\s)(#[\p{L}\p{N}_]+)/gu;

/** Trailing punctuation a sentence puts after a URL but the URL does not own. */
function trimLinkTail(link: string): string {
  return link.replace(/[),.;:!?'"\]]+$/u, "");
}

/**
 * The body split into what the platform bills separately. Hashtags cost
 * their own characters like any other text — they are their own segment
 * kind purely so the preview can RENDER them as the platform does; their
 * `billed` is their length, never a special number.
 */
export function segmentBody(body: string, urlWeight: number | null): PlatformTextSegment[] {
  const marks: Array<{ start: number; end: number; kind: "link" | "hashtag" }> = [];

  LINK_RE.lastIndex = 0;
  for (let m = LINK_RE.exec(body); m !== null; m = LINK_RE.exec(body)) {
    const text = trimLinkTail(m[0]);
    if (text.length === 0) continue;
    marks.push({ start: m.index, end: m.index + text.length, kind: "link" });
  }

  HASHTAG_RE.lastIndex = 0;
  for (let m = HASHTAG_RE.exec(body); m !== null; m = HASHTAG_RE.exec(body)) {
    const start = m.index + m[1].length;
    const end = start + m[2].length;
    // A `#tag` inside a matched link belongs to the link, not to the post.
    if (marks.some((mark) => mark.kind === "link" && start >= mark.start && start < mark.end)) {
      continue;
    }
    marks.push({ start, end, kind: "hashtag" });
  }

  marks.sort((a, b) => a.start - b.start);

  const segments: PlatformTextSegment[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start < cursor) continue; // overlapping match — the first one won
    if (mark.start > cursor) {
      const text = body.slice(cursor, mark.start);
      segments.push({ kind: "text", text, billed: text.length });
    }
    const text = body.slice(mark.start, mark.end);
    segments.push({
      kind: mark.kind,
      text,
      billed: mark.kind === "link" ? (urlWeight ?? text.length) : text.length,
    });
    cursor = mark.end;
  }
  if (cursor < body.length) {
    const text = body.slice(cursor);
    segments.push({ kind: "text", text, billed: text.length });
  }
  return segments;
}

/**
 * Where the ceiling falls, in body characters. Plain text cuts anywhere; a
 * link is atomic (billed whole or not at all), so a link that would
 * straddle the ceiling puts the cut in front of itself.
 */
function cutIndexOf(segments: PlatformTextSegment[], maxChars: number): number {
  let billed = 0;
  let index = 0;
  for (const segment of segments) {
    if (billed + segment.billed <= maxChars) {
      billed += segment.billed;
      index += segment.text.length;
      continue;
    }
    if (segment.kind === "link") return index;
    return index + (maxChars - billed);
  }
  return index;
}

/** Normalizes `image/jpeg; charset=binary` → `image/jpeg` for the accepted-types check. */
function baseContentType(contentType: string): string {
  return contentType.split(";", 1)[0].trim().toLowerCase();
}

/**
 * THE validator. Returns a measurement plus every problem found — all of
 * them, never just the first: an operator fixing a post should see the
 * whole bill, not discover the next refusal one edit at a time.
 */
export function validateForPlatform(input: PlatformFitInput): PlatformFit {
  // An unparseable platform fails at the enum, exactly as the matrix
  // lookup's docstring promises — there is no "unknown platform" branch.
  const platform = socialPlatformSchema.parse(input.platform);
  const capability = platformCapability(platform);
  const body = input.body;
  const media = input.media ?? [];

  const segments = segmentBody(body, capability.text.urlWeight);
  const billedChars = segments.reduce((sum, segment) => sum + segment.billed, 0);
  const maxChars = capability.text.maxChars;
  const links = segments.filter((s) => s.kind === "link").map((s) => s.text);
  const hashtags = segments.filter((s) => s.kind === "hashtag").map((s) => s.text);

  const text: PlatformTextMeasure = {
    rawChars: body.length,
    billedChars,
    maxChars,
    overBy: Math.max(0, billedChars - maxChars),
    cutIndex: billedChars <= maxChars ? body.length : cutIndexOf(segments, maxChars),
    urlWeight: capability.text.urlWeight,
    links,
    hashtags,
    maxHashtags: capability.hashtags.max,
    segments,
  };

  const label = PLATFORM_LABELS[platform];
  const problems: PlatformFitProblem[] = [];

  if (body.trim().length === 0) {
    problems.push({
      code: "text_empty",
      message: `${label} refuses an empty post — there is no body to publish.`,
    });
  }

  if (text.overBy > 0) {
    const linkNote =
      capability.text.urlWeight !== null && links.length > 0
        ? ` (${links.length} link${links.length === 1 ? "" : "s"} billed at ${capability.text.urlWeight} character${capability.text.urlWeight === 1 ? "" : "s"} each, however long they are)`
        : "";
    problems.push({
      code: "text_over_ceiling",
      message:
        `${label} accepts ${maxChars} characters and this body bills ${billedChars}${linkNote} — ` +
        `${text.overBy} over. Shorten it by ${text.overBy} character${text.overBy === 1 ? "" : "s"}; the platform will refuse it as written.`,
    });
  }

  // A video-demanding platform (matrix `media.requiredKind: "video"` — s90,
  // YouTube) splits the attachments: video/* entries are the demanded
  // medium, everything else is judged by the image rules, which on such a
  // platform describe what may ride BESIDE the video (the one custom
  // thumbnail). Everywhere else `images` IS `media`, byte-identical to the
  // pre-s90 behavior — including a video/* entry tripping the
  // unsupported-type refusal, which is the honest answer on an image
  // platform.
  const requiresVideo = capability.media.requiredKind === "video";
  const images = requiresVideo
    ? media.filter((m) => !baseContentType(m.contentType).startsWith("video/"))
    : media;

  if (capability.media.required && media.length === 0) {
    problems.push(
      requiresVideo
        ? {
            code: "video_required",
            message: `${label} publishes videos — this draft carries no media at all. Attach the run's rendered cut before it can be scheduled; an image cannot satisfy this.`,
          }
        : {
            code: "media_required",
            message: `${label} refuses a text-only post — attach an image before this can be scheduled.`,
          },
    );
  } else if (requiresVideo && capability.media.required && images.length === media.length && media.length > 0) {
    problems.push({
      code: "video_required",
      message: `${label} publishes videos — this draft carries ${media.length} image${media.length === 1 ? "" : "s"} and no video, and an image cannot satisfy this. Attach the run's rendered cut.`,
    });
  }

  if (images.length > capability.media.maxImages) {
    problems.push({
      code: "too_many_images",
      message: `${label} accepts ${capability.media.maxImages} image${capability.media.maxImages === 1 ? "" : "s"} and this draft carries ${images.length}.`,
    });
  }

  const accepted = new Set(capability.media.imageContentTypes.map((t) => t.toLowerCase()));
  const unsupported = [
    ...new Set(images.map((m) => baseContentType(m.contentType)).filter((t) => !accepted.has(t))),
  ];
  if (unsupported.length > 0) {
    problems.push({
      code: "unsupported_image_type",
      message:
        `${label} accepts ${capability.media.imageContentTypes.join(", ")} — this draft carries ` +
        `${unsupported.join(", ")}.`,
    });
  }

  if (capability.hashtags.max !== null && hashtags.length > capability.hashtags.max) {
    problems.push({
      code: "too_many_hashtags",
      message: `${label} allows ${capability.hashtags.max} hashtags and this body has ${hashtags.length} — remove ${hashtags.length - capability.hashtags.max}.`,
    });
  }

  return {
    platform,
    fits: problems.length === 0,
    problems,
    text,
    media: {
      count: media.length,
      required: capability.media.required,
      maxImages: capability.media.maxImages,
      imageContentTypes: capability.media.imageContentTypes,
    },
    capability,
  };
}

/**
 * The refusal sentences name the platform the way an operator does. Kept
 * here rather than imported from apps/web's `platformLabel`: the engine
 * must not depend on the app, and this map is total over the matrix's own
 * enum by type.
 */
const PLATFORM_LABELS: Readonly<Record<SocialPlatform, string>> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  reddit: "Reddit",
  bluesky: "Bluesky",
  youtube: "YouTube",
};

/** The label map, for callers rendering a refusal the validator produced. */
export function platformFitLabel(platform: SocialPlatform): string {
  return PLATFORM_LABELS[platform];
}

/**
 * A draft's attached media as the validator needs it — content types only,
 * read structurally off `meta.mediaRefs` (the shape the drafting path puts
 * there and the publish door loads bytes for).
 *
 * Deliberately TOLERANT where the publish door's own `mediaRefsSchema` is
 * strict: the door caps attachments at one image and throws on anything
 * malformed, because it is about to spend a platform call. This one is
 * asked "would the platform take this?", so it must be able to SEE two
 * images in order to say the platform's ceiling is exceeded — a reader that
 * threw on the malformed case would turn a refusal the operator can act on
 * into a crash. Entries it cannot read are skipped; the door remains the
 * authority on what actually travels.
 */
export function readDraftFitMedia(meta: unknown): PlatformFitMedia[] {
  // s100: the shape and the tolerant read are the CONTRACTS' — this used to
  // hand-roll them, and the Composer hand-rolled a different version reading a
  // different field name (`mime`). One reader now, so a fit report and a media
  // band cannot disagree about whether a draft carries anything.
  return readDraftMediaRefs(meta).map(({ contentType }) => ({ contentType }));
}

/**
 * The generation-time stamp (wiring #1, beside `targetTerms`): what the fan-out
 * produced, measured against the ceiling at the moment it was written.
 *
 * It carries `bodyHash` because an operator edit changes the body and NOTHING
 * refreshes this — a stored derivation that cannot be checked for staleness is
 * how a correct fact starts lying. Every reader compares it with the draft's
 * current `bodyHash` (the judge-verdict I1 convention) and re-measures rather
 * than trusting a stale stamp. It blocks nothing: generation records, the
 * producer refuses.
 */
export interface PlatformFitStamp {
  fits: boolean;
  problems: PlatformFitCode[];
  billedChars: number;
  maxChars: number;
  /** The body this verdict was measured on — a mismatch means "re-measure", never "still true". */
  bodyHash: string;
}

export function platformFitStamp(fit: PlatformFit, bodyHash: string): PlatformFitStamp {
  return {
    fits: fit.fits,
    problems: fit.problems.map((p) => p.code),
    billedChars: fit.text.billedChars,
    maxChars: fit.text.maxChars,
    bodyHash,
  };
}
