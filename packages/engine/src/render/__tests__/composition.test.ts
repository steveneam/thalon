import { describe, expect, it } from "vitest";
import { deriveDirectionExport } from "../../direction/export";
import {
  GENERIC_BRAND_STYLE,
  PILLAR_COMPOSITION,
  compositionSpecFromDirectionExport,
  compositionSpecFromPillarManifest,
  defaultCueMotion,
  deriveBrandStyle,
  escapeHtml,
  hexToRgba,
  secondsLiteral,
  shiftHex,
} from "../composition";
import { DIRECTION_DOC, pillarManifest } from "./composition-fixtures";

describe("secondsLiteral", () => {
  it("emits canonical decimal seconds", () => {
    expect(secondsLiteral(10_000)).toBe("10");
    expect(secondsLiteral(1_500)).toBe("1.5");
    expect(secondsLiteral(12_345)).toBe("12.345");
    expect(secondsLiteral(0)).toBe("0");
  });

  it("rejects negatives and non-integers", () => {
    expect(() => secondsLiteral(-1)).toThrow(/invalid composition milliseconds/);
    expect(() => secondsLiteral(1.5)).toThrow(/invalid composition milliseconds/);
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });
});

describe("color helpers", () => {
  it("hexToRgba emits canonical rgba (3- and 6-digit inputs)", () => {
    expect(hexToRgba("#161411", 0.4)).toBe("rgba(22, 20, 17, 0.4)");
    expect(hexToRgba("#fff", 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("shiftHex lightens toward white and darkens toward black, deterministically", () => {
    expect(shiftHex("#000000", 0.1)).toBe("#1a1a1a");
    expect(shiftHex("#ffffff", -0.5)).toBe("#808080");
    expect(shiftHex("#161411", 0.1)).toBe("#2d2c29");
    expect(shiftHex("#161411", 0.1)).toBe(shiftHex("#161411", 0.1));
  });
});

describe("deriveBrandStyle", () => {
  it("applies valid identity.style tokens and the company watermark", () => {
    const style = deriveBrandStyle({
      company: "Fernwood",
      style: { background: "#101820", textColor: "#ffffff", accentColor: "#f2aa4c", fontFamily: "IBM Plex Mono" },
    });
    expect(style).toEqual({
      background: "#101820",
      textColor: "#ffffff",
      accentColor: "#f2aa4c",
      fontFamily: "IBM Plex Mono",
      watermark: "Fernwood",
    });
  });

  it("falls back to the generic defaults on values that fail the character policy (tenant data can never escape its CSS slot)", () => {
    const style = deriveBrandStyle({
      style: {
        background: "red; } body { background: url(https://evil.test/x) }",
        textColor: "#gggggg",
        accentColor: 42,
        fontFamily: `"Inter"; font-size: 0`,
      },
    });
    expect(style).toEqual({ ...GENERIC_BRAND_STYLE, watermark: null });
  });
});

describe("defaultCueMotion", () => {
  it("varies deterministically: hook punches, cta lands, beats alternate — no more all-smooth", () => {
    expect(defaultCueMotion(0, 5)).toBe("snappy");
    expect(defaultCueMotion(4, 5)).toBe("dramatic");
    expect(defaultCueMotion(1, 5)).toBe("smooth");
    expect(defaultCueMotion(2, 5)).toBe("snappy");
  });
});

describe("compositionSpecFromPillarManifest", () => {
  it("bakes the pillar compile-time constants and maps the timeline 1:1", () => {
    const manifest = pillarManifest();
    const spec = compositionSpecFromPillarManifest(manifest);
    expect(spec.width).toBe(PILLAR_COMPOSITION.width);
    expect(spec.height).toBe(PILLAR_COMPOSITION.height);
    expect(spec.fps).toBe(PILLAR_COMPOSITION.fps);
    expect(spec.pacing).toBe("medium");
    expect(spec.durationMs).toBe(manifest.timeline.totalDurationMs);
    expect(spec.cues).toHaveLength(manifest.timeline.cues.length);
    expect(spec.cues.map((c) => c.text)).toEqual(manifest.timeline.cues.map((c) => c.text));
    expect(spec.cues[2].onScreenText).toBe("Approve → ship");
    expect(spec.brand.watermark).toBe("Self");
    expect(spec.audio).toBeNull();
  });

  it("takes motion/transition from DECORATED cues and falls back to the deterministic defaults", () => {
    const manifest = pillarManifest();
    const spec = compositionSpecFromPillarManifest(manifest);
    // Undecorated: varied defaults, deterministic transition cycle.
    expect(spec.cues.map((c) => c.motion)).toEqual(["snappy", "smooth", "snappy", "dramatic"]);
    expect(spec.cues[0].transition).toBe("cut");
    expect(spec.cues[1].transition).toBe("push");
    expect(spec.cues[2].transition).toBe("dissolve");

    manifest.timeline.cues[1].motion = "bouncy";
    manifest.timeline.cues[1].transition = "flash";
    const decorated = compositionSpecFromPillarManifest(manifest);
    expect(decorated.cues[1].motion).toBe("bouncy");
    expect(decorated.cues[1].transition).toBe("flash");
  });
});

describe("compositionSpecFromDirectionExport", () => {
  it("takes width/height/fps/pacing from the export (aspect-derived, compile-time) and keeps scene motion", () => {
    const exported = deriveDirectionExport(DIRECTION_DOC);
    const spec = compositionSpecFromDirectionExport(exported, { company: "Fernwood" });
    expect(spec.width).toBe(1080);
    expect(spec.height).toBe(1920);
    expect(spec.fps).toBe(24);
    expect(spec.pacing).toBe("fast");
    expect(spec.durationMs).toBe(exported.timeline.totalDurationMs);
    expect(spec.cues[0].motion).toBe("bouncy");
    expect(spec.cues[0].heading).toBe("The problem");
    // The derived CTA cue carries no motion — the varied default fills it (last cue lands dramatic).
    expect(spec.cues[2].motion).toBe("dramatic");
  });
});
