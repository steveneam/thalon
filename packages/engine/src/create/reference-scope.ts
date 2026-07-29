import { isAudioExt, isStoredRef, type MediaRef } from "@thalon/contracts";

/**
 * WHAT CAN BE DESCRIBED — one rule, one home.
 *
 * Its own module, small as it is, because **two callers need it and they may
 * not share an import graph**: `reference.ts` checks it before the guard (so
 * an undescribable ref costs neither a budget assertion nor a call), and
 * `plan.ts` counts against it to price the run BEFORE spend (R6). `plan.ts`
 * is pure by construction — no db, no clock, no network — and importing
 * `reference.ts` would pull the gateway driver and `@thalon/db` into its
 * graph through the metering seam. Duplicating the predicate instead would
 * put the same wall in two places and let the preview drift from what the
 * run actually does, which is the failure a cost preview exists to prevent.
 */
export type ReferenceDescribability = { ok: true } | { ok: false; reason: string };

/**
 * **External refs are not fetched.** The bytes are a stranger's, on a host we
 * do not control, and pulling them at describe time to feed a model is a
 * licensing decision with its own texture — deliberately out of B-create.2's
 * scope. The ref stays attached and honestly unanalysed, which is the
 * existing degrade path doing exactly what it was built for.
 *
 * **Audio refs are refused in words.** A vision tier handed an audio file
 * would either error opaquely or describe a picture that does not exist; a
 * seam that names the mismatch is worth more than either.
 */
export function referenceDescribability(ref: MediaRef): ReferenceDescribability {
  if (!isStoredRef(ref)) {
    return {
      ok: false,
      reason:
        "external references are attached, never fetched — only media stored in our own object store is described",
    };
  }
  if (isAudioExt(ref.ext)) {
    return {
      ok: false,
      reason: `a .${ref.ext} reference is audio, and the describer is a vision model — attach an image reference, or use the audio as \`use\`-role media`,
    };
  }
  return { ok: true };
}
