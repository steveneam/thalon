import {
  audioRefEnvelopeSchema,
  MEDIA_AUDIO_EXTS,
  type AudioRefEnvelope,
  type MediaAudioExt,
  type TenantCtx,
} from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { getContentAddressed, objectKey, type ObjectStore } from "@thalon/platform";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { RenderAudioBed, RenderAudioProvider } from "./hyperframes-target";

/**
 * B-audio.1 piece 1 (plan §8) — THE BED SOURCE. An operator-licensed track
 * becomes bytes in OUR content-addressed store plus an `audioRefEnvelope`
 * with `provenance: "operator"`, and the project points at it. One shape for
 * every image, poster and bed (plan §1): a music bed is the same object as a
 * poster, differing only in which ext family it lives in.
 *
 * THE BINDING CONSTRAINT, founder-ratified and written at
 * `render/narration.ts:34-36`: **no music bed lives in-tree.** The bed is
 * operator-supplied track DATA behind the composition's `bed` slot;
 * self-generation stays a recorded future rung behind the same registry
 * discipline as every other driver. Nothing here commits an audio file — not
 * even a test fixture; the tests synthesize their bytes.
 *
 * Audio is STORED-ONLY by contract, and the contract says why: you cannot
 * license bytes you do not hold, and hot-linking someone's audio would make
 * a render's legal footing depend on a stranger's uptime.
 *
 * LICENSING IS NOT ASSUMED, IT IS ATTESTED. This door refuses a bed that
 * arrives without the operator saying, on the record, what right they have to
 * use it. That makes the launch gate executable rather than remembered — the
 * strongest rung of the ratchet ladder that fits here.
 */

/**
 * The operator's licence attestation, recorded beside the bed on the project.
 *
 * It lives in the engine rather than `packages/contracts` because the s77
 * window is FROZEN and this is not a shape lane A consumes — exactly the
 * arrangement `assets/pin.ts` used for `assetProvenanceSchema` before its own
 * window opened. It migrates into contracts at the next window; until then
 * this file is its single door.
 */
export const audioBedLicenseSchema = z.strictObject({
  /** What licence the track is used under, in the operator's words ("CC0", "Epidemic Sound sub #123", "commissioned, work-for-hire"). */
  license: z.string().min(1),
  /** Where the track came from — the audit trail a licence claim is worth nothing without. */
  source: z.string().min(1),
  /** Who attested it. A licence is a person's claim, never the system's inference. */
  attestedBy: z.string().min(1),
  /** When, ISO-8601 with offset. Caller-supplied, so this module stays clock-free. */
  attestedAt: z.iso.datetime({ offset: true }),
  /** Anything else the operator wants on the record (rights period, territory, invoice ref). */
  note: z.string().min(1).optional(),
});
export type AudioBedLicense = z.infer<typeof audioBedLicenseSchema>;

/** What a project stores under `meta.audioBed`: the ref AND the right to use it, together or not at all. */
export const projectAudioBedSchema = z.strictObject({
  bed: audioRefEnvelopeSchema,
  license: audioBedLicenseSchema,
});
export type ProjectAudioBed = z.infer<typeof projectAudioBedSchema>;

/** The object-key family — the same lane the workspace `/api/media/<sha>.<ext>` door reads. */
export const AUDIO_BED_FAMILY = "media";

/**
 * Container sniffing, deliberately shallow: enough to catch a PNG renamed to
 * `.mp3` (which would fail silently at render time, hours later) and not one
 * byte more. This is a mislabel guard, not a codec validator — the render is
 * the real decoder and it is allowed to be the one that refuses.
 */
const MAGIC: Readonly<Record<MediaAudioExt, (bytes: Buffer) => boolean>> = {
  mp3: (b) =>
    b.subarray(0, 3).toString("ascii") === "ID3" ||
    // A bare MPEG frame sync: 11 set bits.
    (b.length > 1 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  wav: (b) =>
    b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WAVE",
  m4a: (b) => b.subarray(4, 8).toString("ascii") === "ftyp",
};

export class AudioBedRejected extends Error {
  constructor(message: string) {
    super(`audio bed refused: ${message}`);
    this.name = "AudioBedRejected";
  }
}

export interface StoreAudioBedInput {
  bytes: Buffer;
  ext: MediaAudioExt;
  /** ISO-8601 stamp for the envelope's `capturedAt` — absent = "we did not record when" (the contract's honest absence). */
  storedAt?: string;
  /** Describes the track for a screen reader on any surface that names it. */
  alt?: string;
}

export interface StoredAudioBed {
  envelope: AudioRefEnvelope;
  /** `media/<sha256>.<ext>` — the durable reference every surface carries. */
  key: string;
  /** False when the identical track was already stored (content-addressed: re-uploading writes nothing). */
  storedNow: boolean;
}

/**
 * Bytes → the content-addressed store → an operator-provenance envelope.
 * Idempotent on the content: uploading the same track twice is one object.
 */
export async function storeAudioBed(
  store: ObjectStore,
  input: StoreAudioBedInput,
): Promise<StoredAudioBed> {
  if (!(MEDIA_AUDIO_EXTS as readonly string[]).includes(input.ext)) {
    throw new AudioBedRejected(`"${input.ext}" is not an audio extension the contract knows`);
  }
  if (input.bytes.length === 0) throw new AudioBedRejected("empty body — there is no track here");
  if (!MAGIC[input.ext](input.bytes)) {
    throw new AudioBedRejected(
      `the bytes do not look like ${input.ext} — a mislabelled track fails at render time, hours after the upload`,
    );
  }

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const key = objectKey(AUDIO_BED_FAMILY, sha256, input.ext);
  const existing = await store.get(key);
  if (!existing) await store.put(key, input.bytes);

  const envelope = audioRefEnvelopeSchema.parse({
    ref: { kind: "stored", sha256, ext: input.ext, bytes: input.bytes.length },
    provenance: "operator",
    ...(input.storedAt ? { capturedAt: input.storedAt } : {}),
    ...(input.alt ? { alt: input.alt } : {}),
  });
  return { envelope, key, storedNow: existing === null };
}

/** Verified read of a stored bed — the bytes only if they still hash to their own key; null when the object is gone. */
export function readAudioBed(store: ObjectStore, envelope: AudioRefEnvelope): Promise<Buffer | null> {
  return getContentAddressed(store, objectKey(AUDIO_BED_FAMILY, envelope.ref.sha256, envelope.ref.ext));
}

/**
 * A project's configured bed, or null. Never throws: a malformed legacy value
 * is "no bed configured", which is a normal, stated state — not a broken
 * render (the refusal-ladder register).
 */
export function projectAudioBed(meta: unknown): ProjectAudioBed | null {
  const raw = (meta as { audioBed?: unknown } | null)?.audioBed;
  if (raw === undefined || raw === null) return null;
  const parsed = projectAudioBedSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/* ------------------------------------------------------------------ */
/* Piece 3 — THE MUX. The bed reaches the rendered cut, or says why not. */
/* ------------------------------------------------------------------ */

/**
 * The film's own bed level (`composition-project` has emitted this number in
 * its own tests since the seam was drawn): under narration, music sits well
 * below it. A cut that configures no gain gets this, not silence and not
 * full level.
 */
export const DEFAULT_BED_VOLUME = 0.35;

/** The music lane speaks dB (the s44 measured method); the composition speaks linear 0–1. One conversion, in one place. */
export function bedVolumeFromGainDb(gainDb: number): number {
  if (!Number.isFinite(gainDb)) return DEFAULT_BED_VOLUME;
  return Math.max(0, Math.min(1, Math.round(10 ** (gainDb / 20) * 1000) / 1000));
}

/** Why a render carries no music. Each is a STATED state — a silent render is honest, a silently-dropped bed is not. */
export type BedOmission =
  /** The project configured none. The normal case, and not a failure. */
  | "none-configured"
  /** A bed IS configured and its bytes are gone or no longer hash to their key. */
  | "bytes-missing";

export type BedResolution =
  | { status: "ready"; bed: RenderAudioBed; license: AudioBedLicense }
  | { status: "omitted"; why: BedOmission };

/**
 * Resolve a project's configured bed into render-ready bytes.
 *
 * `bytes-missing` is deliberately NOT the same answer as `none-configured`:
 * one means the operator chose silence, the other means we lost a track they
 * licensed. Collapsing them would let a render quietly drop configured music
 * — the exact failure the refusal ladder exists to prevent.
 */
export async function resolveProjectBed(
  store: ObjectStore,
  projectMeta: unknown,
  opts: { gainDb?: number } = {},
): Promise<BedResolution> {
  const configured = projectAudioBed(projectMeta);
  if (!configured) return { status: "omitted", why: "none-configured" };
  const bytes = await readAudioBed(store, configured.bed);
  if (!bytes) return { status: "omitted", why: "bytes-missing" };
  return {
    status: "ready",
    bed: {
      bytes,
      ext: configured.bed.ref.ext,
      volume: opts.gainDb === undefined ? DEFAULT_BED_VOLUME : bedVolumeFromGainDb(opts.gainDb),
    },
    license: configured.license,
  };
}

/**
 * Attach the resolved bed to whatever audio a render already had, so the
 * rendered cut actually carries its music — otherwise the editor lies about
 * its output.
 *
 * When there is no inner provider the bundle is narration-silent and
 * bed-only, sized to the manifest's own cue count (the target aligns tracks
 * by cue index and refuses a mismatch). When the bed is omitted, `onOmitted`
 * is called with WHY — the caller states it in the render record rather than
 * discovering silence later.
 */
export function withMusicBed(
  inner: RenderAudioProvider | null,
  resolve: () => Promise<BedResolution>,
  opts: { onOmitted?: (why: BedOmission) => void } = {},
): RenderAudioProvider {
  return async (manifest) => {
    const bundle = inner
      ? await inner(manifest)
      : { narration: manifest.timeline.cues.map(() => null) };
    const resolution = await resolve();
    if (resolution.status === "omitted") {
      opts.onOmitted?.(resolution.why);
      return bundle;
    }
    return bundle === null
      ? { narration: manifest.timeline.cues.map(() => null), bed: resolution.bed }
      : { ...bundle, bed: resolution.bed };
  };
}

export interface ConfigureAudioBedInput extends StoreAudioBedInput {
  license: AudioBedLicense;
}

/**
 * THE OPERATOR DOOR: store the track and point the project at it, with the
 * licence attested in the same act.
 *
 * Order matters and is deliberate: the licence is validated BEFORE a single
 * byte is stored, so an unattested bed never reaches the store at all — that
 * is the gate. This is not a transaction across two systems and does not
 * pretend to be: a db failure after a successful put leaves content-addressed
 * bytes that nothing references, which is exactly what the orphan sweep
 * reclaims, and a re-run puts the identical object again for free.
 */
export async function configureProjectAudioBed(
  ctx: TenantCtx,
  repos: Repos,
  projectId: string,
  store: ObjectStore,
  input: ConfigureAudioBedInput,
): Promise<StoredAudioBed> {
  const license = audioBedLicenseSchema.parse(input.license);
  const stored = await storeAudioBed(store, input);
  await repos.videoProjects.setAudioBed(ctx, projectId, { bed: stored.envelope, license });
  return stored;
}
