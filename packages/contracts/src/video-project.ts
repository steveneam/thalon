import { z } from "zod";

/**
 * B-ve.1 (amendment A17 / ADR 0010): the video-project contract + the EDL —
 * the one new schema the video editor adds. The shape formalizes the
 * concept-film project tree (the founder-directed reference shape, s43):
 * pinned assets with provenance (B7.1), takes as keepers/rejects WITH
 * REASONS (the learning material), and versioned cuts each carrying the EDL
 * that built it. The EDL itself is OTIO-shaped (tracks → clips with source
 * refs, in/out, transitions) but is our own zod schema — the official OTIO
 * JS bindings are explicitly WIP, so we adopt the schema shape, not the
 * library, and keep a `.otio` export seam as a later door.
 *
 * Editor invariants this schema carries (ADR 0010):
 * - Every edit operation compiles to local deterministic work (ffmpeg /
 *   magick) — no vendor-metered call can be EXPRESSED on an edit path.
 * - Aspect variants are derived EDLs over the same takes (own-engine
 *   recut), never a vendor reframe.
 * - Caption/text layers are content: a cut cannot be approved until its
 *   text passes the judge harness (the gate lands with B-ve.3/4 — this
 *   window deliberately ships NO approve door; see VIDEO_CUT_TRANSITIONS).
 */

/** A point or span on the timeline, in seconds (finite, never negative). */
const seconds = z.number().finite().min(0);

/** Where in the project tree a source ref points. `cut` lets an EDL layer over a prior versioned cut (the 16:9 v6 recipe) or stream-copy its audio (the 9:16 mux). */
export const VIDEO_SOURCE_KINDS = ["take", "still", "audio", "cut"] as const;
export type VideoSourceKind = (typeof VIDEO_SOURCE_KINDS)[number];

/**
 * Project-relative ref only — never absolute, never traversing. The
 * compiler resolves refs against the project root; this guard is what makes
 * an EDL from tenant data safe to hand to the resolver.
 */
const projectRelativeRef = z
  .string()
  .min(1)
  .refine(
    (ref) =>
      !ref.startsWith("/") &&
      !ref.includes("\\") &&
      !ref.split("/").includes("..") &&
      !ref.split("/").includes(""),
    { message: "ref must be project-relative (no absolute paths, no '..', no '//', no '\\')" },
  );

export const videoSourceRefSchema = z.object({
  kind: z.enum(VIDEO_SOURCE_KINDS),
  ref: projectRelativeRef,
});
export type VideoSourceRef = z.infer<typeof videoSourceRefSchema>;

/**
 * The only letters allowed in a pan expression are `t` and whitelisted
 * function names — this is the injection guard between tenant data and the
 * ffmpeg filtergraph (no quotes, brackets, semicolons; the compiler quotes
 * the expression, and nothing in this alphabet can escape the quoting).
 */
const PAN_EXPR = /^(?:\d|\.|\s|[t+\-*/(),]|min|max|abs|sqrt|floor|ceil|round)+$/;

/**
 * A crop-window coordinate over the beat: static, linear pan across the
 * clip, or a bounded ffmpeg expression (the b9 full-width sweep,
 * `min(875*t/4.5,875)`). Pan targets are MEASURED from gridded source
 * frames, never estimated (s45 lesson) — but that is craft, not schema.
 */
export const panSchema = z.union([
  z.number().finite(),
  z.object({ from: z.number().finite(), to: z.number().finite() }),
  z.object({ expr: z.string().min(1).regex(PAN_EXPR) }),
]);
export type Pan = z.infer<typeof panSchema>;

/** Source crop window (the 9:16 recomposition verb: 405×720 full-height windows). */
export const cropSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  x: panSchema.default(0),
  y: panSchema.default(0),
});
export type Crop = z.infer<typeof cropSchema>;

/** Per-beat grade (the v1 night grade: eq brightness/gamma/saturation). Absent field = untouched. */
export const gradeSchema = z.object({
  brightness: z.number().min(-1).max(1).optional(),
  gamma: z.number().positive().optional(),
  saturation: z.number().min(0).optional(),
});
export type Grade = z.infer<typeof gradeSchema>;

export const scaleSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  flags: z.enum(["lanczos", "bicubic", "bilinear"]).default("lanczos"),
});
export type Scale = z.infer<typeof scaleSchema>;

/**
 * How a clip enters from what precedes it. `xfade` is the beat-lane
 * crossfade; `overlay-fade` is the v6 endcard machinery — the prior
 * timeline is trimmed at this clip's `at` and frozen (clone-hold), and the
 * clip alpha-fades in on top. xfade is BANNED at trim boundaries (s44
 * lesson, twice) — that is exactly what overlay-fade exists for.
 */
export const VIDEO_TRANSITION_TYPES = ["xfade", "overlay-fade"] as const;
export type VideoTransitionType = (typeof VIDEO_TRANSITION_TYPES)[number];

export const transitionSchema = z.object({
  type: z.enum(VIDEO_TRANSITION_TYPES),
  duration: z.number().positive(),
});
export type Transition = z.infer<typeof transitionSchema>;

/**
 * One clip on the beat lane. Ordinary beats chain with `xfade` and their
 * timeline offsets DERIVE from durations (beat k starts at
 * sum(prior durations) − k·fade); an `overlay-fade` clip instead carries an
 * explicit `at` (the trim/freeze boundary) and typically holds to the end
 * of the film (`duration` = output duration for the endcard hold).
 */
export const edlClipSchema = z
  .object({
    name: z.string().min(1),
    source: videoSourceRefSchema,
    /** Source in-point, seconds. */
    in: seconds.default(0),
    /** Timeline duration of this clip, seconds. */
    duration: z.number().positive().finite(),
    /** Timeline start — REQUIRED for overlay-fade (the trim boundary), FORBIDDEN otherwise (offsets derive). */
    at: seconds.optional(),
    crop: cropSchema.optional(),
    grade: gradeSchema.optional(),
    scale: scaleSchema.optional(),
    transitionIn: transitionSchema.optional(),
  })
  .refine((c) => c.transitionIn?.type !== "overlay-fade" || c.at !== undefined, {
    message: "an overlay-fade clip must carry `at` (the trim/freeze boundary)",
  })
  .refine((c) => c.at === undefined || c.transitionIn?.type === "overlay-fade", {
    message: "`at` is only legal on an overlay-fade clip — xfade offsets derive from durations",
  });
export type EdlClip = z.infer<typeof edlClipSchema>;

/**
 * The music lane, measured not vibed (s44 method): source + offset +
 * STATIC gain + tail easing only. A fade is for avoiding clicks, not for
 * manufacturing an ending — when the phrase resolves, hold level and ease
 * only the tail (founder, s44 FINAL). `copy` mode stream-copies the
 * source's audio track verbatim (the 9:16 mux from the 16:9 master —
 * identical timeline, zero re-encode).
 */
export const audioCueSchema = z.object({
  source: videoSourceRefSchema,
  /** Source offset, seconds into the track where playback starts. */
  offset: seconds.default(0),
  /** Static gain in dB — never dynamic ducking. 0 = level-flat (no filter). */
  gainDb: z.number().finite().default(0),
  /** Anti-click tail easing: fade-out start (timeline seconds) + duration. */
  fadeOut: z
    .object({ start: seconds, duration: z.number().positive() })
    .optional(),
  mode: z.enum(["copy", "encode"]).default("encode"),
});
export type AudioCue = z.infer<typeof audioCueSchema>;

/** Caption plate typography — one style per EDL, reused by every line (the film recipe). */
export const captionStyleSchema = z.object({
  font: z.string().min(1).default("FreeSerif-Italic"),
  pointsize: z.number().int().positive(),
  kerning: z.number().finite().default(2),
  fill: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#eaaa40"),
  glowFill: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#e09b30"),
});
export type CaptionStyle = z.infer<typeof captionStyleSchema>;

/**
 * One caption line: plate CENTER coordinates in the output frame (placement
 * dodges each beat's focal object — data, chosen per cut), plus explicit
 * fade windows. Caption text is CONTENT — it rides the judge harness before
 * any cut carrying it can be approved (ADR 0010 invariant).
 */
export const captionLineSchema = z.object({
  text: z.string().min(1),
  x: z.number().int(),
  y: z.number().int(),
  /** Fade-in start, timeline seconds. */
  fadeIn: seconds,
  /** Fade-out start, timeline seconds. */
  fadeOut: seconds,
  /** Fade ramp, seconds. */
  ramp: z.number().positive().default(0.4),
});
export type CaptionLine = z.infer<typeof captionLineSchema>;

export const edlOutputSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  /** Final duration, seconds (the -t of record). */
  duration: z.number().positive().finite(),
  video: z
    .object({
      codec: z.literal("libx264").default("libx264"),
      crf: z.number().int().min(0).max(51).default(18),
      preset: z
        .enum(["ultrafast", "fast", "medium", "slow", "veryslow"])
        .default("slow"),
      pixFmt: z.literal("yuv420p").default("yuv420p"),
    })
    // prefault, not default: the {} must parse THROUGH the schema so the
    // codec defaults fill (zod 4 applies .default() values as-is).
    .prefault({}),
});
export type EdlOutput = z.infer<typeof edlOutputSchema>;

/**
 * The EDL — one versioned cut's complete build instruction. Deterministic
 * by construction: same EDL + same takes ⇒ the same film (the golden tests
 * replay both concept-film masters from checked-in EDL fixtures).
 */
export const edlSchema = z.object({
  version: z.literal(1).default(1),
  name: z.string().min(1),
  output: edlOutputSchema,
  /** The beat lane, in timeline order. */
  video: z.array(edlClipSchema).min(1),
  /** The music lane (empty = silent cut; the 16:9 v6 video pass). */
  audio: z.array(audioCueSchema).default([]),
  /** The caption lane. */
  captions: z
    .object({
      style: captionStyleSchema,
      lines: z.array(captionLineSchema).default([]),
    })
    .optional(),
});
export type EdlInput = z.input<typeof edlSchema>;
export type Edl = z.infer<typeof edlSchema>;

/* ------------------------------------------------------------------ */
/* Project + takes + cuts — the film-tree shape as validated data.     */
/* ------------------------------------------------------------------ */

export const videoProjectInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type VideoProjectInput = z.input<typeof videoProjectInputSchema>;

/** What a take IS (a cut is never a take — it is built FROM takes). */
export const VIDEO_TAKE_KINDS = ["motion", "still", "audio"] as const;
export type VideoTakeKind = (typeof VIDEO_TAKE_KINDS)[number];

/**
 * keeper/reject with the reason ON RECORD — the s43 retake discipline. The
 * rejects are the learning material; a reject without a reason is refused
 * at the schema door.
 */
export const VIDEO_TAKE_DISPOSITIONS = ["keeper", "reject"] as const;
export type VideoTakeDisposition = (typeof VIDEO_TAKE_DISPOSITIONS)[number];

export const videoTakeSchema = z
  .object({
    /** Beat slot the take auditions for ("beat-01"); music candidates carry none. */
    slot: z.string().min(1).optional(),
    kind: z.enum(VIDEO_TAKE_KINDS),
    disposition: z.enum(VIDEO_TAKE_DISPOSITIONS).default("keeper"),
    /** Project-relative asset ref — the take's identity within the project. */
    ref: projectRelativeRef,
    /** Why a reject was rejected — required for rejects, the learning material. */
    reason: z.string().min(1).optional(),
    /** B7.1 provenance (model, prompt, credits, license tier, mint date) — open shape, pinned at mint. */
    provenance: z.record(z.string(), z.unknown()).default({}),
    meta: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((t) => t.disposition !== "reject" || t.reason !== undefined, {
    message: "a reject must carry its reason (the learning material)",
  });
export type VideoTakeInput = z.input<typeof videoTakeSchema>;
export type VideoTake = z.infer<typeof videoTakeSchema>;

/**
 * Cut lifecycle. A cut's EDL is immutable — a re-edit is a NEW VERSION, so
 * `draft → rendered` is the only transition this window wires
 * (videoCuts.recordRender). `approved` exists in the enum so the check
 * constraint carries it from day one, but NO repo door can reach it yet:
 * the approve transition lands with B-ve.3/4 behind the judge gate on the
 * cut's caption text (ADR 0010 invariant — an edited caption is content
 * like any other draft).
 */
export const VIDEO_CUT_STATUSES = ["draft", "rendered", "approved"] as const;
export type VideoCutStatus = (typeof VIDEO_CUT_STATUSES)[number];

export const VIDEO_CUT_TRANSITIONS: Readonly<
  Record<VideoCutStatus, readonly VideoCutStatus[]>
> = {
  draft: ["rendered"],
  rendered: ["approved"],
  approved: [],
};

export class InvalidVideoCutTransitionError extends Error {
  constructor(
    public readonly from: VideoCutStatus,
    public readonly to: VideoCutStatus,
  ) {
    super(
      `invalid video cut transition "${from}" -> "${to}" (allowed from "${from}": ${
        VIDEO_CUT_TRANSITIONS[from].join(", ") || "none — terminal state"
      })`,
    );
    this.name = "InvalidVideoCutTransitionError";
  }
}

export function assertVideoCutTransition(from: VideoCutStatus, to: VideoCutStatus): void {
  if (!VIDEO_CUT_TRANSITIONS[from].includes(to)) {
    throw new InvalidVideoCutTransitionError(from, to);
  }
}

export const videoCutInputSchema = z.object({
  name: z.string().min(1),
  /** Versioned cuts: (name, version) is the structural idempotency key. */
  version: z.number().int().positive(),
  edl: edlSchema,
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type VideoCutInput = z.input<typeof videoCutInputSchema>;
