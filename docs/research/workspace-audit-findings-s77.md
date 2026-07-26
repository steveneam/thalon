# Workspace audit — the s77 fan-out, and the s78 fix plan

> **Founder directive (s77):** *"going through each page, section, feature, and buttons, to check that consistency and functionality is there … as well as re-introduce the good things (like filters, sort by, a workable calendar) from the old design … so basically a full troubleshoot and verification pass and bug fixes."*

**How this was produced.** One subagent per shipped surface, each walking every
button, link, chip, tab, row and key binding against the `thalon-check` lens
set (dead doors · state that outlives its entity · every row explains itself ·
reversible · visible · discoverable · attributable · rhythm · non-breaking).
**14 of 15 surfaces returned before the run was stopped** at the founder's call
— the adversarial Verify pass (~55 agents) was deliberately NOT run and is the
first job of s78.

**So every finding below is RAW — plausible, not yet refuted.** The verify pass
exists precisely because a confident reviewer invents work; historically it
drops a real fraction. Do not fix straight off this list: verify first, then
fix what survives.

## The count

| severity | n |
|---|---|
| blocker | 10 |
| high | 40 |
| medium | 92 |
| low | 47 |
| **total** | **189** |

## The one theme worth reading first

**State that outlives its entity** — the same defect the founder found by hand
in Intel (`DossierCard` carried no React `key`, so a title pick survived the
card switch and went out of range on a smaller card). The fan-out found the
same disease in at least four more places, and one of them corrupts data:

- `[blocker]` **Approve — "The editor outlives the draft: Save edit writes draft A's body onto draft B."**
- **Create — "CreateSurface isn't keyed by the capture it renders, and the loader never resets on an id change."**
- **Dashboard — "The needs-you selection is an index, not a draft — it silently re-points after a re-read."**
- **Transcription — "Selection is an array INDEX, so it re-points at a different source after every ingest or delete."**

That is a class, not four coincidences, and it is now a named check in the
skill. A single keyed-by-entity sweep plus a pinned test per surface likely
closes all of them.

**The second theme is the founder's own "filters, sort by" ask**, which the
fan-out reached independently: Intel and Transcription both flagged unbounded
lists with neither filter nor sort.

**And it caught a fix made an hour earlier in this same session** — Intel's
*"Click again to ride without an angle" is false — the seam re-attaches the
first angle anyway.* The toggle-off shipped, but the promote seam still
defaults to the first angle when none is picked, so the affordance lies. That
is the strongest evidence the lens set has teeth: it audited fresh work and
found the half that was missed.


## Intel — 13 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | The dossier's primary exit lands on a Create where Generate is refused — and on today's data it is the PRE-PICKED one | `/home/deploy/work/thalon/apps/web/src/components/intel/dossier-card.tsx:296` | Carry Create's honesty upstream to the door. Two parts: (a) stop `suggestedExit` (launchpad.ts:24) pre-picking a family whose generation door is cl… |
| `high` | "Click again to ride without an angle" is false — the seam re-attaches the first angle anyway | `/home/deploy/work/thalon/apps/web/src/lib/intel/store.ts:106` | Split the two defaults at the seam: keep default-to-first for the REQUIRED title, and for the optional angle return undefined when `index === undef… |
| `high` | "Target this" on every horizon card defaults to a family Create cannot generate | `/home/deploy/work/thalon/apps/web/src/components/intel/search-tab.tsx:334` | Either default target-this to a family whose Generate is armed, or say so at the button ("the query rides along — page generation isn't wired to Cr… |
| `medium` | Sweep now has no running cue and throws away everything the sweep reported | `/home/deploy/work/thalon/apps/web/src/components/intel/intel.tsx:187` | Swap the button label to "Sweeping…" while busy (disabled-because-running must not look like disabled-because-not-ready), and render the returned s… |
| `medium` | Dismiss is one click, irreversible, and unexplained — while its twin one tab over has Restore | `/home/deploy/work/thalon/apps/web/src/components/intel/dossier-card.tsx:86` | Give the trend dismissal the same shape as the target one: keep the capture, and offer an undo path — either an "Undo" affordance beside the alert … |
| `medium` | Neither tab offers a filter or a sort, on lists that are unbounded by construction | `/home/deploy/work/thalon/apps/web/src/components/intel/intel.tsx:107` | Make the watch chips do the filtering they already look like they do (click = filter the cards to that area, with the description editor behind a s… |
| `medium` | The demo card contradicts itself on screen: "21d ago" beside "published 6h ago" beside "catchable" | `/home/deploy/work/thalon/apps/web/src/lib/intel/fixtures.ts:18` | Anchor the fixture clock to read time — derive BASE_MS from Date.now() so `iso(-6)` really is six hours ago and the frozen reason strings stay true… |
| `medium` | A capture id that no longer resolves drops the whole handoff silently | `/home/deploy/work/thalon/apps/web/src/components/create/create-context-loader.tsx:33` | Distinguish the two states in the loader: on a 404/failed resolve, render Create with an honest line where the pick chip would be ("the capture you… |
| `low` | The rising row highlights edge-to-edge on hover but only the title text is the door | `/home/deploy/work/thalon/apps/web/src/components/intel/rising-card.tsx:57` | Make the row the door as the rest of the workspace does — wrap the row content in the button/Link and keep the ↗ as a nested stop — or, if the spli… |
| `low` | The Outlier verdict has no route to its reasons | `/home/deploy/work/thalon/apps/web/src/components/intel/dossier-card.tsx:76` | Carry the outlier reason lines onto TrendCard beside `isOutlier` and hang them on the pill's title (the same hover-truth pattern the reason rows al… |
| `low` | "copied" is reported even when the clipboard write never happened | `/home/deploy/work/thalon/apps/web/src/components/intel/dossier-card.tsx:46` | Await the write and only then flip the label; on rejection or a missing API set the label to "copy failed" for the same interval. The state change … |
| `low` | The keyboard cursor survives into a list that no longer contains it | `/home/deploy/work/thalon/apps/web/src/components/intel/intel.tsx:141` | Reconcile the cursor with the list it indexes: on open/dismiss, either clear cursorId or re-point it at the row that took the old one's place, and … |
| `low` | The add-area form's requirements are invisible, and it has no way out that its sibling panel has | `/home/deploy/work/thalon/apps/web/src/components/intel/watch-chips.tsx:124` | Say the requirement where it binds — put the route's own sentence under the description field and give the disabled button a title naming what is m… |

## Approve — 11 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | The editor outlives the draft — Save edit writes draft A's body onto draft B | `apps/web/src/components/approve/approve-surface.tsx:436` | Add `key={selectedDraftId ?? "none"}` to `<DraftCard>` at approve-surface.tsx:436 — the same remount-per-entity treatment already applied to `<Stag… |
| `high` | "13 waiting" beside "Approve all waiting (2)" — staged rows counted, silently excluded, and indistinguishable | `apps/web/src/components/approve/approve-surface.tsx:341` | Either count the same set in both places (`waitingCount = queuedItems.length` plus a separate stated count for staged work), or — better — make the… |
| `high` | Selecting a staged row kills j/k/a/r/e while the footer still advertises them, and the pane that replaces the card points back at the card it removed | `apps/web/src/components/approve/approve-surface.tsx:328` | Split the gate: keep `j`/`k` always enabled (navigation is never owned by the detail pane) and gate only `a`/`r` on `!stagedSelected`. Grey/annotat… |
| `high` | The reasons panel labels both grounding tiers "Grounding" — the two rows that can disagree are indistinguishable | `apps/web/src/components/approve/draft-card.tsx:295` | Don't derive the gate name by string surgery — `CheckMark` already carries `gate`. Render `checkLabel(mark.gate)` in `.reason-gate` and keep the fa… |
| `medium` | A failing gate lists every claim, passing ones included, with no mark on the one that failed | `apps/web/src/components/approve/approve-model.ts:277` | In `evidenceLines`, when `status === "fail"` emit only claims with `c.verdict === "fail"` (falling back to the current full list plus `notes` when … |
| `medium` | A blocked row's red text is a bare sentence from the draft — no gate, no reason | `apps/web/src/components/approve/approve-surface.tsx:139` | Build the row line as the sheet does: `${r.gateLabel} failed — ${detail}`, preferring the claim's `evidence` string over the `claim` text (the clai… |
| `medium` | Disabled buttons are pixel-identical to live ones — no opacity, no cursor, no label change | `apps/web/src/components/approve/approve.css:80` | Add the same scoped rule other surfaces use, e.g. `.approve-surface .btn:disabled { cursor: not-allowed; opacity: 0.55; }`. It is additive and scop… |
| `medium` | A failed action's error message outlives the draft it belongs to | `apps/web/src/components/approve/approve-surface.tsx:99` | Add `setActionError(null)` to `selectDraft` in approve-surface.tsx:104-113 (alongside `setDetailStatus`). Keying DraftCard per draft does NOT fix t… |
| `medium` | "Deep link" that isn't one, and a run stamp that is plain text though /app/runs?run= is a live door | `apps/web/src/components/approve/draft-card.tsx:168` | Make the id a copy-link button (`as-text-btn`) that writes `${location.origin}/app/approve?draft=${draft.id}` and flips to "Link copied", or an `<a… |
| `medium` | Every row reads the wire token "single-post" where the sheet says "post" | `apps/web/src/components/approve/approve-model.ts:67` | Two-part: (a) add `"single-post": "post"` to FORMAT_WORDS so the surface reads the sheet's word today; (b) raise the upstream mismatch — generation… |
| `low` | Copy button never reverts and swallows a clipboard refusal | `apps/web/src/components/approve/format-detail.tsx:172` | Add `.catch(() => setCopied(false))` plus an error word ("Copy failed — select the text instead"), and reset `copied` to false on a timer (~2s) or … |

## Dashboard — 14 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | The needs-you card's global Enter binding steals Enter from every control on the surface | `apps/web/src/components/dashboard/needs-you-card.tsx:50` | Copy the sites.tsx guard into the Enter binding: `if (event.target instanceof HTMLElement && event.target.closest("button, a")) return;` before pre… |
| `high` | j/k moves the selection out of the scroll box and the box never follows | `apps/web/src/components/dashboard/needs-you-card.tsx:39` | Add a `selectedRef` on the active row and `useEffect(() => selectedRef.current?.scrollIntoView?.({ block: "nearest" }), [active])`, matching sites.… |
| `high` | The card head says 25 while the card lists 21 — two reads, two windows, no statement of the gap | `apps/web/src/components/dashboard/dashboard.tsx:98` | Make the count and the list share one read — either count from `rows.length` in the card (and let the tile keep the pulse number with its own hones… |
| `high` | The day view puts week-old waiting drafts on today's clock at their historical time | `apps/web/src/components/dashboard/week-card.tsx:144` | Mirror the calendar: render waiting events in a fixed lane above the hour grid (not by time), chip text `lead · Nh →`; keep only sweep ticks and pl… |
| `high` | "your review" marks paint accent blue instead of warn amber — the status colour is overridden by .screen a | `apps/web/src/components/dashboard/week-card.tsx:318` | In a new scoped dashboard stylesheet (see the unscoped-surface finding) add `.dashboard-surface a.mark, .dashboard-surface a.mark-you, .dashboard-s… |
| `medium` | Latest-published cards look clickable and are not — the whole card is inert | `apps/web/src/components/dashboard/dashboard.tsx:289` | Make the card a `<Link href={/app/approve?run=…&draft=…}>` (the provenance door every other row on this surface uses) and keep `view live ↗` as the… |
| `medium` | "The published ledger →" lands on Settings, two clicks short of the ledger | `apps/web/src/components/dashboard/dashboard.tsx:282` | Point the link at `/app/settings/integrations#published` and have Integrations open the disclosure when the hash/param is present (it already owns … |
| `medium` | thumbLabel's format vocabulary matches nothing the engine emits — no draft gets a thumb, every published row invents one | `apps/web/src/components/dashboard/dashboard-model.ts:21` | Key the thumb off the real vocabulary — platform === "video" or format ∈ STAGED_DRAFT_FORMATS → "clip frame", format === "web_page" → "page hero", … |
| `medium` | "+14 more" is an inert span whose only explanation is a tooltip of 14 identical strings | `apps/web/src/components/dashboard/week-card.tsx:327` | Render the overflow as a `<Link href="/app/approve">+14 more waiting →</Link>` (or the calendar's day route), and drop the enumerating title. |
| `medium` | The trends tile has no failure state — a dead read paints as "reading trends…" forever | `apps/web/src/components/dashboard/dashboard.tsx:74` | Give the tile the surface's own three-state grammar — a `trendsStatus` state; on error render "–" with ctx "Couldn't read trends — a read failure, … |
| `medium` | The Rising-trends sparkline from the sheet was never built (its CSS shipped unused) | `apps/web/src/components/dashboard/dashboard.tsx:184` | Render the spark from the trends payload's per-sweep card counts (or add that series to the trends read), keeping the sheet's markup and title; if … |
| `medium` | Dashboard is the only rebuilt surface with no scoped root or stylesheet — its rules live in the read-only shell file | `apps/web/src/components/dashboard/dashboard.tsx:121` | Add `className="content dashboard-surface"` to the root, create components/dashboard/dashboard.css with every rule under `.dashboard-surface`, and … |
| `low` | The needs-you selection is an index, not a draft — it silently re-points after a re-read | `apps/web/src/components/dashboard/needs-you-card.tsx:36` | Hold the selected draftId and derive the index from `rows.findIndex(...)` (the sites.tsx:88-92 pattern), falling back to row 0 when the id is gone. |
| `low` | The engine-down banner's Try again only retries the pulse, leaving the reads that failed with it broken | `apps/web/src/components/dashboard/dashboard.tsx:156` | Have the banner's handler run all three reads (`refresh()`, `retryPlan()`, and a trends retry) so one control restores the whole surface. |

## Leads — 14 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | Dismiss and Mark hot have no pointer control anywhere — the verbs exist only as hidden keystrokes | `apps/web/src/components/leads/leads-surface.tsx:340` | Put both verbs on real controls: a `Dismiss` and `Mark hot`/`Clear hot` pair in the dossier `card-head` beside the `#id` stamp (the sheet's card-he… |
| `high` | A judge-BLOCKED draft is handed over with the same one-click send affordances as a passed one, and no judge verdict has a door to its trail | `apps/web/src/components/leads/leads-surface.tsx:780` | In the ready branch: make the judge pill a link to the draft (Approve already accepts a mount-time `?draft=` deep link — approve-surface.tsx:36,84 … |
| `high` | A failed run-feed read renders as "No draft yet" — broken presented as empty | `apps/web/src/components/leads/leads-surface.tsx:118` | Model the failure: `setRuns("error")` (widen the state to `FeedRun[] \| "error" \| null`) and add an outreach branch that reads "Couldn't read this… |
| `high` | An older draft falls out of the 50-run feed window and becomes invisible, while the compose toast insists it is being shown | `apps/web/src/components/leads/leads-surface.tsx:147` | Stop scanning a bounded feed for a lead-scoped fact: add a lead-scoped read (`/api/leads/[id]/draft`, or filter drafts by `meta.recipient.leadId`) … |
| `high` | `outreachError` is not keyed to its lead — lead A's compose failure stays on screen under lead B | `apps/web/src/components/leads/leads-surface.tsx:101` | Key the failure to its entity: `useState<{ leadId: string; message: string } \| null>` and render only when `outreachError.leadId === selectedId` (… |
| `high` | The Dismissed view is a filter with no cue on screen and no visible way to clear it | `apps/web/src/components/leads/leads-surface.tsx:134` | When `showDismissed`, show it where the operator is looking: a `pill pill-idle` "Dismissed · N" beside the headline (:378-385) carrying its own cle… |
| `medium` | The Post and Page promote doors land on a Create where Generate is disabled — and Create's own copy points back at an "→ Email exit" that Leads doesn't have | `apps/web/src/components/leads/leads-surface.tsx:642` | Say it at THIS control: disable Post and Page with `title` carrying Create's own sentence ("Live post generation isn't wired to Create yet — this h… |
| `medium` | A queue built to swallow whole CRM exports offers no search, no filter and no sort | `apps/web/src/components/leads/leads-surface.tsx:134` | Add a filter strip in the list card head (the sheet leaves the card-head free above `.lead-scroll`): a search input matching name/company/email, st… |
| `medium` | Dismiss is one keystroke, contractually terminal, and has neither confirm nor any restore path | `apps/web/src/components/leads/leads-surface.tsx:345` | Either add the restore transition (`dismissed → scored`) to the contract and offer a real Undo in the toast, or make the act deliberate at the poin… |
| `medium` | The dossier never shows how to contact the lead — email, website and the imported `extras` columns are dropped | `apps/web/src/components/leads/leads-surface.tsx:704` | Add an identity line to the dossier under the card-head using the already-ported `.lead-sub`: email as a `mailto:` door, website as a link (`rel="n… |
| `medium` | The footer disclosure holding Learn, Score now, the Create exits, the key legend and the Dismissed view looks like a static label | `apps/web/src/components/leads/leads-surface.tsx:674` | Give the disclosure a resting affordance: a rotating chevron before the text, `text-decoration: underline dotted` on hover/focus, and an open-state… |
| `low` | The CSV file input is never reset, so re-picking the same file after a failed import silently does nothing | `apps/web/src/components/leads/leads-surface.tsx:536` | Clear the input after reading (`const file = event.target.files?.[0]; event.target.value = "";` before `file.text()`), so a re-pick always fires, a… |
| `low` | The board column is capped at a hardcoded 620px, below its real content at today's density | `apps/web/src/components/leads/leads.css:139` | Bound the column to the space it actually has instead of a constant: `.lead-board { flex: 1; min-height: 0 }`, `.cols { min-height: 0 }` with the c… |
| `low` | "hot" names two different facts on the same surface | `apps/web/src/components/leads/leads-surface.tsx:384` | Give the pin one word everywhere — the sheet's own "follow up" — on the header pill and the board card pill, and leave `hot` to the thermal band; o… |

## Calendar — 18 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | Every navigated week marks the wrong day "today" — fake now-line, and all 21 waiting drafts get dumped into that fake today | `apps/web/src/components/calendar/calendar-surface.tsx:186` | Pass the clock, not the anchor: `weekDays(now)`-style truth — e.g. `const days = useMemo(() => (anchor && now ? weekDays(anchor).map(d => ({...d, i… |
| `blocker` | The time grid clips at 18:38 with no scrollbar — the evening and the whole 21–24 quiet band are unreachable, and "expand" cuts 531px while claiming "quiet hours · shown" | `apps/web/src/components/calendar/calendar.css:25` | Stop bounding the card to the viewport: in calendar.css give `.calendar-surface .cal { flex: 0 0 auto; }` (or `min-height: max-content`) so the nat… |
| `high` | Selecting any non-plan event shows no cue at the control — `.sel` is styled only for `.ev-plan` | `apps/web/src/components/calendar/calendar.css:140` | Promote the selected style off `.ev-plan`: add `.calendar-surface .ev.sel { border-color: var(--act); border-style: solid; box-shadow: 0 0 0 1px va… |
| `high` | j/k walks into events that have no box on the grid — the popover opens with zero selected controls | `apps/web/src/components/calendar/calendar-surface.tsx:243` | Restrict the keyboard cursor to what is actually drawn: build `ordered` from the same set the grid renders (`visible.filter(e => e.kind !== "you" &… |
| `high` | "+15 more" / "+17 more" is a dead end — the bulk of what waits on you is reachable only as a hover tooltip | `apps/web/src/components/calendar/calendar-surface.tsx:447` | Make both overflow markers links: week → `<Link href="/app/approve">+15 more</Link>`, or better, switch to Agenda density scoped to that day (`setD… |
| `high` | Agenda rows carry no date, so carried items from outside the labelled range read as in-range | `apps/web/src/components/calendar/calendar-surface.tsx:692` | Print the date in the `agenda-when` column (`Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short'})`), and give carried rows … |
| `medium` | No way back to today — the anchor is one-way once you page | `apps/web/src/components/calendar/calendar-surface.tsx:279` | Add a `btn btn-ghost btn-sm` "Today" between › and the density seg, `onClick={() => { setSelectedId(null); setAnchor(new Date(now.getFullYear(), no… |
| `medium` | The sweep event's detail door says "Open draft →" and goes to /app/intel | `apps/web/src/components/calendar/calendar-surface.tsx:761` | Label from the destination, not the kind: `event.href.startsWith("/app/intel") ? "Open Intel →" : "Open draft →"`, or carry an explicit `doorLabel`… |
| `medium` | The ⚑ flag's reason is reachable only in Week density — Month draws no flag at all | `apps/web/src/components/calendar/calendar-surface.tsx:674` | Render the flag in all three densities and always attach its reason: add `{event.flagged && <span className="flag" title={event.flagReason}>⚑</span… |
| `medium` | The detail popover calls work that is waiting on you right now "a record of what happened" | `apps/web/src/components/calendar/calendar-surface.tsx:790` | Add the missing branch: `event.kind === "you" ? "waiting on you — open it to approve, edit or reject" : …` before the record-of-what-happened fallb… |
| `medium` | Nothing ticks — the red now-line and every "waiting Nh" freeze at page load | `apps/web/src/components/calendar/calendar-surface.tsx:100` | `useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, [])`, and derive `isToday` from that … |
| `medium` | A scope that matches nothing renders a blank week with no message — and ⚑ Flagged can never match while no cadence rules exist | `apps/web/src/components/calendar/calendar-surface.tsx:410` | Give Week density the same empty row Agenda has, keyed to the scope: when `visible.length === 0`, overlay the grid with "Nothing in this week for t… |
| `medium` | Concurrent events collapse to 45px and clip mid-word with no tooltip | `apps/web/src/components/calendar/calendar-model.ts:389` | Floor the split — cap the run at 3 lanes and let the rest cascade with a small offset, or set a `min-width` (~86px) on the placed box and allow sli… |
| `medium` | All-day chips wrap to two lines, tripling the lane to 114px against the sheet's 30px | `apps/web/src/components/calendar/calendar.css:191` | Shorten the chip to what a 159px column holds — drop the redundant platform word or the arrow and keep the hours ("your review · 25h"), put the ful… |
| `low` | Every event box says cursor: grab for a drag that is not wired | `apps/web/src/components/calendar/calendar.css:117` | In the app-adaptation block override `.calendar-surface button.ev { cursor: pointer }` until the write route lands, and drop the `⋮⋮` grip with it … |
| `low` | The detail's when-line prints the clock twice and inverts the surface's own date order | `apps/web/src/components/calendar/calendar-surface.tsx:752` | Strip the clock from the tail: build the line from the parts rather than from `meta` (`{dayLabel} · {clockLabel(at)} · {event.kind === "plan" ? "do… |
| `low` | Month marks "today" with colour alone, and the carried-waiting chip is distinguished only by a hover title | `apps/web/src/components/calendar/calendar.css:274` | (a) Append the word to the month cell: `{cell.isToday && <span className="mday-today">today</span>}` beside `.mday`. (b) Put the carry in the chip … |
| `low` | The "N planned" pill is scope-filtered, so it reads 0 while plans exist | `apps/web/src/components/calendar/calendar-surface.tsx:232` | Count plans before the scope filter (`allEvents.filter(e => e.kind === "plan" && rangeKeys.has(e.day)).length`), or label the pill with the scope i… |

## Sites — 12 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | Dead door: the dossier's "Wave" fact link is silently dropped for wave 2.5 | `/home/deploy/work/thalon/apps/web/src/app/app/sites/page.tsx:17` | Parse the wave as a finite number, not an integer: `const wave = Number(one("wave")); ... wave: one("wave") !== undefined && Number.isFinite(wave) … |
| `high` | A filter can be left applied with its chip hidden and no clear control on screen | `/home/deploy/work/thalon/apps/web/src/components/sites/sites.tsx:112` | Two changes: (a) always render the ACTIVE chips regardless of `expanded` — `const visibleChips = expanded ? chips : [...chips.slice(0, PRIMARY_CHIP… |
| `high` | The resting filter row is five alphabetical one-result verticals; every useful facet is hidden | `/home/deploy/work/thalon/apps/web/src/components/sites/sites-model.ts:101` | Make the resting five a cross-section instead of an alphabetical head: take the registers (axes) first — they are the sheet's own resting vocabular… |
| `medium` | Three filter kinds render as identical chips with different selection semantics and no labels | `/home/deploy/work/thalon/apps/web/src/components/sites/sites.tsx:157` | Group the row: emit the chips with a small `.t-label` lead per kind ("Vertical", "Register", "Wave") or a `role="group" aria-label` per run with a … |
| `medium` | The hover record caption clips every one-liner at ~40% with no title fallback | `/home/deploy/work/thalon/apps/web/src/components/sites/sites.css:66` | Let the one-liner take two lines inside the cap: replace the nowrap rule on `.site-line` with `display:-webkit-box; -webkit-line-clamp:2; -webkit-b… |
| `medium` | Filters are read from the URL but never written back to it | `/home/deploy/work/thalon/apps/web/src/components/sites/sites.tsx:69` | Sync on change: `useEffect(() => router.replace(`/app/sites${qs(filters)}`, { scroll: false }), [filters])` with a pure `qs()` beside `applyFilters… |
| `medium` | Verdict is the cards' only status and there is no way to filter or reach it | `/home/deploy/work/thalon/apps/web/src/components/sites/sites.tsx:124` | Add a `verdict` kind to SiteChip/SiteFilters/applyFilters/toggleChip/chipActive (three chips: Approved / Fix round / Awaiting verdict, counts from … |
| `medium` | j/k selection is a silent context change for screen readers — no aria-live, unlike its sibling surfaces | `/home/deploy/work/thalon/apps/web/src/components/sites/sites.tsx:93` | Add the established live region as the first child of `.sites-surface`: `<p aria-live="polite" className="sr-only">{selected ? `${name} — ${VERDICT… |
| `medium` | Enter re-toggles the last-clicked chip while a card is visibly selected | `/home/deploy/work/thalon/apps/web/src/components/sites/sites.tsx:98` | Move focus with the pick rather than only scrolling: in the `move` handler, focus the selected card's anchor (the existing `selectedRef`) after `se… |
| `medium` | The remote catalog fetch has no timeout, so a hung origin hangs the surface with no cue | `/home/deploy/work/thalon/apps/web/src/lib/sites/provider.ts:122` | Bound the read: `fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) })` and map the abort to the existing error state with its own w… |
| `low` | 20 cards with no sort and no name search, ordered by a fact that is invisible at rest | `/home/deploy/work/thalon/apps/web/src/lib/sites/provider.ts:113` | State the order at minimum — a `.t-label` "newest build first" beside the header pills costs one span. Better: a `.seg` sort toggle (Newest / A–Z) … |
| `low` | Zero-result copy blames "these chips" when the filter came from a URL value no chip carries | `/home/deploy/work/thalon/apps/web/src/components/sites/sites.tsx:217` | Say what is filtering, not what you assume filtered: render the active filter values in the empty row ("No sites match vertical “bogus” — 20 are bu… |

## Profiles — 10 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | Saving the profile silently deletes identity.style — the video render's brand colours — while the review panel promises a complete carry | `apps/web/src/lib/profiles/form.ts:123` | Widen the carry to identity: pass `active?.config.identity` into `formToConfig` and spread its non-known keys first — `identity: { ...unknownIdenti… |
| `high` | The Voice step renders a fully-authored voice as completely blank | `apps/web/src/components/profiles/profiles-surface.tsx:353` | Mirror the cadence pattern inside step 2: a read-only field 'Voice keys carried, untouched' rendering every stored `voice` key the chips/sample don… |
| `high` | Clearing every tone chip makes the review summary show a tone the save is about to delete | `apps/web/src/components/profiles/profiles-surface.tsx:522` | Render the review row from the edit state, not the stored one: `toneTouched ? (tone.length ? tone.join(' · ') : 'tone cleared — this save removes i… |
| `medium` | Save-time validation names a field two steps back and gives no door to it | `apps/web/src/components/profiles/profiles-surface.tsx:555` | Return the owning step index alongside the error from `formToConfig` (or map field name → step), render the error as a button that calls `setStep(o… |
| `medium` | Disabled buttons are visually identical to live ones and still respond to hover | `apps/web/src/components/profiles/profiles.css:51` | Add to the scoped stylesheet (no workspace.css edit): `.profiles-surface .btn:disabled { opacity: .55; cursor: not-allowed; }` and `.profiles-surfa… |
| `medium` | The only door to version history is an unmarked pill that looks like the read-only status pills used everywhere else | `apps/web/src/components/profiles/profiles-surface.tsx:192` | Add a disclosure caret inside the pill that rotates on `aria-expanded`, plus `.profiles-surface button.pill:hover { background: var(--n-300); }` an… |
| `medium` | Carried blocks are named but only one of them is viewable, in rows written to look identical | `apps/web/src/components/profiles/profiles-surface.tsx:543` | Render each carried block's stored values read-only in the same `.input` box grammar step 3 already uses for cadence — either inline in the review … |
| `low` | Version history is unbounded, unsorted, unfiltered, and silently truncates to the OLDEST 500 events | `apps/web/src/components/profiles/profiles-surface.tsx:222` | Bound the rows with `.profiles-surface .ver-list { max-height: 320px; overflow-y: auto; }` sized ABOVE realistic density (≈9 rows at 35px) so no sc… |
| `low` | An empty denylist disarms gate G1 and says nothing, while an empty cadence explicitly says it disarms its gate | `apps/web/src/components/profiles/profiles-surface.tsx:497` | When `form.denylist.trim()` is empty, show the same sentence shape at step 4 ('No denylist terms — gate G1 blocks nothing on this profile'), and ec… |
| `low` | The green save-confirmation survives subsequent edits, and there is no dirty indicator anywhere | `apps/web/src/components/profiles/profiles-surface.tsx:560` | Clear `savedVersion` from every edit entry point (`set`, `toggleTone`, `setSample`), and track a `dirty` flag so the footer's 'held here until you … |

## Settings — 13 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | ConnectPanel has no key — a credential pasted for one destination is still in the box when the panel re-titles itself for another, and Connect will seal it there | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations.tsx:396` | Add `key={connectCard.destination}` to the ConnectPanel element at line 396 so the panel remounts per destination. Add a regression test: open 'Set… |
| `medium` | 'Open ↗' means two different things inside the same ledger, and the blog door evacuates the workspace with no way back | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations.tsx:227` | Give the web/blog doors the same `target="_blank" rel="noreferrer"` the social rows already carry so the ↗ tells the truth on every row (integratio… |
| `medium` | 'Showing 12 of 40 publications on record' is a dead end — the other 28 have no route, though the route already returned them | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations.tsx:248` | Make the bound line a control: a `button.card-link` that raises the shown bound to `published.items.length` and then states the remaining honestly … |
| `medium` | The published ledger scrolls inside its own card at half the rows it claims to show | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations.tsx:207` | Add a scoped override in apps/web/src/components/settings/settings.css — `.settings-surface .card-rows { max-height: 520px; }` — so all twelve rows… |
| `medium` | Validate and Disconnect give no in-flight cue at the control — a slow probe is indistinguishable from an honestly-disabled card | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations.tsx:329` | Flip the label with the busy flag at 339 — `{busy === card.destination && action.key === "validate" ? "Validating…" : action.label}` — and the same… |
| `medium` | The disconnect confirm is not env-aware — it promises removal on a seat the box environment keeps posting from | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations.tsx:347` | Make the confirm copy env-aware at 347-350: when `card.envOverride`, append '— the box environment still fills this seat and will keep posting unti… |
| `medium` | 'Set up' opens a panel below an 11-card grid with no cue at the button, no aria-expanded, and no focus move | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations.tsx:330` | Add `aria-expanded={connecting === card.destination}` and `aria-controls` on the connect button, and either scrollIntoView/focus the panel's first … |
| `medium` | The grid never says which destinations post in public — the class verb only appears after you connect | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations-model.ts:128` | Put the class verb in the not_connected (and expiring/needs_reauth) sub-lines — 'Reading trends — nothing posts from here' vs 'Posting publicly as … |
| `medium` | Settings root: the Drivers and Seams cards vanish entirely while loading and on read failure | `/home/deploy/work/thalon/apps/web/src/components/settings/settings-panel.tsx:105` | Render the Drivers and Seams cards unconditionally and put the three states inside each body — 'Reading…' / a named read-failure line / the rows — … |
| `medium` | The Settings root is still the pre-rebuild surface — shadcn cards and Tailwind inside the rebuilt shell, one click above a byte-true child | `/home/deploy/work/thalon/apps/web/src/components/settings/settings-panel.tsx:51` | Rebuild the root panel in the shell's own atomics under `<div className="content settings-surface">` — `.card`/`.card-head`/`.row`/`.pill`/`.t-*`, … |
| `low` | Settings root: the read failure is terminal — no retry, unlike every other read on this surface | `/home/deploy/work/thalon/apps/web/src/components/settings/settings-panel.tsx:98` | Extract the fetch into a `loadStatus` useCallback and add the same `btn btn-ghost btn-sm` 'Try again' beside the error line, matching the wording p… |
| `low` | Published rows light up under the cursor but are not doors — only the trailing link is | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations.tsx:217` | Make the row the door (the doctrine's preference): wrap the row content in the link, or give `.row` an onClick + `cursor: pointer` where an href ex… |
| `low` | Blockers state their verdict with no address — 'Not on your plan' and 'gateway unconfigured' have no route to their reasons | `/home/deploy/work/thalon/apps/web/src/components/settings/integrations-model.ts:123` | Give each blocker the same treatment the driver rows get: name the entitlement key beside 'Not on your plan', and name the gateway env var (or link… |

## Settings — 12 raw

| sev | finding | where | fix |
|---|---|---|---|
| `blocker` | ConnectPanel is unkeyed — a secret typed for one destination rides into the next one's paste field | `apps/web/src/components/settings/integrations.tsx:396` | Key the panel by the entity it renders: `<ConnectPanel key={connectCard.destination} card={connectCard} … />`. Add a test that opens the panel for … |
| `high` | Instagram's "Set up" walks a full credential paste into a driver that refuses every publish | `apps/web/src/components/settings/integrations-model.ts:128` | Give the registry a per-destination capability note (or derive one from the driver name) and render it on the card: restore the sheet's "Almost rea… |
| `high` | "Connected" never says whether the platform is ARMED — the fact that decides if anything posts, with no door to it | `apps/web/src/components/settings/integrations.tsx:314` | Add `armed` to the card read model (the derivation already exists in social-arming) and render it as a worded second state on social cards — "conne… |
| `medium` | The three seats that are actually live in production are the only ones with no Validate and no evidence | `apps/web/src/components/settings/integrations-model.ts:155` | Either let validate probe the merged env view for env-filled seats (pass the resolved credentials rather than requiring a row), or render a disable… |
| `medium` | Validate and Disconnect give no cue at the control — a disabled .btn is pixel-identical to an enabled one | `apps/web/src/components/settings/integrations.tsx:329` | Swap the label like the connect button does ("Validating…" / "Disconnecting…") and add `aria-busy`; add a scoped `.settings-surface .btn:disabled {… |
| `medium` | Read-only intel sources are indistinguishable from posting destinations, and get social copy in the destructive confirm | `apps/web/src/components/settings/integrations-model.ts:70` | Branch statePill and the confirm sentence on `card.class` (restore "Intel connected" / "Live", and say "trend sweeps stop reading this source" for … |
| `medium` | The published ledger scrolls inside its card past 5 rows, and rows 13+ have no route at all — no filter, no sort, no see-all | `apps/web/src/components/settings/integrations.tsx:34` | Give the ledger its own scoped row region sized to its content instead of inheriting the 260px shell cap, and add the missing affordances: a destin… |
| `low` | Two rows with the same "Open ↗" affordance behave differently — one opens a tab, one navigates the workspace away | `apps/web/src/components/settings/integrations.tsx:231` | Open the blog path in a new tab as well, or label that row distinctly ("View on your blog") so the two behaviours are stated. |
| `low` | "Move into vault" moves nothing — it asks for a new token and the env keys keep winning afterwards | `apps/web/src/components/settings/integrations-model.ts:159` | Rename to "Store your own keys" (or "Add a vault credential") and add a line to the step list stating that the box's env keys stay in force until t… |
| `low` | The published door reads the same whether the ledger is loading or failed | `apps/web/src/components/settings/integrations.tsx:163` | Give the error state its own word at the control — "Published · unavailable →" — so a broken read is visible without opening the disclosure. |
| `low` | A card's action error survives a successful reconnect | `apps/web/src/components/settings/integrations.tsx:399` | Clear the destination's entry in `setActionErrors` inside onDone, next to the probe write. |
| `low` | The only way back from the rebuilt surface lands on the un-rebuilt Settings panel | `apps/web/src/components/settings/integrations.tsx:152` | Either point the breadcrumb at a rebuilt Settings index or fold the surviving Settings content into the sheet's grammar; if Settings is deliberatel… |

## Create — 17 raw

| sev | finding | where | fix |
|---|---|---|---|
| `high` | "Advanced · staged flow →" is a dead path — no staged authoring door exists, and the brief is discarded on the way | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:185` | Either (a) relabel to the truth — "Walk the staged demo →" with the palette's own hint, or (b) keep the label and add the honest state beside it: "… |
| `high` | Intel's primary suggested exit lands on a disabled Generate — the flagship path terminates in Create | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:178` | Two halves. In Create: when a capture rode in and the family is unwired, render a real control next to the disabled Generate — "Video is wired — sw… |
| `high` | A failed profile read is rendered as "no active profile" — broken and empty collapsed into one fact | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:101` | Add a third state: `type ProfileState = {resolved:false} \| {resolved:true; profile: ProfileWire\|null} \| {resolved:true; failed:true}`. On failed… |
| `high` | Grounding row lost the sheet's "view sources" door — the capture's source URL is never a link anywhere on Create | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:441` | Restore the sheet's link: when pick?.sourceUrl exists render `<a className="card-link" href={pick.sourceUrl} target="_blank" rel="noreferrer noopen… |
| `medium` | "Preview plan" produces no visible change for a mouse user | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:285` | Give the action a body: planRef.current?.scrollIntoView({block:"nearest"}) plus a transient highlight on the card (a .sel-style inset rule scoped u… |
| `medium` | One Generate writes three identical rows into Latest runs — the stage that distinguishes them is on the wire and unused | `/home/deploy/work/thalon/apps/web/src/components/create/create-model.ts:155` | In runRows, when params.stageKey is present title the row from it — "Video · scenes & effects (stage 2 of 3)" — or collapse a chain's stage runs in… |
| `medium` | Latest runs is not reloaded after a successful Generate — the run you just made isn't there | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:169` | After a queued OR blocked result in runDoor, `void loadRuns();` (it already re-stamps readAt). A blocked run is history too — reload on both. |
| `medium` | Dropping the whole capture is irreversible; dropping one field is not | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:259` | Make dropping recoverable: after pickDropped, keep a quiet inline line in the hero — "Context dropped — generation uses your prompt alone. Undo" (o… |
| `medium` | An expired or unknown capture renders identically to arriving with nothing | `/home/deploy/work/thalon/apps/web/src/components/create/create-context-loader.tsx:32` | Keep the failure: `setState({resolved:true, context:null, failed:true})` and pass it down. Render one honest label in the hero — "That capture coul… |
| `medium` | Run rows drop the sheet's media slot — the framework's own prescribed placeholder is missing | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:539` | Import { EMPTY } from "@/lib/media/resolve" and render `<SourceThumb resolution={EMPTY} legend="video" />` as the row's first child, matching the s… |
| `medium` | The family picker gives no cue which families are wired until after you pick | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:196` | Mark the state at the control: on the unwired options set title="Live post generation isn't connected to this surface yet" and a `.seg-opt.pending`… |
| `medium` | The plan card invites you to leave and silently destroys the typed brief | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:427` | Persist the brief while the operator is away: sessionStorage keyed by `create:brief:${context?.captureId ?? "none"}`, restored on mount (and cleare… |
| `medium` | A foreign-tenant demo run always sits in Latest runs, and the honest empty state is unreachable | `/home/deploy/work/thalon/apps/web/src/app/api/runs/route.ts:16` | Mark the fixture where it is built or where it is rendered: title it "Staged demo · walk the flow" with a t-label "demo chain, zero spend", or drop… |
| `low` | The prune panel clips the very value you are deciding to keep or drop | `/home/deploy/work/thalon/apps/web/src/components/create/create.css:97` | Add `title={String(rawPick[key])}` to the value span, and allow two lines before clamping (`white-space: normal; display: -webkit-box; -webkit-line… |
| `low` | No keyboard submit on the one-prompt surface | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:216` | onKeyDown on the textarea: `if ((e.metaKey\|\|e.ctrlKey) && e.key==="Enter" && armed && door.state!=="running") { e.preventDefault(); void runDoor(… |
| `low` | CreateSurface isn't keyed by the capture it renders, and the loader never resets on an id change | `/home/deploy/work/thalon/apps/web/src/components/create/create-context-loader.tsx:52` | `<CreateSurface key={contextId} … />` at line 52, and set `{resolved:false}` at the top of the contextId effect so the loading chrome shows while t… |
| `low` | The Email refusal names an exit it doesn't link | `/home/deploy/work/thalon/apps/web/src/components/create/create-surface.tsx:390` | Wrap "a lead card" in `<Link className="card-link" href="/app/leads">`. For the pruned-lead case, branch the message on rawPick?.leadId: "You dropp… |

## Transcription — 17 raw

| sev | finding | where | fix |
|---|---|---|---|
| `high` | Every disabled control on this surface looks and feels exactly like a live one | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.css:18` | Add the house rule, scoped, matching the editor precedent: `.transcription-surface .btn:disabled { cursor: not-allowed; opacity: 0.5; }` in transcr… |
| `high` | "or drop a file" is advertised in the ingest box and there is no drop handler anywhere | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:211` | Either wire it — an `onDrop`/`onDragOver` on the `.ingest` form that reads a dropped .srt/.vtt/.txt into the `captions` state (and refuses other ty… |
| `high` | Selection is an array INDEX, so it re-points at a different source after every ingest or delete | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:55` | Hold `selectedId: string \| null` and derive `const active = rows.findIndex(r => r.id === selectedId)` (falling back to 0 when -1), exactly as lead… |
| `high` | An unbounded shelf with no search, no filter and no sort — and the tags that would filter it are inert text | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:311` | Add a filter band above the card in the sheet's own chip grammar: a text box filtering on title/uri, a tag chip row built from the union of `rows.f… |
| `medium` | Opening a row paints its panel below the fold with no cue, and "Export" is the same door under a different name | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:370` | Give the panel a ref and `scrollIntoView({block:'nearest'})` when `transcript.sourceId` changes, and move focus to its heading. Then either delete … |
| `medium` | The reason .csv/.srt are refused lives in a `title` on a disabled button, where browsers never show it | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:404` | Render the reason as visible text in the `.card-head` whenever `!timed` — e.g. a `t-label` reading "plain-text ingest · no cue timings, so .csv/.sr… |
| `medium` | j/k move the selection with no scroll-into-view, so the cursor leaves the screen | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:172` | Keep a ref on the active row (`ref={index === active ? selectedRef : undefined}`) and call `selectedRef.current?.scrollIntoView({block:'nearest'})`… |
| `medium` | A single unmodified `d` deletes the selected source and nothing on the surface says the keyboard grammar exists | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:453` | Put the grammar in the footer band that already exists at :456-461 — `j/k move · ↵ open · d delete` as `kbd` chips beside the existing label. That … |
| `medium` | The transcript — this surface's primary read — is a 260px window over cue-per-line rows | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:432` | Scope an override in transcription.css — `.transcription-surface .card-rows { max-height: min(60vh, 640px); }` — and render `toParagraphs(transcrip… |
| `medium` | The `original ↗` door rides the tail of a single nowrap line and clips out of existence | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:341` | Take the link out of the clipping run — render `original ↗` as a fixed-position element in the row (beside the day stamp, or before the Copy button… |
| `medium` | The seam says "selected but not keyed yet" and offers no route to where a key is set | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:249` | Make the provider name a link to /app/settings (and the "not keyed yet" clause a link to /app/settings/integrations). One `<a>` each — the shell al… |
| `medium` | A re-ingest of a URL already on the shelf is indistinguishable from a fresh one | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:105` | Keep the response and state it: on `created === false` show a `t-label` reading "already on the shelf — opened the existing source" beside the inge… |
| `medium` | role="button" on the row container makes its link and buttons presentational to assistive tech | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:317` | Drop `role="button"` from the container, make the `.src-lead` itself the button that opens the source (keeping the whole row clickable via the div'… |
| `medium` | A source with no recorded transcript looks identical to one with 84 segments, and Copy reports "Copied" for an empty brief | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription-model.ts:50` | State the absence on the row: when `segmentCount === null` append "· no transcript recorded" to the facts line, and either disable Copy transcript … |
| `low` | A failed Copy or Delete reports at the top of the page, nowhere near the row that failed | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:262` | Scroll the alert into view when it is set, or render row-scoped failures inline in the row that produced them (the delete refusal in particular bel… |
| `low` | The download revokes its object URL synchronously and never puts the anchor in the document | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:163` | Append the anchor, click, remove it, and revoke on a `setTimeout(..., 0)` (or in `requestAnimationFrame`). Name the file from `openRow` — slugified… |
| `low` | Timecodes in the transcript panel are inert facts next to a URL that accepts a timestamp | `/home/deploy/work/thalon/apps/web/src/components/transcription/transcription.tsx:443` | When `openRow` has a web origin, render each timecode as a link to the source at that offset (`?t=<seconds>` for YouTube-shaped hosts, plain text o… |

## Board — 17 raw

| sev | finding | where | fix |
|---|---|---|---|
| `high` | Waiting column drops 9 of 21 cards behind a note that claims the opposite | `apps/web/src/components/board/board-surface.tsx:183` | State the truncation, not a scroll: render `showing 12 of 21` as a <Link href="/app/approve"> so the remainder has a door, and move it OUT of the s… |
| `high` | 620px column bound clips a card at the sheet's own density while ~180px of page height sits unused | `apps/web/src/components/board/board.css:135` | Let the shell decide the height: `.cols` already has `min-height: 0`; give `.col { max-height: 100% }` and `.col-bd { flex: 1; min-height: 0; overf… |
| `high` | Topbar says "Needs you · 25", the column says "Waiting on you 21" — same fact, same screen | `apps/web/src/components/board/board-model.ts:46` | One number from one read. Either have the Waiting column display the pulse's needsYou (it is already in context via usePulseSafe, as workspace-topb… |
| `high` | Approved / Composing / At-the-judge cards carry no platform — two identical cards render today | `apps/web/src/components/board/board-model.ts:138` | Put the platform back in the meta line for every asset column, as the Waiting column already does: `${platformLabel(asset.platform)} · ready to pla… |
| `medium` | Blocked cards lose both their identity and their platform — 10 near-identical red rows | `apps/web/src/components/board/board-model.ts:121` | Keep the draft's identity in the title and put the reason where the reason belongs: title = assetTitle(asset), meta = `${platformLabel(asset.platfo… |
| `medium` | "Intel picks" is rendered unranked — Hot, Rising, Hot, Warm, top to bottom | `apps/web/src/components/board/board-model.ts:69` | Sort before slicing, exactly as Intel does: `[...cards].sort((a, b) => b.score - a.score).slice(0, limit)`. One line, and the heat pills then read … |
| `medium` | Twelve Intel cards, one destination, no selection — the clicked card is not what opens | `apps/web/src/components/board/board-model.ts:79` | Add the card param on both ends: `href: \`/app/intel?card=${encodeURIComponent(card.id)}\`` here, and a one-shot mount read in intel.tsx that seeds… |
| `medium` | Intel card titles are model-suggested headlines presented as the trend item | `apps/web/src/components/board/board-model.ts:71` | Show `card.text` as the card's title (it is what was actually observed) and, if the suggestion is worth surfacing, put it in the meta with its own … |
| `medium` | "Intel picks" column shows unpicked sweep items and drops the sheet's picked/unpicked channel | `apps/web/src/components/board/board-model.ts:74` | Either restore the channel — expose the capture store's promoted-card ids on the trends read and render `picked · <family>` / `unpicked` in the met… |
| `medium` | Planned column's empty state tells the operator to do something the app cannot do | `apps/web/src/components/board/board-model.ts:221` | Match the Calendar's honesty: `No plans yet — planning a slot isn't wired; the slot store has no write route yet.` Restore the instructional copy i… |
| `medium` | Planned cards: identical rows with two different destinations, weekday-only labels across a 28-day window | `apps/web/src/components/board/board-model.ts:157` | Give every planned card the same door (`/app/calendar?on=<ISO date>` plus a date param the calendar honours for its anchor), date the label when th… |
| `medium` | A `scheduled` draft appears in no column; an approved draft with a slot appears in two and still says "ready to plan" | `apps/web/src/components/board/board-model.ts:44` | Make the mapping total: add `scheduled` to a column (the Planned column, driven by status ∪ slots), have `approvedCards` read `ready to plan` only … |
| `medium` | The demo dataset is painted as live pipeline with no cue | `apps/web/src/components/board/board-surface.tsx:69` | Keep the flag in state and put the word on the column, not a banner: `Intel picks` header gains a `pill-idle` reading `demo` (or the column footer … |
| `medium` | No filter and no sort on a surface whose densest column is 21 items | `apps/web/src/components/board/board-surface.tsx:91` | Add the two knobs the founder named, board-wide rather than per-column: a platform filter and a sort (oldest/newest) applied across every column's … |
| `low` | Video and staged drafts get no media slot — the media-first column is all text | `apps/web/src/components/board/board-model.ts:1` | Use one mapping. Extend the dashboard's thumbLabel with the staged formats (or have the board import approve-model's and add the platform==='web' b… |
| `low` | "published ↗" can point back into the Approve queue | `apps/web/src/components/board/board-model.ts:140` | Say what the door does: keep `published ↗` only when `deployRef !== null`, otherwise `published · no live link recorded` pointing at the draft. And… |
| `low` | The current tab is an unfocusable span with a pointer cursor and no selected state for assistive tech | `apps/web/src/components/board/board-surface.tsx:100` | Render both as buttons in a `role="tablist"` (or `<nav>`) wrapper, with the current one `aria-current="page"`, `disabled`-less but inert via onClic… |

## Videos — 8 raw

| sev | finding | where | fix |
|---|---|---|---|
| `high` | Card says "4 aspect cuts"; the dossier it opens says "none yet" — the family line mixes three different scopes | `/home/deploy/work/thalon/apps/web/src/components/videos/videos-model.ts:86` | Make the card count what the dossier shows, or say the scope out loud. Cheapest correct version: count distinct aspects, not rows — `new Set(detail… |
| `medium` | An approve refusal survives a version switch and is read as the new version's verdict | `/home/deploy/work/thalon/apps/web/src/components/videos/dossier.tsx:222` | Clear the gate result whenever the entity it describes changes: add `setNotice(null); setRefusals([])` to the version-chip handler (and to load()),… |
| `medium` | ↵ open silently does nothing after any button click, while the card still wears the picked accent | `/home/deploy/work/thalon/apps/web/src/components/videos/videos.tsx:129` | Move focus with the pick instead of only scrolling: in the [picked] effect call `pickedRef.current?.focus({preventScroll:false})` (the card's exist… |
| `medium` | Family facts wear the sheet's link treatment but are not doors and never respond | `/home/deploy/work/thalon/apps/web/src/components/videos/videos.tsx:308` | Either make them real doors or stop drawing them as doors. Real: give the dossier deep-link params it already has the state for (`?cut=…&open=takes… |
| `medium` | A project whose record couldn't be read vanishes silently under any state filter | `/home/deploy/work/thalon/apps/web/src/components/videos/videos.tsx:106` | Keep unreadable cards visible under every filter (they already say why), or append the fact to the count pill — `${shown.length} of ${summaries.len… |
| `low` | No sort and no name search on an unbounded project grid; the ordering rule is never stated | `/home/deploy/work/thalon/apps/web/src/components/videos/videos.tsx:157` | Add the missing axis beside the existing chips: a sort control (Newest · Name · State) driving the same `shown` array, and/or a name filter input (… |
| `low` | Two buttons toggle one disclosure and neither changes when it is open | `/home/deploy/work/thalon/apps/web/src/components/videos/videos.tsx:174` | Flip the label on open ("Import media" → "Hide import" / "Browse files" → "Close") or add a scoped pressed style, e.g. `.videos-surface .btn[aria-e… |
| `low` | j/k selection has no path back to unselected, against the house Escape convention | `/home/deploy/work/thalon/apps/web/src/components/videos/videos.tsx:124` | Add `Escape: () => setPickedId(null)` to the useListKeys bindings (call event.preventDefault() only when something was actually picked, so Escape s… |

## Runs — 13 raw

| sev | finding | where | fix |
|---|---|---|---|
| `high` | Global Enter binding hijacks the surface's own buttons — the All/Failed/Published filter cannot be operated by keyboard | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:149` | Guard the binding on the event target, not just typing targets: in lib/workspace/keyboard.ts add `if (event.target instanceof HTMLElement && event.… |
| `high` | A failed run with zero drafts opens into Approve and silently selects a DIFFERENT run's draft | `/home/deploy/work/thalon/apps/web/src/components/runs/runs-model.ts:133` | Two-sided. (a) In approve-surface.tsx make an unmatched ?run= honest instead of silently falling back: when `runId && runItems.length === 0`, selec… |
| `high` | Every row's lead is derived from platforms only — 19 of 27 live rows read the identical string "Fan-out · Video" | `/home/deploy/work/thalon/apps/web/src/components/runs/runs-model.ts:134` | Build the lead the way the sheet does: `${topic} · ${platforms.map(platformLabel).join(" + ")}` where topic = the first asset's `excerpt` bounded t… |
| `medium` | Failed rows lose their "Open →" door and keep only an unarmed Retry whose reason is hover-only on a non-focusable span | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:340` | Keep "Open →" on every row and put Retry beside it; make Retry a real `<button type="button" disabled>` (or a focusable button with aria-disabled="… |
| `medium` | The verbatim lastError — the triage evidence — is clipped by the single-line .excerpt with no title and no other route to the full text | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:321` | Add `title={row.excerpt}` (and `title={row.liveHref}` on the anchor) on the excerpt element in runs.tsx:321 as the floor, and in the scoped runs.cs… |
| `medium` | Plan-read failure shows the honest "unresolved, not empty" alert AND a card asserting "Nothing published yet" directly beneath it | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:35` | Add the missing branch: `if (planStatus === "error") return "Publish state couldn't be read — retry above.";` in emptyLine, or suppress the empty c… |
| `medium` | Enter on the published live-page link fires two navigations — opens the page and throws the surface to Approve | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:310` | `onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(); }}` at runs.tsx:310, which also removes the double-push when … |
| `low` | j/k selection changes nothing announceable — no aria-live, no focus move, and the grammar is never named on the surface | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:138` | Add the Approve surface's pattern verbatim — an `<p aria-live="polite" className="sr-only">` announcing `${ordered[active].lead}, ${pill.label}, ${… |
| `low` | The row's aria-label replaces its content, dropping the timestamp, the error text and the judge reason from what AT announces | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:307` | Either drop the aria-label and let the row's own text name it, or extend it to carry the evidence: `${row.lead} — ${row.pill.label} — ${row.excerpt… |
| `low` | The "N failed" header pill is not a door to the Failed view, and its count silently includes runs whose pill says "Incomplete" | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:177` | Make the pill a button that sets `filter="failed"` (same visual, `.pill` on a <button> — no layout drift), and align the words: either label the he… |
| `low` | 27 rows (feed cap 50) of near-identical leads with no search, no platform filter and no sort control | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:181` | Add one `.sel-ctl` platform filter (and optionally the oldest/newest sort) beside the seg using Approve's exact markup, and state the bound at the … |
| `low` | The ?run= deep link is never consumed, so it re-hijacks selection and scroll on every filter change | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:74` | Consume it once: hold targetRunId in a ref and null it after the first successful match (or set `selected` to deepIndex once when runs resolve), so… |
| `low` | The footer promises cost receipts that no destination on the path shows | `/home/deploy/work/thalon/apps/web/src/components/runs/runs.tsx:277` | Extend the draft card's existing provenance line (draft-card.tsx:321) with the run's token/cost figure where the engine records one — it already ow… |

## s78 plan

1. **Verify first — it is the whole point.** Re-run the audit's Verify phase
   over these 189 (`fe-check`-style adversarial refutation, default
   `real:false`). Fix nothing until a finding survives it.
2. **Then the keyed-by-entity sweep**, as ONE change across every surface it
   touches, with a pinned test each. It is one disease and the Approve case
   writes one draft's body onto another.
3. **Then blockers → high**, surface by surface, screenshot-gated per the
   standing rule.
4. **Then the founder's re-introductions**: filters + sort where the fan-out
   independently agreed they are missing, and the calendar's write route
   (`/api/calendar` does not exist, which is why reschedule is unarmed).
5. **Founder rulings to collect before the walk** (they change the work):
   Approve's "Oldest first" chip vs its newest-first rows · the calendar
   "+N more" sheet divergence · whether the Dashboard publish door should arm.
6. **The 15th surface never returned** (the run was stopped) — re-walk it.

**Spend note, unchanged:** arming post/page generation on Create is the one
item here that costs real tokens per click, so it wants an explicit founder GO
on the arming, not just on the building.

