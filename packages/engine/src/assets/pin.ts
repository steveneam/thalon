import { createHash } from "node:crypto";
import { getContentAddressed, objectPrefix, type ObjectStore } from "@thalon/platform";
import { z } from "zod";

/**
 * B7.1 (amendment A15) — mint-time asset pinning. Vendor generation URLs
 * expire in 30–60 minutes, so every minted asset is downloaded to our own
 * content-addressed storage THE MOMENT it exists, alongside a provenance
 * manifest (model, prompt, credits, license tier). No surface ever holds a
 * vendor URL — the pinned key is the only durable reference. This module is
 * the post-subscription insurance: pinned assets survive; only NEW mints
 * need the vendor.
 *
 * Key scheme (registered in the packages/platform object-keys family list):
 *   assets/<sha256(asset bytes)>/asset.<ext>   the hashed content (VERIFIABLE)
 *   assets/<sha256(asset bytes)>/provenance.json  sibling manifest
 *
 * The manifest is written LAST — its presence is the commit marker for a
 * completed pin. Both files are immutable: a re-pin of identical bytes is a
 * no-op that keeps the FIRST manifest (mint history is never rewritten).
 *
 * The provenance schema lives here for now and migrates into
 * `packages/contracts` when the Sprint-7 contract window opens at B7.3
 * (the AssetSource driver seam consumes it) — B7.1 lands pre-window, so it
 * must not touch the frozen contract.
 */

export const assetProvenanceSchema = z.object({
  /** Vendor the asset was minted at (runtime data, e.g. per-tenant config name). */
  vendor: z.string().min(1),
  /** Model/preset identifier as the vendor reports it. */
  model: z.string().min(1),
  /** The prompt that produced the asset — required; an asset without its prompt is unreproducible. */
  prompt: z.string().min(1),
  /** Vendor-specific generation params (aspect, seed, preset …), recorded verbatim. */
  params: z.record(z.string(), z.unknown()).default({}),
  /** Credits the mint consumed (0 for unlimited-tier mints). */
  creditsSpent: z.number().min(0),
  /**
   * License tier of the minting account at mint time. Free-tier outputs are
   * watermarked AND carry a vendor promo/training license — never allowed on
   * a shipped surface (A15 invariant), so pinning them is opt-in only.
   */
  licenseTier: z.enum(["paid", "free"]),
  /** Mint timestamp, caller-supplied ISO-8601 (keeps the module clock-free and the manifest deterministic in tests). */
  mintedAt: z.string().datetime(),
  /** The (expiring) vendor URL the bytes came from — audit trail only, never dereferenced after the pin. */
  sourceUrl: z.string().url().optional(),
  /** Vendor job/generation id, when one exists. */
  jobId: z.string().optional(),
});

export type AssetProvenance = z.infer<typeof assetProvenanceSchema>;

/** The stored provenance.json shape: the manifest self-describes its asset. */
export const assetManifestSchema = z.object({
  asset: z.object({
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    ext: z.string(),
    bytes: z.number().int().positive(),
  }),
  provenance: assetProvenanceSchema,
});

export type AssetManifest = z.infer<typeof assetManifestSchema>;

/** A15 invariant made executable at the door: free-tier mints don't get pinned by accident. */
export class FreeTierAssetError extends Error {
  constructor() {
    super(
      "refusing to pin a free-tier asset: free-tier outputs are watermarked and carry a vendor promo/training license — never shipped (A15). " +
        "Pass allowFreeTier: true only for MCP smoke-tests whose output reaches no surface.",
    );
    this.name = "FreeTierAssetError";
  }
}

const EXT_RE = /^[a-z0-9]+$/;

export interface PinAssetInput {
  /** Asset bytes, when the caller already holds them. Exactly one of `bytes` / `url`. */
  bytes?: Buffer;
  /** Vendor URL to download from NOW (they expire in 30–60 min). Exactly one of `bytes` / `url`. */
  url?: string;
  /** File extension for the stored key, e.g. "png", "mp4". */
  ext: string;
  provenance: AssetProvenance;
}

export interface PinAssetDeps {
  fetchImpl?: typeof fetch;
  /** Opt-in escape hatch for free-tier smoke tests only — see FreeTierAssetError. */
  allowFreeTier?: boolean;
}

export interface PinnedAsset {
  /** `assets/<hash>/asset.<ext>` — the durable reference surfaces carry. */
  key: string;
  /** `assets/<hash>/provenance.json` */
  provenanceKey: string;
  contentHash: string;
  bytes: number;
  /** True when this exact content was already pinned — the original manifest was kept. */
  alreadyPinned: boolean;
}

function assetKeys(contentHash: string, ext: string): { key: string; provenanceKey: string } {
  const prefix = objectPrefix("assets", contentHash);
  return { key: `${prefix}/asset.${ext}`, provenanceKey: `${prefix}/provenance.json` };
}

/**
 * Downloads (or accepts) a minted asset, stores it content-addressed with a
 * provenance manifest, and returns the durable keys. Loud failures
 * throughout: bad provenance, free tier without opt-in, non-2xx download,
 * and empty bodies all throw — a pin either completes or never happened.
 */
export async function pinAsset(
  store: ObjectStore,
  input: PinAssetInput,
  deps: PinAssetDeps = {},
): Promise<PinnedAsset> {
  const provenance = assetProvenanceSchema.parse(input.provenance);
  if (provenance.licenseTier === "free" && !deps.allowFreeTier) throw new FreeTierAssetError();
  if (!EXT_RE.test(input.ext)) throw new Error(`invalid asset extension: "${input.ext}"`);
  if ((input.bytes === undefined) === (input.url === undefined)) {
    throw new Error("pinAsset needs exactly one of bytes / url");
  }

  let bytes = input.bytes;
  if (bytes === undefined) {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const response = await fetchImpl(input.url!);
    if (!response.ok) {
      throw new Error(`asset download failed: ${response.status} ${response.statusText} (${input.url})`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length === 0) throw new Error("refusing to pin an empty asset body");

  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const { key, provenanceKey } = assetKeys(contentHash, input.ext);

  // Idempotent re-pin: the manifest is the commit marker — when it already
  // exists, the first mint's history stands and nothing is rewritten.
  const existing = await store.get(provenanceKey);
  if (existing) {
    return { key, provenanceKey, contentHash, bytes: bytes.length, alreadyPinned: true };
  }

  const manifest: AssetManifest = {
    asset: { contentHash, ext: input.ext, bytes: bytes.length },
    provenance,
  };
  await store.put(key, bytes); // bytes first …
  await store.put(provenanceKey, JSON.stringify(manifest, null, 2)); // … manifest last (commit marker)
  return { key, provenanceKey, contentHash, bytes: bytes.length, alreadyPinned: false };
}

/** Read side: bytes only if they still hash to the key's segment (B4.6 verification); null when absent. */
export async function readPinnedAsset(store: ObjectStore, key: string): Promise<Buffer | null> {
  return getContentAddressed(store, key);
}

/** Parsed provenance manifest for a pinned asset; null when absent. Accepts the content hash or either of the pin's keys. */
export async function readAssetProvenance(
  store: ObjectStore,
  contentHashOrKey: string,
): Promise<AssetManifest | null> {
  const hashMatch = /[0-9a-f]{64}/.exec(contentHashOrKey);
  if (!hashMatch) throw new Error(`no content hash in "${contentHashOrKey}"`);
  const { provenanceKey } = assetKeys(hashMatch[0], "json");
  const raw = await store.get(provenanceKey);
  if (!raw) return null;
  return assetManifestSchema.parse(JSON.parse(raw.toString("utf8")));
}
