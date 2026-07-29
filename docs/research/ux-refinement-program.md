# The UX refinement program — 3 passes over the workspace

> **Status: PASS 1 in progress.** This file is the memory of the program. It
> survives session boundaries; chat does not. Anything decided here is decided.
> Update the per-surface tables as you go — a finding with no row here is a
> finding that will be rediscovered.

## The mandate (founder, 2026-07-29, verbatim intent)

> "do 3 passes of the workspace using postiz and mobbin mcp for each feature and
> section and each button, and look for improvements you can make to the UX/UI,
> flow, onboarding, creation, posting, state, etc. can use claude design for the
> mock up but definitely record how you want to build it so you dont forget
> between sessions."

Plus two standing steers from the same day:

- **"use visual stuff (thumbnails, graphs, images) as much as possible"**
- **"less is more, but still with the same effect"** — these two are in tension
  on purpose. The resolution used throughout: **more visual, fewer words.** A
  chart or a thumbnail earns its space; a sentence explaining the chart usually
  does not. Every honesty signal survives the cut, in fewer words.

**Approval on record:** *"whatever refined version you put up this version, it is
approved."* That approves the DESIGN. It does not approve arming a publish path,
changing a product invariant, or a 16-sheet rename sweep (see Open decisions).

## Rules this program inherits (do not relitigate)

1. **Design is lead-direct.** No lane, no subagent authors a sheet. (Founder:
   *"i want you responsible for the exact claude-design mock implementation."*)
2. **The repo is the spec of record** — `docs/research/mock-sheets/`. The canvas
   is the viewing surface. Keep them byte-identical: one file, whose `<head>`
   carries BOTH `theme.css` (local shooting) and `support.js` (canvas). Proven
   on `Source Media.dc.html` and now the D4 four.
3. **Shoot and READ before presenting.** `node scripts/shoot-surface.mjs --sheet
   <Name>.dc.html --mode dark`. The viewport is parsed from `theme.css`'s
   `.screen` rule (**1440×940** — not 900; a 900px shot invents false clipping).
4. **Drift from the verdicted sheets is a defect, not a style choice.** This wave
   EXTENDS a built system. Same chrome, same `theme.css`, same rail.
5. **Honesty beats polish, every time.** A platform we cannot measure says so in
   words. Never a 0 that reads real, never a fabricated curve, never a flat line
   at zero (it reads as "measured, and it was nothing" — use no line at all).
6. **Postiz is AGPL.** Study its patterns as facts; never copy its code.

## The three passes

| pass | question it answers | output |
|---|---|---|
| **1 — Surface** | Does each surface show the right things, and does it look like a product? Visual density, hierarchy, graphs, thumbnails. | Refined sheets |
| **2 — Flow** | Can an operator get from intent to done? Onboarding, creation, posting, the joins BETWEEN surfaces, dead ends. | Flow map + sheet amendments |
| **3 — State & button** | Every control, every state: empty, loading, partial, refused, error, success. What does each button do, and what does it say when it cannot? | State matrix + sheet amendments |

Pass 1 is per-surface and parallelisable. Passes 2 and 3 are cross-cutting and
should run only after pass 1 has settled the surfaces they walk.

## Reference library (built 2026-07-29, Mobbin MCP + the repo's Postiz digs)

Cite these rather than re-searching. Each entry is the PATTERN worth taking.

**Analytics**
- [Sprout Social · Post Performance](https://mobbin.com/screens/0a753d8c-c569-4943-98a7-7e8fea4afcf5) — the post renders INSIDE the table row (avatar + body + media). You recognise a post by its picture long before its title. **TAKEN.**
- [Sprout Social · card view](https://mobbin.com/screens/128207d8-a06c-4e30-8b1e-b3f138ff2385) — the Cards alternative to the table; metric list under a media card. *Reference for the Cards seg option, not yet drawn.*
- [Typefully · engagement by hour](https://mobbin.com/screens/10423d95-119f-43f3-b6dd-47a20486e715) — area chart + **Avg / Days / Heatmap** seg + timezone chip; icon column heads on the tweet table. **TAKEN** (seg + icon heads; the chart stays reserved until D2).
- [Sprout Social · Listening](https://mobbin.com/screens/d979824e-201d-4b75-9170-c2928144d30c) — per-network table with platform icons per row. **TAKEN** (real platform marks).

**Schedule**
- [Later · calendar week](https://mobbin.com/screens/85de220d-a33e-4850-b9b9-00b73f91fa52) — **media thumbnails inside the time-grid cells.** The single biggest visual win available to this surface. *PENDING.*
- [Sprout Social · month](https://mobbin.com/screens/31ee54e5-18dc-407a-b01d-f7db20d388f7) — event = platform icon + time + excerpt + tag chip + action icons. *PENDING.*
- [monday.com · content calendar](https://mobbin.com/screens/0a728fda-2e33-44f3-97c1-8243b526f429) — legends by PLATFORM colour. **REJECTED**: our legend names the three FACTS (planned/queued/published), which is the sheet's organizing idea. Platform identity rides the glyph instead.

**Composer**
- [HubSpot · create social post](https://mobbin.com/screens/051f4daf-cf58-414f-9dec-1738c2ce045d) — preview at full fidelity: media large, hashtags in link colour, the platform's own action row. Media control = thumbnail + icon toolbar (crop/alt/remove). *PENDING.*
- [Sprout Social · new post](https://mobbin.com/screens/bd123fd1-a666-4d84-937d-d51174ff1ebb) — "Network Preview", collapsible per network, with the honesty caveat *"Preview approximates how your content will display."* **Validates ours** — two independent products ship the same caveat.

**Channels**
- [Rox · integrations](https://mobbin.com/screens/2820d9c1-11bc-4134-9274-87035d73da60) — **CURRENT / NOT CONNECTED grouping**, connected cards carry a live activity line ("0 emails processed, last synced 2 min ago") and icon-only actions. *PENDING — this is the biggest Channels win.*
- [Chatbase](https://mobbin.com/screens/9d24c903-7050-4e16-b34e-71da42107d2c) / [Notion](https://mobbin.com/screens/842d8ae9-059c-4ff3-8ca3-36428dc831eb) — every card leads with a real brand mark, never a text initial. **TAKEN on Analytics; PENDING on Channels.**

**Postiz** (from `docs/research/s82-PREPLAN.md` §1b/§4 + `distribution-charter.md`; patterns only, AGPL)
- Their integration row stores `token/refresh/expiry/username/**avatar**` — connected channels render the **account's real profile picture**. *PENDING on Channels: our `.plat-ico` is a text initial.*
- Per-platform settings tabs + per-channel preview before scheduling, generated from **28 settings DTOs**. **Validates our Composer tabs**; the schemas are D3.
- ONE dynamic callback route serves all ~36 platforms. Already ours (s84 `callbackAs`).

## Pass 1 — per-surface status

| surface | sheet | status | what changed / what is queued |
|---|---|---|---|
| Analytics | `Analytics.dc.html` | **DONE (s85b)** | Post rendered in-row (avatar + body + media thumb) · sparkline on every tile AND every row · 28-day reach/engagement area chart · icon metric heads · real platform marks · hour-box gains Avg/Days/Heatmap and stays reserved. Two layout defects found by reading the render and fixed: ~300px dead space under the table (→ 10 rows) and a right column clipping the fold (measured: last row bottom 919 ≤ 940). |
| Schedule | `Schedule.dc.html` | **queued** | Media thumbnails in event chips (Later) · platform glyph per event · keep the three-fact legend. |
| Composer | `Composer.dc.html` | **queued** | Full-fidelity preview (large media, coloured hashtags, platform action row) · media control with icon toolbar · keep the caveat. |
| Channels | `Channels.dc.html` | **queued** | CURRENT / NOT CONNECTED grouping (Rox) · real brand marks + **account avatars** (Postiz) · activity line per connected card · icon-only actions. |
| The 16 verdicted sheets | — | **not started** | Pass 1 only after the D4 four land; they are law until amended, so each change needs a stated reason. |

## Open decisions (founder's, NOT closed by the blanket design approval)

1. **Calendar → Schedule rename + Analytics joining the rail.** All four D4 sheets
   draw the rail this way. The 16 verdicted sheets still say "Calendar". The
   approval covers the sheets as drawn; it does not obviously authorise a
   16-sheet + app-wide sweep. **Ask before sweeping.**
2. The four per-sheet OPEN CALLS in each sheet's own header remain open.
3. **Intel's live-vs-mock gap** (found 2026-07-29, and it is a product question,
   not a design one): on real Bluesky-only data, Velocity and Engagement are dark
   (no view counts) and nothing can reach "Hot", so live Intel reads far weaker
   than its sheet. Lighting those signals needs a second source in the live sweep
   (YouTube). Recorded here because a design pass cannot fix it.

## The working loop (repeat per surface)

1. Search Mobbin for that surface's pattern; add the citation to the library above.
2. Edit the sheet in `docs/research/mock-sheets/` (one file, both heads).
3. `node scripts/shoot-surface.mjs --sheet <Name>.dc.html --mode dark`
4. **READ the render.** Then MEASURE anything you suspect — a probe beats a squint
   (`.getBoundingClientRect().bottom` vs the 940 screen height caught a real clip
   that "looks fine" would have shipped).
5. Upload to the canvas: `finalize_plan` → `write_files` on project
   `f5d304cb-cd0e-484d-8542-7b6561e1ef30`.
6. Update this file's status table, then commit.
