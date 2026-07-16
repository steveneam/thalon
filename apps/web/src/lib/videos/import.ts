import type { VideoTakeInput, VideoTakeKind } from "@thalon/contracts";

/**
 * B-ve.2 import classifier: a project tree's file listing → take inputs for
 * the frozen B-ve.1 repos. Encodes the REFERENCE TREE SHAPE (the concept
 * film's layout, founder-directed s43 as how a client video project lives in
 * Thalon): `keepers/` and `rejects/` segments carry the disposition, slots
 * parse from `beat-NN`-style names, `cuts/` holds OUTPUTS (a cut is never a
 * take) except `music-candidates/` (audio takes, slotless), `checkpoints/`
 * holds review sheets. Pure module — the CLI wrapper owns fs and db.
 */

const KIND_BY_EXT: Record<string, VideoTakeKind> = {
  ".mp4": "motion",
  ".webm": "motion",
  ".mov": "motion",
  ".png": "still",
  ".jpg": "still",
  ".jpeg": "still",
  ".gif": "still",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".flac": "audio",
};

/** "beat-01" from beat-/clip-/composite-/hold-NN naming; null = slotless. */
export function slotFromRef(ref: string): string | null {
  const base = ref.split("/").at(-1) ?? "";
  const m = /(?:^|[^a-z0-9])(?:beat|clip|composite|hold)-(\d{1,2})(?![0-9])/i.exec(base);
  return m ? `beat-${m[1].padStart(2, "0")}` : null;
}

export interface ImportPlan {
  takes: VideoTakeInput[];
  /** Not takes, with the why on record — printed, never silently dropped. */
  skipped: { ref: string; why: string }[];
  /** Rejects the contract would refuse: no reason on record yet. */
  missingReasons: string[];
}

export interface ClassifyOptions {
  /** Sidecar: ref → why it was rejected (the learning material). */
  reasons?: Record<string, string>;
  /** Sidecar: ref → B7.1 provenance manifest data. */
  provenance?: Record<string, Record<string, unknown>>;
  /** Path segments to leave out entirely (e.g. "experiments"). "archive" is always excluded. */
  exclude?: string[];
  /** Fallback reason for rejects missing a sidecar entry. */
  defaultReason?: string;
}

export function classifyProjectTree(files: string[], opts: ClassifyOptions = {}): ImportPlan {
  const exclude = new Set(["archive", ...(opts.exclude ?? [])]);
  const plan: ImportPlan = { takes: [], skipped: [], missingReasons: [] };

  for (const raw of files.slice().sort()) {
    const ref = raw.replaceAll("\\", "/").replace(/^\.?\//, "");
    const segments = ref.split("/");
    if (segments.some((s) => s.startsWith("."))) continue; // hidden files/dirs: not project data
    const excluded = segments.find((s) => exclude.has(s));
    if (excluded) {
      plan.skipped.push({ ref, why: `excluded segment "${excluded}"` });
      continue;
    }
    const kind = KIND_BY_EXT[(/\.[^.]+$/.exec(ref)?.[0] ?? "").toLowerCase()];
    if (!kind) {
      plan.skipped.push({ ref, why: "not a media file" });
      continue;
    }
    const isMusicCandidate = segments.includes("music-candidates");
    if (!isMusicCandidate && segments.includes("cuts")) {
      plan.skipped.push({ ref, why: "cut output, not a take" });
      continue;
    }
    if (segments.includes("checkpoints")) {
      plan.skipped.push({ ref, why: "checkpoint review sheet, not a take" });
      continue;
    }
    const disposition = segments.includes("rejects") ? "reject" : "keeper";
    const reason = opts.reasons?.[ref] ?? (disposition === "reject" ? opts.defaultReason : undefined);
    if (disposition === "reject" && reason === undefined) {
      plan.missingReasons.push(ref);
      continue;
    }
    plan.takes.push({
      slot: isMusicCandidate ? undefined : (slotFromRef(ref) ?? undefined),
      kind,
      disposition,
      ref,
      reason,
      provenance: opts.provenance?.[ref] ?? {},
    });
  }
  return plan;
}
