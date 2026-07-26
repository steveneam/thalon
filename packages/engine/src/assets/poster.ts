import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  videoTakePosterSchema,
  type TenantCtx,
  type VideoTakePoster,
} from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { objectKey, type ObjectStore } from "@thalon/platform";
import { defaultBinary } from "../edl/execute";

/**
 * B-media.0 (s77) — WRITE MOMENT 2 of the media framework (plan §5): a take
 * owns bytes but no still, so the dossier has nothing to show until one is
 * derived. ffprobe the source → ffmpeg one frame at ~1s → 640w webp → sha256
 * → the content-addressed store under `media/<sha>.webp` → the take's
 * `meta.posterRef` as a `videoTakePosterSchema` envelope, `provenance:
 * "derived"`.
 *
 * `media/<sha>.<ext>` is the family lane A's `/api/media/[ref]` door already
 * reads, composed through `objectKey` and nowhere else (the B4.6 lesson: three
 * hand-rolled key conventions existed before that helper).
 *
 * THE GATE IS THE POINT. Derivation never throws into a render: a box (or an
 * image) without ffmpeg degrades to an honest "poster pending" — which is the
 * SAME `empty` the resolver already shows for a take that never had one,
 * because "pending" and "none" are the same box with a different story behind
 * it (the resolver says so in its own comment). This survives ffmpeg landing
 * in `Dockerfile.web`: a missing binary must never take down a render, and
 * defence in depth outlives the reason it was added.
 *
 * Every subprocess is behind the `PosterFrameExtractor` seam, so tests inject
 * a fake and no test in this repo ever shells out to a real ffmpeg.
 */

const run = promisify(execFile);

/** The one poster geometry — 640 wide, height from the source's own aspect (never letterboxed, never guessed). */
export const POSTER_WIDTH = 640;
/** Posters are webp: the image family's smallest honest option, and a closed `MEDIA_IMAGE_EXTS` member. */
export const POSTER_EXT = "webp";
/** ~1s in: past the fade-up a mint almost always opens with, before anything can have cut away. */
export const POSTER_SEEK_SECONDS = 1;
/** The object-key family lane A's workspace door reads. */
export const POSTER_FAMILY = "media";

/**
 * Why a take has no poster, when the honest answer is "not yet". Each one is
 * a fact the log states plainly — never an exception, never a silent skip.
 */
export type PosterPendingReason =
  /** No ffmpeg/ffprobe on this box or in this image. The defence-in-depth gate. */
  | "binaries-absent"
  /** An audio take has no frame to take. Not a failure — a category. */
  | "not-visual"
  /** The bytes are missing, truncated, or carry no measurable video stream. */
  | "unreadable";

export type PosterOutcome =
  | {
      status: "derived";
      poster: VideoTakePoster;
      /** `media/<sha>.webp` — where the bytes now live. */
      key: string;
      /** False when the identical frame was already stored (content-addressed: a re-derive writes nothing). */
      storedNow: boolean;
    }
  | { status: "pending"; why: PosterPendingReason; detail?: string };

/** A measured frame: the bytes AND the dimensions they actually have — read from the output, never computed from the scale math. */
export interface PosterFrame {
  bytes: Buffer;
  width: number;
  height: number;
}

/**
 * The subprocess seam (the B4.8 runner pattern). `available()` answers the
 * binary-presence gate by ASKING THE OS rather than guessing at a path — a
 * guess drifts from reality the moment an image changes.
 */
export interface PosterFrameExtractor {
  readonly name: string;
  available(): Promise<boolean>;
  /** One frame of `file` as webp, at most `maxWidth` wide. Throws on refusal; the caller degrades. */
  extract(file: string, opts: { maxWidth: number; seekSeconds: number }): Promise<PosterFrame>;
}

/** Loud failure carries the actual ffmpeg/ffprobe refusal, never a euphemism (the EdlExecuteError rule). */
export class PosterExtractError extends Error {
  constructor(
    public readonly file: string,
    message: string,
  ) {
    super(`poster extract: ${file}: ${message}`);
    this.name = "PosterExtractError";
  }
}

function stderrOf(err: unknown): string {
  if (err && typeof err === "object" && "stderr" in err) {
    const text = String((err as { stderr: unknown }).stderr).trim();
    if (text) return text;
  }
  return err instanceof Error ? err.message : String(err);
}

function isMissingBinary(err: unknown): boolean {
  return (
    err !== null && typeof err === "object" && (err as { code?: unknown }).code === "ENOENT"
  );
}

interface ProbedSource {
  width: number;
  height: number;
  /** Seconds, or null when the container reports none (a still image, a stream without a duration). */
  durationSeconds: number | null;
}

/**
 * The real extractor: two local binaries, resolved through the render door's
 * own ladder (THALON_FFMPEG/THALON_FFPROBE → ~/.local/bin → PATH), so a
 * poster and a cut can never disagree about which ffmpeg this box means.
 */
export function createFfmpegPosterExtractor(
  opts: { ffmpeg?: string; ffprobe?: string; timeoutMs?: number } = {},
): PosterFrameExtractor {
  const ffmpeg = opts.ffmpeg ?? defaultBinary("ffmpeg");
  const ffprobe = opts.ffprobe ?? defaultBinary("ffprobe");
  const timeout = opts.timeoutMs ?? 120_000;
  let presence: Promise<boolean> | null = null;

  async function probe(file: string): Promise<ProbedSource> {
    let stdout: string;
    try {
      ({ stdout } = await run(
        ffprobe,
        [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=width,height:format=duration",
          "-of",
          "json",
          file,
        ],
        { timeout },
      ));
    } catch (err) {
      if (isMissingBinary(err)) throw err;
      throw new PosterExtractError(file, stderrOf(err));
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new PosterExtractError(file, "ffprobe returned no JSON");
    }
    const stream = (parsed as { streams?: { width?: unknown; height?: unknown }[] }).streams?.[0];
    const width = stream?.width;
    const height = stream?.height;
    if (typeof width !== "number" || width <= 0 || typeof height !== "number" || height <= 0) {
      throw new PosterExtractError(file, "no video stream with measurable dimensions");
    }
    const rawDuration = (parsed as { format?: { duration?: unknown } }).format?.duration;
    const durationSeconds = Number(rawDuration);
    return {
      width,
      height,
      durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null,
    };
  }

  return {
    name: "ffmpeg-local",

    available(): Promise<boolean> {
      // Memoized: the door asks once per run, not once per take.
      presence ??= (async () => {
        for (const binary of [ffprobe, ffmpeg]) {
          try {
            await run(binary, ["-version"], { timeout });
          } catch (err) {
            if (isMissingBinary(err)) return false;
            // A binary that answers ANYTHING exists; only ENOENT means absent.
          }
        }
        return true;
      })();
      return presence;
    },

    async extract(file, { maxWidth, seekSeconds }): Promise<PosterFrame> {
      const source = await probe(file);
      // Never upscale: a 320w take's poster is 320 wide, honestly, rather than
      // 640 pixels of invented detail. Even width keeps every encoder happy.
      const target = Math.max(2, Math.min(maxWidth, source.width) & ~1);
      // Only seek into media we have MEASURED as long enough. A clip shorter
      // than the seek point would seek past its own end and yield nothing, and
      // a still image (or a container reporting no duration) is exactly that
      // case — those take frame zero rather than no frame at all.
      const seek =
        source.durationSeconds !== null && source.durationSeconds > seekSeconds ? seekSeconds : 0;

      const scratch = await mkdtemp(path.join(tmpdir(), "thalon-poster-"));
      const out = path.join(scratch, `poster.${POSTER_EXT}`);
      try {
        try {
          await run(
            ffmpeg,
            [
              "-nostdin",
              "-v",
              "error",
              "-ss",
              String(seek),
              "-i",
              file,
              "-frames:v",
              "1",
              "-vf",
              `scale=${target}:-2`,
              "-y",
              out,
            ],
            { timeout },
          );
        } catch (err) {
          if (isMissingBinary(err)) throw err;
          throw new PosterExtractError(file, stderrOf(err));
        }
        let bytes: Buffer;
        try {
          bytes = await readFile(out);
        } catch {
          throw new PosterExtractError(file, "ffmpeg wrote no frame");
        }
        if (bytes.length === 0) throw new PosterExtractError(file, "ffmpeg wrote an empty frame");
        // MEASURED, never estimated: the poster's dimensions are read back off
        // the bytes we are about to store, so the envelope can never claim a
        // geometry the file does not have.
        const measured = await probe(out);
        return { bytes, width: measured.width, height: measured.height };
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Deterministic keyless test double — the fake-driver pattern every seam in
 * this engine ships (fake-target, fake-tts, fake-embedder). Frame bytes are
 * synthesized from the file path, so two different takes get two different
 * shas and the same take derives byte-identically twice.
 */
export function createFakePosterExtractor(
  opts: {
    available?: boolean;
    width?: number;
    height?: number;
    /** Files whose extraction refuses — the `unreadable` path, without a real corrupt fixture. */
    unreadable?: readonly string[];
  } = {},
): PosterFrameExtractor {
  const unreadable = new Set(opts.unreadable ?? []);
  return {
    name: "fake-poster",
    available: () => Promise.resolve(opts.available ?? true),
    extract(file, { maxWidth }): Promise<PosterFrame> {
      if (unreadable.has(file)) {
        return Promise.reject(new PosterExtractError(file, "no video stream with measurable dimensions"));
      }
      const width = Math.min(maxWidth, opts.width ?? maxWidth);
      const height = opts.height ?? Math.round(width / 1.6);
      return Promise.resolve({
        bytes: Buffer.from(`fake-poster:${file}:${width}x${height}`, "utf8"),
        width,
        height,
      });
    },
  };
}

export interface DerivePosterDeps {
  /** Where the derived bytes land — the same content-addressed store every other artifact uses. */
  store: ObjectStore;
  /** Default: the local ffmpeg pair. Tests inject a fake and never shell out. */
  extractor?: PosterFrameExtractor;
  /**
   * ISO-8601 stamp for the envelope's `capturedAt`. Absent = "we did not
   * record when", which the contract calls a fact — and it keeps this module
   * clock-free, so tests are deterministic (the `pinAsset` precedent).
   */
  derivedAt?: string;
}

/** What a poster can be derived FROM: a take's kind and the absolute path to its bytes. */
export interface PosterSource {
  kind: string;
  /** Absolute path — the caller owns the media root AND its containment wall. */
  file: string;
}

/**
 * Derive one poster and store it. Never throws for an absent binary or
 * unreadable media: those are `pending`, the honest empty box.
 */
export async function derivePoster(
  source: PosterSource,
  deps: DerivePosterDeps,
): Promise<PosterOutcome> {
  // An audio take has no frame. Answering "not-visual" before touching the
  // filesystem keeps a music candidate from ever looking like a failure.
  if (source.kind !== "motion" && source.kind !== "still") {
    return { status: "pending", why: "not-visual" };
  }
  const extractor = deps.extractor ?? createFfmpegPosterExtractor();
  if (!(await extractor.available())) {
    return {
      status: "pending",
      why: "binaries-absent",
      detail: `${extractor.name}: no ffmpeg/ffprobe on this box — poster pending, render unaffected`,
    };
  }

  let frame: PosterFrame;
  try {
    frame = await extractor.extract(source.file, {
      maxWidth: POSTER_WIDTH,
      seekSeconds: POSTER_SEEK_SECONDS,
    });
  } catch (err) {
    if (isMissingBinary(err)) {
      return { status: "pending", why: "binaries-absent", detail: stderrOf(err) };
    }
    return { status: "pending", why: "unreadable", detail: stderrOf(err) };
  }

  const sha256 = createHash("sha256").update(frame.bytes).digest("hex");
  const key = objectKey(POSTER_FAMILY, sha256, POSTER_EXT);
  // Content-addressed: identical bytes are already the same object, so a
  // re-derive writes nothing rather than rewriting an immutable artifact.
  const existing = await deps.store.get(key);
  if (!existing) await deps.store.put(key, frame.bytes);

  const poster = videoTakePosterSchema.parse({
    ref: {
      kind: "stored",
      sha256,
      ext: POSTER_EXT,
      width: frame.width,
      height: frame.height,
      bytes: frame.bytes.length,
    },
    provenance: "derived",
    ...(deps.derivedAt ? { capturedAt: deps.derivedAt } : {}),
  });
  return { status: "derived", poster, key, storedNow: existing === null };
}

/** A take already carrying a READABLE poster is done — re-deriving would rewrite history for no gain. */
export function takeHasPoster(meta: unknown): boolean {
  const posterRef = (meta as { posterRef?: unknown } | null)?.posterRef;
  if (posterRef === undefined || posterRef === null) return false;
  return videoTakePosterSchema.safeParse(posterRef).success;
}

/**
 * Join a project-relative take ref onto its media root, refusing anything
 * that would escape it. The contract's `projectRelativeRef` already forbids
 * `..` and absolute refs at the write door; this is the second wall, because
 * a path that reaches outside the root is the one bug worth paying twice for.
 */
export function resolveTakeFile(mediaRoot: string, ref: string): string {
  const root = path.resolve(mediaRoot);
  const file = path.resolve(root, ref);
  if (file !== root && !file.startsWith(root + path.sep)) {
    throw new Error(`take ref "${ref}" escapes the project media root`);
  }
  return file;
}

export interface BackfillTakePostersDeps extends DerivePosterDeps {
  /** Absolute path to the project's media tree on THIS box (`meta.mediaRoot`). */
  mediaRoot: string;
  /** Progress line per take — the operator watches a backfill, they do not guess at it. */
  log?: (line: string) => void;
}

export interface TakePosterReport {
  ref: string;
  status: "derived" | "already" | "pending";
  why?: PosterPendingReason;
  detail?: string;
}

export interface BackfillTakePostersResult {
  derived: number;
  /** Takes that already carried a poster — untouched, never re-derived. */
  already: number;
  pending: number;
  takes: TakePosterReport[];
}

/**
 * THE BACKFILL DOOR: derive posters for the takes that already exist (58 on
 * the concept film alone), so the dossier lights up without waiting for new
 * mints.
 *
 * IDEMPOTENT BY CONSTRUCTION — a take that already carries a readable poster
 * is skipped before any subprocess runs, so a second run is a no-op and never
 * a re-derive. A take whose poster cannot be derived stays pending and the
 * run continues: one unreadable file must not cost the other fifty-seven
 * their posters.
 */
export async function backfillTakePosters(
  ctx: TenantCtx,
  repos: Repos,
  projectId: string,
  deps: BackfillTakePostersDeps,
): Promise<BackfillTakePostersResult> {
  const log = deps.log ?? (() => {});
  const takes = await repos.videoTakes.list(ctx, projectId);
  const result: BackfillTakePostersResult = { derived: 0, already: 0, pending: 0, takes: [] };

  for (const take of takes) {
    if (takeHasPoster(take.meta)) {
      result.already += 1;
      result.takes.push({ ref: take.ref, status: "already" });
      log(`  = ${take.ref} — poster already on record`);
      continue;
    }
    let file: string;
    try {
      file = resolveTakeFile(deps.mediaRoot, take.ref);
    } catch (err) {
      // A ref the containment wall refuses is one bad row, not a reason to
      // abandon the other fifty-seven takes their posters.
      result.pending += 1;
      const detail = err instanceof Error ? err.message : String(err);
      result.takes.push({ ref: take.ref, status: "pending", why: "unreadable", detail });
      log(`  · ${take.ref} — poster pending (unreadable): ${detail}`);
      continue;
    }
    const outcome = await derivePoster({ kind: take.kind, file }, deps);
    if (outcome.status === "pending") {
      result.pending += 1;
      result.takes.push({ ref: take.ref, status: "pending", why: outcome.why, detail: outcome.detail });
      log(`  · ${take.ref} — poster pending (${outcome.why})${outcome.detail ? `: ${outcome.detail}` : ""}`);
      continue;
    }
    await repos.videoTakes.setPoster(ctx, take.id, outcome.poster);
    result.derived += 1;
    result.takes.push({ ref: take.ref, status: "derived" });
    log(
      `  + ${take.ref} — ${outcome.key} (${outcome.poster.ref.width}×${outcome.poster.ref.height}` +
        `${outcome.storedNow ? "" : ", bytes already stored"})`,
    );
  }
  return result;
}
