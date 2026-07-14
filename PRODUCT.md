# Product

## Register

product

> The one Next.js app carries two registers: `/app/*` (the workspace — this file's
> default) is product; `/` and `/blog` (the landing and blog surfaces) are brand,
> overridden per task. Design work on the landing reads the brand register.

## Platform

web

## Users

A solo operator — founder, marketer, or small-agency owner — running content and
social automation for one or more tenants. They work beside white-background
platform surfaces (video/social dashboards, search consoles), dipping into the
workspace between other tasks: triaging what the engine found, approving or
steering what it drafted. They are time-poor and reputation-sensitive — the
product posts under *their* name, so trust in the gate matters more than raw
volume. Multi-tenant agency operators are the growth audience; the shipped demo
tenant models the solo case.

## Product Purpose

A generic multi-tenant content and social-automation engine: trend and search
intel comes in, judged drafts (posts, videos, pages, outreach email) go out, and
a human approve gate sits between — every draft passes a shared judge harness
(compliance denylist, grounding-to-provided-sources, platform cadence) before an
operator ever sees it, and nothing publishes without their click. Success looks
like a short *time from prompt to first approved draft* (the instrumented
north-star) and an operator who returns daily because the engine visibly worked
while they were away.

## Positioning

Automation you can trust with your name: the engine hunts, drafts, and judges —
nothing ships without your click.

## Brand Personality

Warm, organic confidence — calm operator-grade competence, never aggressive.
Three words: **warm · vigilant · honest**. The falcon/talon hunting metaphor is
present but restrained (deliberate asymmetry, sails-not-claws); the workspace
should feel like paper and ink with heat rising off the page where the engine
found something.

## Anti-references

- Enterprise-fintech corporate (shields, world maps, gold-on-navy) — rejected by
  the founder as "too corporate."
- Aggressive/sharp/predatory readings of the mark or the UI — warm and organic
  wins every time.
- Near-black command-center HUD for the workspace — the workspace is light-first
  because operators work beside white platform surfaces; dark-cinematic is the
  landing's register only.
- Spam-cannon AI-marketing tools — no fake urgency, no synthetic countdowns, no
  guilt buttons, no manufactured scarcity; honest variants only.
- Gamification noise — streaks and cadence read as operator-grade consistency
  signals, never points-and-badges.

## Design Principles

1. **The 10-second rule.** A first-time operator must get any surface and be able
   to act within 10 seconds; the primary action is the visually dominant element.
2. **React to artifacts, never author from blank.** Cards, previews, chips, and
   diffs are doorways; context flows forward through structured handoffs and is
   never re-asked or retyped.
3. **Blue = you act, amber = the engine found heat.** One restrained interactive
   blue; amber is reserved for the signal channel (heat, outliers, needs-you).
   Heat reads as an explicit thermal scale with the band word in the pill.
4. **Honest states only.** Empty states are tutorials; loading is skeletons; a
   state the system cannot actually reach is never drawn. No dark patterns.
5. **Visible automation is perceived value.** The activity feed attributes work
   to the engine with provenance links; the operator should always be able to see
   what happened, why, and what it cost.

## Accessibility & Inclusion

WCAG AA for every named token pairing, pinned executable in
`apps/web/src/lib/__tests__/tokens-contrast.test.ts` (edit a color and the test
re-derives the ratio). The thermal heat scale is colorblind-proof by
construction: the band word sits inside the pill, adjacent-band CVD ΔE ≥ 13
validated, hot deliberately hue-distinct from destructive-red. Every animation
has a `prefers-reduced-motion` alternative; decorative motion halts entirely.
