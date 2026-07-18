---
name: Thalon
description: Paper-and-ink operator workspace with a thermal signal channel; dark-cinematic landing sharing the same DNA
colors:
  paper: "oklch(0.978 0.008 84)"
  ink-navy: "oklch(0.24 0.028 258)"
  card-white: "oklch(1 0 0)"
  action-blue: "oklch(0.5 0.115 252)"
  bronze-signal: "oklch(0.55 0.118 70)"
  muted-wash: "oklch(0.945 0.009 82)"
  muted-ink: "oklch(0.46 0.025 255)"
  hairline: "oklch(0.9 0.008 255)"
  destructive-red: "oklch(0.577 0.245 27.325)"
  heat-cool: "oklch(0.52 0.075 245)"
  heat-warm: "oklch(0.8 0.14 90)"
  heat-rising: "oklch(0.68 0.16 55)"
  heat-hot: "oklch(0.55 0.2 35)"
  night-ink: "oklch(0.145 0.01 260)"
  landing-amber: "oklch(0.78 0.14 76)"
typography:
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
  eyebrow:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    letterSpacing: "0.18em"
  micro:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "2rem"
    padding: "0 0.625rem"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.md}"
    height: "2rem"
    padding: "0 0.625rem"
  badge-signal:
    backgroundColor: "{colors.bronze-signal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    height: "1.25rem"
    padding: "0.125rem 0.5rem"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.xl}"
    padding: "1rem"
---

# Design System: Thalon

## 1. Overview

**Creative North Star: "The Falconer's Desk"**

A calm, light desk of paper and navy ink where a vigilant engine delivers what
it found — and heat rises off the page exactly where something is worth acting
on. The workspace is deliberately quiet: white cards on warm-neutral paper,
hairline borders, one restrained blue reserved for things the operator can do.
Color is never decoration; it is a channel. Blue means *you act*. Amber-bronze
means *the engine found heat*. The thermal scale (stale blue → yellow → orange
→ red) is the loudest thing on any screen, and it has earned that right by
being information.

The landing page is the same DNA after dark: near-black ink-navy, amber as the
marketing accent, cinematic motion — the site looks like the product because
they share one token set. This system explicitly rejects enterprise-fintech
corporate dress (shields, gold-on-navy), aggressive/sharp readings, near-black
command-center HUDs in the workspace, and every dishonest marketing mechanic
(fake urgency, synthetic scarcity, gamification noise).

**Key Characteristics:**
- Light-first workspace: paper base, navy ink, white cards, hairline borders
- Two-channel color doctrine: action-blue (interactive) vs bronze-amber (signal)
- Thermal heat grading worn as word-in-pill — glanceable, colorblind-proof
- One sans family (Geist) at a tight product scale; mono reserved for
  data/eyebrow labels
- Flat by default; depth from tonal layering, not shadows
- Dark-cinematic landing sharing the same tokens (`.dark` scope, never the root)

## 2. Colors

A restrained two-channel palette on warm-neutral paper: one blue that acts, one
bronze that signals, and a four-step thermal scale that is allowed to shout.

### Primary
- **Action Blue** (oklch(0.5 0.115 252)): every interactive element — primary
  buttons, links, focus rings, selection. If it's blue, clicking it does
  something. Hover dims to 80% opacity; focus draws a 3px `ring/50` halo.

### Secondary
- **Bronze Signal** (oklch(0.55 0.118 70)): the engine-found-heat channel —
  outlier badges, needs-you counts, opportunity markers. Deep enough to clear
  AA on paper. Never on interactive chrome. On the dark landing this family
  brightens to **Landing Amber** (oklch(0.78 0.14 76)) and becomes the primary
  marketing accent.

### Tertiary — the thermal scale
- **Heat Cool** (oklch(0.52 0.075 245)): stale/cool band; white text in-pill.
- **Heat Warm** (oklch(0.8 0.14 90)): warm band; ink text in-pill.
- **Heat Rising** (oklch(0.68 0.16 55)): rising band; ink text in-pill.
- **Heat Hot** (oklch(0.55 0.2 35)): hot band; white text in-pill. Deliberately
  hue-side of destructive red — heat must never read as an error.

### Neutral
- **Paper** (oklch(0.978 0.008 84)): the body background. Low chroma — an
  off-white with a faint, deliberate warm cast toward the landing's amber DNA
  (founder direction 2026-07-14), still nowhere near cream.
- **Card White** (oklch(1 0 0)): cards and popovers lift off paper by being
  pure white — tonal elevation, not shadow.
- **Ink Navy** (oklch(0.24 0.028 258)): all foreground text and structure.
- **Muted Ink** (oklch(0.46 0.025 255)): secondary text; clears 4.5:1 on paper.
- **Muted Wash** (oklch(0.945 0.009 82)): hover fills, skeletons, magnitude-bar
  troughs.
- **Hairline** (oklch(0.9 0.008 255)): every border and divider.
- **Night Ink** (oklch(0.145 0.01 260)): the landing's base — warm charcoal
  hue-shifted toward ink-navy so both themes share one DNA.

### Named Rules
**The Two-Channel Rule.** Blue = you act; amber = the engine found heat.
Neither color ever does the other's job, and no third accent exists. An
interactive element styled amber, or a signal styled blue, is a defect.

**The Word-In-Pill Rule.** Heat is never color alone: the band word sits
inside the pill, the exact score demotes to the tooltip. Adjacent bands hold
CVD ΔE ≥ 13; in-pill text pairs clear AA. Any new grading surface reuses this
grammar — never a bare colored dot.

**The AA-Executable Rule.** Every named token pairing is pinned by
`apps/web/src/lib/__tests__/tokens-contrast.test.ts`. Change a value here and
the test re-derives the ratio; a failing pairing does not ship.

## 3. Typography

**Display Font:** Geist (system-ui fallback) — landing display sizes only
**Body Font:** Geist (system-ui fallback)
**Label/Mono Font:** Geist Mono (ui-monospace fallback)

**Character:** One quietly confident geometric sans carries the whole product;
the mono appears only for data (tabular numerals) and the HUD eyebrow label —
a restrained trace of the command-center references, not a costume.

### Hierarchy
- **Display** (600, clamp-scaled, tight leading): landing hero only. Never in
  the workspace.
- **Headline** (600, 1.125–1.25rem): page titles in the workspace shell.
- **Title** (600, 0.875rem, leading-none): card titles — `CardTitle` default.
- **Body** (400, 0.875rem, 1.5): descriptions, prose. Prose runs ≤ 65–75ch;
  dense data surfaces may run wider.
- **Label** (500, 0.75rem): badges, secondary metadata, `CardDescription`.
- **Eyebrow** (mono, 0.6875rem, +0.18em, uppercase): the `u-eyebrow` HUD
  micro-label — section kickers on the landing, column labels in dense cards.
- **Micro** (mono, 0.625rem — the `text-2xs` theme step): dense mono
  micro-labels only — judge gate chips, stage-rail labels, clip timestamps.
  The smallest legal size in the system; anything below it is a defect, and
  arbitrary pixel sizes never substitute for the named step.

### Named Rules
**The Tabular Rule.** Any number that updates (counts, scores, budgets) sets
`font-variant-numeric: tabular-nums` (`u-tabular`) so digits never jitter.

**The One-Family Rule.** No second display face, ever. Contrast comes from
weight and the mono, not from a new family.

## 4. Elevation

Flat by default. Depth is conveyed tonally: pure-white cards sit on warm paper,
the sidebar sits a half-step darker than content, and hairline borders
(oklch(0.9 0.008 255)) do the separating. The shipped `Card` primitive carries
no box-shadow at all. On the dark landing, borders become white-alpha hairlines
(9%) and glow/spotlight effects are scoped, decorative, and reduced-motion-safe.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. If depth appears, it
is tonal (white-on-paper) or a state response — never an ambient drop shadow
under every card.

## 5. Components

The component base is shadcn-style primitives (`components/ui/`), tuned to the
two-channel doctrine. Consistency over surprise: the same button vocabulary on
every surface.

### Buttons
- **Shape:** gently rounded (0.5rem at default size), height 2rem (`h-8`),
  0.875rem medium text.
- **Primary:** Action Blue fill, paper text; hover dims to 80%; pressing
  nudges down 1px (`active:translate-y-px`).
- **Hover / Focus:** focus-visible draws `border-ring` + 3px `ring/50`;
  disabled drops to 50% opacity with pointer-events off.
- **Outline / Secondary / Ghost:** hairline border on paper · muted wash fill ·
  bare with muted hover, respectively. **Destructive:** red at 10% fill with
  red text — quiet until hovered (20%).

### Chips / Badges
- **Style:** full-pill (rounded-4xl), height 1.25rem, 0.75rem medium text.
- **State:** `signal` variant = Bronze Signal fill (the amber channel);
  `secondary`/`outline` for neutral metadata; `destructive` follows the
  quiet-red pattern.

### Cards / Containers
- **Corner Style:** rounded-xl (0.875rem).
- **Background:** Card White on Paper (the tonal lift).
- **Shadow Strategy:** none — see The Flat-By-Default Rule.
- **Border:** 1px Hairline.
- **Internal Padding:** 1rem (`py-4` + `px-4`), 4-unit gap rhythm.

### Inputs / Fields
- **Style:** hairline stroke (`--input`), paper background, md radius.
- **Focus:** ring treatment identical to buttons (one focus vocabulary).
- **Error:** `aria-invalid` drives destructive border + 20% destructive ring —
  state carried by attributes, not ad-hoc classes.

### Navigation
- **Style:** left sidebar on the half-step darker wash (`--sidebar`), ink text,
  Action Blue for the active item; top bar carries tenant switcher + needs-you
  badge (signal channel). Collapses structurally on small screens.

### Action verbs (vocabulary)

**The Four-Verbs Rule** *(founder-prompted, session 39)*: removal-shaped
actions use exactly one verb per meaning, everywhere — never synonyms:

| Verb | Meaning | Consequence | Dress |
|---|---|---|---|
| **Dismiss** | "not for us" — a judgment | Item survives (dismissed tab/badge, reversible); teaches the engine (eval row) | quiet ghost/outline |
| **Delete** | destroy the data | Gone (cascade); refused while referenced | destructive quiet-red + named confirm |
| **Reject** | terminal verdict on a draft | Recorded decision; draft closed | destructive, beside Approve |
| **Remove** | take out of a working set | Nothing destroyed, nothing learned (e.g. context chips) | bare × / ghost |

A new surface that reaches for a removal word picks from this table; a
"delete" that secretly dismisses (or vice versa) is a defect. Current usage
audited clean 2026-07-15: intel/leads = Dismiss, library = Delete,
approve = Reject, Create chips = Remove.

### List-surface grammar *(consistency slice, session 40; fifth recipe session 56)*

Five recipes, each defined once — a list surface that reinvents any of them
is a defect:

**The Bounded-List Rule** *(founder direction, session 56 — workspace
redesign input)*. A list that grows with data (leads, activity, runs,
library rows) never grows the page with it: past a short threshold it lives
in a bounded region — fixed-height internal scroll, tabs, or
pagination/numbering — chosen per surface and stated in the design.
Page geometry is independent of list length; sibling sections keep their
dimensions as data accumulates. An unbounded "just keep listing" surface is
the defect this retires. The workspace-redesign Phase D designs must state
each list's bound; the redesigned dashboard is the first conformance
surface.

**The Selected-Row Recipe.** Exactly one selected/current-row treatment:
the action-blue tint (`SELECTED_ROW` in `lib/workspace/selected-row.ts`).
Selection is an interactive state, so it wears the action channel per the
Two-Channel Rule; muted washes are *hover only* — a selected row that
matches a hovered row is the defect this retires. Conformance is pinned
executable by `lib/workspace/__tests__/selected-row.test.ts`.

**The j/k Grammar.** Every triage list shares one keyboard grammar
(`useListKeys` in `lib/workspace/keyboard.ts`): `j`/`k` move the selected
row (detail follows selection), `x` picks it for bulk, and single letters
act on it using the surface's own Four-Verbs word (`a`/`r` on approve, `d`
= Dismiss on leads, `d` = Delete on library — the named confirm still
guards destructive keys). Keys never fire while typing or with a modifier
held; each surface shows a `keys ·` eyebrow legend and announces the
moved-to row through an sr-only live region.

**The Bulk Bar.** Multi-select bars are one component
(`components/workspace/bulk-bar.tsx`): count + mass action behind ONE
named confirm with the count (FRONTEND §0's standing QoL convention) +
Clear. The action wears its Four-Verbs dress (Delete destructive, Dismiss
quiet).

**The Terminal Toast.** Terminal verbs (Approve/Reject/Dismiss/Delete)
confirm through `components/workspace/action-toast.tsx` — message plus a
link back to where the item now lives when such a place exists (leads →
Dismissed tab). Never a promised "Undo" that doesn't exist: true
undo-after-terminal rides the queued B-crm approve/reject contract change.

### HeatGrade (signature component)
The thermal pill: `u-eyebrow` band word inside a filled pill (band color
decides ink-vs-paper text), beside a 2.5rem magnitude bar on Muted Wash whose
fill repeats the band color. Exact score lives in `title`/`aria-label`.
Defined once in `components/intel/heat-grade.tsx`; every grading surface
imports it — see The Word-In-Pill Rule.

## 6. Do's and Don'ts

### Do:
- **Do** keep the two channels pure: Action Blue (oklch(0.5 0.115 252)) for
  anything clickable, Bronze Signal (oklch(0.55 0.118 70)) for anything the
  engine flagged.
- **Do** reuse the HeatGrade grammar (word-in-pill + magnitude bar) for any
  new score or grade — the band word is the accessibility channel.
- **Do** keep skeletons on Muted Wash for loading and write empty states as
  tutorials with a one-click seeded example (fake drivers make this free).
- **Do** run motion at 150–250ms, ease-out, state-conveying only — and give
  every animation a `prefers-reduced-motion` alternative.
- **Do** keep the primary action visually dominant on every surface — the
  10-second rule is the design invariant.
- **Do** pass the squint test before shipping a surface: blur your eyes and
  exactly one focal point per section should survive. If two elements fight
  for the eye, demote one — hierarchy is weight and placement, not a second
  accent color (founder-ratified, session 38).

### Don't:
- **Don't** dress the workspace as enterprise-fintech corporate — no shields,
  world maps, or gold-on-navy (the founder's named anti-reference).
- **Don't** darken the workspace: near-black command-center HUDs are the
  landing's register only; operators work beside white platform surfaces.
- **Don't** ship spam-cannon marketing mechanics: fake urgency, synthetic
  countdowns, guilt buttons, manufactured scarcity, gamification
  points-and-badges. Honest variants only.
- **Don't** use amber/signal on interactive chrome or blue on signal badges —
  the Two-Channel Rule cuts both ways.
- **Don't** use side-stripe borders (colored `border-left` > 1px), gradient
  text, glassmorphism-as-default, or an eyebrow kicker above every section —
  the `u-eyebrow` is a scoped HUD label, not section scaffolding.
- **Don't** convey any state by color alone — words and attributes carry it
  (the heat pill and `aria-invalid` patterns are the precedents).
- **Don't** add ambient drop shadows under cards; tonal white-on-paper is the
  elevation system.
