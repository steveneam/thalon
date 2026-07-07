import { describe, expect, it } from "vitest";
import { deriveDirectionExport } from "../../direction/export";
import {
  compositionSpecFromDirectionExport,
  compositionSpecFromPillarManifest,
  secondsLiteral,
  type CompositionSpec,
} from "../composition";
import { renderCompositionProject } from "../composition-project";
import { HOOK_MAX_VISUAL_GAP_MS, MAX_VISUAL_GAP_MS } from "../composition-pacing";
import { assertCompositionProjectSafe } from "../composition-lint";
import { DIRECTION_DOC, pillarManifest } from "./composition-fixtures";

function pillarSpec(): CompositionSpec {
  return compositionSpecFromPillarManifest(pillarManifest());
}

describe("renderCompositionProject", () => {
  it("is deterministic: same spec, same bytes, every file", () => {
    const a = renderCompositionProject(pillarSpec());
    const b = renderCompositionProject(pillarSpec());
    expect(a.files).toEqual(b.files);
    expect(a.schedule).toEqual(b.schedule);
  });

  it("emits one sub-composition per cue, mounted by the root with compile-time timing", () => {
    const spec = pillarSpec();
    const { files } = renderCompositionProject(spec);
    const names = Object.keys(files).sort();
    expect(names).toEqual([
      "compositions/scene-0.html",
      "compositions/scene-1.html",
      "compositions/scene-2.html",
      "compositions/scene-3.html",
      "index.html",
    ]);

    const root = files["index.html"];
    const durationSec = secondsLiteral(spec.durationMs);
    expect(root).toContain(`data-width="1920"`);
    expect(root).toContain(`data-height="1080"`);
    expect(root).toContain(`data-duration="${durationSec}"`);
    expect(root).toContain(`window.__timelines["main"] = tl;`);
    expect(root).toContain(`tl.set({}, {}, ${durationSec});`);
    for (const [i, cue] of spec.cues.entries()) {
      expect(root).toContain(
        `id="scene-host-${i}" class="clip scene-host" data-composition-id="scene-${i}-host" data-start="${secondsLiteral(cue.startMs)}"`,
      );
      expect(root).toContain(`data-composition-src="compositions/scene-${i}.html"`);
      const scene = files[`compositions/scene-${i}.html`];
      expect(scene).toContain(`data-composition-id="scene-${i}"`);
      expect(scene).toContain(`window.__timelines["scene-${i}"] = tl;`);
      expect(scene).toContain("gsap.timeline({ paused: true })");
    }
  });

  it("extends outgoing scenes by the entering transition's tail (scene hosts overlap exactly the transition window)", () => {
    const spec = pillarSpec();
    // cue 1 enters via the default cycle's "push" (tail 0.5s) — cue 0's host must outlive its cue by 500ms.
    const { files } = renderCompositionProject(spec);
    const cue0DurMs = spec.cues[0].endMs - spec.cues[0].startMs;
    expect(files["index.html"]).toContain(
      `id="scene-host-0" class="clip scene-host" data-composition-id="scene-0-host" data-start="0" data-duration="${secondsLiteral(cue0DurMs + 500)}"`,
    );
    expect(files["compositions/scene-0.html"]).toContain(`data-duration="${secondsLiteral(cue0DurMs + 500)}"`);
  });

  it("emits the entering transition tweens at each boundary from the curated recipes", () => {
    const spec = pillarSpec();
    const { files } = renderCompositionProject(spec);
    const root = files["index.html"];
    // cue 1 = push (default cycle position 1).
    expect(root).toContain(
      `tl.fromTo("#scene-host-1", { x: 1920 }, { x: 0, duration: 0.5, ease: "power3.inOut" }, ${secondsLiteral(spec.cues[1].startMs)});`,
    );
    // cue 2 = dissolve.
    expect(root).toContain(
      `tl.fromTo("#scene-host-2", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.inOut" }, ${secondsLiteral(spec.cues[2].startMs)});`,
    );
  });

  it("renders the brand depth stack from style DATA: gradient base, accent glow, vignette, GSAP-stepped grain (no CSS animation)", () => {
    const spec = pillarSpec();
    const { files } = renderCompositionProject(spec);
    const root = files["index.html"];
    expect(root).toContain("#bg-depth");
    expect(root).toContain("linear-gradient(165deg");
    expect(root).toContain("radial-gradient(circle, rgba(122, 162, 255, 0.16)"); // generic accent as data
    expect(root).toContain("#vignette");
    expect(root).toContain("grain-texture");
    expect(root).toContain(`tl.set(".grain-texture", { xPercent: -5, yPercent: -5 }, 0.125);`);
    expect(root).not.toContain("@keyframes"); // wall-clock CSS animation is invisible to the frame clock
    expect(root).not.toContain("animation:");
  });

  it("mounts the flash overlay only when a flash transition is actually used", () => {
    const spec = pillarSpec();
    expect(renderCompositionProject(spec).files["index.html"]).not.toContain("transition-flash");
    spec.cues[1] = { ...spec.cues[1], transition: "flash" };
    const flashed = renderCompositionProject(spec).files["index.html"];
    expect(flashed).toContain(`<div id="transition-flash"></div>`);
    expect(flashed).toContain(`tl.fromTo("#transition-flash", { opacity: 0 }, { opacity: 0.9`);
  });

  it("emits kinetic karaoke captions: grouped word spans, dimmed-to-active color tweens, monotonic timings", () => {
    const spec = pillarSpec();
    const { files } = renderCompositionProject(spec);
    const scene = files["compositions/scene-1.html"];
    expect(scene).toContain(`class="cw"`);
    expect(scene).toContain(`tl.set("#w0-0", { color: "#f5f7fa" }`);
    expect(scene).toContain(`tl.to("#w0-1", { color: "#f5f7fa", duration: 0.12, ease: "none" }`);
    // Word tween times are monotonically non-decreasing within the file.
    const times = [...scene.matchAll(/duration: 0\.12, ease: "none" \}, ([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(times.length).toBeGreaterThan(3);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("renders a count-up stat block for numeric onScreenText and none otherwise", () => {
    const spec = pillarSpec();
    spec.cues[1] = { ...spec.cues[1], onScreenText: "Cuts editing time 63%" };
    const { files } = renderCompositionProject(spec);
    const statScene = files["compositions/scene-1.html"];
    expect(statScene).toContain(`<span id="statnum">63</span>`);
    expect(statScene).toContain(`tl.to(statv, { v: 63,`);
    expect(statScene).toContain(`fmtInt(Math.round(statv.v))`);
    expect(statScene).toContain(`tl.to("#feature", { scale: 1.05, duration: 0.16, ease: "back.out(2.2)" }`);
    // "Approve → ship" carries no number — no stat machinery.
    const plainScene = files["compositions/scene-2.html"];
    expect(plainScene).not.toContain("statnum");
    expect(plainScene).not.toContain("fmtInt");
  });

  it("keeps comma-grouped numbers: '12,000' counts to 12000 and rests as its formatted self", () => {
    const spec = pillarSpec();
    spec.cues[1] = { ...spec.cues[1], onScreenText: "12,000 drafts judged" };
    const scene = renderCompositionProject(spec).files["compositions/scene-1.html"];
    expect(scene).toContain(`<span id="statnum">12,000</span>`);
    expect(scene).toContain(`tl.to(statv, { v: 12000,`);
  });

  it("HTML-escapes all judged content — markup in a narration cannot become markup in any file", () => {
    const manifest = pillarManifest();
    manifest.timeline.cues[1].text = `<script>fetch("https://evil.test")</script> attack`;
    const { files } = renderCompositionProject(compositionSpecFromPillarManifest(manifest));
    for (const html of Object.values(files)) {
      expect(html).not.toContain(`<script>fetch(`);
    }
    expect(files["compositions/scene-1.html"]).toContain("&lt;script&gt;");
    expect(() => assertCompositionProjectSafe(files)).not.toThrow();
  });

  it("passes the core forbidden-pattern project gate for both entry mappings, with and without audio", () => {
    const pillar = renderCompositionProject(pillarSpec());
    expect(() => assertCompositionProjectSafe(pillar.files)).not.toThrow();

    const direction = renderCompositionProject(
      compositionSpecFromDirectionExport(deriveDirectionExport(DIRECTION_DOC), { company: "Fernwood" }),
    );
    expect(() => assertCompositionProjectSafe(direction.files)).not.toThrow();

    const spec = pillarSpec();
    spec.audio = {
      narration: spec.cues.map((cue, i) =>
        i === 0
          ? {
              fileName: "audio/cue-0.wav",
              durationMs: cue.endMs - cue.startMs - 200,
              words: [{ text: "hello", startMs: 100, endMs: 400 }],
            }
          : null,
      ),
      sfx: spec.cues.map((_, i) => (i === 1 ? { fileName: "audio/sfx-1.wav" } : null)),
      bed: null,
    };
    const withAudio = renderCompositionProject(spec);
    expect(() => assertCompositionProjectSafe(withAudio.files)).not.toThrow();
    expect(withAudio.files["index.html"]).toContain(
      `<audio id="narration-0" src="audio/cue-0.wav" data-start="0"`,
    );
    expect(withAudio.files["index.html"]).toContain(`<audio id="sfx-1" src="audio/sfx-1.wav"`);
  });

  it("narration word timings drive the karaoke tweens when audio is present", () => {
    const spec = pillarSpec();
    spec.audio = {
      narration: spec.cues.map((cue, i) =>
        i === 1
          ? {
              fileName: "audio/cue-1.wav",
              durationMs: 2_000,
              words: [
                { text: "Thalon", startMs: 0, endMs: 420 },
                { text: "reads", startMs: 420, endMs: 780 },
                { text: "everything.", startMs: 780, endMs: 1_400 },
              ],
            }
          : null,
      ),
      sfx: spec.cues.map(() => null),
      bed: null,
    };
    const scene = renderCompositionProject(spec).files["compositions/scene-1.html"];
    expect(scene).toContain(`<span id="w0-0" class="cw">Thalon</span>`);
    expect(scene).toContain(`duration: 0.12, ease: "none" }, 0.42);`);
  });

  it("mounts the honest bed seam when (and only when) operator data supplies one", () => {
    const spec = pillarSpec();
    expect(renderCompositionProject(spec).files["index.html"]).not.toContain("music-bed");
    spec.audio = {
      narration: spec.cues.map(() => null),
      sfx: spec.cues.map(() => null),
      bed: { fileName: "audio/bed.wav", volume: 0.35 },
    };
    expect(renderCompositionProject(spec).files["index.html"]).toContain(
      `<audio id="music-bed" src="audio/bed.wav" data-start="0" data-duration="${secondsLiteral(spec.durationMs)}" data-track-index="0" data-volume="0.35"></audio>`,
    );
  });

  it("enforces the pacing-density rule by construction: no silent stretch over 2.5s (2s inside the hook), even for a sparse 12s cue", () => {
    const spec = pillarSpec();
    // A pathological beat: two words, twelve seconds.
    spec.cues[1] = { ...spec.cues[1], text: "Long hold.", startMs: spec.cues[0].endMs, endMs: spec.cues[0].endMs + 12_000 };
    const shift = spec.cues[1].endMs - spec.cues[2].startMs;
    spec.cues[2] = { ...spec.cues[2], startMs: spec.cues[2].startMs + shift, endMs: spec.cues[2].endMs + shift };
    spec.cues[3] = { ...spec.cues[3], startMs: spec.cues[3].startMs + shift, endMs: spec.cues[3].endMs + shift };
    spec.durationMs = spec.cues[3].endMs;

    const { files, schedule } = renderCompositionProject(spec);
    expect(schedule.maxGapMs).toBeLessThanOrEqual(MAX_VISUAL_GAP_MS);
    const hookEvents = schedule.events.filter((e) => e.atMs <= spec.cues[0].endMs).map((e) => e.atMs);
    expect(Math.min(...hookEvents)).toBeLessThanOrEqual(HOOK_MAX_VISUAL_GAP_MS);
    // The filler pulses materialize as accent tweens in the sparse scene.
    expect(schedule.events.some((e) => e.kind === "accent-pulse")).toBe(true);
    expect(files["compositions/scene-1.html"]).toContain(`yoyo: true, repeat: 1`);
  });

  it("refuses misaligned audio tracks and out-of-policy audio file names", () => {
    const spec = pillarSpec();
    spec.audio = { narration: [null], sfx: spec.cues.map(() => null), bed: null };
    expect(() => renderCompositionProject(spec)).toThrow(/audio\.narration carries 1 entries for 4 cues/);

    const bad = pillarSpec();
    bad.audio = {
      narration: bad.cues.map(() => null),
      sfx: bad.cues.map(() => null),
      bed: { fileName: "../../escape.wav", volume: 1 },
    };
    expect(() => renderCompositionProject(bad)).toThrow(/audio file name/);
  });

  it("refuses an empty timeline and out-of-policy interpolation slots", () => {
    const empty: CompositionSpec = { ...pillarSpec(), cues: [] };
    expect(() => renderCompositionProject(empty)).toThrow(/no cues/);

    const badId = { ...pillarSpec(), compositionId: `x"]; alert(1); //` };
    expect(() => renderCompositionProject(badId)).toThrow(/composition id/);

    const badBrand = pillarSpec();
    badBrand.brand = { ...badBrand.brand, accentColor: "url(https://evil.test)" };
    expect(() => renderCompositionProject(badBrand)).toThrow(/character policy/);
  });

  it("omits the watermark clip when the identity has no company", () => {
    const spec = compositionSpecFromPillarManifest(pillarManifest({}));
    expect(renderCompositionProject(spec).files["index.html"]).not.toContain(`id="brand-watermark"`);
  });
});

describe("assertCompositionProjectSafe cross-file checks", () => {
  it("catches a root that mounts a sub-composition the project never emitted", () => {
    const { files } = renderCompositionProject(pillarSpec());
    const { ["compositions/scene-2.html"]: _dropped, ...missing } = files;
    expect(() => assertCompositionProjectSafe(missing)).toThrow(/missing-sub-composition|mounts "compositions\/scene-2.html"/);
  });

  it("catches duplicate composition ids across files", () => {
    const { files } = renderCompositionProject(pillarSpec());
    const dup = { ...files, "compositions/rogue.html": files["compositions/scene-1.html"] };
    expect(() => assertCompositionProjectSafe(dup)).toThrow(/duplicate|appears in both/);
  });
});
