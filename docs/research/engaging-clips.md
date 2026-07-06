# Engaging clips research (Sprint 6 / founder feedback on the first B6.3 renders)

> Founder verdict on the first-ever brand renders (2026-07-06, session 15): "pretty stale." Correct — and diagnosable. This doc records why, what the craft actually is (evidence-backed), what tooling we already ship for it, and the bucket-shaped proposal for the wave-3 re-plan checkpoint. Companion to `docs/research/hyperframes-integration.md` (Sprint-5 read-around); facts re-verified against the pinned hyperframes 0.7.33 package docs (`node_modules/hyperframes/dist/docs` + `dist/skills`) and https://hyperframes.heygen.com (2026-07-06).

## 1. Why the first clips were stale — the diagnosis

B5.1's composition template (`packages/engine/src/render/composition.ts`) was built to prove **correctness**: deterministic bytes, compile-time dims, judged-text escaping, char-policy brand styling, two-belt lint gate. Its entire visual vocabulary is one tween: every cue does `opacity 0 → 1, y +24px` on a flat brand-color background. No transitions between cues, no depth (gradient/vignette/grain), no caption animation, no audio of any kind, uniform pacing (~3.4s static holds). The contracts even ship a four-word motion vocabulary (`smooth | snappy | bouncy | dramatic` → deterministic GSAP easings) — the pillar-manifest path pins every cue to `smooth` (`DEFAULT_CUE_MOTION`) and never lets data vary it. Staleness is the **template's floor, not the pipeline's ceiling** — which is exactly where it should be raisable: the composition is generated, so craft encoded once applies to every tenant's videos.

## 2. The craft, evidence-backed (what "engaging" mechanically means)

- **The hook owns the first ~3 seconds.** ~71% of viewers decide within the first seconds whether to stay; hook formulas that hold: visual interrupt (motion burst, high contrast), curiosity gap, direct promise. Our clips open on a static text card.
- **Watch-through rate is the ranking metric; 15–30s completes better than 60s.** Our ~15s duration is right; the *density* is wrong.
- **A visible change every ~1.5–3s.** Quick cuts / motion beats / pattern interrupts signal liveliness; a 3.4s static hold reads as a slide deck.
- **~85% of feed viewing is muted → bold animated captions** (word-level highlight/karaoke) are the engagement carrier, reported to lift completion ~40%. For sound-on contexts, a music bed + SFX accents on beat changes is the norm, not a nicety.
- **Depth and grade beat flat fills:** gradients, vignette, film grain, parallax layers, glow accents — cheap CSS-in-composition effects that separate "designed" from "slop."
- **Narrative arc even in 15s:** hook → story → proof → CTA (this is literally the `SCRIPT.md` structure of Hyperframes' own production pipeline).
- **Non-slop = specificity:** real product UI, real numbers, brand-consistent motion — not generic stock aesthetics. For feature demos, *showing the actual product* is the strongest move (see §5, workspace captures).

## 3. The toolkit we already ship (pinned hyperframes 0.7.33 — no new dependency)

The founder's hypothesis ("there's probably an open source solution for engaging non-slop videos") is confirmed — and it's the render engine we already pin, whose ecosystem we use ~10% of:

- **Component/block catalog** (`npx hyperframes add <name>`, `hyperframes catalog`): 20+ caption effects (Pill Karaoke, Kinetic Slam, Editorial Emphasis, Neon Glow, Glitch RGB, Weight Shift, Emoji Pop…), 12 transition families (push, dissolve, blur, scale, grid, light, 3D…) plus shader transitions (Whip Pan, Cinematic Zoom, Light Leak, Ripple), and depth overlays (Grain, Vignette, Parallax Zoom, Shimmer Sweep, Morph Text). Each item is a **single self-contained HTML/CSS/JS snippet with a paused GSAP timeline — no build step** (blocks mount via `data-composition-src`; components paste into markup). That shape is *directly consumable by our deterministic template generator*: curate snippets into the repo as data, parameterize with the existing char-policy style tokens, emit behind the lint gate.
- **Keyless local media stack** (`npx hyperframes tts` / `transcribe`; A5-clean): Kokoro-82M TTS (54 voices) → Whisper **word-level `transcript.json`** → timestamps drive caption components and beat durations ("no key configured is a normal state"). Bundled SFX library. Hosted voices (HeyGen/ElevenLabs keys) remain optional keyed adapters.
- **Sub-compositions** (`data-composition-src`) — scene-per-beat with independent timelines; the real linter already advised this for growing timelines (B5.1 wrap note).
- **Their 7-step production pipeline** (capture → DESIGN.md → strategy → STORYBOARD+SCRIPT → VO+timing → build per beat → validate) independently validates our staged-video design *again*, and adds two adoptable ideas: per-beat fields for **mood / transition / SFX** in the storyboard, and **narration word-timestamps as the source of truth for beat durations** (vs our chars×60ms estimate).
- **Workflow skills** (`npx skills add heygen-com/hyperframes`): `/motion-graphics` (short unnarrated design-led clips — exactly the landing demos), `/product-launch-video` (URL/brief → 60–90s promo). These run in the *coding agent*, not the engine — right tool for one-off marketing assets authored in a session; the engine encodes the same craft as template code for runtime tenant videos.

## 4. OSS landscape beyond the seam (surveyed; stay put)

| Tool | License | Verdict for us |
|---|---|---|
| Motion Canvas / Revideo | MIT | Strong (canvas-based, generator-model, Revideo adds render API) — but replaces our whole seam and forfeits DOM-editing (SDK patches → edit_diffs), the lint gate, and the HTML authoring contract. Not worth it. |
| Remotion | custom commercial | Already the recorded swap path (ADR-0004); per-render fees + React authoring. Unchanged. |
| editly / ffcreator | MIT | ffmpeg-declarative slideshow-grade transitions; aging/low-maintenance; strictly weaker than the catalog. Pass. |
| whisperX / caption generators | BSD/MIT | Word-level alignment — already inside the hyperframes media stack; no separate adoption needed. |

**⚠ Licensing gate found (record per repo rule):** the local music generator behind the media stack is MusicGen (`facebook/musicgen-small`), whose **weights are CC-BY-NC** — non-commercial. Music beds for tenant/production videos must come from elsewhere (bundled SFX library, licensed catalog via HeyGen key, or silence) until swapped; flag at adoption, do not silently ship MusicGen output in commercial renders. TTS (Kokoro, Apache-2.0) is clean. Per-catalog-block license: not stated per item in the docs — verify at `hyperframes add` time (adoption-gate check), the ecosystem itself is Apache-2.0.

## 5. Proposal for the wave-3 re-plan checkpoint (bucket-shaped)

1. **Composition v2 — visual craft, fully deterministic (engine, render glob; lane-sized).** Scene-per-beat sub-compositions; a curated **transition enum** between scenes (catalog-derived, deterministic subset); exercise the existing per-cue **motion enum** from data (stop pinning `smooth`); background depth layer from `identity.style` (gradient + vignette + grain); **kinetic caption component** for narration text and onScreenText; stat **count-up block** for numeric beats; a **pacing-density rule in the generator** (a visible change every ≤2.5s, hook beat ≤2s — enforced by construction, testable). Catalog snippets vendored as data (`proprietary/` or engine assets) after license check; judged text stays escaped; lint gate unchanged. This raises every video the engine ever renders, not just the demos.
2. **Audio tier — v2.5, optional (seam + config).** Kokoro TTS narration + word-aligned karaoke captions + SFX accents behind a driver seam with content-addressed artifact caching (cache key = text × voice × model — inference bit-stability across machines doesn't matter, same class as the Windows screenshot fallback; ADR-0004 logic). Music bed = licensed/HeyGen-catalog or silence pending the MusicGen NC gate.
3. **Demo clips re-cut (B6.3 phase 2 rides whichever lands first).** The spec files already carry per-beat `durationHintMs`/`onScreenText`/`visualHint` — under v2 they gain `motion`/`transition`/`sfx` fields (additive schema). Interim option if phase 2 must ship before v2: re-cut current-template clips with tighter pacing (≤2.5s cues) — honest but still floor-grade; founder's call at the checkpoint.
4. **The non-slop end-game for feature demos: real product footage.** B2.5's demo/capture module already drives a web app deterministically via Playwright; once B6.2's workspace merges, Thalon can capture *its own UI on fake drivers* and composite those frames into the clips (screenshots are plain `<img class="clip">` elements) — actual product, actual motion, "rendered by Thalon" twice over. Natural B6.6-adjacent scope.

## Sources

- Pinned package docs: `node_modules/hyperframes/dist/docs/*` · `dist/skills/hyperframes/SKILL.md` (capability map + workflow router) · `dist/templates/_shared/AGENTS.md` (authoring contract)
- [HyperFrames docs index (llms.txt)](https://hyperframes.heygen.com/llms.txt) · [Video components/catalog guide](https://hyperframes.heygen.com/guides/video-components.md) · [7-step pipeline](https://hyperframes.heygen.com/guides/pipeline.md)
- Engagement mechanics: [Animoto — why the first 3 seconds matter](https://animoto.com/blog/video-marketing/why-first-3-seconds-matter) · [OpusClip — Shorts hook formulas](https://www.opus.pro/blog/youtube-shorts-hook-formulas) · [JoinBrands — YouTube Shorts best practices 2026](https://joinbrands.com/blog/youtube-shorts-best-practices/) · [Teleprompter — short-form strategy 2026](https://www.teleprompter.com/blog/short-form-video-strategy) · [Levitate Media — short-form production best practices](https://levitatemedia.com/learn/mastering-short-form-video-production-best-practices-and-marketing-tips)
- Framework survey: [PkgPulse — Remotion vs Motion Canvas vs Revideo 2026](https://www.pkgpulse.com/guides/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026) · [Remotion's own comparison](https://www.remotion.dev/docs/compare/motion-canvas) · [WhisperX](https://github.com/m-bain/whisperx)
