import { directionDocSchema, type DirectionDoc } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import { deriveDirectionExport } from "../../direction/export";
import {
  COMPOSITION_GSAP_SRC,
  GENERIC_BRAND_STYLE,
  MOTION_EASING,
  PILLAR_COMPOSITION,
  compositionSpecFromDirectionExport,
  compositionSpecFromPillarManifest,
  deriveBrandStyle,
  escapeHtml,
  renderCompositionHtml,
  secondsLiteral,
  type CompositionSpec,
} from "../composition";
import { assertCompositionSafe } from "../composition-lint";
import { derivePillarTimeline } from "../srt";
import type { PillarRenderManifest } from "../target";

function pillarManifest(identity: Record<string, unknown> = { company: "Self" }): PillarRenderManifest {
  return {
    manifestVersion: "pillar-render.v1",
    tenantId: "tenant-1",
    title: "Docs that demo themselves",
    timeline: derivePillarTimeline({
      hook: "What if your docs wrote their own demo?",
      beats: [
        { beatIndex: 0, narration: "Thalon reads your site and drafts the script." },
        { beatIndex: 1, narration: "You approve. It ships.", durationHintMs: 2_000, onScreenText: "Approve → ship" },
      ],
      cta: "Try the demo tenant today.",
    }),
    brand: { profileId: "profile-1", profileVersion: 1, identity, voice: {} },
    script: { promptVersion: "pillar-script-generate.v1", brandProfileVersion: 1, platformProfileVersion: "pillar.v1" },
  };
}

const DIRECTION_DOC: DirectionDoc = directionDocSchema.parse({
  docVersion: "direction.v1",
  title: "Launch teaser",
  aspect: "9:16",
  fps: 24,
  pacing: "fast",
  scenes: [
    {
      sceneIndex: 0,
      heading: "The problem",
      narration: "Shipping content by hand does not scale.",
      onScreenText: "Manual does not scale",
      visual: "cluttered desk",
      motion: "bouncy",
      durationMs: 3_000,
    },
    {
      sceneIndex: 1,
      heading: "The fix",
      narration: "One prompt in, judged drafts out.",
      onScreenText: null,
      visual: null,
      motion: "dramatic",
      durationMs: 2_500,
    },
  ],
  cta: "See it run.",
});

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
    // The derived CTA cue carries no motion — the default fills it.
    expect(spec.cues[2].motion).toBe("smooth");
  });
});

describe("renderCompositionHtml", () => {
  it("is deterministic: same spec, same bytes", () => {
    const spec = compositionSpecFromPillarManifest(pillarManifest());
    expect(renderCompositionHtml(spec)).toBe(renderCompositionHtml(spec));
  });

  it("bakes root width/height/duration as compile-time literals and registers ONE paused, end-padded timeline", () => {
    const manifest = pillarManifest();
    const html = renderCompositionHtml(compositionSpecFromPillarManifest(manifest));
    const durationSec = secondsLiteral(manifest.timeline.totalDurationMs);
    expect(html).toContain(`data-width="1920"`);
    expect(html).toContain(`data-height="1080"`);
    expect(html).toContain(`data-duration="${durationSec}"`);
    expect(html).toContain(`<script src="${COMPOSITION_GSAP_SRC}"></script>`);
    expect(html).toContain("gsap.timeline({ paused: true })");
    expect(html).toContain(`tl.set({}, {}, ${durationSec});`);
    expect(html).toContain(`window.__timelines["main"] = tl;`);
    // One clip per cue, each with literal data-start/data-duration.
    for (const [i, cue] of manifest.timeline.cues.entries()) {
      expect(html).toContain(
        `<div id="cue-${i}" class="clip cue" data-start="${secondsLiteral(cue.startMs)}" data-duration="${secondsLiteral(cue.endMs - cue.startMs)}" data-track-index="2">`,
      );
    }
  });

  it("maps motion → pinned GSAP easings and pacing → pinned tween seconds", () => {
    const exported = deriveDirectionExport(DIRECTION_DOC);
    const html = renderCompositionHtml(compositionSpecFromDirectionExport(exported, {}));
    expect(html).toContain(`duration: 0.2, ease: "${MOTION_EASING.bouncy}"`);
    expect(html).toContain(`duration: 0.2, ease: "${MOTION_EASING.dramatic}"`);
  });

  it("HTML-escapes all judged content — markup in a narration cannot become markup in the composition", () => {
    const manifest = pillarManifest();
    manifest.timeline.cues[0].text = `<script>fetch("https://evil.test")</script>`;
    const html = renderCompositionHtml(compositionSpecFromPillarManifest(manifest));
    expect(html).not.toContain(`<script>fetch(`);
    expect(html).toContain("&lt;script&gt;fetch(&quot;https://evil.test&quot;)&lt;/script&gt;");
    // The escaped content is inert to the lint gate too (it scans script bodies, not text).
    expect(() => assertCompositionSafe(html)).not.toThrow();
  });

  it("passes the core forbidden-pattern gate for both entry mappings (the generator cannot emit the forbidden list, by construction)", () => {
    const pillarHtml = renderCompositionHtml(compositionSpecFromPillarManifest(pillarManifest()));
    const directionHtml = renderCompositionHtml(
      compositionSpecFromDirectionExport(deriveDirectionExport(DIRECTION_DOC), { company: "Fernwood" }),
    );
    expect(() => assertCompositionSafe(pillarHtml)).not.toThrow();
    expect(() => assertCompositionSafe(directionHtml)).not.toThrow();
  });

  it("omits the watermark clip when the identity has no company", () => {
    const html = renderCompositionHtml(compositionSpecFromPillarManifest(pillarManifest({})));
    expect(html).not.toContain(`id="brand-watermark"`);
  });

  it("refuses an empty timeline and out-of-policy interpolation slots", () => {
    const spec: CompositionSpec = {
      ...compositionSpecFromPillarManifest(pillarManifest()),
      cues: [],
    };
    expect(() => renderCompositionHtml(spec)).toThrow(/no cues/);

    const badId = { ...compositionSpecFromPillarManifest(pillarManifest()), compositionId: `x"]; alert(1); //` };
    expect(() => renderCompositionHtml(badId)).toThrow(/composition id/);

    const badBrand = compositionSpecFromPillarManifest(pillarManifest());
    badBrand.brand = { ...badBrand.brand, accentColor: "url(https://evil.test)" };
    expect(() => renderCompositionHtml(badBrand)).toThrow(/character policy/);
  });
});
