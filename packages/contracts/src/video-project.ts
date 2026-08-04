import { z } from "zod";
import { imageRefEnvelopeSchema, storedImageRefSchema } from "./media";

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
 * STATIC gain + entry/tail easing only. A fade is for avoiding clicks, not
 * for manufacturing an ending — when the phrase resolves, hold level and
 * ease only the tail (founder, s44 FINAL); a track entering mid-phrase gets
 * the same anti-click treatment at its head (the G-score mux carries a 1.2s
 * entry ease, recovered from the master at the B-ve.4 half-window). `copy`
 * mode stream-copies the source's audio track verbatim (the 9:16 mux from
 * the 16:9 master — identical timeline, zero re-encode).
 */
export const audioCueSchema = z.object({
  source: videoSourceRefSchema,
  /** Source offset, seconds into the track where playback starts. */
  offset: seconds.default(0),
  /** Static gain in dB — never dynamic ducking. 0 = level-flat (no filter). */
  gainDb: z.number().finite().default(0),
  /** Anti-click entry easing: fade-in over the cue's first `duration` seconds (B-ve.4, additive). */
  fadeIn: z.object({ duration: z.number().positive() }).optional(),
  /** Anti-click tail easing: fade-out start (timeline seconds) + duration. */
  fadeOut: z
    .object({ start: seconds, duration: z.number().positive() })
    .optional(),
  /** AAC target bitrate in kbps (encode mode only); absent = encoder default (B-ve.4, additive). */
  bitrateKbps: z.number().int().positive().optional(),
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

/**
 * `copy` output mode (B-ve.4 half-window, additive): the video stream is
 * stream-copied from a single source — zero re-encode, zero generation
 * loss. This is the G-score mux made expressible: an existing cut's picture
 * carried verbatim while the music lane is (re-)muxed. The copy arm sits
 * FIRST in the union on purpose — zod objects are non-strict, so the encode
 * arm (all fields defaulted) would otherwise swallow `{ mode: "copy" }`.
 */
export const edlVideoCopySchema = z.object({ mode: z.literal("copy") });
export type EdlVideoCopy = z.infer<typeof edlVideoCopySchema>;

const edlVideoEncodeSchema = z.object({
  /** Additive discriminator: pre-window EDLs carry no `mode` and default here. */
  mode: z.literal("encode").default("encode"),
  codec: z.literal("libx264").default("libx264"),
  crf: z.number().int().min(0).max(51).default(18),
  preset: z
    .enum(["ultrafast", "fast", "medium", "slow", "veryslow"])
    .default("slow"),
  pixFmt: z.literal("yuv420p").default("yuv420p"),
});
export type EdlVideoEncode = z.infer<typeof edlVideoEncodeSchema>;

export const edlOutputSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  /** Final duration, seconds (the -t of record). */
  duration: z.number().positive().finite(),
  video: z
    .union([edlVideoCopySchema, edlVideoEncodeSchema])
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
export const edlSchema = z
  .object({
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
  })
  // `copy` output mode can only carry what a stream copy can honestly do:
  // one video-bearing source, untouched picture, no caption overlays. What
  // cannot be stream-copied refuses at the schema door, not in ffmpeg.
  .superRefine((edl, ctx) => {
    if (edl.output.video.mode !== "copy") return;
    if (edl.video.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["video"],
        message: "copy output mode carries exactly one video clip (the stream to copy)",
      });
      return;
    }
    const clip = edl.video[0];
    if (clip.source.kind === "still" || clip.source.kind === "audio") {
      ctx.addIssue({
        code: "custom",
        path: ["video", 0, "source"],
        message: "copy output mode needs a video-bearing source (take or cut)",
      });
    }
    if (clip.crop || clip.grade || clip.scale || clip.transitionIn || clip.in !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["video", 0],
        message:
          "copy output mode cannot re-process the picture — no crop/grade/scale/transition/in-point on a stream copy",
      });
    }
    if (edl.captions !== undefined && edl.captions.lines.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["captions"],
        message: "copy output mode cannot overlay captions — caption work needs an encode pass",
      });
    }
  });
export type EdlInput = z.input<typeof edlSchema>;
export type Edl = z.infer<typeof edlSchema>;

/* ------------------------------------------------------------------ */
/* Project + takes + cuts — the film-tree shape as validated data.     */
/* ------------------------------------------------------------------ */

/**
 * A project's name — the ONE definition, shared by the create door and the
 * rename door (window 0026). `(tenant, name)` is both a unique index and the
 * get-or-create idempotency key, so the two doors must agree on what a legal
 * name is: a name the create door would accept but rename would not (or the
 * reverse) is a project reachable one way and unreachable the other.
 * Trimmed at the door, because " Pillar" and "Pillar" colliding on nothing
 * but leading whitespace is a duplicate wearing a disguise.
 */
export const videoProjectNameSchema = z.string().trim().min(1);

export const videoProjectInputSchema = z.object({
  name: videoProjectNameSchema,
  description: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type VideoProjectInput = z.input<typeof videoProjectInputSchema>;

/**
 * Window 0026 — the rename door's input. Rename REFUSES on a name collision
 * and never merges: `(tenant, name)` is the get-or-create key, so folding two
 * projects together is what a "merge" would actually mean here (the founder's
 * call at the s99 close). The refusal is enforced in the repo against LIVE
 * *and* RETIRED rows alike — the unique index does not care that a row is
 * retired, and a rename that failed on a constraint the operator cannot see
 * would be a mystery rather than an answer.
 */
export const videoProjectRenameSchema = z.object({ name: videoProjectNameSchema });
export type VideoProjectRename = z.infer<typeof videoProjectRenameSchema>;

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

/* ------------------------------------------------------------------ */
/* B-ve.4 (ADR 0010): EDL diffs + attribution — the AI-assist wire.    */
/* ------------------------------------------------------------------ */

/**
 * The diff vocabulary the agent may propose — the MEASURED ops first
 * (caption placement + music alignment, ADR 0010 §B-ve.4), grown additively
 * as later seats earn their way in: `clip-crop` joined at the B-ve.7
 * half-window (the agent-reframe seat). A diff op is a targeted knob turn on an
 * existing EDL, never a whole-EDL replacement: the operator reads each op
 * (with its `why`), and what they approve rides the SAME save door as a
 * manual edit — compile-gated, versioned, replayable.
 */
export const EDL_DIFF_OP_KINDS = [
  "caption-move",
  "caption-text",
  "music-align",
  "clip-crop",
] as const;
export type EdlDiffOpKind = (typeof EDL_DIFF_OP_KINDS)[number];

/**
 * B-ve.7 (half-window, additive): the pan alphabet the AGENT may propose —
 * static or linear from/to only. The `expr` arm never enters through the
 * propose door: an expression is hand-measured operator craft (and an
 * injection surface the agent has no business writing); a reframe that needs
 * one is an operator edit.
 */
const proposedPanSchema = z.union([
  z.number().finite(),
  z.object({ from: z.number().finite(), to: z.number().finite() }),
]);

export const edlDiffOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("caption-move"),
    /** Index into captions.lines. */
    line: z.number().int().min(0),
    /** New plate-center coordinates in the output frame. */
    x: z.number().int(),
    y: z.number().int(),
    /** Operator-readable rationale — required; an unexplained op is refused. */
    why: z.string().min(1),
  }),
  z.object({
    op: z.literal("caption-text"),
    line: z.number().int().min(0),
    /** New caption text — CONTENT: the judge gate binds before approve (ADR 0010). */
    text: z.string().min(1),
    why: z.string().min(1),
  }),
  z
    .object({
      op: z.literal("music-align"),
      /** Index into the audio lane. */
      cue: z.number().int().min(0),
      offset: seconds.optional(),
      gainDb: z.number().finite().optional(),
      fadeIn: z.object({ duration: z.number().positive() }).optional(),
      fadeOut: z.object({ start: seconds, duration: z.number().positive() }).optional(),
      why: z.string().min(1),
    })
    .refine(
      (o) =>
        o.offset !== undefined ||
        o.gainDb !== undefined ||
        o.fadeIn !== undefined ||
        o.fadeOut !== undefined,
      { message: "a music-align op must turn at least one knob" },
    ),
  z.object({
    op: z.literal("clip-crop"),
    /** Index into the video (beat) lane. */
    clip: z.number().int().min(0),
    /**
     * The full replacement crop window, source pixels. Bounds are checked at
     * dry-apply against MEASURED source dims (probeSourceDims) — "measured,
     * never estimated" binds the agent too; the schema carries only the shape.
     */
    crop: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      x: proposedPanSchema.default(0),
      y: proposedPanSchema.default(0),
    }),
    why: z.string().min(1),
  }),
]);
export type EdlDiffOp = z.infer<typeof edlDiffOpSchema>;

export const edlDiffSchema = z.object({
  version: z.literal(1).default(1),
  /** One-line agent rationale for the whole proposal. */
  summary: z.string().min(1),
  ops: z.array(edlDiffOpSchema).min(1),
});
export type EdlDiffInput = z.input<typeof edlDiffSchema>;
export type EdlDiff = z.infer<typeof edlDiffSchema>;

/**
 * Cut attribution (stored under the cut row's `meta.attribution`, validated
 * at the save door — no table change): WHO authored this version, and for
 * agent-proposed edits the full replay record — model + prompt pin + the
 * exact applied diff. An agent-authored cut without its proposal is refused:
 * every applied diff stays replayable and attributed (ADR 0010 invariant).
 */
export const VIDEO_CUT_AUTHORS = ["operator", "agent"] as const;
export type VideoCutAuthor = (typeof VIDEO_CUT_AUTHORS)[number];

export const videoCutAttributionSchema = z
  .object({
    authoredBy: z.enum(VIDEO_CUT_AUTHORS),
    proposal: z
      .object({
        /** The cut the diff was proposed AGAINST — the replay anchor: base EDL + diff must reproduce this save's EDL, verified at the door. */
        baseCutId: z.string().min(1),
        /** Model id that generated the diff. */
        model: z.string().min(1),
        /** proprietary/prompts name of the proposer prompt. */
        promptName: z.string().min(1),
        /** Content hash of the prompt file at proposal time. */
        promptHash: z.string().min(1),
        /** The operator's natural-language ask, when one drove the proposal. */
        ask: z.string().optional(),
        /** The exact applied diff — the replay record. */
        diff: edlDiffSchema,
        /** Who accepted it. Always the operator: auto-apply does not exist. */
        decidedBy: z.literal("operator"),
      })
      .optional(),
  })
  .refine((a) => a.authoredBy !== "agent" || a.proposal !== undefined, {
    message: "an agent-authored cut must carry its proposal (replayable + attributed)",
  });
export type VideoCutAttribution = z.infer<typeof videoCutAttributionSchema>;

/* ------------------------------------------------------------------ */
/* B-ve.5 (ADR 0010): derived cuts — the aspect-lens lineage pin.      */
/* ------------------------------------------------------------------ */

/**
 * Aspect presets a cut can be derived FOR. Aspect variants are own-engine
 * recuts, never vendor reframe (ADR 0010 invariant); the canvas pairs are
 * the two film masters' proven geometry family.
 */
export const VIDEO_DERIVE_ASPECTS = ["9:16", "1:1"] as const;
export type VideoDeriveAspect = (typeof VIDEO_DERIVE_ASPECTS)[number];

export const DERIVE_CANVAS: Record<VideoDeriveAspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

/**
 * Cut lineage (stored under the cut row's `meta.lineage`, validated at the
 * derive/save doors and immutable once stamped — no table change, the
 * meta.attribution pattern): which cut this one was DERIVED from and the
 * aspect it recomposes for. The pin is by cut id — one row = one immutable
 * (name, version) — so the surface can show honest staleness ("derived from
 * v6 · parent now at v8") with NO auto-sync: a parent edit never touches a
 * derived cut (auto-apply does not exist).
 */
export const videoCutLineageSchema = z.object({
  /** The parent cut row this EDL was seeded from. */
  parentCutId: z.string().min(1),
  /** Declared target aspect, "W:H". */
  aspect: z.string().regex(/^\d{1,3}:\d{1,3}$/),
});
export type VideoCutLineage = z.infer<typeof videoCutLineageSchema>;

/* ------------------------------------------------------------------ */
/* B-media.0 (s77): the take's poster.                                  */
/* ------------------------------------------------------------------ */

/**
 * A take's poster frame (stored under the take row's `meta.posterRef`,
 * validated at the write door — no table change, the `meta.attribution`
 * pattern above).
 *
 * A take owns BYTES but no still, so the dossier has nothing to show until
 * one is derived: ffprobe a frame at ~1s → 640w webp → sha256 → object store.
 * That is why the ref must be **stored**, not external — the poster is
 * something we made from bytes we hold, and a poster that could link off-box
 * would reintroduce exactly the link-rot this framework exists to surface.
 *
 * `provenance` stays open across all three values on purpose. `derived` is
 * today's only writer, but a poster is legitimately reachable as `captured`
 * (a platform still we pulled into our own store) or `operator` (a human
 * picks a better frame through the future import door) — and narrowing it
 * now would cost a whole contract window to widen later.
 *
 * Its own chain is one link long and stops honestly: `meta.posterRef → empty`
 * (invariant 1 — a take never borrows its project's or its cut's image).
 */
export const videoTakePosterSchema = imageRefEnvelopeSchema.extend({
  ref: storedImageRefSchema,
});
export type VideoTakePoster = z.infer<typeof videoTakePosterSchema>;
