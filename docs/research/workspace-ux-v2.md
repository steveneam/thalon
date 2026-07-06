# Workspace UX v2 research (Sprint 6 / wave-3 re-plan checkpoint)

> Founder-directed study (2026-07-07, session 16): 34 reference screenshots + two video-essay transcripts (a third-party "Hermes Astros" agent-OS competitor-radar walkthrough, and a UX-psychology piece on habit-forming app design), read against the B6.2 workspace as merged; founder added three landing-page reference catalogs mid-session (§8). Founder verdict on the current workspace: functionally correct but "does not achieve" convenient / engaging / enjoyable / intuitive. **All recommendations below were ratified by the founder on 2026-07-07.** Reference material stays outside the repo per the standing rule (described here, never copied in). Companion docs: `docs/FRONTEND.md` (amended to point here) · `docs/research/engaging-clips.md` (the sibling wave-3 proposal).
>
> This doc doubles as a portable lesson set — §1, §4 and §6 are deliberately written product-agnostic so other projects can reuse them.

## 1. What the Astros system teaches (function, not aesthetics)

Stripping the space theming and the sales pitch, five load-bearing ideas — each generic:

1. **Every intel card is a doorway, not a readout.** A topic card carries: heat score with a visible magnitude bar · provenance ("who posted it, 28k views, 19 hours ago", link to the original) · a plain-language "why it's moving" paragraph · ~5 ready titles (copy buttons) · ~3 angles · 1 hook line — and then **per-destination one-click exits** (their video agent / notebook / SEO article). The user never retypes context. This is the workflow connection the founder named: intel → create with the context carried, not re-authored.
2. **The handoff carries everything.** Clicking their "Video agent" opens the video brief *pre-filled* with title + angle + hook; settings (length, narrator, engine, voice) sit prompt-left/settings-right. The user's job becomes "scan and adjust", not "author from scratch" — smart defaults applied at the seam *between* features, which is where most products drop context.
3. **Visible cadence.** "Re-scans every 4h · last swept 2h ago · LIVE" plus a manual "scan now" button, on the intel surface itself. Automation is *felt* because it's stamped where the user looks, not buried in an activity feed.
4. **Watchlist managed in place.** Tracked accounts + keyword chips with an inline add box live on the intel surface — no settings detour. Auto-discovered accounts appear in the same chip row.
5. **Everything archives.** Every sweep logs to their memory system, compounding into a trend archive ("what was hot, when it broke, which titles I had ready").

## 2. Gap analysis vs the B6.2 workspace (why ours reads as a report)

The seam already exists — B6.2's `Generate from this` → `POST /api/intel/trends/:id/promote` → `/app/create?prompt=…` — but it hands over a **bare text string** (`promptSeed = card.text`). Concretely:

| Astros pattern | Thalon today (B6.2) | Gap |
|---|---|---|
| Dossier card: titles + angles + hook + provenance | Card: score, reasons, ratios, source link | No ready-to-fire creative context on the card |
| Per-destination exits on the card | One `Generate from this` button | Family choice deferred to Create, context thins on the way |
| Brief opens pre-filled (title/angle/hook/settings) | Create gets `?prompt=<card text>` + family heuristic | Operator re-authors what intel already knew |
| Cadence stamp + scan-now on the surface | Demo banner naming the B6.5 seam | No last-swept/next-sweep/sweep-now affordance |
| Watchlist chips inline | AreasManager inline (already good) | Keep |
| Sweep archive | `trend_snapshots` + events spine exist, unsurfaced | Surface later (parked) |

The card bones are right (reason strings verbatim, outlier badge, ratios — the B6.4 ranker grammar). What's missing is the card **as launchpad**.

## 3. The dossier card + context spine (the redesign)

Mostly a **data-shape change** the UI then expresses:

1. **Dossier card** — collapsible extension of today's trend card: ready titles (3–5) · suggested angles (2–3) · a hook line, alongside the existing score/reasons/provenance. Fixture-shaped now (exactly like the current demo cards); becomes live when B6.5 pollers land plus a title/angle generation pass. **Live title/angle generation is LLM spend per sweep — lands behind the gateway top-up ([you], already on the list) and rides the existing metered choke points.**
2. **Per-family exits on the card**: → Video · → Post · → Page (same promote capture, three doors), replacing the single button.
3. **Structured handoff, not a query-string prompt.** The promote route already writes an `IntelCapture` — hand Create a **capture/context id**; Create fetches `{title, angle, hook, sourceUrl, areaName, keyword, score}`. Same pattern for Search's `target-this`.
4. **Context chips on Create.** The fetched context renders as a visible, removable "Intel context" chip stack that rides into generation — the operator *sees* what flows in and can prune it. Extends the founder rule that the profile carries company context: **intel carries topic context; never re-ask either.**
5. **Create pre-fills, never re-asks.** Video brief opens with the title as working title, angle + hook seeded into prompt/direction, profile defaults (length, voice, platforms) pre-selected.
6. **Symmetric capture door.** Promote and dismiss flow through the same intel-action capture path — dovetails with carried follow-up (3), the dismiss→eval-row write door.
7. **Cadence stamp on Intel**: "last swept · next sweep · Sweep now" header — honest about fake-driver mode until B6.5 arms it.

## 4. Colour direction (ratified)

Founder's reasoning — a **workflow argument, not taste**: the operator lives beside YouTube/X/Facebook/GSC, all white surfaces; embedded thumbnails/previews of that content always look wrong floating on near-black. *Work surfaces should match the material they handle.* (Portable lesson: pick app chrome for the content it hosts, not the brand's marketing mood.)

**Ratified direction: white/paper workspace · navy-ink structure · blue for actions · amber narrowed to the signal channel.**

- **Base**: warm white / paper (the existing `:root` light token set is already this).
- **Structure**: deep navy-ink for text, headers, sidebar chrome — calm, trustworthy, native beside the platforms.
- **Interactive (primary)**: one restrained blue for buttons, links, focus rings.
- **Signal (amber, kept but narrowed)**: heat scores, outlier badges, needs-you counts, magnitude bars. **Colour becomes meaning: blue = you act, amber = the engine found heat.** (The Astros screens do exactly this — gold magnitude bars on every card.) Keeps continuity with the warm Grip II mark instead of orphaning it: navy sky, gold talon.

Why not all-navy: blue-on-white alone is the most generic SaaS look; the amber signal channel is what keeps Thalon recognisable. Why not amber-primary on white: amber-as-action reads washed/alarmy at AA-compliant weights — moving the *interactive* layer off orange is correct.

Scope notes: (a) the flip is a class change + light-palette retune — the token architecture was built dual from day one (`:root` light set live, `.dark` a class on the layout), and `tokens-contrast.test.ts` re-derives WCAG AA from the oklch values, so the ratchet already runs; (b) **landing stays dark-cinematic for now** (ratified) — it's a marketing artifact, its vignette/placeholder loops are dark-built, and the dual token set supports both cleanly; revisit at B6.7.

## 5. UX-psychology principles, mapped honestly

The essay's six principles, filtered through the honest-claims rule (ADR 0006) — several of its examples are dark patterns we will not ship:

1. **Smart defaults** ("70–90% never change defaults; a default reads as a recommendation") — the dossier handoff *is* this at the feature seam. Also: outcome-stating buttons ("Generate 3 drafts — judged before you see them"), family pre-pick from context (done), profile-seeded video settings.
2. **Goal gradient** (never start at 0%; pre-stamped loyalty cards double completion) — first-run checklist opens ~20% because "profile seeded ✓" counts; staged video flow shows steps already cleared.
3. **Reciprocity** (give value before asking) — the demo tenant with pre-generated drafts before any setup; the landing demo popouts. Value lands before we ask for anything.
4. **IKEA/endowment effect** (built = owned) — onboarding leads with *building your profile* (identity, voice, topics) so the workspace is "theirs" in minutes; the B3.8/B3.11 spine makes this nearly free.
5. **Loss aversion — honest version only.** Velocity is genuinely perishable, so a freshness indicator ("rising for 19h — catchable") is truthful loss-framing. Fake countdowns / "I'll risk it" guilt buttons violate the honest-claims ethos; skip them.
6. **Anchoring/contrast** — parked for pricing (§3 tiers await [you]); anchor against hours-saved/agency cost, never fake was-prices (already the FRONTEND.md stance).

Landing-copy patterns worth lifting from the reference screenshots for §2 of the landing: the "old way vs new way" two-column, and the "one topic card → three one-click exits" flow diagram — both fit the "how it works" strip.

## 6. What NOT to copy (recorded so it isn't re-litigated)

- **The dark space aesthetic** — rejected (§4); we take the function, not the look.
- **The commercial avatar/voice stack** (HeyGen avatars, ElevenLabs voices) — our deterministic Hyperframes pipeline + keyless Kokoro/Whisper tier is the deliberate counter-position (see `engaging-clips.md`).
- **Near-clone title generation.** Their titles pattern-match the winning competitor's. Our framing: *angles grounded in what's demonstrably rising* — judge-gated, honest-claims-checked, uniqueness as the point.
- **Dark-pattern loss framing** from the UX essay (fake countdowns, guilt-trip dismiss buttons) — the honest variants only (§5.5).

## 7. Wave-3 slotting (ratified order)

1. **Workspace light-theme flip + palette retune** — small, isolated, contrast test re-pins it, immediate founder-visible payoff.
2. **Intel dossier card + structured context handoff** (fixture-backed) — per-family exits + the symmetric capture door (absorbs carried follow-up 3).
3. **B6.5 live drivers** — titles/angles/provenance go real (needs gateway top-up + transcript key).
4. **B6.6 origination live loop** — consumes the context object end-to-end. Web-ingest driver candidate surveyed same session (founder-supplied ten-tool review): **Crawl4AI** (Apache-2.0; URL → clean LLM-ready markdown) behind a subprocess seam like B4.8's transcript pattern — for operator-site grounding ingestion; verify current license terms at adoption.
5. **Landing v2 moment**: composition v2 (+ demo-clip re-cut, FeatureLoop swap — `engaging-clips.md`) **+ the landing craft uplift (§8)** land together as one coherent landing revision, then **B6.7 deploy** ships it.

Items 1–2 are lead-terminal work per the board (integration-heavy, no lanes needed to start). The remaining carried follow-ups (events paged read · brandProfiles.list/activate · `next build` CI job · B6.7 deploy notes) slot into these steps where they touch the same files.

Parked (recorded, not now): surfacing the sweep archive as a browsable trend-history view; intel digests pushed out-of-app (already on FRONTEND.md's parked list).

## 8. Landing uplift (founder-added scope, same session)

Founder pointed at three catalogs; surveyed 2026-07-07:

| Source | What it is | License | Use for us |
|---|---|---|---|
| awesome-landing-pages (GitHub + its Vercel gallery) | ~20 plain HTML/Tailwind landing templates by industry (SaaS/AI SaaS the relevant set) | MIT | Minable for **section/layout/conversion patterns**; stack-compatible (Tailwind, no framework) |
| ReactBits (reactbits.dev) | 130+ animated React components — text animations (Split Text, Blur Text, Count Up…), UI (Spotlight Card, Tilted Card, Dock…), animated backgrounds (Aurora, Particles, Silk…); JS/TS × CSS/Tailwind variants | MIT + Commons Clause (free for use in products; you may not resell the library itself — fine for us, recorded) | **Signature moments**, selectively; many components pull gsap/motion, backgrounds often WebGL (three.js/ogl) — per-component dependency + license check at adoption, like the hyperframes catalog gate |

Two framing facts keep the uplift honest:

- The founder's own galleries preach **conversion-first minimalism** ("minimal site >> fancy site" is the stated philosophy of the first catalog). So the uplift is *a few signature moments + stronger section craft*, not an animation carnival — which also matches the UX-psych findings (§5).
- The current landing's structure is sound (4 sections, waitlist mechanics, JSON-LD/llms.txt, static-first). What it lacks is **drama and density of craft**: the hero is quiet, sections are flat stacks, the feature cards don't pull.

Uplift items (ratified direction; detail at build time):

1. **Hero signature moment** — one animated headline treatment (ReactBits split/blur-text class) + a depth layer behind the vignette. This deliberately amends the client-JS budget from "forms+modal+sticky only" to "+ one hero moment"; `/` must stay static-prerendered and LCP-safe, and the `next build` CI job (carried follow-up 5) becomes the guard.
2. **Section craft pass** from the MIT template set: stats/proof band shaped for what we can honestly claim (suite size, $0 renders, platforms planned — no fake logos/testimonials pre-launch) · "old way vs new way" two-column (§5) · bento-style feature grid as the §2 alternative if side-scroll cards keep underperforming · footer architecture.
3. **Feature-card pull**: hover/spotlight treatment on the three §2 cards (ReactBits spotlight/tilt class, or CSS-only equivalent), popouts get the real composition-v2 renders (the FeatureLoop swap riding this step).
4. **Micro-interactions, max 2–3**: count-up on waitlist position, magnetic/glare CTA. Stop there.
5. **Palette continuity decision folds into step-1 of §7**: landing stays dark, but when the workspace light retune lands, re-tune the landing's dark base toward the same navy-ink + amber-signal DNA so the brand doesn't fork (today's warm charcoal `#161411` is also baked into tenant #0's `identity.style` brand literals — composition v2 is the natural moment to reconcile both).
