import { edlSchema, type Crop, type EdlInput } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import {
  clampOrigin,
  displayToSource,
  dragCropAxis,
  panEndpoint,
  panModeOf,
  patchClipCrop,
  setCropAxisMode,
  sourceToDisplay,
} from "../frame";

/** B-ve.5: the crop-handle math — pure, source-pixel-true, mode-preserving. */

const staticCrop: Crop = { width: 404, height: 720, x: 438, y: 0 };
const panCrop: Crop = { width: 404, height: 720, x: { from: 228, to: 678 }, y: 0 };
const exprCrop: Crop = { width: 404, height: 720, x: { expr: "min(875*t/4.5,875)" }, y: 0 };

describe("pan mode + endpoints", () => {
  it("classifies static / pan / expression and reads endpoints (expressions resolve to null)", () => {
    expect(panModeOf(staticCrop.x)).toBe("static");
    expect(panModeOf(panCrop.x)).toBe("pan");
    expect(panModeOf(exprCrop.x)).toBe("expression");
    expect(panEndpoint(staticCrop.x, "start")).toBe(438);
    expect(panEndpoint(staticCrop.x, "end")).toBe(438);
    expect(panEndpoint(panCrop.x, "start")).toBe(228);
    expect(panEndpoint(panCrop.x, "end")).toBe(678);
    expect(panEndpoint(exprCrop.x, "start")).toBeNull();
  });
});

describe("projection math", () => {
  it("round-trips display and source pixels", () => {
    // 640px on a 320px-wide display of a 1280px source = 1280 * 0.5.
    expect(displayToSource(160, 320, 1280)).toBe(640);
    expect(sourceToDisplay(640, 320, 1280)).toBe(160);
    expect(displayToSource(10, 0, 1280)).toBe(0);
  });

  it("clamps a window origin inside the source", () => {
    expect(clampOrigin(-20, 404, 1280)).toBe(0);
    expect(clampOrigin(2000, 404, 1280)).toBe(876);
    expect(clampOrigin(438.4, 404, 1280)).toBe(438);
  });
});

describe("dragCropAxis", () => {
  it("moves a static axis whole and clamps", () => {
    expect(dragCropAxis(staticCrop, "x", "start", 500, 1280).x).toBe(500);
    expect(dragCropAxis(staticCrop, "x", "end", 5000, 1280).x).toBe(876);
  });

  it("moves only the dragged endpoint of a pan axis", () => {
    expect(dragCropAxis(panCrop, "x", "start", 200, 1280).x).toEqual({ from: 200, to: 678 });
    expect(dragCropAxis(panCrop, "x", "end", 700, 1280).x).toEqual({ from: 228, to: 700 });
  });

  it("never moves an expression axis — edited as data (knobless honesty)", () => {
    expect(dragCropAxis(exprCrop, "x", "start", 500, 1280)).toEqual(exprCrop);
  });
});

describe("setCropAxisMode", () => {
  it("static → pan seeds both endpoints at the current value; pan → static collapses to the start", () => {
    expect(setCropAxisMode(staticCrop, "x", "pan").x).toEqual({ from: 438, to: 438 });
    expect(setCropAxisMode(panCrop, "x", "static").x).toBe(228);
    expect(setCropAxisMode(exprCrop, "x", "pan")).toEqual(exprCrop);
  });
});

describe("patchClipCrop", () => {
  const input: EdlInput = {
    name: "t",
    output: { width: 1080, height: 1920, fps: 24, duration: 5 },
    video: [
      {
        name: "b1",
        source: { kind: "take", ref: "motion/keepers/clip-01.mp4" },
        duration: 5,
        crop: staticCrop,
      },
    ],
  };

  it("replaces one clip's window immutably; out-of-range is a no-op", () => {
    const edl = edlSchema.parse(input);
    const next = patchClipCrop(edl, 0, { ...staticCrop, x: 500 });
    expect(next.video[0].crop).toEqual({ ...staticCrop, x: 500 });
    expect(edl.video[0].crop).toEqual(staticCrop);
    expect(patchClipCrop(edl, 7, staticCrop)).toBe(edl);
  });
});
