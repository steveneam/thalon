import path from "node:path";
import { videoSourceRefSchema } from "@thalon/contracts";

/**
 * B-ve.2 media guard: the ONLY path between a browser and a project file.
 * Three walls, in order — the contract's project-relative ref schema (no
 * absolute, no `..`, no `\`, no `//`), an extension allowlist (media only,
 * never scripts or manifests), and resolved-path containment under the
 * project's media root (belt over the schema's braces). Server-only module.
 */

/** The contract's own ref guard — the same schema the EDL compiler trusts. */
const refGuard = videoSourceRefSchema.shape.ref;

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".srt": "text/plain; charset=utf-8",
};

export type ResolvedMedia =
  | { ok: true; absPath: string; contentType: string }
  | { ok: false; reason: string };

export function resolveMediaFile(root: string, rawRef: string): ResolvedMedia {
  const parsed = refGuard.safeParse(rawRef);
  if (!parsed.success) {
    return { ok: false, reason: "ref must be project-relative (no absolute paths, no '..', no '//', no '\\')" };
  }
  const contentType = CONTENT_TYPES[path.posix.extname(parsed.data).toLowerCase()];
  if (!contentType) {
    return { ok: false, reason: "ref is not a servable media type" };
  }
  const absPath = path.resolve(root, parsed.data);
  if (absPath !== root && !absPath.startsWith(root + path.sep)) {
    return { ok: false, reason: "ref escapes the project media root" };
  }
  return { ok: true, absPath, contentType };
}

export type ByteRange = { start: number; end: number };

/**
 * RFC 9110 single-range subset: a malformed header is IGNORED (null → serve
 * 200 full, per spec SHOULD); a syntactically valid but unsatisfiable range
 * returns "unsatisfiable" (→ 416). Multi-range requests are ignored.
 */
export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | null | "unsatisfiable" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    // suffix range: last N bytes
    const suffix = Number(m[2]);
    if (suffix === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(m[1]);
  if (start >= size) return "unsatisfiable";
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (end < start) return null;
  return { start, end };
}
