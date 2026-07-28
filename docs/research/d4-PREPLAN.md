# D4 design wave — PREPLAN (s84, for s85 authoring)

> **Artifact class:** pre-plan (the s62 loop — direction settled BEFORE the
> sheet is drawn; 6/6 first-take on its last outing). This file is the brief
> the four sheets are authored against, so s85 spends its budget DRAWING, not
> re-deriving. Raw material: `mobbin-patterns-s83.md` §"What this changes
> about D4" + `mobbin-patterns-s83b-microux.md`. **Fable 5 authors directly**
> (standing founder rule) — never delegated to a lane.
>
> **The sheet is law only after the founder's verdict.** Each sheet below
> names its OPEN CALLS — the questions the mock must ask him rather than
> answer for him.

## What changed under this wave since it was chartered

Three facts the s83 charter could not assume, all true now:

1. **The connect dance is real and proven on four platforms** — Facebook,
   Instagram, LinkedIn, Bluesky all connected; `connectFlavor` drives the
   panel; `callbackAs` lets destinations share one registered callback. The
   Channels sheet is therefore drawing something that EXISTS, not a wish.
2. **Staging is the real origin** (`preview.swordfish.cfd`, edge exemption +
   `APP_ORIGIN`, s84). Screens can be shot against a reachable deployment.
3. **Instagram posting is unblocked in principle** — the `/assets/<sha256>`
   door is edge-public and Meta can now fetch it. The composer's per-platform
   media rules stop being hypothetical for IG.

## Sheet 1 — Analytics (new surface)

**Shape:** Sprout's per-post table — sortable metric columns, list/card
toggle, date-range compare, filters, **honest N/A per platform**, an
end-of-data line. Engagement-by-hour chart is DRAWN but explicitly waits on
D2's `publication_metrics`.

**Thalon-specific, and the reason this sheet matters more than a competitor's:**
Intel measures the MARKET, Analytics measures US. The sheet must make that
distinction visible rather than presenting one number soup — the D2 closed
loop (own-post metrics steering generation) is the differentiator, so the
surface should show where a metric FEEDS BACK, not just what it was.

**Honesty rules (non-negotiable, they are the house style):**
- A platform with no metrics API says so in words; never a 0 that reads real.
- Every number carries its as-of time (the s83b copy grammar).
- Zero-state is the separate code-drawn layer, not a shrunken table.

**Open calls:** (a) does the founder want the feedback-loop lane on THIS sheet
or held for a Learning surface — noting his standing "ML BACKEND-ONLY, no
Learning surface" ruling, which argues for here; (b) card vs table as the
default view.

## Sheet 2 — Calendar → Schedule

**Shape:** the three-fact split — **planned / queued / published** — as the
sheet's organizing idea (today's calendar reads planned slots only, which is
why a committed queue row breaking cadence is currently unflagged). Per-cell
verb menus; timezone in the toolbar; schedule modal takes Typefully's verb
set (next free slot · queue slot · best-time placeholder) with its
**confirm-carries-the-absolute-time** rule; the scheduled confirmation
carries Unschedule.

**Carries a known open item:** deferred item #2 (no cadence pre-check at the
queue producer) is a DESIGN problem — this sheet is where it gets solved, by
showing cadence pressure before the commit rather than failing terminally
after it.

**Open calls:** (a) empty-slots-as-doors (click an empty cell to schedule) —
a mock-time decision; (b) whether published rows stay on the calendar or move
to the ledger view.

## Sheet 3 — Create/Approve composer band

**Shape:** per-platform settings fields under the body in Buffer's grammar,
generated from the D3 schemas; the fit line is a **counter with refusal
reasons** (not a bare count); the preview card carries the Sprout-class
honesty caveat and REAL truncation points.

**Thalon-specific:** the judge gate is the moat and must be visible in the
band — the ratified doctrine is *"the judge gates — it never rewrites."* The
band shows what would block and why, before the operator spends a click.
Also carries the s70c discoverability gap: target terms / SEO coverage have
no visible home on the social path.

**Open calls:** (a) does the fit line show per-platform tabs or one stacked
column; (b) where the discoverability lens sits — beside the judge verdict or
its own strip.

## Sheet 4 — Integrations → Channels

**Shape:** cards gain `expired` / action-required (Klaviyo grammar) beside
the s70 states; `connectedAs` + `connectedAt` + `lastValidatedAt` on the
card; **disconnect confirm counts pending queue rows** (already shipped s83 —
the Mobbin finding nobody ships); the connect dance gets its own states.

**Now drawable from life:** LinkedIn's `needs_reauth`-near-expiry is REAL
(partner-gated refresh, s84), Instagram's "connected but posting-walled" is
REAL, and env-override is a real badge. This sheet should be drawn from the
live cards, not invented.

**Open calls:** (a) does a walled-but-connected platform (IG pre-assets) get
a distinct visual state or a capability note under a normal Connected card;
(b) per-platform arming — currently profile data, invisible on the card.

## Method for s85

1. Read both Mobbin memos' verdict tags — **do not re-derive**.
2. Author each sheet into `docs/research/mock-sheets/` in the established
   `.dc.html` form (theme.css, contract README), matching the 16 existing
   sheets' chrome exactly — this wave EXTENDS a built system, so drift is a
   defect, not a style choice.
3. Shoot each with `scripts/shoot-surface.mjs` (it refuses not-ready shots)
   and read the render before presenting.
4. Present all four with their OPEN CALLS named. **His verdict makes each
   sheet law; only then does any build lane open.**
