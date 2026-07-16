# Iteration-pass checklist — two lanes, every pass

> **P0.2 of the vendor-visual block.** The source method defines an iteration pass
> as a fine-toothed-comb pass for design problems **and** for "opportunities to
> improve/complexify" — so every pass here runs BOTH lanes. A pass that only
> fixes faults is half a pass and does not count toward the minimum.
>
> **Applies to:** every B7.2 Thalon surface and every B7.4 template page.
> **Minimum: 3 full passes per page/surface** before it may be called done.
> The factory meta-prompt (`meta-prompt.md`) mandates this file by name.

## Pass protocol

1. Render the current state (staging preview on syd4; local browser elsewhere).
2. Lane A top to bottom, fixing as you go or queuing fixes.
3. Lane B top to bottom — commit to at least **one** ambition item per pass, or
   record explicitly why the page is already at its ceiling.
4. Log one line per pass (what Lane A caught · what Lane B added) in the
   page's `/guide` source data (templates) or the PR description (Thalon
   surfaces).
5. After the final pass: browser-verify, then the repo gates (suite · guard ·
   judge where content flows through it).

## Lane A — fault-hunt (find what's wrong)

**Layout & rhythm**
- [ ] Alignment: nothing off-grid by accident; optical alignment where geometry lies.
- [ ] Spacing rhythm consistent (no ad-hoc margins fighting the scale).
- [ ] Every breakpoint walked (mobile → wide); no overflow, no orphaned UI.
- [ ] Prose measure sane (≤ 65–75ch); headlines balance/wrap cleanly.

**Color & type**
- [ ] Contrast: all text pairings clear AA on their actual backgrounds.
- [ ] Palette discipline: accents used as designed, not leaking into chrome
      (Thalon surfaces: the Two-Channel Rule — blue acts, amber signals).
- [ ] Type scale: no arbitrary sizes outside the named steps; hierarchy reads
      at squint distance.
- [ ] **Tonal continuity** (s35 lesson): no sensory-shock background jumps —
      a bright wall after several dark viewports (or the reverse) fails the
      scroll even if the section is beautiful alone.

**Motion & state**
- [ ] Every animation has a `prefers-reduced-motion` alternative.
- [ ] Nothing animates without conveying state or earning its decoration.
- [ ] **Idle-motion temperament** (s36 lesson): ambient/idle motion must match the
      scene's mood — a calm backdrop forbids springy or jittery type; big type
      moves only on interaction or state change, never on scroll velocity or an
      idle pulse. Tempo effects live in small contained instruments, not page-wide.
- [ ] Loading, empty, error, and success states all exist and are honest.
- [ ] Hover/focus/active/disabled all designed; focus visible on keyboard walk.

**Assets & performance**
- [ ] Images sized to slot, modern format, lazy-loaded below the fold.
- [ ] **Minted-image setting scrutiny** (s37 lesson): read every property/scene
      mint for what its *setting* connotes, not just its subject — placement
      (corner/end-of-street houses fail feng shui and general perception),
      infrastructure clutter (power lines, bare asphalt), and neighbourhood
      register (established greenery reads prestigious; bare reads cheap).
      Re-mint rather than crop around a wrong setting.
- [ ] **Causal-handoff continuity** (s41 lesson, founder-taught): in any
      multi-scene sequence — film beats, storyboards, scroll scenes — each
      scene's exit object must be the next scene's entry object (spark→card,
      card→draft, draft→gate…). If the link between two scenes exists only in
      the narration around them, the sequence fails; name the handoff object at
      every boundary in the plan before minting.
- [ ] **Legibility at render scale** (s41 lesson, founder-taught): judge every
      minted frame at phone-width/thumbnail AND compressed, not just full-res
      on a bright monitor — subjects must survive small, dark, and moving.
      Night palettes stay rich and readable, never crushed to near-black; a
      frame whose subject can't be named at three inches wide is a reject.
- [ ] **Anchor stillness in motion prompts** (s42 lesson): image→video models
      animate the focal object by default — a "held/pinned/still" object will
      drift, detach, or scribble unless the prompt names what stays still as
      explicitly as what moves and pushes the motion energy into the
      environment (water, light, machinery). Both s42 first-take rejects were
      exactly this failure; the "nothing else moves" retakes both passed.
- [ ] **Per-object color-hold routes the model slot** (s42 lesson): Kling 3.0
      cycles per-object colors over time even when the prompt fixes them (two
      takes, same drift — flames wandered magenta→red→orange); Seedance 2.0's
      identity strength holds per-object hues from a reference frame. Any beat
      whose colors carry *meaning* (platform-color beacons) goes to the
      Seedance slot; decorative color can ride Kling.
- [ ] **Fix the flaw, keep the energy** (s43 lesson, founder-taught): a take
      that breaks a law (palette drift, detached anchor) but nails the story
      *event* is a better retake seed than a law-clean take where nothing
      happens. Judging on law-compliance alone selects for static clips — both
      s42 mill-gate/bloom keepers were quieter than their rejects and lost the
      beat's meaning. On any retake, transcribe the reject's event
      choreography into the new prompt explicitly (what ignites, what strains,
      in what order), then add the law as anchors — never re-prompt from the
      still alone.
- [ ] **Lock-off beats = composite, not re-prompt** (s43 lesson): even with
      anchor-stillness language Kling re-paints static *texture* every frame
      (stone outlines, linework simmer — no camera drift needed). For a beat
      that is a held frame plus one small live effect, build it locally:
      static keeper still as base + the effect region windowed in from the
      minted clip through a feathered mask (beat-1 proof: frame churn 0.674 →
      0.140, 0cr). Quantify stillness with a tblend-difference YAVG pass, not
      by eyeballing sampled frames — the s43 first check sampled 0.8s and
      passed a clip the founder correctly rejected.
- [ ] **Semantic flow direction is never implied** (s43 lesson,
      founder-caught): models animate physically-natural flow (deltas drain
      toward the sea/camera); when the story needs flow toward a destination
      (delivery toward the towers), the prompt must name the direction, the
      arrival, and the forbidden direction explicitly — geometry in the still
      does not carry it.
- [ ] **Seedance holds the creative-elaboration seat** (s43 standing
      directive, founder-taught): on the s43 comparison the founder judged
      Seedance's taste, animation and imagination "a lot better" than the
      agent's conservative single-beat prompts — its rival cut had ideas
      nobody briefed (wheel-through-window, fanned pages, clean swoop/stamp)
      AND it self-corrected a semantic bug (page-flow direction) the
      beat-by-beat pass missed. Standing method: (1) for any multi-beat
      sequence, always run a low-tier Seedance multi-shot pass off the full
      storyboard + keeper refs EARLY — treat it as the cinematographer's
      draft, not a curiosity; (2) write briefs that hand Seedance room to
      elaborate (story intent, mood, what must be true) instead of
      motion-by-numbers anchor lists — reserve hard anchors for laws only;
      (3) harvest its choreography into beat retakes; (4) the agent's seat is
      director/editor: story structure, laws, judgment, provenance, and the
      deterministic local assembly (ffmpeg remains the assembler of record).
      Escalation path: with richer briefs + more materials, Seedance
      multi-shot per ACT (2-3 beats per generation) is the candidate upgrade
      for final films — cost it and propose at the next film.
- [ ] **Score selection is measured, never vibes** (s44 lesson — the audio
      sibling of "quantify stillness"): candidate music is judged by a
      per-second RMS-envelope map against the beat arc (rise into the climax
      beat, fall/cadence at the close) — a window scorer over every offset of
      every candidate finds real crescendos and real endings that name-based
      picking misses (the s44 "cadence on the sheet" cut came from the scorer,
      not the track list). And single-pass `loudnorm` is a *dynamic* gain — it
      flattened a candidate's entire build (+0.6dB where the storyboard needed
      a crescendo); use static gain for score work and re-measure the envelope
      AFTER the mux.
- [ ] No vendor URLs anywhere — every asset served from our storage (B7.1 pin).
- [ ] No watermarked/free-tier asset on the page.
- [ ] Console clean; no layout shift on load; static-first holds.

**Copy & honesty**
- [ ] Claims verifiable; no fake urgency/scarcity/testimonials.
- [ ] Alt text on meaningful images; decorative marked as such.
- [ ] `/guide` route present and accurate (templates).

**Accessibility sweep**
- [ ] Full keyboard traversal; skip/landmark structure sane.
- [ ] State never conveyed by color alone (word-in-pill precedent).
- [ ] Screen-reader labels on icon-only controls.

## Lane B — ambition-push (find what could be more)

- [ ] **The memorable moment:** does the page have ONE thing a visitor would
      describe to someone else? If not, build it this pass.
- [ ] Can the hero go further on the assigned primary axis — deeper 3D, a
      choreographed entrance, a braver type scale — without breaking Lane A?
- [ ] Is there a micro-interaction that would reward attention (cursor
      response, hover physics, scroll-linked reveal) that fits the axis?
- [ ] Would a minted asset upgrade the weakest section (texture → key image,
      static → animated) at acceptable credit class? (Check the shot-list's
      credit tags before minting video.)
- [ ] Is the palette merely correct, or actually *exceptional*? One deliberate
      intensification per page is usually available.
- [ ] **Material feel** (s35 lesson): would texture upgrade a flat fill —
      parchment grain, print grammar, a lit-object vignette? Flat backgrounds
      read cheap on luxury verticals; self-contained textures (inline SVG
      noise, layered gradients) cost nothing.
- [ ] Complexify with intent: layered depth, second reading rewards, detail in
      corners — never noise for its own sake.
- [ ] Squint test versus the rest of the wave: is this page still unmistakably
      itself?

## Exit criteria (all true)

- ≥ 3 full two-lane passes logged.
- Lane A: zero open items.
- Lane B: at least one ambition item shipped across the passes, or the ceiling
  call recorded.
- Browser-verified final state; suite green; guard clean; assets pinned with
  paid-tier provenance.

---

*v1, 2026-07-14 (session 31). Tag: opinion (revise freely at wave checkpoints),
except the B7.1/free-tier and honesty items, which restate invariants.*
