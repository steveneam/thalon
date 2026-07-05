# Hyperframes integration research (Sprint 5 / A11)

> Read-around of https://hyperframes.heygen.com docs (2026-07-05, v0.7.x era), distilled per bucket. This is **kickoff reading for every Sprint-5 lane**; the B5.1 decision record (`docs/adr/0004-render-driver-default.md`) cites it. Facts below are pinned from the official docs — re-verify against the pinned package version at build time (pre-1.0: minor versions may move).

## TL;DR per bucket

- **B5.1 (driver):** call `@hyperframes/producer` directly — `createRenderJob({fps, quality, format, workers})` → `executeRenderJob(job, compositionDir, outputPath, onProgress?, timeout?)` → `RenderResult {path, duration, frameCount, warnings}`. `RenderCancelledError {reason: user_cancelled|timeout|aborted}` maps onto our loud-failure taxonomy. Quality presets: `draft` (CRF 28 — stage previews), `standard` (CRF 18, "visually lossless at 1080p" — default), `high` (CRF 15). Formats: mp4 / webm (VP9 alpha) / mov (ProRes 4444) / png-sequence (+`audio.aac` sidecar). `npx hyperframes doctor` exists — our `npm run doctor` render check should invoke it.
- **B5.2 (composition contract):** scene = **sub-composition** (`data-composition-src`, auto-nested timelines); tenant/brand parameterization = **variables** (`data-composition-variables` typed slots: string/number/color/boolean/enum, `--strict-variables` enforcement, per-instance `data-variable-values`). Root `data-width`/`data-height`/root-duration/fps are **compile-time** — the deterministic template generator bakes them from the direction doc's timeline (we already derive duration from beats).
- **B5.2/B5.1 (validation gate):** `@hyperframes/lint` is **pure static analysis** (no browser, no node builtins in the browser bundle): `lintProject(dir)` → `{ok, errorCount, warningCount, findings[{severity, rule code, message, selector, fix hints}]}`. Run it in **core** after template generation and **before any chromium/render spend** (SPINE §1 "validation guard at every boundary"); its fix hints are structured repair-loop feedback if a shell-authored fragment ever fails it.
- **B5.4 (UI):** `@hyperframes/player` (3 KB web component, iframe + shadow DOM, `<video>`-like API: play/pause/seek/currentTime + ready/timeupdate/ended/error events) gives **live in-queue preview with NO render**. `@hyperframes/sdk` (headless editing engine — same engine as their Studio): stable `data-hf-id` targeting, typed ops + `dispatch()`, every commit emits **RFC-6902 JSON patches with inverses** (undo built-in) — store these patches verbatim as our `edit_diffs` payload (machine-readable operator edits → eval rows). "Embedded override mode" folds **sparse deltas onto a base template** — i.e. per-tenant brand base composition + per-video deltas: the multi-tenant reuse pattern for free.

## Composition authoring contract (what the B5.2 template emits)

- Root: `<div data-composition-id="…" data-start="0" data-width="1920" data-height="1080">`; portrait = 1080×1920.
- Clips: `id` + `data-start` (seconds **or relative**: `data-start="intro + 2"`) + `data-track-index` (z-order). Images need `class="clip"` + mandatory `data-duration`; video/audio get NO `class="clip"` (framework manages visibility/playback); `data-media-start` trims, `data-volume` 0–1.
- Animation: GSAP timelines **created paused** and registered `window.__timelines[<composition-id>]` (key must match exactly); absolute-positioned tweens (`tl.to(sel, vars, atSeconds)`); composition duration == timeline duration (pad with `tl.set({}, {}, T)` to match media length).
- Sub-compositions: `data-composition-src` + own `data-composition-id`; parent auto-nests by `data-start` — never nest timelines manually.
- **Forbidden (breaks determinism/rendering)** — the template generator must be unable to emit these *by construction*, with lint as belt-and-braces: `Date.now()`/`requestAnimationFrame`/unseeded `Math.random()`; network fetches at render (preload everything); `video.play()`/`currentTime` control in scripts; animating width/height/top/left on `<video>` directly (wrap in a div); non-paused timelines; infinite timelines; root duration set from script/variables.
- Motion vocabulary (their agent guidance — perfect **enum candidates for `direction_doc`**, deterministic mapping to easing): `smooth | snappy | bouncy | dramatic`; pacing `fast 0.2s | medium 0.4s | slow 0.6s`.

## Determinism (SPINE §1 fit)

Guarantee: "the same composition always produces the same video." Mechanism: integer frame clock (`time = floor(frame)/fps`) → adapter seeks paused timelines → atomic capture via Chrome `HeadlessExperimental.beginFrame` → ffmpeg encode. **Platform caveat:** BeginFrame mode is Linux/chrome-headless-shell; macOS/**Windows fall back to screenshot capture** — local dev renders are correct but not byte-identical across machines; **Docker mode** pins Chromium+fonts+ffmpeg for cross-machine identity. Our render cache keys on the **manifest hash, not output bytes**, so the Windows fallback costs nothing; use Docker/Lambda for production artifacts.

## Audio, captions, TTS (upgrades the pass-3 story)

- **Fully keyless local stack** — "No key configured is a normal state, not an error": TTS = **Kokoro-82M (54 voices)** with **Whisper word-level caption alignment**; music = MusicGen (`facebook/musicgen-small`); bundled SFX library. Hosted upgrades (HeyGen key → ElevenLabs → local; HeyGen library → Lyria via Gemini key → local) resolve `HEYGEN_API_KEY` → `HYPERFRAMES_API_KEY` → `~/.heygen/credentials`. This is exactly the A5 "hosted APIs = optional keyed adapters" pattern — **pass 3's TTS seam gets a $0 local default without a new vendor**.
- **No native SRT muxing.** Captions are authored as caption *components* inside the composition (20+ effects incl. karaoke). Thalon keeps its deterministic SRT as the platform-upload artifact; the **same derived timeline** can additionally drive burned-in caption components. Audio rides in `<audio>` tags (renderer mixes); `<video>` elements stay muted.

## Scale + deploy paths (pass 3+, both fit existing rails)

- **AWS Lambda** (`@hyperframes/aws-lambda`): Step Functions Plan → Map(N) → Assemble over one dispatch Lambda + S3; **CDK construct `HyperframesRenderStack`** fits our CDK-Python sub-account infra; reserved-concurrency default bounds runaway spend (~$1.20); `hyperframes lambda progress` = real-time cost accounting. v1 gaps: no webhooks, no multi-region, no HDR.
- **Vercel render-API template** (Apache 2.0, one-click): `<hyperframes-player>` preview + `POST /api/render` → sandboxed runtime (Firecracker microVM, pre-baked snapshot ~100 ms restore) → MP4 to Blob storage. Aligns with the web family's existing Vercel deploy adapter direction.

## Build accelerators + prior art

- **Skills**: `npx skills add heygen-com/hyperframes` (Claude Code-compatible; `--all` or `--skill <name>`; `/hyperframes` router). Load during B5.1/B5.2 builds as reference. Skills run in the *coding agent*; the engine itself drives the library APIs.
- **Their website-to-video pipeline is independent validation of our staged design**: capture → `DESIGN.md` → `SCRIPT.md` → `STORYBOARD.md` → narration + word timestamps → **one composition per beat** → validate (PNG snapshots). Same artifact chain as our storyboard + direction.md — ours adds pinned schemas + judge gates + tenancy. Their capture is *non-interactive* (screenshots at scroll depths + DOM/asset/token extraction) — complementary to B2.5's deterministic Playwright *drive* (interactions + event trace), not a replacement; their optional AI image-descriptions need a Gemini/OpenRouter key (~$0.04/40 images) = optional keyed adapter.
- Prompting guidance for stage chains (`proprietary/prompts/`): warm start (URL/transcript-grounded) beats cold start; specify duration/aspect/mood/elements; iterate with small directed edits ("make the title 2x bigger") rather than re-specification.

## ADR-0004 fodder (vs Remotion)

| | Hyperframes | Remotion |
|---|---|---|
| Authoring | HTML+CSS+GSAP ("agents think in HTML") | React/TSX |
| GSAP fidelity | seekable, frame-accurate (paused + seek per frame) | real-time ticker drifts during render |
| Editing | DOM rendered == DOM edited (SDK/Studio native) | code + build step |
| License | Apache 2.0, free at any scale, no per-render fees | custom commercial, thresholds + per-render fees |
| Capture | BeginFrame (deterministic) / screenshot fallback | screenshot-based |
| Where Remotion still wins | — | mature massive-scale Lambda, React design-system shops |

## Risks / mitigations

1. **Pre-1.0 drift** — pin exact version; bump only at checkpoints; Lambda "plan hash mismatch" errors indicate local↔deployed producer version drift (keep them lockstep).
2. **Windows dev ≠ byte-identical output** — irrelevant to our manifest-hash cache; Docker/Lambda for production artifacts.
3. **Performance foot-guns** (oversized images ≥2× canvas, >2-3 stacked `backdrop-filter` blurs, >64px radii) — encode as template-generator constraints, not reviewer memory.
4. **Feedback collection exists** (guides/feedback) — check the opt-out at driver-install time and record the decision.
