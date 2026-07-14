/**
 * Minted brand assets — the landing's derived web copies (B7.2 step 1).
 *
 * Source of truth is the pinned original in the object store
 * (`assets/<pinnedHash>/asset.png` + provenance manifest, B7.1); the files
 * under `public/brand/` are derived, web-optimized copies regenerated
 * deterministically by `scripts/export-brand-assets.ts` — never hand-edited,
 * never a vendor URL. Mint history: `proprietary/prompts/b7.2-shot-list.md`.
 */
export interface BrandAsset {
  /** Public URL path of the derived webp. */
  src: string;
  /** Derived output size (also the CLS-safe intrinsic size). */
  width: number;
  height: number;
  /** Content hash of the pinned original this file derives from. */
  pinnedHash: string;
  /** Export quality (webp). */
  quality: number;
}

export const BRAND_ASSETS = {
  /** L1 — hero backdrop: three amber sails on a dusk horizon. */
  heroDusk: {
    src: "/brand/hero-dusk.webp",
    width: 1920,
    height: 1080,
    pinnedHash: "6b10470d15b98d51136d26772196b50e567c92602467256b0557ef0c67d0c785",
    quality: 80,
  },
  /** L2 — features-section texture: faint currents, one warm updraft. */
  currents: {
    src: "/brand/currents.webp",
    width: 1600,
    height: 900,
    pinnedHash: "c9d106219e439237010e2f318cc6ceb74c751e478fbb860a85cf7b21ea0529d6",
    quality: 75,
  },
  /** L3b — one point of light unfolding into three forms (the steps strip). */
  unfolding: {
    src: "/brand/unfolding.webp",
    width: 1200,
    height: 900,
    pinnedHash: "3b3872028149445b341d1cb798c904e2b3f5b11daa09581de4d4a1d63b012c1d",
    quality: 75,
  },
  /** L3c — the calm lantern above still water (the trust card). */
  lantern: {
    src: "/brand/lantern.webp",
    width: 1200,
    height: 900,
    pinnedHash: "c27faa3c1d595371bf93aece2d3fc79e8009af4754d4d386bcdb0fc2ac06da42",
    quality: 75,
  },
  /** L4 — near-black paper grain, warm lower edge (pricing). */
  paperGrain: {
    src: "/brand/paper-grain.webp",
    width: 1920,
    height: 826,
    pinnedHash: "77845aba74b59f04059eaebd530e83bb431862018e45587fbcd54cfcc8e303e3",
    quality: 70,
  },
  /** L5 — thin amber horizon, first light gathering (final CTA band). */
  horizon: {
    src: "/brand/horizon.webp",
    width: 2048,
    height: 881,
    pinnedHash: "7c6b6f2e05ba3a19a0b7e949c04521415ee38eaa13b8d6367a3a28a4555858f0",
    quality: 78,
  },
} as const satisfies Record<string, BrandAsset>;

export type BrandAssetKey = keyof typeof BRAND_ASSETS;
