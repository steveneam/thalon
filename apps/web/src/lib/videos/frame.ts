import type { Crop, Edl, Pan } from "@thalon/contracts";

/**
 * B-ve.5 frame helpers: pure math + transforms behind the crop/pan handles.
 * The handles are a MEASURING tool — they read and write SOURCE-pixel
 * coordinates over the real frame (the browser's videoWidth/videoHeight is
 * the measurement; display size is only ever a projection). Pan targets are
 * measured, never estimated (s45): nothing here guesses a coordinate.
 */

export type PanMode = "static" | "pan" | "expression";

export function panModeOf(pan: Pan): PanMode {
  if (typeof pan === "number") return "static";
  return "expr" in pan ? "expression" : "pan";
}

/** A pan's value at the clip's start/end — for placing the handle rectangles. Expressions resolve to null (not evaluated client-side). */
export function panEndpoint(pan: Pan, which: "start" | "end"): number | null {
  if (typeof pan === "number") return pan;
  if ("expr" in pan) return null;
  return which === "start" ? pan.from : pan.to;
}

/** Displayed px → source px (the projection back to the measurement space). */
export function displayToSource(displayPx: number, displaySize: number, sourceSize: number): number {
  if (displaySize <= 0) return 0;
  return (displayPx * sourceSize) / displaySize;
}

/** Source px → displayed px. */
export function sourceToDisplay(sourcePx: number, displaySize: number, sourceSize: number): number {
  if (sourceSize <= 0) return 0;
  return (sourcePx * displaySize) / sourceSize;
}

/** Clamp a crop-window origin so the window stays inside the source. */
export function clampOrigin(value: number, windowSize: number, sourceSize: number): number {
  return Math.min(Math.max(0, Math.round(value)), Math.max(0, sourceSize - windowSize));
}

/** Replace one clip's crop window (any lane position — beats and the endcard overlay both carry windows). */
export function patchClipCrop(edl: Edl, index: number, crop: Crop): Edl {
  if (index < 0 || index >= edl.video.length) return edl;
  return {
    ...edl,
    video: edl.video.map((clip, i) => (i === index ? { ...clip, crop } : clip)),
  };
}

/**
 * Move one axis of a clip's crop, in source pixels, preserving the axis's
 * mode: a static axis moves whole; a pan axis moves the dragged endpoint
 * only; an expression axis never moves from a drag (edited as data, the
 * B-ve.3 knobless-honesty precedent).
 */
export function dragCropAxis(
  crop: Crop,
  axis: "x" | "y",
  which: "start" | "end",
  sourceValue: number,
  sourceSize: number,
): Crop {
  const pan = crop[axis];
  const windowSize = axis === "x" ? crop.width : crop.height;
  const next = clampOrigin(sourceValue, windowSize, sourceSize);
  if (typeof pan === "number") return { ...crop, [axis]: next };
  if ("expr" in pan) return crop;
  return {
    ...crop,
    [axis]: which === "start" ? { ...pan, from: next } : { ...pan, to: next },
  };
}

/** static → pan seeds both endpoints at the current value; pan → static collapses to the start. Expressions stay data. */
export function setCropAxisMode(crop: Crop, axis: "x" | "y", mode: "static" | "pan"): Crop {
  const pan = crop[axis];
  if (typeof pan === "object" && "expr" in pan) return crop;
  if (mode === "pan") {
    const value = typeof pan === "number" ? pan : pan.from;
    return typeof pan === "number" ? { ...crop, [axis]: { from: value, to: value } } : crop;
  }
  return typeof pan === "number" ? crop : { ...crop, [axis]: pan.from };
}
