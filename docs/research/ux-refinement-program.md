# The UX refinement program — 3 passes over the workspace

> **Status: PASS 1 — the D4 four are DONE (Analytics s85b; Schedule · Composer ·
> Channels s86).** Next: the remaining verdicted sheets, then the VIDEO arc.
> This file is the memory of the program. It
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
approved."* That approves the DESIGN. It does not approve arming a publish path or
changing a product invariant. **The rail sweep was separately approved** on
2026-07-29 (*"you can run the sweep when you have time"*) and is DONE.

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
7. **A LANE NEVER RUNS ITS OWN MOBBIN PASS.** (Founder question, 2026-07-29:
   *"make sure those two lanes have mobbin mcp pass first, or is that redesign
   already part of the overall workspace redesign?"* — it is, and that is the
   point.) Design reference is CENTRALISED here; a lane doing its own would
   invent a dialect, and five lanes would invent five. A lane that needs a new
   control ships it **in its surface's existing sheet grammar** — the s82
   keeper-state precedent: *a keeper returns as a state behind the sheet's own
   chrome, the sheet stays law*. The surface then gets its proper pass in this
   programme, where the control is designed against real references alongside
   everything else on the screen. **A lane may never amend a sheet.**
   Corollary: backend-only lanes need no design input at all — say so plainly
   rather than performing a pass over a surface that does not exist.

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

**Tooltips — the answer to "less is more"** (founder: *"additional info can be hidden inside a tooltip or something, see how mobbin mcp does it"*)

Two distinct patterns, and we use both:
- **ⓘ on the label** — [Gorgias](https://mobbin.com/screens/e4248d94-917f-44e4-a0c3-4f76eea2e385) ("AGENTS ONLINE ⓘ", "Support Volume ⓘ"), [Medium](https://mobbin.com/screens/9084d2aa-ef18-4558-aae7-0c09b6e9c490) ("INTERNAL VIEWS ⓘ"), [Arcade](https://mobbin.com/screens/ffa76985-7fe5-4ae3-8a08-2337cae94c02) ("Performance ⓘ"). A small circled-i beside a metric label; the popover explains how the number is built.
- **Values-at-a-point on hover** — [WRITER](https://mobbin.com/screens/c5c263e9-1ca3-4423-8419-ff09d2b70b13), [Exa](https://mobbin.com/screens/8439f27d-0396-4236-96e2-ce595af04b98), [Visitors](https://mobbin.com/screens/2c4470d3-5888-4f3f-b204-7a2dde003c8b). Crosshair + a dot per series + a card listing each series' value at that x.

**THE RULE THIS GIVES US — write it on every sheet:**

> **Fact on the surface, rationale behind ⓘ.** A signal that changes what the
> operator does stays visible. The sentence explaining *why* collapses into a
> tooltip. **A tooltip is never the only home of something that changes a
> decision** — "partner-gated" stays in the cell; the paragraph about LinkedIn's
> partner programme does not.

Shared vocabulary now in `Analytics.dc.html`, reuse verbatim: `.info` (the glyph),
`.tip` / `.tip-h` (the popover), `.crosshair`. **Draw exactly ONE tooltip open per
sheet**, and never over the thing it explains — the first attempt opened two at once
and together they hid the whole chart. Anchor with `right:100%; margin-right:9px`
so it spills into the neighbouring column, which is what a real tooltip does.

**Postiz** (from `docs/research/s82-PREPLAN.md` §1b/§4 + `distribution-charter.md`; patterns only, AGPL)
- Their integration row stores `token/refresh/expiry/username/**avatar**` — connected channels render the **account's real profile picture**. *PENDING on Channels: our `.plat-ico` is a text initial.*
- Per-platform settings tabs + per-channel preview before scheduling, generated from **28 settings DTOs**. **Validates our Composer tabs**; the schemas are D3.
- ONE dynamic callback route serves all ~36 platforms. Already ours (s84 `callbackAs`).

## Pass 1 — per-surface status

| surface | sheet | status | what changed / what is queued |
|---|---|---|---|
| Analytics | `Analytics.dc.html` | **DONE (s85b)** + tooltips | Post rendered in-row (avatar + body + media thumb) · sparkline on every tile AND every row · 28-day reach/engagement area chart · icon metric heads · real platform marks · hour-box gains Avg/Days/Heatmap and stays reserved. Two layout defects found by reading the render and fixed: ~300px dead space under the table (→ 10 rows) and a right column clipping the fold (measured: last row bottom 919 ≤ 940). |
| Schedule | `Schedule.dc.html` | **DONE (s86)** | Media thumbnail in every post chip with the **platform as a badge ON the thumb** — so "Planned · LinkedIn" left the chip entirely (border says planned, badge says LinkedIn). Text-only post keeps the slot with an "Aa" mark: the ABSENCE of a picture is information. An engine RUN is not a post (clock mark, no picture, no platform). Legend compressed to "won't fire"/"will fire". **Founder asked mid-pass whether clicking a chip expands with a good thumbnail — it did NOT** (a text-only verb menu), so the click now opens a card that leads with the media at card width, anchored BELOW the chip. Two defects the render caught: `.info`/`.tip` CSS was never copied from Analytics (only its markup) so the tooltip spilled into the footer as body copy; and a 36px thumb truncated every excerpt in a ~147px column. Measured: expanded card 441→829 inside `.cal`'s 859 clip. |
| Composer | `Composer.dc.html` | **DONE (s86)** | Full-fidelity preview (HubSpot): media large instead of a 64px strip, hashtags in the platform's LINK colour, LinkedIn's own action row. Media control gains an icon toolbar; the band gains a **cover-frame picker** — the Postiz video-settings finding applied where it is TRUE (YouTube's title/thumbnail/made-for-kids and TikTok's privacy/duet/stitch belong on THEIR tabs; the ⓘ says so rather than drawing them under LinkedIn). **Fabricated-data defect found and cut**: the first draft showed "41 reactions · 6 comments · 2 reposts" on an UNPUBLISHED post — rule 5. Measured: the right column overflowed the fold by ~85px, putting the action row AND the caveat below it, i.e. the pass's whole point invisible; now ends at 911 inside the card's 916. |
| Channels | `Channels.dc.html` | **DONE (s86)** | CURRENT · 6 / NOT CONNECTED · 3 grouping (Rox), nine real brand marks replacing nine two-letter boxes, account avatars (Postiz), a live line per connected card, icon-only Validate/Open/Disconnect. Honesty held where a number was tempting: "nothing published yet" not 0; X reads "not measured — no vault row to attribute to". **A not-connected channel is an OFFER, not an identity** — it loses the account block and the "door disarmed" line (which restated its own pill), and that subtraction is what got the connect dance back above the fold (992 → 925 → **914**). **No tooltip on this sheet, deliberately** — every card note is already a fact, not a rationale, and there is no free region; forcing one would have covered a card to demonstrate a pattern the sheet does not need. |
| Rail sweep | all 15 with a rail | **DONE (2026-07-29)** | Calendar→Schedule + Analytics inserted. Rail-only match on the icon markup, so prose was never blind-replaced; `Profiles` cross-ref renamed by hand, `Calendar.dc.html` marked SUPERSEDED. Verified: 15 identical rails, zero rail overflow. |
| **Transcription** (`Library.dc.html`) | `Library.dc.html` | **queued — has a live dependency** | The s86 `transcription-free` lane adds an AI-enhance toggle beside Ingest. Per rule 7 it ships in the sheet's existing grammar, NOT a fresh design; this pass is where that control gets designed properly. **Also carries a naming drift like Calendar/Schedule: the sheet's `data-screen-label` still says "Library" while the app calls the surface Transcription.** |
| The other verdicted sheets | — | **not started** | Pass 1 only after the D4 four land; they are law until amended, so each change needs a stated reason. |

### The VIDEO arc — its own 3 passes (founder ask, 2026-07-29)

> *"run the video / video feature / video dashboard / video editor pass the postiz
> and mobbin mcp 3 times as well? i feel like the ux/ui and flow and visual of it
> can be improved significantly, as well as the engine (see how postiz creates and
> edits videos)"*

**This is the biggest single surface area in the workspace and it gets its own
track**, because it is four sheets plus an engine, not one surface:

| piece | sheet / code | why it is here |
|---|---|---|
| Videos Overview | `Videos Overview.dc.html` | the list |
| Video Dossier | `Video Dossier.dc.html` | the project page |
| Video editor | `Videos.dc.html` (carries `data-screen-label="Video editor"`) | the 15th surface |
| The engine | `packages/engine` video/render/EDL + `components/videos/editor*.tsx` (~1,900 lines) | **the founder named the ENGINE explicitly, not just the UI** |

**Start from what is already known — do NOT re-audit from zero.** Two prior passes
exist and their findings are still the baseline:
- `docs/research/video-editor-audit-s78.md` — 36 confirmed findings, and the JOBS
  table (of 27 jobs an operator would try: 8 worked, 4 dead doors, 15 no affordance).
- s80/s81 moved it to **21 works · 0 dead doors · 5 no-affordance**, and the render
  gate against `Videos.dc.html` from 38 drifted → 30 drifted / 9 within tolerance.
- **5 jobs still have no affordance**, and 4 are one theme: compare two versions ·
  save as a named variant · delete a version · check on a render after coming back.
  The 5th is auditioning a take before swapping it.

**The engine half — VERIFIED against their live API docs, 2026-07-29.** Postiz has
**no video editor at all**: no timeline, no clip editing, no AI video generation,
no Reels/Shorts-specific handling. It is a scheduler that posts a finished video.
So "see how postiz creates and edits videos" cannot be answered by imitating an
editor they do not have — **say that plainly in the memo instead of inventing one.**

What they DO have is worth taking, and it is the *pipeline seam*, not the craft:
**per-platform video settings as declared schema.** Their YouTube destination
carries `title` · `thumbnail` · `tags` · `type` · `selfDeclaredMadeForKids`;
TikTok carries `privacy_level` · `duet` · `stitch` · `comment` · `autoAddMusic` ·
`brand_content_toggle`. That is exactly the shape the **Composer band** needs for a
video destination, and it is the same D3 settings-schema idea we already took for
text. **Concrete take: when Composer's pass runs, its per-platform band must have a
VIDEO variant** — a cover/thumbnail control, a title distinct from the body, and
the platform's own toggles — not just the character-fit line that suits text.

For the editor craft itself the reference set is elsewhere. **Seeded 2026-07-29:**

- [VEED · editor](https://mobbin.com/screens/98e80276-8843-4be7-af26-54759c2d7a98) — the closest structural match. Left icon rail (Media/Audio/Subtitles/Text/Elements/Transitions), player centre, **multi-track timeline colour-coded BY KIND** (video strip · Sound Wave · Subtitles · Voiceover · Image). Our editor has three plain blocks; this is the shape it should grow into.
- [VEED · clip inspector](https://mobbin.com/screens/2717375a-b274-473b-970c-431596003769) — the selected clip's properties: Animations/Adjust, Speed (0.5–2× + Custom), volume, Fade Audio In/Out, then named "Magic Tools" each carrying a **credit badge**. That badge pattern matters for us: our copilot actions spend real metered calls, and a cost marker at the control is how an operator learns that before clicking, not after.
- [Vimeo · editor](https://mobbin.com/screens/ef13a0bc-33a7-4740-90e3-e8f30b37cf54) + [presets](https://mobbin.com/screens/e2a78459-d055-482a-a3af-e24006b6f0ce) — timeline clips carry **frame thumbnails**; stock tiles carry duration badges; a minimal Split/Delete toolbar over the playhead.
- **[Descript](https://mobbin.com/screens/edc52e73-c7dc-4275-b272-6de067e1e301) — THE IMPORTANT ONE, and it is a paradigm, not a widget.** Descript edits video **by editing its transcript**: the script is the primary surface, the timeline is secondary. **This maps onto Thalon better than any timeline reference does**, because our videos are GENERATED FROM BEATS — the beat text already is the script, and the render already follows it. An operator retiming a generated video by dragging pixels is fighting the model; editing the beat and re-rendering is the model. **Evaluate script-first as the editor's primary mode in pass 2**, with the timeline kept for the things text cannot express (music, exact cuts).

**Every reference above puts frame thumbnails on its timeline clips. Ours are plain
blocks — that is the first visual fix, and it is the same "thumbnails everywhere"
note the founder has now made three times.**

**Pass plan (same three lenses, video-scoped):**
1. **Surface** — visual density and the render gate. The known drift is 30 rows;
   the s80 finding was that most of it was ONE defect (the copilot band's 19px).
2. **Flow** — Intel → Create → dossier → editor → Approve → Schedule. Where does a
   video actually enter the publishing loop, and where does that path break?
3. **State & button** — finish the 5 no-affordance jobs, and every control's
   refused/empty/loading state.

**Status: NOT STARTED.** Queued behind the D4 pass-1 sheets (Schedule, Composer,
Channels), because those are half-done and leaving them half-done is worse.

## Open decisions (founder's, NOT closed by the blanket design approval)

1. ~~Calendar → Schedule rename + Analytics joining the rail.~~ **RATIFIED and
   SWEPT 2026-07-29.** 15 sheets done. **Still open, and it is the app half:** the
   shipped surface is still `/app/calendar` with a "Calendar" rail item, so the
   product and the spec now disagree until the rebuild lands. That is a BUILD task,
   not a design one — it needs its own go.
2. The four per-sheet OPEN CALLS in each sheet's own header remain open.
3. **Intel's live-vs-mock gap** (found 2026-07-29, and it is a product question,
   not a design one): on real Bluesky-only data, Velocity and Engagement are dark
   (no view counts) and nothing can reach "Hot", so live Intel reads far weaker
   than its sheet. Lighting those signals needs a second source in the live sweep
   (YouTube). Recorded here because a design pass cannot fix it.

## The working loop (repeat per surface)

1. Search Mobbin for that surface's pattern; add the citation to the library above.
2. Edit the sheet in `docs/research/mock-sheets/` (one file, both heads).
   **Reusing the shared vocabulary means copying its CSS, not just its markup.**
   `.info` / `.tip` / `.tip-h` live in `Analytics.dc.html`'s own `<style>`, not in
   `theme.css` — s86 pasted the ⓘ markup into `Schedule.dc.html` without the block
   and the tooltip rendered as raw body copy that wrecked the footer. Same trap for
   any class a sibling sheet defines locally.
3. `node scripts/shoot-surface.mjs --sheet <Name>.dc.html --mode dark`
4. **READ the render.** Then MEASURE anything you suspect — a probe beats a squint
   (`.getBoundingClientRect().bottom` vs the 940 screen height caught a real clip
   that "looks fine" would have shipped). **s86 made this the rule, not the advice:
   all three sheets overflowed the fold on their first cut** (Schedule's expanded
   card lost its Unschedule row; Composer put the action row AND the honesty caveat
   below 940, i.e. the pass's own point was invisible; Channels pushed the whole
   connect-dance section off). None of the three looked wrong in the render — the
   content simply stopped, which reads as "that is where it ends".
   **When a sheet will not fit, cut STRUCTURE before you cut padding.** Channels
   went 992 → 925 on copy compression alone and still did not fit; what landed it
   at 914 was realising a not-connected channel is an OFFER, not an identity, and
   deleting a block that had nothing true to say.
   A one-off probe script must live in the repo root to resolve `puppeteer` (the
   scratchpad cannot), so delete it before committing.
5. Upload to the canvas: `finalize_plan` → `write_files` on project
   `f5d304cb-cd0e-484d-8542-7b6561e1ef30`.
6. Update this file's status table, then commit.
