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

**THE DEFINITION OF DONE (founder ruling, 2026-07-29 s87 — this outranks every
status word below):**

> *"So now you have examples of how top design is done by the best companies, why
> not change and use their design on everything, every feature, every button then?
> why do you think im telling you to do a postiz and mobbin pass on everything.
> if a surface hasnt been touched by the postiz or mobbin-mcp research, then i
> dont consider it finished or ready."*

Consequences, so nobody re-derives them softer:

1. **"Functional" is not a finish line.** A surface can work end to end — zero
   dead doors, every test green — and still be UNFINISHED if the research pass
   has not touched it. The lead claimed exactly this about the video editor's
   ve4 frontend at s87 and was corrected; that mistake is why this block exists.
2. **The unit of coverage is every feature and every button, not "the screens".**
   A pass that walks a surface but skips a control has not finished the surface.
3. **The coverage ledger below is the record.** A surface not in the ledger, or
   in it without a research-pass mark, is by his definition NOT READY — whatever
   its code status. "Not started" rows are debts with names, never a bucket.
4. Postiz = patterns only (AGPL, rule 6); Mobbin = the visual record. Both count
   as "the research"; a surface needs whichever of the two has something to say,
   and the reference library above records what was TAKEN and what was REJECTED
   — a REJECTED pattern with a stated reason still counts as touched. Silence
   does not.

Plus two standing steers from the same day:

- **"use visual stuff (thumbnails, graphs, images) as much as possible"**
- **"less is more, but still with the same effect"** — these two are in tension
  on purpose. The resolution used throughout: **more visual, fewer words.** A
  chart or a thumbnail earns its space; a sentence explaining the chart usually
  does not. Every honesty signal survives the cut, in fewer words.
- **THE MINIMAL-INTERACTION DOCTRINE (founder, s90, verbatim):** *"simplicity
  is key, and you want all the interactables available to the user without
  overwhelming them so they only have to interact minimally to get the complex
  job (you, engine, under the hood magic) done"* — things that don't require
  the operator's input *"can be tucked or hidden away a bit, since those are
  just extra info."* Operationally: **interactables forward; information one
  click behind a quiet line; one action launches the complex job.** Applied
  s90b to Create home (the ask-card redraw) · Create wizard (artifact tucked)
  · Composer (judge strip, settings tail, fit band in words). Every honesty
  fact that changes a decision STAYS visible — this doctrine tucks rationale
  and status anatomy, never the facts themselves.

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

## The `impeccable` waiver — SCOPED, and it expires

**Founder ruling, 2026-07-29 (s86):** *"since our designs and layout are based on
mobbin.mcp, you can relax the impeccable rule a bit until the final pass, for
consistencies and stuff and landing pages."*

`docs/research/mock-sheets/**` is in `.impeccable/config.json`'s `ignoreFiles`. The
reason: the hook grades against `.impeccable/design.json`, while the sheets are their own
design system (`theme.css`) with a deliberately denser ramp for 1440×940 workspace
screens — and rule 4 below makes matching the existing sheet's ramp **mandatory**, so the
hook and the programme were issuing opposite orders on the same line.

**What the waiver does NOT cover, deliberately:** `apps/web/**` and any landing/marketing
page. Those are the shipped product and the public surface, and that is exactly where he
kept the rule live.

> **RE-ARM TRIGGER — do not let this rot.** The waiver is *until the final pass*. When
> pass 3 closes on a surface and its sheet stops changing, that sheet's tokens are no
> longer a moving target: run `/impeccable audit` over the sheets, reconcile the ramp
> into `design.json` (the sheets are the spec of record, so the design system should
> learn from them, not the reverse), then **remove the ignore entry**. Whoever runs the
> final pass owns this; it is listed here because a waiver with no expiry is just drift
> with paperwork.

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
- **W1 walk (s89, docs + web):** their HOME is the calendar itself — one centralized calendar, all channels. **REJECTED as our Dashboard model**: Schedule owns the calendar; our Dashboard's job is triage (needs-you → act), which their home simply does not do. Their **approvals exist but as an agency permission gate** (role-based, client-reviews-before-publish, inside the post lifecycle) — **REJECTED as a model for Approve**: our gate is a first-class surface because judge verdicts + eval rows make each decision a RECORD, not a permission check. Their **notifications are real but thin**: an org-scoped paginated list (`GET /public-api/notifications`) — a flow fact for gap §5.6, not a UI to imitate. No run-history surface documented at all — n/a, stated.

**Approve (W1, s89)**
- [Reddit · mod queue](https://mobbin.com/screens/1caf9bf6-61a5-4cc2-b63f-705d756973f5) — queue tabs named by STATE (Needs Review / Reported / Removed / Edited / Unmoderated), per-item Approve/Remove + secondary verbs, a reason chip ON the item ("This is spam"), "1 action successful" toast. **TAKEN**: state-named tabs + the judge's reason as a chip on the card + the action toast.
- [Sprout Social · Needs Approval](https://mobbin.com/screens/acaff017-f7dd-4611-8163-428b099a22d9) — the post renders at FULL fidelity in the queue (avatar + handle + body + media), workflow-step chip on the card, filter bar (My approvals / Workflows / Tags / Authors / Post types), sort oldest-first. **TAKEN**: full-fidelity post card (the same in-row-post idea Analytics already took) + the step chip becomes our judge-verdict chip.
- [Deel · Action required](https://mobbin.com/screens/ebede796-0ca0-408a-bf05-630420732e1f) — bulk verbs CARRY THE COUNT ("Approve all your pending (71)"), per-row ✓/✗ quick verdicts, nav badge. **TAKEN**: batch-by-run verbs state their count; a bulk verb that hides its blast radius is a dead-door cousin.
- [Klaviyo · review detail](https://mobbin.com/screens/fe6a4a63-ed41-4e2e-95a8-5bd2332551a3) — Reject is a dropdown carrying guidance ("only reject with a valid reason"). **TAKEN**: reject asks for a reason — for us that reason is an `eval_cases` row, so the control that collects it IS the learn loop's front door.
- [Plain · support triage](https://mobbin.com/screens/729a1556-d706-4943-aefa-1cc648ce320c) — **the keyboard grammar, drawn**: every verb carries its key INLINE on the control ("Reply R", "Add note N", "Wait for Customer W", "Done E"), plus an event timeline on the thread. **TAKEN — this VALIDATES the DESIGN.md j/k grammar** and sharpens it: keys live on the buttons, not in a help overlay.
- [Front · inbox](https://mobbin.com/screens/ca886cf9-1312-40e6-a0bc-e7a20dc8973c) — list→detail split; events (assigned / archived / reopened) ride inline in the thread. *Reference for the detail rail's verdict + edit history.*

**Dashboard + Board (W1, s89)**
- [Jira · space Summary](https://mobbin.com/screens/6d79381a-e824-465c-86d6-bea59049ccf5) — **the structural match.** Count tiles carry TIME WINDOWS ("2 updated *in the last 7 days*", "0 due soon *in the next 7 days*"), a status donut, a Recent-activity feed whose items carry state chips (APPROVED / IN DESIGN) — and **Summary · List · Board · Calendar are TABS of one space**, which is our Board-as-a-Dashboard-toggle ruling already drawn by someone else. **TAKEN** (tiles-with-windows · activity-with-state-chips · the toggle precedent).
- [Gorgias · Live overview](https://mobbin.com/screens/8d140229-3dec-4e38-aa2c-b16f18419001) — the needs-you strip: labeled count tiles with ⓘ, a "Today" header, live volume chart. **TAKEN**: the strip; also revalidates our `.info` vocabulary.
- [HubSpot · Help Desk summary](https://mobbin.com/screens/49fb345d-b6f3-4145-833a-9b2e111e7e1f) — empty-state cards with one illustration + ONE named CTA ("Connect a channel"). **TAKEN** for first-run states (see Onboarding below).
- [ClickUp · dashboard AI digest](https://mobbin.com/screens/2802e4dc-5a33-4b61-b556-7008bffeeb2f) — "Key Decisions and Updates" + "Who did what" as a machine-written summary block. *Reference for "what changed since I left" (gap §5.6) — noted, not drawn.*

**Runs (W1, s89)**
- [Vercel · Deployments](https://mobbin.com/screens/b9d9cc23-34a1-434c-a4ed-52a2a4f49bb7) — the row grammar: status dot + word + DURATION together ("● Ready 16s" / "● Error 19s"), env + Current pill, commit line, age + author; a status MULTI-FILTER (Ready/Error/Building/Queued/…); Rolled Back badge. **TAKEN**: status-with-duration + the filter.
- [Cursor · automation Run History](https://mobbin.com/screens/8a1c7ab7-54f3-4284-bb15-b929555ef3da) — window tiles (Last 1h / 24h / 7d success counts) above a Trigger · Triggered · Tools · Status · Duration table, per-row Cancel. **TAKEN — this is the `create_runs` table shape**: our Trigger = the prompt/family, Tools = the shells it ran.
- [Cloudflare · Workers deployments](https://mobbin.com/screens/2dfb1cd3-26ac-4e63-9866-f293a0306177) — an ACTIVE-deployment band sits above Version History. **TAKEN**: running-now band above the history list.
- [PlanetScale · deploy requests](https://mobbin.com/screens/be0ec4c5-4a49-4f4a-8a29-179143a514c5) — a queue-state banner that NAMES ITS REASON ("queue is paused while a deployment is in a revertible state"). *Reference: our honesty banners already speak this register.*
- [Clay · usage history](https://mobbin.com/screens/8b5ce126-379a-4dbc-86dd-a98eed54d93a) — cost grouped by WHAT SPENT IT (per-verb rows: count · avg cost · credits) with a TOTAL row. **TAKEN**: the run detail's cost roll-up ends in a total, per `usage_ledger`.
- [ElevenLabs · generation history](https://mobbin.com/screens/070f4b10-fa79-43a7-94c6-4ff005a0940e) — day-grouped history WITH OUTPUT THUMBNAILS, model/aspect/duration chips per generation. **TAKEN**: a run that produced media shows its thumbs on the row — the founder's thumbnails-everywhere note applied to Runs.
- [Hume · chat history](https://mobbin.com/screens/0fc3643f-ecb6-435b-8146-680f7480ff64) — run rows carry EVALUATION chips beside status. **TAKEN**: judge outcome rides the run row as a chip (blocked/passed counts), not buried in detail.
- [Runway · credit table](https://mobbin.com/screens/850f0ad4-96f6-4368-865f-7657acabd025) — balance before/after per row. **REJECTED for the surface**: that is a billing ledger's honesty, not a run list's; our per-run cost + total covers the operator's actual question.

**Create home — the s90b minimal-interaction sweep (founder: "look at a lot of best design example features for flow, ease of use … the current look of Create is still a bit intimidating")**
- Eight best-in-class homes swept, and the pattern is UNANIMOUS — [ChatGPT](https://mobbin.com/screens/efb593c5-be61-47d5-a2bd-87aab6056cd2) · [Microsoft Copilot](https://mobbin.com/screens/b5513383-3d9f-4c67-9793-9af0b394025f) · [Notion AI](https://mobbin.com/screens/176a7fae-1de4-4d50-a28b-cb14eef8b18b) · [WRITER](https://mobbin.com/screens/7350cb39-b86a-4a18-8c75-86367e890783) · [Manus](https://mobbin.com/screens/156621d5-5d04-427e-acd0-a20be1c8d1ca) · [Langdock](https://mobbin.com/screens/27e62d7b-3e23-49ef-96ed-4cdc9079d095) · [Lindy](https://mobbin.com/screens/1469c839-23d1-48ae-bce5-651fa30e5a34) · [Obvious](https://mobbin.com/screens/17b7482f-2f1f-4198-85cd-c059a89890cb): **one warm headline question · ONE centered prompt card whose controls live INSIDE its own bottom row · suggestion chips beneath · NOTHING else at rest** (recents live in a sidebar or far below a break). **TAKEN wholesale** — Obvious is the closest structural match (a workspace product: ask + kind chips + recents pushed down).
- What it displaced on our sheet: the per-surface h1 (the rail + topbar already orient; the question replaces the label — the 8-product take) · the plan card (→ ONE collapsed run-line, expanded state = git history/pass 3) · the Latest-runs card (→ ONE quiet foot line; the W1 "stays on Create home" decision honored at minimum surface).

**Pipeline board — the Dashboard toggle's Board state (s90 founder ask: "an overall visual representation on how things are connected and flow"; ruled into the s91 draw)**
- [HubSpot · Deals board](https://mobbin.com/screens/35b26dbf-8d2b-4f6c-a789-738b02d927b1) — every stage column head carries its COUNT, and every column FOOT carries a per-stage roll-up (Total / Weighted) — the funnel math lives IN the board. **TAKEN as the grammar**: our columns get live counts on the head and the day's in/out on the foot.
- [folk · recruitment pipeline](https://mobbin.com/screens/30e4db23-d229-42c9-8122-57fbcdc65205) / [Twenty](https://mobbin.com/screens/b4ca148d-0555-4928-877c-8f2ee3115856) / [Attio](https://mobbin.com/screens/a2b97705-be0b-44a3-84ec-522316c873bf) — stage-colored column heads with counts; grouped-by-stage IS the flow reading. **Validates the core finding: nobody in the reference set draws arrows — the board itself is the flow, left→right.**
- **Node-graph canvas (n8n/Zapier genre) — REJECTED with reason:** that grammar means *editable wiring*; our loop is linear with ONE human gate, and a graph editor would promise re-plumbing the pipeline, which is not a product truth. Recorded so it isn't re-proposed.
- **The drawn shape (s91):** columns in loop order — Intel picks → Generating → At the judge → In Approve → Scheduled → Published — heads carry live counts, feet carry the day's in/out, cards keep their judge/state chips; home = `Board.dc.html` per its own retirement note (it becomes the Dashboard toggle's Board state). His verdict arrives by text (hands-free week). **DRAWN s91:** feet aligned as one funnel-math row (columns stretch full height — the HubSpot take made literal); In Approve keeps the warn tint (the one human gate, said in the header line); ✓/✗ judge rides every Approve card, the blocked card's reason verbatim; the Generating foot's 5-in against Intel's 2-out left TRUE on purpose (fan-out multiplies one pick into drafts — the board teaches it); measured 916 ≤ 940, zero spills, zero clipped text. **VERDICTED same day (his text: "board approved") — the Dashboard build wires the toggle to it and the `/app/board` route deletes in the same change (s92).**

**Sites (W2, s90)**
- [Lovable · projects](https://mobbin.com/screens/114dc619-8f00-4816-bed1-e861558c122b) — the state badge rides ON the preview thumbnail ("Published", top-left), cards carry edited-ago meta, and the toolbar is a real status/visibility filter set. **TAKEN**: badge-on-the-shot (you read a gallery by its pictures, so the state belongs on the picture) + the status filter as our seg + per-card age meta.
- [Squarespace · dashboard](https://mobbin.com/screens/3e8db334-1f8e-4d5c-a055-c50bfd4288f9) — every site row leads with its own DOMAIN under the name; the card states its billing/expiry truth in words. **TAKEN**: a live site's hostname IS its card fact (drafts say "previews only" — never a placeholder URL that reads real).
- [Webflow · CMS list](https://mobbin.com/screens/6a47ce90-a40e-461b-97e5-f866e73cf254) — "Staged for Publish" as a distinct state word between draft and published. *Reference only — our page family has no staging tier; noted for the day publish-to-own-site arms.*

**Library (W2, s90 — the §5.3 ONE-Library ruling drawn)**
- [ElevenLabs · Knowledge Base](https://mobbin.com/screens/67e87818-fd79-43a6-a0e3-cc6d795f7478) — ingest KINDS as entry doors (Add URL · Add Files · Create Text · Create Folder) above ONE list with `+Type` filter chips, plus a storage-honesty chip. **TAKEN as the ruling's drawn shape**: kind is an ingest door and a filter — never a route; our one-box ingest band names every kind it takes.
- [Relevance AI · Knowledge](https://mobbin.com/screens/e6486eeb-75f6-4cd8-8244-408d4fe49ed7) — rows carry LIVE state chips (Processing · Uploading) in the same list as finished sources; the upload zone names its supported formats. **TAKEN**: a source mid-transcription is a row STATE ("Transcribing · ~3m left"), not an absence — transcription visibly IS an ingest kind, which is the §5.3 ruling made legible.
- [Chatbase · data sources](https://mobbin.com/screens/493fb3e6-8ee3-408e-9897-c04824012c8c) — a by-kind roll-up rail (2 Files · 2 Text · 1 Link with sizes) and a "retraining required" honesty banner. **TAKEN (the roll-up)** as the qtab counts; the banner pattern is n/a — our chunks embed at ingest, nothing goes stale silently.
- [Mistral · Files](https://mobbin.com/screens/5046fb14-6216-4ac2-9fc1-6637e6563d30) — Type/Source as dropdown filters over one table. *Validates the filter-not-route IA; nothing further taken.*

**Postiz launcher — the W2 flow-facts walk (s90; API contract as the flow of record, docs.postiz.com)**
- Their create contract: `type` (now/schedule/draft) + `date` + `posts[]`, each item = one integration id + its `value[]` (content + media) + a per-platform `settings` object discriminated by `__type`. **Content is per-integration BUNDLES from the start — REJECTED as our Composer model**: no master, no divergence tracking, no way back; our master+forks-with-provenance ("re-derive from master") is deliberately richer and stays.
- Their pre-validation endpoint (`integration-settings`: `maxLength` + `rules` text + a settings JSON schema + provider `tools`) — clients validate BEFORE creating. **VALIDATES ours twice over**: R3 (capability surfaced pre-generation — the wizard's platform chips) and the D3 settings-as-schema slice. Two products, same conclusion.
- **Failure surfaces: UNDOCUMENTED** — their public contract has no multi-platform partial-failure story at all. The standing question closes with: our create spec's Error Behavior (partial run state, per-tab verbatim refusal) stands alone; nothing to take.
- `find-slot` (next open slot per channel) — a Schedule flow fact, noted for its pass. Draft→schedule status flips exist but are a status change, not a human gate — our Approve separation is structural, theirs is not.

**Onboarding + Notifications — the two W1 research questions (s89; answers, not surfaces)**
- [Hex · home with setup band](https://mobbin.com/screens/1316cdc2-0371-4ee7-b75e-63894c17ce75) — "**Set up your workspace · 2 of 4 complete**" checklist band ON the home (Connect data → Create project → Invite team → Customize), each step expanding inline, sitting ABOVE "Jump back in". **TAKEN as the onboarding ANSWER**: a dismissible setup band on Dashboard + per-surface empty states with the same steps (HubSpot above). No route, no wizard — exactly the spec's "thin guided state over existing surfaces".
- [Steep · demo-data banner](https://mobbin.com/screens/d9f49fbc-87c3-4e69-a96c-c5b7cc317acf) — "You are using demo data. Continue setup to connect your own." **TAKEN**: our demo/self tenant states itself the same way.
- Grain's connect step ships an explicit **"Skip Connection"** — a first-run step you cannot skip is a wall, not a guide. **TAKEN** as a rule for the band's steps.
- [Asana · Inbox](https://mobbin.com/screens/ec4d0343-84cd-4faa-939a-e67070294db4) — **the notification MODEL**: bundled-by-reason groups ("Your overdue tasks from the past week"), day-grouped, an AI "Inbox Summary" offer, a "Manage notifications" door. [ClickUp · Inbox](https://mobbin.com/screens/bc8a4bb6-6f82-4001-a0d4-4ffa237149fd) adds triage buckets (Primary / Other / Later / Cleared) and overdue-age honesty ("due date was 2 days ago"). **RECORDED as the answer to gap §5.6, not drawn**: no alert center exists until real signals exist; the Dashboard needs-you strip + activity feed carry the job for now, and the ruling ("research decides the shape") is satisfied — the shape is bundled-by-reason, and it waits for its wave.

### The s93 re-check (2026-08-02) — built-surface validation sweep

Founder directive s93: *"Continue to use mobbin-mcp to re-check and adjust any
UX/UI as needed to ensure that the surfaces that you made are indeed world class
design."* Fresh searches against the LIVE renders of all six built surfaces
(dark + light, real dev data), not a re-read of the banked library. Verdicts:

- **Dashboard** — validated against Jobber ([home](https://mobbin.com/screens/9de47309-e37f-40db-b3c8-847d17392de7), stage-tile band with sub-counts) · [Deel](https://mobbin.com/screens/403abcf1-892f-4036-9cbd-ba951c6dce7e) · [Rox](https://mobbin.com/screens/62b4d10c-498e-49eb-bf78-3b944290f407) · [Remote](https://mobbin.com/screens/e5036bc0-b233-44ad-ba65-1794411f7a2f). Greeting-persona registers ("Hey, Alex 👋") REJECTED — our "Today · date" says less and does the same orienting. **ONE FIX TAKEN from Deel's "Overdue for: 33 days"**: live data had outgrown the sheet's hour grammar — "oldest has waited 380h" hid sixteen days behind arithmetic. `waitLabel()` (shared, `lib/workspace/format.ts`) keeps hours below 48h (the recorded 26h-not-1d decision stands) and rolls to days above; the sheet's fixtures never cross 48h, so this extends the grammar where it was undrawn — no sheet amendment needed.
- **Board** — validated against [GitHub Projects](https://mobbin.com/screens/401f3d2a-fb2d-4d8b-a0b0-d475438f0d26) · [Rox](https://mobbin.com/screens/1afa393c-87c4-4ce4-a4c5-654a3fe3a3c4) · [Programa](https://mobbin.com/screens/d12827a1-62a3-4442-8139-737b83985d09) · [Plane](https://mobbin.com/screens/3ab97a90-278b-4784-84d2-00aa05d21aa6): all draw bare "No items" empty columns where ours teach what starts the loop; none attempt funnel-math feet. Card ages take the same `waitLabel` day rollover (`ageLabel`).
- **Approve** — validated against [Reddit mod queue split-view](https://mobbin.com/screens/9e81dbcf-db79-45ef-8347-08e81e1b5b77) (action toast + reason-as-event: both already ours) · [Aboard approval-chain rail](https://mobbin.com/screens/d15cd548-a758-4743-8944-99c825340019) (covered by our judge panel + provenance line) · [Relevance AI](https://mobbin.com/screens/860b4d5d-622b-4dea-81ed-a5582422fa17) selection-based bulk REJECTED again (our batch-by-run carries its count and its scope sentence). **ONE FIX**: the scope sentence's singular read broken on the live header ("1 staged draft advance through their own flow") — now "advances through its own flow" (`batchScopeNote`).
- **Runs** — validated against [n8n executions](https://mobbin.com/screens/8599968f-6ca2-4e28-a058-17d5d5a9f110) (status+duration per row = the create-run shape) · [Zapier](https://mobbin.com/screens/79e1ffb1-261c-47a8-ab29-e2d5bb0c3f47) (errored row carries its fix door = our Retry + verbatim reason) · [Cursor](https://mobbin.com/screens/8c9f4c28-46ed-4b65-acd9-e0a3762d33e4). [Snowflake's per-row duration-trend sparkline](https://mobbin.com/screens/430cbae9-a8e6-4bda-b914-4ef7b80e1716) REJECTED: a trend over two runs is noise dressed as signal. Legacy flat rows stay duration-less — that data was never on their wire ("no fake parents" honesty, recorded s89).
- **Analytics** — validated against [Google Analytics "Data collection is pending"](https://mobbin.com/screens/12d45d8a-28f9-423a-bd90-28fee871b737) · [Cloudflare](https://mobbin.com/screens/7ec1f61d-bfbe-4481-9ced-eafac4916bbc) · [Visitors "Collecting Data" + "–" metrics](https://mobbin.com/screens/73ce6686-1274-49a3-9c1d-30a8ebf3bdc3) — three products in our exact honest-empty register. [Dub](https://mobbin.com/screens/3a6674ee-9f0a-4ac8-b062-216c0085d131) (real-reading zeros + decorative sparklines) and [Ghost](https://mobbin.com/screens/1f8d59a8-f7e8-4a4c-808d-2f104569960d) (blurred fabricated chart as backdrop) are the rule-5 anti-pattern shipped at scale — REJECTED with our placeholder-that-says-so kept.
- **Composer** — populated state UNCHECKABLE until the first real Create run (the standing visual gate; fake runs stay barred). The predates-Create boundary state renders its fact verbatim with two doors (try again · back to Approve) — checked at the level dev permits.

**Net: three code fixes (waitLabel day rollover · ageLabel delegation · batchScopeNote singular), zero sheet amendments, six surfaces validated against 24 fresh references.** Every fix carries its test row in the same change.

## Pass 1 — per-surface status

| surface | sheet | status | what changed / what is queued |
|---|---|---|---|
| Analytics | `Analytics.dc.html` | **DONE (s85b)** + tooltips | Post rendered in-row (avatar + body + media thumb) · sparkline on every tile AND every row · 28-day reach/engagement area chart · icon metric heads · real platform marks · hour-box gains Avg/Days/Heatmap and stays reserved. Two layout defects found by reading the render and fixed: ~300px dead space under the table (→ 10 rows) and a right column clipping the fold (measured: last row bottom 919 ≤ 940). |
| Schedule | `Schedule.dc.html` | **DONE (s86)** | Media thumbnail in every post chip with the **platform as a badge ON the thumb** — so "Planned · LinkedIn" left the chip entirely (border says planned, badge says LinkedIn). Text-only post keeps the slot with an "Aa" mark: the ABSENCE of a picture is information. An engine RUN is not a post (clock mark, no picture, no platform). Legend compressed to "won't fire"/"will fire". **Founder asked mid-pass whether clicking a chip expands with a good thumbnail — it did NOT** (a text-only verb menu), so the click now opens a card that leads with the media at card width, anchored BELOW the chip. Two defects the render caught: `.info`/`.tip` CSS was never copied from Analytics (only its markup) so the tooltip spilled into the footer as body copy; and a 36px thumb truncated every excerpt in a ~147px column. Measured: expanded card 441→829 inside `.cal`'s 859 clip. |
| Composer | `Composer.dc.html` | **DONE (s86) · REBUILT s86 on his call · TUCKED s90b on his doctrine** | **Founder, mid-pass: "the preview needs the bigger spot in the middle, and those information rows like visibility, first comment etc can go to the right instead."** Three columns now — 330 / 522 / 300 — because that is what the operator is doing: write left, see the result middle, turn knobs right. The judge moved LEFT beside the body (it names a hit marked IN the body). The five destinations became a full-width band underneath. **"Expand" added on the preview head** (his second message: "clicking on the preview expands it into its own tab or large popout") — the column gives the preview the biggest RESTING spot, the popout gives it TRUE platform width, which no column on a 1440 screen can; the popout is drawn as its own state in pass 3. Earlier in the same pass: full-fidelity preview (HubSpot): media large instead of a 64px strip, hashtags in the platform's LINK colour, LinkedIn's own action row. Media control gains an icon toolbar; the band gains a **cover-frame picker** — the Postiz video-settings finding applied where it is TRUE (YouTube's title/thumbnail/made-for-kids and TikTok's privacy/duet/stitch belong on THEIR tabs; the ⓘ says so rather than drawing them under LinkedIn). **Fabricated-data defect found and cut**: the first draft showed "41 reactions · 6 comments · 2 reposts" on an UNPUBLISHED post — rule 5. Measured: the right column overflowed the fold by ~85px, putting the action row AND the caveat below it, i.e. the pass's whole point invisible; now ends at 911 inside the card's 916. **s90b (minimal-interaction doctrine, his "do the same for the Composer"): his s86 zoning kept; judge card → verdict STRIP under the body (facts in words, gate anatomy behind "details ▸" — expanded state = git history, pass 3); Discoverability → one warn line; settings rail → Media/Cover/First-comment + "More settings ▾ · 5" (the density rule finally applied to this rail); fit band → words only, every refusal reason verbatim. Measured: bottom 916 ≤ 940.** **s90c (his purpose audit: "what is the Composer for, and is the layout achieving it?"): the purpose of record spelt ON the surface — every zone carries a mono job-label (YOUR WORDS — EDITS RE-JUDGE · Preview · THIS DESTINATION'S SETTINGS · HOW IT SHOULD DO · EVERY DESTINATION AT A GLANCE); a PROVENANCE line under the header answers "based on what" (run · intel pick · sources · profile · models — Approve's src-line grammar); "how it would trend" gets its honest home (Discoverability + Posting slot real today; Trend forecast NAMES its D2 dependency, with the sheet's one open tooltip explaining why a number now would be fiction); and the built-but-doorless AI-edit verb finally has its drawn door beside YOUR WORDS. The tooltip moved twice on probe evidence (band clipped it; below-hang covered the Blog fit cell) and now hangs in the preview card's empty region covering nothing — verified by intersection probe, not eyeball.** |
| Channels | `Channels.dc.html` | **DONE (s86)** | CURRENT · 6 / NOT CONNECTED · 3 grouping (Rox), nine real brand marks replacing nine two-letter boxes, account avatars (Postiz), a live line per connected card, icon-only Validate/Open/Disconnect. Honesty held where a number was tempting: "nothing published yet" not 0; X reads "not measured — no vault row to attribute to". **A not-connected channel is an OFFER, not an identity** — it loses the account block and the "door disarmed" line (which restated its own pill), and that subtraction is what got the connect dance back above the fold (992 → 925 → **914**). **No tooltip on this sheet, deliberately** — every card note is already a fact, not a rationale, and there is no free region; forcing one would have covered a card to demonstrate a pattern the sheet does not need. |
| Rail sweep | all 15 with a rail | **DONE (2026-07-29)** | Calendar→Schedule + Analytics inserted. Rail-only match on the icon markup, so prose was never blind-replaced; `Profiles` cross-ref renamed by hand, `Calendar.dc.html` marked SUPERSEDED. Verified: 15 identical rails, zero rail overflow. |
| Runs | `Runs.dc.html` | **DONE (s89, W1)** | The create_runs re-shape drawn (spec §5.8): RUNNING-NOW band above the history (Cloudflare) mirroring the Dashboard tray's fixture · ONE create-run parent row — judge chip ("judge ✓ 3 of 3", Hume) + status pill + duration-and-cost together ("3m 42s · $0.09", Vercel/Clay) — with its three family drafts NESTED (platform dot · quote · passed chip · Waiting pill · "In Approve →" door each) · the failed run states its cost honestly ("failed at 8s · $0.00 — kept its receipts") with Retry · Thursday's pre-create rows stay FLAT under a day-header note ("no fake parents" — the orphan rule stated where it applies) · seg gains Live/Waiting · footer gains the day total ("2 runs finished · $0.09 total · 2 live"). Child mini-thumbs cut after the render read — blank 34px boxes said nothing the platform dot didn't. |
| Dashboard | `Dashboard.dc.html` | **DONE (s89, W1)** | The SETUP BAND (gap §5.1's answer drawn): "Set up your workspace · 3 of 4", steps inline, the open step is a live door ("First approve — 4 waiting →"), dismiss × with every-step-skippable on hover — coherent with the sheet's own fixture, NOT a fresh-tenant lie. The Overview|Board seg (drawn s71) is now THE Board ruling made real; `Board.dc.html` carries a status note that its kanban becomes this toggle's Board state. Composing tile → **"Runs live"** — the ORIENT door to `/app/runs`, its ctx now agreeing with the work tray (1 rendering · 1 at the judge gate). "Open calendar" → "Open schedule" (sheet law since the rail sweep); cadence caps compressed to one line, rationale on hover. "Latest runs" deliberately ABSENT — it stays on Create home (W1 decision); this surface shows counts, never a second run list. |
| Approve | `Approve.dc.html` | **DONE (s89, W1)** | State tabs with counts (All 8 · Waiting 3 · Blocked 1 · Approved 3 · Rejected 1 — Reddit) · run-group header with "Approve run · 2" (Deel's count-carrying batch verb, applied per run) · real platform marks on every row (in/X/f/bsky/globe) · the judge's reason as a chip on the Blocked row, the OPERATOR's reason as a warn chip on the new Rejected row ("your reason → eval: …" — the learn loop drawn on the surface) · every detail verb carries its key inline (Approve a / Edit e / Reject r — Plain) · "Open in Composer →" re-entry door added to the detail head (the Create-spec join) · queue filled 5→8 rows (the Analytics dead-space rule; the Rejected state existed nowhere before). Reject's reason-required rationale moved to hover title — the Rejected row already states the fact on the surface. Measured: footer caption 2 lines, card bottom inside 940. |
| Create home | `Create.dc.html` | **DONE (s90, W2) · REDRAWN s90b on his direction** | The dead "Advanced · staged flow →" header link DELETED — its job is a real door now: **"Start guided"** in the hero's control row (the wizard is an offer beside the prompt, R2). Jasper-style task shortcuts seeded from Intel picks (one row of three, each names its kind — post/video/page — and says what it prefills). Latest-runs rows carry their door: in-flight → "In Composer →" (the Runs sheet's door grammar; "Open in Composer" truncated at the 400px column — probed, not squinted), published → view live. Measured: bottom 717 ≤ 940, zero truncation. **s90b ("Create is still a bit intimidating… simplicity is key"): full redraw to the 8-product ask pattern (library §Create home s90b) — headline question · ONE centered ask-card (controls in its own bottom row) · collapsed run-line · suggestion chips · recents as one quiet foot line. Bottom 916.** |
| Create wizard | `Create Wizard.dc.html` (NEW) | **DONE (s90, W2) · AMENDED s90b** | The B-create.3 sheet the approved Create spec names, drawn at the Sources & media step: Jasper's accordion rail (What ✓ · Platforms ✓ · Sources & media OPEN · Review plan pending) beside the live brief ARTIFACT ("this exact record rides the run"). Platform chips carry capability BEFORE spend (R3): Facebook ✓ ready · Instagram ✓ video carries the media · YouTube/TikTok "connect to publish" in warn — an honest fixture, those two aren't connected. Media attaches wear their ROLE at the file (Runway): `use` solid, `reference` dashed + "informs · never in the output" visible on the row (never tooltip-only — it changes a decision). The media door names the dialog (Leonardo: Uploads · Generations · Library). The plan region is a dashed HONEST PENDING ("lands at Review — before anything generates"), never invented numbers. Profound's generating-checklist state = pass 3, stated in the header. Measured: bottom 916 ≤ 940. **s90b: the two-column layout is gone — the brief-artifact column TUCKED behind one quiet line ("view the brief ▸"); the accordion is the single centered focus. Amends the Create spec’s Decision 2 by his later word.** |
| Sites | `Sites.dc.html` | **DONE (s90, W2)** | State pill moved ONTO the preview shot (Lovable); every card gains its truth line — live → its hostname ↗ + minted date (Squarespace), draft → "previews only" (never a fake URL); h1 pills became a real filter seg (All 17 · Live 2 · Draft 15); footer gains the blog door ("Blog articles ride the same engine · the published ledger →" — the contract's blog-loop join, previously doorless). Measured: bottom 690 ≤ 940. |
| Library | `Library.dc.html` | **DONE (s90, W2 — §5.3 drawn)** | ONE Library: the ingest band names every kind it takes (URL · file · text · video/audio transcribe on ingest) and gains the s86 lane's control designed properly — a **Free transcript | AI enhance** seg (free default; enhance metered, cost shows before the run); KIND became a qtab filter row with counts (All 6 · Video 2 · Audio 1 · Article 1 · Capture 1 · Text 1 — type is a lens, never a route); a mid-transcription source is an honest ROW STATE ("Transcribing · ~3m left · chunks land when it finishes"). The `/app/transcription` route retires at the rebuild; `data-screen-label` was always "Library" and stays. Source Media stays its own component family (knowledge shelf ≠ media shelf — resolved, not merged). Measured: bottom 662 ≤ 940. |
| The other verdicted sheets | — | *(bucket row retired)* | Superseded by the coverage ledger below — his ruling forbids unnamed "others". |

## THE COVERAGE LEDGER — every surface, by his definition of done

> **Structure home: `docs/workspace/spec.md` (s87, DRAFT awaiting his verdict)** —
> the acts, per-surface contracts, flows, gaps, and the four-wave passthrough
> plan live THERE; this ledger stays the pass RECORD. A wave that moves no row
> here did not happen.

All 21 sheets in `docs/research/mock-sheets/`, each a named row. **research** =
has Postiz/Mobbin research been run against this surface (the definition of
done); **p1/p2/p3** = the three passes. A `—` is a debt, not a detail.

| # | surface (sheet) | research | p1 | p2 | p3 | note |
|---|---|---|---|---|---|---|
| 1 | Analytics | ✅ s85b | ✅ | — | — | reference library §Analytics; **BUILT s92** (lane `analytics`, merged at the lead's gate): `/app/analytics` + read-only `/api/analytics` over the engine read-model, rail entry after Schedule, every absence word verbatim on the live render (deferred · partner-gated · no impressions in the API); the sheet's FB provenance amendment lead-applied; honest divergences + the D2 series gap (G1) = `agent_handoff/lanes/WRAP-analytics.md` |
| 2 | Schedule | ✅ s86 | ✅ | — | — | §Schedule |
| 3 | Composer | ✅ s86 + Create-spec Mobbin pass + **P walked s90** (launcher flow facts, library §Postiz launcher) | ✅ | — | — | popout state = p3, drawn open; the launcher walk REJECTED their bundle model, VALIDATED R3 + D3; **ROUTE BUILT s92** (B-create.4 core): `/app/create/run/[runId]` exact-mock from the s90c iteration, AI-edit door armed over the create-shells verbs (propose→judge→apply), Approve's re-entry door armed, fit band verbatim from the one validator; populated-state visual gate rides the first real Create run (dev truthfully renders predates-Create/empty) |
| 4 | Channels | ✅ s86 | ✅ | — | — | §Channels |
| 5 | Create home | ✅ s86 (Create-spec pass: HubSpot·Jasper·Linktree·Profound·Midjourney·Runway·Krea·Leonardo) | ✅ s90 (W2) · **VERDICTED** | — | — | pass-1 row above; W2 approved by the founder s91, 2026-08-02 ("you have my approval on W2 too"); **BUILT s93** — the s90b ask-card exact-mock at `/app/create` (headline 26px at 172 · card 740 · recent-line bottom 916, all probed): run-line facts real (profile platforms/version), the s90a plan card = its expanded state, sugg chips = real Intel picks via `?ctx=`, honest empties throughout; 26 tests |
| 6 | Create wizard (new sheet) | ✅ s86 (same pass) | ✅ s90 (W2) · **VERDICTED** | — | — | `Create Wizard.dc.html`; W2 approved s91 (covers the s90b tucked-artifact amendment); **BUILT s93** — `/app/create/guided` exact-mock: accordion slots, platform chips carry `deriveCreatePlan`'s OWN verdicts via the new pure `POST /api/create/plan` (R3 before spend — live render: TikTok "connect to publish" verbatim), Review = the derived plan with cost honesty, Generate → new gated `POST /api/create` → `runCreate` → the Composer door; media dialog = STATED deferral (media pass), never a dead button; brief tucked behind its line; 13 tests + the sequence-gate route ratchet |
| 7 | Videos Overview | ✅ s87 (VEED·Riverside·Loom·Arcade·ClickUp) | — | — | — | video build order 1 |
| 8 | Video Dossier | ✅ s87 (Synthesia·Adobe·AI Studio·Fibery·Sana·Frame.io) | — | — | — | video build order 1 |
| 9 | Videos (editor) | ✅ s85 (VEED·Vimeo·Descript) | — | — | — | **NOT FINISHED by his ruling** — engine done ≠ done; thumbnails/track-colour/credit-badges = p1, script-first = p2 gate |
| 10 | Approve | ✅ s89 (W1) | ✅ s89 · **VERDICTED** | — | — | library §Approve; W1 approved by the founder s89 ("yes to all, W1 approved") — build unblocked |
| 11 | Board | ✅ s89 (W1) + **s90 pipeline pass** (library §Pipeline board) | ✅ s89 · **PIPELINE BOARD DRAWN s91 · VERDICTED** (founder text, 2026-08-02 post-wrap: *"board approved"*) | — | — | **retires into a Dashboard toggle** (his s88 ruling); **the toggle's Board state redrawn as the PIPELINE BOARD s91** — loop-order columns (Intel picks → Generating → At the judge → In Approve → Scheduled → Published), counts on heads, the day's in/out as ONE aligned feet row (columns stretch full height so the funnel math reads as a row), ✓/✗ judge chips on every Approve card with the blocked reason verbatim; the W1 fixture's "unpicked" card removed (picks only — an unpicked trend lives on Intel); measured: all six columns bottom 916 ≤ 940, zero clipped text; on canvas; **BUILT s92 (`d357233`)**: the toggle's Board state wired at `/app?view=board` + `/app/board` DELETED in the same change; feet aligned at 916 by probe; picks read = `/api/intel/picks`; node-graph stays rejected |
| 12 | Dashboard | ✅ s89 (W1) | ✅ s89 · **VERDICTED** | — | — | library §Dashboard+Board; pass-1 row above |
| 13 | Integrations | — | — | — | — | untouched — not ready |
| 14 | Intel | — | — | — | — | untouched — not ready |
| 15 | Leads | — | — | — | — | untouched — not ready |
| 16 | Library (Transcription) | ✅ s90 (W2) | ✅ s90 (W2) · **VERDICTED** | — | — | §5.3 DRAWN — one Library, kind = filter, transcribing = row state; pass-1 row above; W2 approved s91 — the `/app/transcription` retirement builds with the rebuild |
| 17 | Profiles | — | — | — | — | untouched — not ready |
| 18 | Runs | ✅ s89 (W1) | ✅ s89 · **VERDICTED** | — | — | library §Runs; create_runs re-shape drawn (workspace spec §3 ORIENT); pass-1 row above |
| 19 | Sites | ✅ s90 (W2) | ✅ s90 (W2) · **VERDICTED** | — | — | library §Sites; pass-1 row above; W2 approved s91 |
| 20 | Source Media | ◐ banked (Leonardo dialog + Runway roles, s86 — APPLIED in the W2 wizard draw) | — | — | — | the IA question is RESOLVED (own component family, the wizard's media dialog — never merged into Library); its own sheet's p1 still owed |
| 21 | Wave 0 – Triage spine | — | — | — | — | untouched — not ready |
| — | Calendar | *(superseded s85 — rail sweep; kept only as history)* | | | | |

**The honest count: 15 of 20 live surfaces have been touched by the research; 5
have not and are therefore not ready.** (W1/s89 moved Approve · Board · Dashboard
· Runs; W2/s90 moved Sites · Library and drew Create home + wizard from the s86
bank; Source Media is ◐ — its dialog pattern is banked and applied, its own
sheet's pass is still owed.) Every design session updates this table in the same
commit as its sheets — a pass that does not move a row here did not happen.

### The VIDEO arc — its own 3 passes (founder ask, 2026-07-29)

> **s86 close: the arc now has a SPEC — `docs/video-arc/spec.md`, APPROVED by the
> founder same close (as was `docs/create-engine/spec.md`).** It
> carries the flow map, requirements V1–V10, the Create↔Video joins (including the
> existing `waterfall/` engine as the Repurpose bridge), the script-first DECISION
> GATE (evaluated in pass 2, not assumed), and the reconciliation ledger. The notes
> below remain the reference detail behind it.

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

#### Overview + Dossier references — BANKED s87 (the arc's last blank)

The video spec called these "the only surfaces with zero banked references". They
are no longer zero. Swept 2026-07-29 (s87), Mobbin MCP, web. **Do not re-search
these; the editor set above is likewise banked.**

**Videos Overview — the list.**
- **[VEED · projects grid](https://mobbin.com/screens/f6dcf4e8-1233-4b22-b8a7-5dfc114d1750) — the closest match, and it answers V1/V7 directly.** Every card carries a **state badge on the thumb** (`● Draft` / `● Exported`) top-right and a **duration badge** bottom-right. Crucially, a project with no render yet draws **"No Preview Available"** as a real, deliberate tile — not a blank, not a borrowed frame. That is our render-state badge AND our honest-absence rule already drawn by someone else.
- **[Riverside · projects](https://mobbin.com/screens/20933911-0b7c-4db0-9b95-71f0ae55b9fe)** — each card's meta line counts its own history: *"4 days ago · 2 Recordings · 5 Edits"*. **Version/take counts surfaced at LIST level**, which is the cheapest possible answer to "what happened to this project" before you open it. Also: a quick-action bar above the grid (Plan · Record · Upload · Edit · AI Voice), and un-rendered projects showing an icon placeholder rather than a fake thumbnail.
- **[Loom · library](https://mobbin.com/screens/9e8909a2-43b5-4007-b72d-05475a8c0af4)** — duration badge on the thumb, a **share-state line** ("Not shared ▾") on the card, and a metrics triplet (views · comments · reactions) under each. **Ours must stay empty until `publication_metrics` has rows** (the s87 D2 window) — a Loom-shaped metrics row filled with zeros is precisely the rule-5 failure the Composer pass already cut once.
- **[Arcade · library](https://mobbin.com/screens/02beed61-a42e-462c-a824-b61b0a9ce46c)** — Status + Tags filter chips, grid/list toggle, `Template` marker on a card, duration bottom-right.
- **[ClickUp · clips](https://mobbin.com/screens/08a507a8-ddc8-42e4-a34b-5c3caec6a0be)** — per-card KIND label ("Video Clip · 39 mins ago"), and an item with no thumbnail drawn as an icon placeholder.

**Video Dossier — the project page.**
- **[Synthesia · video detail](https://mobbin.com/screens/86150fba-e1c2-4c00-8dc6-35dca70c6f0f) — the single best structural match we have for the Dossier.** The **version selector lives IN the breadcrumb** (`My videos › Product Demo › Version 2 ▾ › Edit`), and the dropdown lists each version with its age and a **`PUBLISHED` pill** on the one that shipped. Right rail = name, description, "Generated 1min ago", and **comments anchored to a timecode** ("Version 1 · at 00:05"). Top-right verbs: Analytics · Translate · Invite · Republish. Between the breadcrumb selector and the published pill, three of our five no-affordance jobs have a drawn home.
- **[Adobe Express · version history](https://mobbin.com/screens/8e02843d-74a8-420a-b8b7-ea4f5630bf0f)** — a **"Marked versions"** group collapsed ABOVE the raw timestamp list, and a version carrying a typed name ("First Project V1 ✓"). That is **save-as-a-named-variant** exactly, and the marked/unmarked split is the honest answer to a list of forty autosaves where three matter.
- **[Google AI Studio · app versions](https://mobbin.com/screens/26c8f8ba-2aaa-4028-8983-d41f4b71b784)** — versions as **radio rows** with a `● Current` pill and one "Restore version" action at the foot. Radio-select-then-act is the natural precursor to **compare two**: the same rows, two selectable slots.
- **[Fibery · restore confirm](https://mobbin.com/screens/eb05e8be-4a16-47f0-94fe-08ad3da74171)** — *"Restore this version? Your current version will revert to version Jan 8, 2026 1:13 pm."* The confirm NAMES what you lose and when it was from. Our delete-a-version and restore rules land in this register — reversibility stated in words, per V1.
- **[Sana AI](https://mobbin.com/screens/0d1c373e-876d-48f2-b460-54aa375f8b35)** + Fibery both carry a **"Highlight changes" / "Show changes" toggle** beside the history — the diff-on-demand idea the SHIPPED B-ve.4 diff panel could be re-aimed at for version-compare.
- **[Frame.io · asset detail](https://mobbin.com/screens/c11d1ed7-0776-4793-8f12-4132d25d11c3)** — a `Show all versions` switch inside a settings rail, plus per-asset metadata rows and a **Grid | Reel** layout toggle.

**What the sweep changes about the plan:** the five no-affordance jobs do not need
five new inventions. Version-compare, named variants, delete-with-a-real-confirm
and published-state are all *one* well-drawn version rail (Synthesia's breadcrumb
selector + Adobe's marked group + Fibery's naming confirm), and render-state on
return is a badge on a card (VEED). Take audition is the one genuinely separate
affordance. **Sheets are still lead-direct and still owed a founder verdict.**

**Pass plan (same three lenses, video-scoped):**
1. **Surface** — visual density and the render gate. The known drift is 30 rows;
   the s80 finding was that most of it was ONE defect (the copilot band's 19px).
2. **Flow** — Intel → Create → dossier → editor → Approve → Schedule. Where does a
   video actually enter the publishing loop, and where does that path break?
3. **State & button** — finish the 5 no-affordance jobs, and every control's
   refused/empty/loading state.

**Status: REFERENCES BANKED (s87), SHEETS NOT STARTED.** The D4 pass-1 sheets are
done (s86) and the Overview + Dossier sweep is done (above) — so the arc's blocker
is no longer research, it is drawing time. **Held deliberately at the s87 boot on
BUDGET, not on doubt:** the weekly limit read 87% used with two engine lanes live
(resets Jul 31, 11pm UTC), and the sheet passes are the heaviest spend left in the
programme. Banking the references first is what makes the hold cheap — the durable
half is done and the sheets can start cold from this section whenever there is
headroom.

## Open decisions (founder's, NOT closed by the blanket design approval)

1. ~~Calendar → Schedule rename + Analytics joining the rail.~~ **RATIFIED and
   SWEPT 2026-07-29.** 15 sheets done. **Still open, and it is the app half:** the
   shipped surface is still `/app/calendar` with a "Calendar" rail item, so the
   product and the spec now disagree until the rebuild lands. That is a BUILD task,
   not a design one — it needs its own go.
2. The four per-sheet OPEN CALLS in each sheet's own header remain open.
3. ~~WHERE DOES COMPOSER ACTUALLY LIVE IN THE FLOW?~~ **ANSWERED by the founder and
   SPECCED, s86 close** (*"once it's generated we can have the Composer window appear
   after to do some previews and checks … before approving"*). The flow of record:
   **Create → Generate → Composer (run-scoped checkpoint) → Send to Approve → Approve
   (human gate) → Schedule → publish**, with an "Open in Composer" re-entry per draft
   group from the Approve queue. The whole Create arc — dashboard, wizard, media
   roles, routing, engine, the Composer's position — is **`docs/create-engine/spec.md`**
   (DRAFT, awaiting his verdict), including the reconciliation ledger of what research
   was incorporated / deferred / rejected and why. **The Create sheets (home update +
   wizard + Composer run states) are the programme's next design work after the video
   arc — or before it, his sequencing call.**
4. **Intel's live-vs-mock gap** (found 2026-07-29, and it is a product question,
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
