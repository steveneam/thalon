import { describe, expect, it } from "vitest";
import { COMPOSITION_GSAP_SRC } from "../composition";
import {
  CompositionLintError,
  FORBIDDEN_SCRIPT_PATTERNS,
  assertCompositionSafe,
  runCompositionLintGate,
  type CompositionLinter,
} from "../composition-lint";

/** Minimal structurally-valid composition wrapping one inline script body. */
function composition(scriptBody: string, markup = ""): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <script src="${COMPOSITION_GSAP_SRC}"></script>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="5" data-width="1920" data-height="1080">
${markup}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${scriptBody}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

const VIOLATION_SAMPLES: Record<string, string> = {
  "no-wall-clock": "const t = Date.now();",
  "no-raf": "requestAnimationFrame(step);",
  "no-random": "const r = Math.random();",
  "no-render-fetch": 'fetch("/asset.png");',
  "no-timers": "setTimeout(go, 100);",
  "no-media-control": "video.play();",
  "no-infinite-timeline": "tl.to('#x', { repeat: -1 });",
  "no-script-set-root": 'root.setAttribute("data-duration", "99");',
  "no-doc-write": 'document.write("<div>");',
};

describe("assertCompositionSafe (belt 1: the research doc's forbidden list, executable)", () => {
  it("covers every forbidden pattern with a violating sample", () => {
    // Table-completeness ratchet: adding a pattern without a sample fails here.
    expect(Object.keys(VIOLATION_SAMPLES).sort()).toEqual(
      FORBIDDEN_SCRIPT_PATTERNS.map((r) => r.code).sort(),
    );
  });

  for (const [code, sample] of Object.entries(VIOLATION_SAMPLES)) {
    it(`rejects ${code}`, () => {
      let thrown: unknown;
      try {
        assertCompositionSafe(composition(sample));
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(CompositionLintError);
      expect((thrown as CompositionLintError).findings.map((f) => f.code)).toContain(code);
    });
  }

  it("accepts the clean baseline", () => {
    expect(() => assertCompositionSafe(composition('tl.from("#cue-0", { opacity: 0 }, 0);'))).not.toThrow();
  });

  it("rejects a non-paused GSAP timeline", () => {
    const html = composition("").replace("gsap.timeline({ paused: true })", "gsap.timeline()");
    expect(() => assertCompositionSafe(html)).toThrow(/non-paused-timeline|created paused/);
  });

  it("rejects any external script other than the pinned GSAP runtime", () => {
    const html = composition("").replace(
      COMPOSITION_GSAP_SRC,
      "https://cdn.example.test/other.js",
    );
    expect(() => assertCompositionSafe(html)).toThrow(/unexpected-external-script|only the pinned GSAP/);
  });

  it("rejects remote media references in markup (preload everything)", () => {
    expect(() =>
      assertCompositionSafe(composition("", '<img class="clip" src="https://cdn.example.test/a.png" data-start="0" data-duration="1" />')),
    ).toThrow(/no-remote-media|remote reference/);
  });

  it("rejects a root missing its compile-time attributes", () => {
    const html = composition("").replace(' data-duration="5"', "");
    expect(() => assertCompositionSafe(html)).toThrow(/compile-time data-duration/);
  });

  it("does NOT false-positive on judged text content that mentions forbidden tokens", () => {
    const html = composition(
      'tl.from("#cue-0", { opacity: 0 }, 0);',
      '<div id="cue-0" class="clip cue" data-start="0" data-duration="5" data-track-index="2">Avoid Math.random() and fetch() in compositions — Date.now() drifts.</div>',
    );
    expect(() => assertCompositionSafe(html)).not.toThrow();
  });
});

describe("runCompositionLintGate (belt 2: the framework linter behind the seam)", () => {
  const html = composition('tl.from("#cue-0", { opacity: 0 }, 0);');

  it("passes a clean lint result through (warnings are advisory)", async () => {
    const linter: CompositionLinter = async () => ({
      ok: true,
      errorCount: 0,
      findings: [{ code: "font_hint", severity: "warning", message: "consider a bundled font" }],
    });
    await expect(runCompositionLintGate(html, linter)).resolves.toBeUndefined();
  });

  it("throws a CompositionLintError carrying the error findings — BEFORE any render spend", async () => {
    const linter: CompositionLinter = async () => ({
      ok: false,
      errorCount: 1,
      findings: [
        { code: "clip_missing_duration", severity: "error", message: "clip #x lacks data-duration" },
        { code: "font_hint", severity: "warning", message: "advisory" },
      ],
    });
    const gate = runCompositionLintGate(html, linter);
    await expect(gate).rejects.toBeInstanceOf(CompositionLintError);
    await expect(runCompositionLintGate(html, linter)).rejects.toThrow(/clip_missing_duration/);
  });
});
