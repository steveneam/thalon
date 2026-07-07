import { createHash } from "node:crypto";
import type { ObjectStore } from "./object-store";

/**
 * THE object-store key scheme (B4.6 — one helper; three hand-rolled
 * conventions existed before it). Every persisted key is
 * `<family>/<id>.<ext>` (flat) or `<family>/<id>/<name>` (a prefix
 * directory of sibling artifacts). Families in use:
 *
 *   web-pages/<sha256(html)>.html            content-addressed, VERIFIABLE
 *   renders/pillar/<sha256(manifest)>/…      content-addressed prefix, the
 *                                            manifest.json bytes ARE the
 *                                            hashed content (VERIFIABLE)
 *   demo-captures/<sha256(bundle)>.json      content-addressed, VERIFIABLE
 *   crawl-pages/<source contentHash>.json    keyed by the crawl's content
 *                                            hash (an envelope — the stored
 *                                            JSON's own bytes hash
 *                                            differently; NOT verifiable)
 *   embeddings/<cache key>.json              cache-keyed (NOT verifiable)
 *   sweeps/<tenantId>.json                   MUTABLE POINTER (B6.5): the
 *                                            tenant's latest ranked sweep
 *                                            bundle, overwritten per sweep;
 *                                            protected from the orphan
 *                                            sweep (no db row references it
 *                                            by design)
 *
 * GC stance (documented here because this is the one file every key passes
 * through): content-addressed artifacts are IMMUTABLE — never overwritten,
 * never mutated, safe to re-put idempotently. Deletion happens only through
 * the orphan sweep (`npm run -w @thalon/eval sweep`, dry-run by default),
 * which removes keys no db row references; `embeddings/` is a cache family
 * — evict-safe by construction (a miss just re-embeds) but still swept only
 * explicitly, never automatically. Byte-stability: the composed keys are
 * pinned by packages/engine/src/__tests__/key-stability.test.ts (A10).
 */

const FAMILY_RE = /^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/;
const ID_RE = /^[A-Za-z0-9._:-]+$/;
const EXT_RE = /^[a-z0-9]+$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

function assertPart(value: string, re: RegExp, what: string): void {
  if (!re.test(value)) {
    throw new Error(`invalid object-key ${what}: "${value}"`);
  }
}

/** Flat key: `<family>/<id>.<ext>`. */
export function objectKey(family: string, id: string, ext: string): string {
  assertPart(family, FAMILY_RE, "family");
  assertPart(id, ID_RE, "id");
  assertPart(ext, EXT_RE, "extension");
  return `${family}/${id}.${ext}`;
}

/** Prefix-directory key root: `<family>/<id>` — sibling artifacts live under it. */
export function objectPrefix(family: string, id: string): string {
  assertPart(family, FAMILY_RE, "family");
  assertPart(id, ID_RE, "id");
  return `${family}/${id}`;
}

/** Read side of the content-address invariant: stored bytes no longer hash to the key that names them — corruption or tampering, never silently served. */
export class ContentAddressMismatchError extends Error {
  constructor(
    public readonly key: string,
    public readonly expectedHash: string,
    public readonly actualHash: string,
  ) {
    super(
      `object "${key}" failed content-address verification: bytes hash to ${actualHash}, key names ${expectedHash} — refusing to serve corrupted content`,
    );
    this.name = "ContentAddressMismatchError";
  }
}

/**
 * Extracts the sha256 segment a content-addressed key embeds: the stem of a
 * flat key's last segment (`family/<hash>.ext`) or the directory naming a
 * prefix key's artifact (`family/<hash>/name`). Throws on keys that aren't
 * content-addressed — callers must not "verify" cache/envelope families.
 */
export function contentHashSegment(key: string): string {
  const segments = key.split("/");
  const last = segments[segments.length - 1] ?? "";
  const stem = last.includes(".") ? last.slice(0, last.lastIndexOf(".")) : last;
  if (SHA256_HEX_RE.test(stem)) return stem;
  const parent = segments[segments.length - 2] ?? "";
  if (SHA256_HEX_RE.test(parent)) return parent;
  throw new Error(`object key "${key}" carries no sha256 content-address segment`);
}

/**
 * B4.6 content-address verification on read: returns the bytes only when
 * they still hash to the key's embedded sha256; a mismatch throws loudly.
 * Missing objects stay `null` (the caller decides whether absence is an
 * invariant break — e.g. deploy's ArtifactMissingError).
 */
export async function getContentAddressed(store: ObjectStore, key: string): Promise<Buffer | null> {
  const expected = contentHashSegment(key);
  const bytes = await store.get(key);
  if (!bytes) return null;
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new ContentAddressMismatchError(key, expected, actual);
  return bytes;
}

/**
 * Orphan detection (pure — the eval `sweep` CLI feeds it the store listing
 * and every db-referenced ref): a key is an orphan when nothing references
 * it AND it doesn't live under a protected prefix. Sibling artifacts under
 * a referenced prefix key (renders/pillar/<hash>/…) are covered by passing
 * the prefix in `referenced` — any key under a referenced prefix survives.
 */
export function findOrphans(
  allKeys: readonly string[],
  referenced: Iterable<string>,
  opts: { protectedPrefixes?: readonly string[] } = {},
): string[] {
  const refs = new Set<string>();
  const refPrefixes: string[] = [];
  for (const ref of referenced) {
    refs.add(ref);
    refPrefixes.push(ref.endsWith("/") ? ref : `${ref}/`);
  }
  const guarded = opts.protectedPrefixes ?? [];
  return allKeys.filter((key) => {
    if (refs.has(key)) return false;
    if (refPrefixes.some((p) => key.startsWith(p))) return false;
    if (guarded.some((p) => key.startsWith(p))) return false;
    return true;
  });
}
