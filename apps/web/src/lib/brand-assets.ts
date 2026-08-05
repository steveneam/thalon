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
  /** Extension of the pinned original in the object store (default "png"). */
  ext?: "png" | "svg";
}

export const BRAND_ASSETS = {
  /** L1v2 — hero backdrop: ambient dusk glow, low right, no subject
   * (v1's sails read as a flame floating mid-hero — founder call; the
   * sails original stays pinned at 6b10470d… for subject-led surfaces). */
  heroAmbient: {
    src: "/brand/hero-ambient.webp",
    width: 1920,
    height: 1080,
    pinnedHash: "3caa32ae2c8aca3e63e43587c2a9f8420ea23a8fb345f62e9fa934f7e6cace02",
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
  /** L5v2 — the closing beacons: many warm lights answering one, under
   * "Be publishing everywhere…" (v1's thin streak did nothing — founder
   * call; the first-light original stays pinned at 7c6b6f2e…). */
  beacons: {
    src: "/brand/beacons.webp",
    width: 2048,
    height: 881,
    pinnedHash: "3ac2b35ffc22d128cb433184829cbed260332dc0f1f5b1aef1ccc824161a32df",
    quality: 78,
  },
  /**
   * s109 — the landing's hero: water held still above a low stone sill, and
   * water passing over it. The page's argument as a natural object, which is
   * the §casting (8)+(9) answer for a precision vertical: nature at the
   * subject's own geometry, light and air, no people.
   *
   * ⚠ Deliberately NOT a gate. The s104 Whitethorn corollary: a prompted
   * "gate" renders as a mullioned lattice and reads as BARS, and any barrier
   * object carries that risk. Water over stone is an opening, not a leaf
   * across one. It is also frame 0 of the `weir` sequence below, so the still
   * hero and the moving band are the same place.
   */
  weirHero: {
    src: "/brand/weir-hero.webp",
    width: 1920,
    height: 1080,
    pinnedHash: "62efcdca87a4ed98042b8a2797bd8a79d4eaaa4888e2eaa6856c8e54a3acf347",
    quality: 78,
  },
} as const satisfies Record<string, BrandAsset>;

export type BrandAssetKey = keyof typeof BRAND_ASSETS;

/**
 * §W — workspace paper/navy set (B7.2 step 3): decorative empty-state and
 * first-run illustrations. Recraft V4.1 utility_vector originals (SVG) minted
 * against the DESIGN.md tokens (paper field #faf7f2, ink/muted/hairline/bronze
 * palette), so the plates share the workspace's exact background. Decorative
 * only: rendered aria-hidden via <EmptyArt>; the empty-state copy stays the
 * tutorial (never replace text with art). Amber in these images is an accent
 * on ink objects, never an interactive cue (Two-Channel Rule).
 */
export const WORKSPACE_ASSETS = {
  /** W1 — approve queue at rest: the falconer's empty glove. */
  emptyApprove: {
    src: "/brand/empty-approve.webp",
    width: 720,
    height: 480,
    pinnedHash: "a6fea058c90b82fc1fb4e223757b13d1ec07ecf7978226a5076631987b6cac9a",
    quality: 82,
    ext: "svg",
  },
  /** W2 — runs: blank paper stack beside an inkwell, work about to begin. */
  emptyRuns: {
    src: "/brand/empty-runs.webp",
    width: 720,
    height: 480,
    pinnedHash: "d520f462be4aa7e83925815b51a380cf6b79ef88c77e368574a97994346a2e78",
    quality: 82,
    ext: "svg",
  },
  /** W3 — intel · trends: the watchtower, one ember on the horizon. */
  emptyTrends: {
    src: "/brand/empty-trends.webp",
    width: 720,
    height: 480,
    pinnedHash: "9129eaf28b960489431050ca041532ac9834353c13653f7c277c9fa8702cede1",
    quality: 82,
    ext: "svg",
  },
  /** W4 — intel · search: hand lens over unmarked contours. */
  emptySearch: {
    src: "/brand/empty-search.webp",
    width: 720,
    height: 480,
    pinnedHash: "14f526c7115936be42757fc88cb744860818fa11f31f3e95287f036936e2d9fe",
    quality: 82,
    ext: "svg",
  },
  /** W5 — leads: the open ledger, first line unmarked (navy cover, take 2). */
  emptyLeads: {
    src: "/brand/empty-leads.webp",
    width: 720,
    height: 480,
    pinnedHash: "0a5b845f3f60c84d969f683d8f0e1c11f96ef6005dc9956fa4e28dcb56d2958d",
    quality: 82,
    ext: "svg",
  },
  /** W6 — library: three empty shelves, one bookmark ribbon. */
  emptyLibrary: {
    src: "/brand/empty-library.webp",
    width: 720,
    height: 480,
    pinnedHash: "d3b30772a3fae3698c564ae9b410f7e74209c523a4396780cca2acf3fd59656c",
    quality: 82,
    ext: "svg",
  },
  /** W7 — areas manager: blank survey chart, one empty pin outline. */
  emptyAreas: {
    src: "/brand/empty-areas.webp",
    width: 720,
    height: 480,
    pinnedHash: "41679b8451d3f001c02242dca5d95c7bfde925d7799beeb455619366f04374a7",
    quality: 82,
    ext: "svg",
  },
  /** W8 — profile editor: the blank calling card, unstamped. */
  emptyProfile: {
    src: "/brand/empty-profile.webp",
    width: 720,
    height: 480,
    pinnedHash: "2355e20b5204e96afc22cf3430c02e7eb7abc91e279111356587a4505113ac52",
    quality: 82,
    ext: "svg",
  },
  /** W9a — first-run step 1 (profile): pen filling from the inkwell. */
  stepProfile: {
    src: "/brand/step-profile.webp",
    width: 480,
    height: 480,
    pinnedHash: "42cf3fe6b08dc11fbb48cb26e2091acffb814f54317c938e5f85d317bb39ed0f",
    quality: 82,
    ext: "svg",
  },
  /** W9b — first-run step 2 (prompt): storyboard panels, arc through them. */
  stepStoryboard: {
    src: "/brand/step-storyboard.webp",
    width: 480,
    height: 480,
    pinnedHash: "cfe8436416e06ce7b8007d30647ee858400306a27e1f010533731dda650ab462",
    quality: 82,
    ext: "svg",
  },
  /** W9c — first-run step 3 (approve): the falcon leaving the glove. */
  stepRelease: {
    src: "/brand/step-release.webp",
    width: 480,
    height: 480,
    pinnedHash: "4adb04b8ac9e9197e7ba23459f3527f71768307f79eb2a003a3c0d19bbe4cafb",
    quality: 82,
    ext: "svg",
  },
} as const satisfies Record<string, BrandAsset>;

export type WorkspaceAssetKey = keyof typeof WORKSPACE_ASSETS;

/**
 * A minted VIDEO derived to a scroll-scrubbable frame sequence (s109, the
 * landing arc's capstone).
 *
 * Why frames and not the mp4: seeking a compressed video lands on keyframes,
 * so scrubbing `video.currentTime` on scroll janks. Extracting to stills is
 * deterministic and decodes without seek cost — the technique proved across
 * all three A+ sites. The mp4 stays the pinned original; these are derives.
 */
export interface BrandSequence {
  /** Public URL directory holding `<name>-NN.webp`. */
  dir: string;
  /** How many frames the sequence ships. */
  frames: number;
  width: number;
  height: number;
  quality: number;
  /** Content hash of the pinned original mp4. */
  pinnedHash: string;
}

export const BRAND_SEQUENCES = {
  /**
   * The weir — water held above a stone sill, and water passing over it.
   *
   * ⚠ FRAME COUNT IS MEASURED, NOT CHOSEN (s108 corollary, refined here).
   * That corollary says density is set by the CAMERA: locked-off takes need
   * roughly a third of a tracking take's frames (㉒'s locked-off bloom ships
   * 36). This take is ALSO locked-off and needs 81 — because the rule is
   * really about how much of the FRAME is moving, and turbulent water changes
   * every pixel of the lower half every frame even with the camera nailed
   * down. Measured adjacent-frame difference against ㉒'s shipped bloom
   * (1.26, a sequence that reads well): 41 frames → 1.88, 61 → 1.56,
   * **81 → 1.24**, 121 (native) → 0.93. 81 is the count that matches the
   * benchmark; 36 would have been visibly steppy.
   */
  weir: {
    dir: "/brand/weir",
    frames: 81,
    width: 960,
    height: 540,
    quality: 58,
    pinnedHash: "d0afcc1b6465158ea13a0dd66c3363c61f0358eb43e2e3bc8655d4d3476ee538",
  },
} as const satisfies Record<string, BrandSequence>;

export type BrandSequenceKey = keyof typeof BRAND_SEQUENCES;

/** The public path of frame `i` of a sequence, zero-padded to two digits. */
export function sequenceFrameSrc(seq: BrandSequence, i: number): string {
  return `${seq.dir}/f${String(i).padStart(2, "0")}.webp`;
}
