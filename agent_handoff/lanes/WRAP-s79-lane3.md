# WRAP — s79 lane 3: `dashboard · transcription · sites`

Branch `s79-lane3-dashtransites`, rebased onto `main` (`2db2406`). **Not merged** —
the lead merge-gates on rebase + `npm run verify` on merged main + a MEASURED
render + driving the surfaces.

## Round 1 — the verify gate: 11 findings, 11 survived, 0 refuted

Three parallel workflows (one per surface), **three independent refuters per
finding**, each prompted to REFUTE, each defaulting `real:false`, each on a
distinct lens (`code` = does the code literally do this · `by-design` = honest
refusal / faithful sheet port / served elsewhere / documented trade-off ·
`repro` = does it happen on today's real data). Majority of 3 to survive.
**33 refuters, 31 voted real.**

| id | finding | votes | verdict |
|---|---|---|---|
| D1 `blocker` | needs-you card's global Enter steals Enter from every control | 3/3 | SURVIVES |
| D2 `high` | j/k walks the selection out of the scroll box, box never follows | 3/3 | SURVIVES |
| D3 `high` | head says 25, card lists 21 — two reads, two windows, no statement | 3/3 | SURVIVES |
| D4 `high` | day view puts week-old waiting drafts on today's clock | 3/3 | SURVIVES |
| D5 `high` | "your review" marks paint accent blue, not warn amber | 3/3 | SURVIVES |
| T1 `high` | every disabled control looks and feels like a live one | 3/3 | SURVIVES, RELOCATED |
| T2 `high` | "or drop a file" advertised, no drop handler anywhere | 3/3 | SURVIVES |
| T3 `high` | unbounded shelf, no search/filter/sort; tags inert | **2/3** | SURVIVES, HALVED |
| S1 `blocker` | dead door: the dossier's Wave link is dropped for wave 2.5 | 3/3 | SURVIVES |
| S2 `high` | a filter can be applied with its chip hidden and no clear | **2/3** | SURVIVES, NARROWED |
| S3 `high` | the resting filter row is five one-result verticals | 3/3 | SURVIVES |

**Nothing was killed — the same result s78 lane 1 got, and for the same reason:
blocker+high is the pile least likely to be invented, and every finding arrived
with a file:line its walker had already read.** The gate still paid for itself:
it corrected **eight of the eleven** in ways that changed the fix, and on two
(T1, T2) the audit's own suggested fix would have made the surface worse.

### I drove all three surfaces in a real browser BEFORE fixing

`localhost:3111` serves main, and at Round 1 my branch was code-identical to it
(the only delta was two docs commits), so driving main **was** driving my code.
Measured with puppeteer at the sheet's own 1440×940 — these are numbers, not
arguments:

- **D3** — the card head pill reads `25`; the card lists `21` rows. Live
  `/api/app/pulse` → `needsYou: 25`; `/api/app/plan` → 26 assets, 11 queued + 10
  blocked = 21.
- **D2** — after 12×`j` the selected row sits **743px** down a **419px** box with
  `scrollTop` still **0**. The cursor works for ~5 presses, then goes silent.
- **D5** — all six `.mark-you` on `/app` are `<a>` and compute to `--act`
  exactly, over a `--warn-subtle` fill that survives.
- **D1** — focused the "Board" seg button, pressed Enter → landed on
  `/app/approve?run=aeab5224…&draft=54de377b…`, **not** `/app/board`. Then Enter
  on "Open approve →" (href `/app/approve`) → `/app/approve?run=92ba9d67…&draft=…`.
- **S1** — `/app/sites/sprig-and-barrow` emits `href="/app/sites?wave=2.5"`;
  following it renders **20 cards / "20 built" / no active chip**. Control
  `?wave=3` → **5 cards / "5 of 20 built" / chip "Wave 3" on**.
- **S3** — the resting row is 5 chips, **each matching exactly 1 site**
  (`B2b · science consumables distributor`, `Events · live production`,
  `Fitness · run coaching`, `Florist · weddings`, `Food · coffee roastery`);
  **30 chips** sit behind "More →".
- **S2** — with `?wave=3` applied and the row collapsed: 5 cards still filtered,
  **zero** chips marked active, and the only buttons in the whole surface are
  `Build site` (disabled) + the five resting verticals + `More →`.
- **T1** — the disabled `Ingest` button computes `opacity: 1`, `cursor: pointer`,
  and carried no title.
- **T2** — dispatched a real `.srt` drop on the ingest box: `dragover` and `drop`
  both `defaultPrevented === false`. Nothing in the app touches it.
- **T3** — **the live shelf is EMPTY** (`/api/library` → `{"sources":[]}`, pill
  reads "0 sources"). See T3 below: this is why one lens refuted it.

### The eight corrections the gate forced on the fixes

- **D1 — the narrow guard four siblings use would NOT have been enough.** The
  needs-you rows are `role="button"` divs with their own Enter handler, so a
  focused row was firing *both* its handler and the window binding — a double
  push. The fix uses Runs' broader `closest("button, a, [role=button]")`.
  Blast radius is also wider than the finding said: the listener is on `window`,
  so it stole Enter from the shell's own side-nav too.
- **D2 — key the effect on `selectedId`, never on `active`.** The card re-reads
  on the dashboard pulse, so the index moves with no operator action; an
  `active`-keyed effect would yank the box while they read further down.
  `block: "nearest"`, not `"center"`, for the same reason.
- **D3 — my planned fix was one of the two the verifiers named as WORSE.** I was
  going to feed the pill from `rows.length`. The topbar chip and the rail badge
  both render the pulse's number on this same screen, so that trades one visible
  disagreement for two invisible ones. Raising `PLAN_RUN_WINDOW` to match is
  also refused here: it is a shared-lib read-cost call (the plan read is an N+1),
  and s78 lane 1 already routed that decision to the lead. **State the bound,
  don't chase the number.** The verifiers also found the sibling symptom I had
  not: the tile's "oldest has waited Nh" is computed from the narrower window
  while its number comes from the wider one — and the drafts outside the window
  are precisely the oldest. Both now say which set they measure.
- **D4 — only CARRIED waiting drafts are misplaced**, and the carry itself must
  not be reverted (it exists so waiting work cannot vanish — critique P1, s39).
  A draft that started waiting today at 09:12 truthfully sits at 09:12. The
  comment that shipped this claimed the placement was "the same honest placement
  the main calendar makes"; the calendar does the **opposite** — it filters
  `kind === "you"` off the axis into a lane. That false rationale is now
  corrected in the file. The `repro` lens also found a **second bug inside the
  first**: `stacked` assumes ascending `top` while `dayEvents` was sorted by
  absolute instant, so a week-old 06:48 chip sorted ahead of today's 12:08 one
  and was swallowed as "+1" — only two chips were drawn on today's clock and
  both were a week old. Fixed by sorting on the value the layout actually uses.
- **D5 — the durable home is `workspace.css`, which this lane may not touch.**
  All three lenses agreed: `.mark`/`.mark-you` is SHELL grammar that the Calendar
  also renders as Links (its month marks), so one line at workspace.css:250-252
  would fix both surfaces, and a Dashboard-scoped rule leaves the Calendar
  broken and puts two copies of one shell atom in the repo. Constraint 1 is not
  negotiable, so I shipped the lane-legal scoped form — **and the shell
  promotion is written up for the lead below.** The finding also overstated the
  damage: only the FOREGROUND flips; the amber fill survives, so the mark reads
  as an amber pill with blue text.
- **T1 — the claimed sibling precedent does not exist.** No `.btn:disabled` rule
  exists anywhere in this repo; the five that look like precedent are bespoke
  controls (`.plan-choice`, `.input`, `.tone-chip`, `button.play-btn`,
  `input.prompt-box`). Nothing upstream dims a disabled `.btn` either — Astryx's
  reset declares `:where(:disabled){cursor:default}` at zero specificity and
  Tailwind's preflight sets `opacity:1` on `button` explicitly. So this is a
  **shell-wide gap in a lead-owned file** (the same raw finding is filed against
  Approve, Profiles and Settings), and the lane-legal scoped rule is *not*
  parity — it makes Transcription the one surface where buttons dim. Second
  correction, load-bearing: three of this surface's five disabled controls are
  `disabled={busy}` — **transient, not refusals** — and dimming them would make
  RUNNING look like NOT-READY, which the audit itself names as wrong. They now
  flip their own label and carry `aria-busy`, so the word carries the
  distinction the dim cannot.
- **T2 — the audit's suggested fix would have been worse than the bug.** It said
  to read the dropped file into `captions`. Captions are consumed **only** by the
  `caption-file` provider; the live seam is `hosted-vendor`, which fetches from
  the link and ignores them, and the captions textarea is not even rendered
  outside caption mode. The file would have vanished into invisible state under a
  button still disabled by `!url.trim()`. It branches honestly instead.
- **T3 — half the finding is false and the other half is the founder's ask.**
  The `repro` lens refuted it outright and was right on both counts: the shelf
  has **zero rows on today's data**, and the per-row tags are **not** chip-shaped
  — they are prose inside a `nowrap`/ellipsis `.excerpt`, so they never lied
  about being pressable; they just clip out of view. Nothing on the surface
  claims filtering exists, so this is a missing capability, not a dead door. It
  is shipped anyway because it **is** the founder's named "re-introduce filters,
  sort by", which the kickoff routes to me explicitly — and the fix therefore
  builds real controls in a band and leaves the row's prose alone.
- **S2 — two of the finding's three consequence clauses are wrong.** The header
  pill *does* announce the slice ("5 of 20 built"), and "More →" *is* a one-click
  way back to the hidden chip; the URL-seeded path is explicitly defended in code
  and pinned by an existing test. The residual defect is narrower and real: the
  filter's **identity** can be off-screen after an operator-inflicted collapse,
  and the only "Clear filters" control lives in the zero-result state that a
  working filter never reaches. All three lenses (including the refuter) named
  the same fix and the same two ways to make it worse — which I avoided: no
  persistent clear-filters band (the sheet draws none), no forcing the row open
  on a chip click (that fights the operator's own "Fewer ←").
- **S3 — the sort is not alphabetical; it is a weight sort that degenerates.**
  `siteChips` sorts verticals by count descending with `localeCompare` only as
  tie-break. Today's catalog is 20 sites across 20 **distinct** verticals, so
  every count is 1, the discriminant is always 0, and the tie-break decides the
  whole order. "Fix the sort" was therefore the wrong fix; the false comment
  ("most built first — the portfolio's own weight") is corrected in place. Two
  lenses also graded it medium rather than high, and noted the sheet is no
  defence: `Sites.dc.html` draws five **coarse, multi-site** chips, so five
  one-site niches diverge from the sheet's intent rather than honouring it.

## Round 2 — what shipped

**Dashboard** (`components/dashboard/**`)
- **D1** — `closest("button, a, [role=button]")` on the Enter binding, with the
  s79 live evidence in the comment. The advertised `↵ open` still works with
  nothing focused.
- **D2** — `selectedRef` on the active row + `scrollIntoView({block:"nearest"})`
  keyed on `selectedId`, optional-called (jsdom has no layout).
- **D3** — the card footer states `21 of 25 shown — the oldest wait in the queue →`
  (a link, only when `count > rows.length`), and the tile reads
  `21 of 25 read · oldest of those Nh` when the two windows disagree. The pill
  keeps the pulse's number: one number for one fact.
- **D4** — carried waiting work moves into a non-timed `waiting` lane above the
  hour grid, in the **calendar's own vocabulary** (`.allday` → `.wd-wait`, amber
  chips reading `lead · Nh →`, bounded at 3 with `+N more waiting →` as a real
  door). Same-day waiting keeps its true place on the clock. The empty axis over
  a full lane says which fact it is reporting. Axis events now sort by position.
- **D5** — new `components/dashboard/dashboard.css`, every rule scoped under
  `.dashboard-surface` (added to the root, which this surface never had), giving
  linked marks and linked day chips their own colour channel back.

**Transcription** (`components/transcription/**`)
- **T1** — scoped `.btn:disabled { opacity:.55; cursor:not-allowed }` plus a
  per-variant `:disabled:hover` neutraliser (each restating its resting values —
  `inherit` would take the parent's). The three transient controls flip to
  "Ingesting…"/"Working…" with `aria-busy`; the resting Ingest refusal now names
  what it is waiting for.
- **T2** — `onDragOver`/`onDrop` on the ingest form. The drop can never leave the
  surface; a wrong extension is refused **by name**; a caption file on a fetching
  seam is refused in the engine's own words; on `caption-file` it reads into the
  captions box, **opens the panel so the operator sees it land**, and says that
  the URL the schema requires is still needed. A failed read is reported, never a
  silent no-op. The sheet's own copy ("or drop a file") is now true — unchanged.
- **T3** — a knobs band between the ingest card and the shelf, in **Approve's
  `.sel-ctl` grammar + lane 1's find box** (find over title/uri/**tags** · tag
  filter built from the shelf's own tags · sort Newest/Oldest/Title A–Z · Clear).
  Absent entirely on an empty shelf. The count pill states `N of M sources` when
  narrowed; a narrowed-empty shelf says **the knob** emptied it; the cursor walks
  the SHOWN list so `↵`/`d` can never act on a row the filter removed; and an
  ingest clears the narrowing so a write never lands behind a filter.

**Sites** (`components/sites/**`, `app/app/sites/**`)
- **S1** — `Number.isFinite` in `readFilters`, which is now **exported and under
  test** (a door's parse belongs under test, not inside a page body). `?wave=abc`
  is still refused: letting NaN through would empty the grid for every typo,
  which is worse than ignoring the filter.
- **S2 + S3 as one change** (they are one row): `restingChips()` decides *which*
  five rest — actives first (so an applied filter is never nameless, and one
  click on the hoisted chip clears it), then the chips that cut hardest, skipping
  any matching one record (a bookmark) or all of them (no cut), falling back to
  the reading order so the row never shrinks below the sheet's five. Nothing is
  dropped; the expanded row keeps its pinned reading order. Each chip gained a
  `title` naming its facet and its count — the resting row now mixes kinds, so
  position no longer reads as the kind.

## Tests — every fix pinned, every pin revert-checked

**+34 tests in four new files.** Each was run with its fix reverted to prove it
fails without it: D1 (3 of 4 — the fourth pins the path the fix must not break),
D2, D3, D4, D5 (root class and stylesheet separately), T1 (css, busy label and
refusal title separately), T2 (all four), T3 (5 of 7 on the narrowing + the band
gate separately), S1 (2), S2, S3.

- `dashboard/__tests__/dashboard-s79-fixes.test.tsx` · `dashboard-css.test.ts`
- `transcription/__tests__/transcription-s79-fixes.test.tsx` · `transcription-css.test.ts`
- `sites/__tests__/sites-s79-fixes.test.tsx`

D5 and T1 are pure cascade fixes and jsdom computes no cascade, so they are
pinned as stylesheet assertions on the **rule** (lane 1's `board-css.test.ts`
precedent), each carrying the specificity math and the measured evidence. Both
files also re-assert README rule 6 locally, so a future unscoped rule fails in
the surface's own test as well as in the repo ratchet.

One guard-on-a-guard: `D4 guard` asserts the sweep-free fixture really carries a
waiting draft, so the D4/D5 assertions can never pass by rendering nothing.

## Cross-lane touch — READ THIS

**`apps/web/src/test/setup.ts` (shared with lane 4).** jsdom's `Blob`/`File`
implement no `.text()`, so T2's caption-file drop test saw a surface that did
nothing. Added a spec-shaped polyfill in the file's own established style
(it already stubs `matchMedia`, `HTMLMediaElement.play`, `ResizeObserver` the
same way). **This also covers Leads' CSV import**, which reads a picked file the
same way and had no test over the read itself. Additive, 16 lines, guarded on
absence — but it is a shared file, so lane 4 should expect it on rebase.

## For the LEAD — three calls that are yours, not a lane's

1. **Promote the mark-colour fix into the shell.** `workspace.css:250-252`
   should read `.mark, .screen a.mark { … }` / `.mark-you, .screen a.mark-you
   { … }` / `.mark-plan, .screen a.mark-plan { … }`, byte-identical declarations,
   exactly as line 146 already does for `.pill-warn`. That fixes the **Calendar's
   month marks** too (`calendar-surface.tsx` renders the same grammar as Links),
   and my scoped copy in `dashboard.css` can then be deleted. I did not touch the
   file (constraint 1).
2. **Promote `.btn:disabled` into the shell.** One rule fixes ~15 surfaces; the
   same raw finding is filed against Approve, Profiles and Settings, and my
   scoped rule makes Transcription the only surface where a refused button dims.
   Keyed to refusal, not busy — the label-flip half is what keeps that honest.
3. **`PLAN_RUN_WINDOW` (20) vs `PULSE_RUN_WINDOW` (50) still disagree at the
   source.** D3 is fixed at the surface (the bound is stated, with a door), and
   s78 lane 1 fixed the same symptom on Board the same way. Reconciling them is a
   shared-lib read-cost decision — the plan read is an N+1 (`drafts.listByRun`
   per run) and the window is the only thing holding it.

## Expected visual deltas — for the lead's screenshot gate

I **cannot** shoot my own work: `shoot-surface.mjs` refuses from a worktree
(enforced by `tests/worktree-screenshot-guard.test.ts`). What to look for on
merged main:

**Dashboard** (`Dashboard.dc.html`, route `/app`)
- The **"your review" marks turn amber** (they were accent blue). This is the
  most visible delta and the one to check in both themes.
- The needs-you footer gains a middle clause: `· 21 of 25 shown — the oldest
  wait in the queue →`, in `.t-label`/`.card-link` type. `oldest first` and the
  `j k ↵` chips keep their slots. **Absent when the two reads agree.**
- The "Needs you" tile's ctx line reads `21 of 25 read · oldest of those 158h`
  instead of `oldest has waited 158h`. One line, same slot.
- **Today view only:** a new ~34px amber-chip lane above the hour grid, labelled
  `waiting` in the gutter's mono type — and today's clock is now largely EMPTY
  (on live data every waiting draft is carried), with the honest line
  "Nothing is timed for today…". This is a big, intended change to that view.
- Week view, tiles, published strip, the card's geometry: unchanged.

**Transcription** (`Library.dc.html`, route `/app/transcription`)
- **A new band between the ingest card and the shelf** — find box + two
  `.sel-ctl` chips + `Clear` — but **only when the shelf has rows**. The live
  shelf is empty today, so the resting screenshot should be **unchanged**; seed a
  source to see the band.
- **The disabled `Ingest` button now renders at 55% opacity at rest.** This is a
  deliberate deviation from the sheet, which draws that button at full strength
  (`Library.dc.html:56`) because a static mock has no empty-input state. An armed
  -looking primary button that does nothing is the exact defect this pass exists
  to remove — but it IS a resting-render delta, so it is the lead's to accept or
  bounce, and the founder's to rule on if the lead wants it recorded as an
  amendment.
- Row chrome, thumbs, the transcript panel and the footer: unchanged.

**Sites** (`Sites.dc.html`, route `/app/sites`)
- **The five resting chips change identity**: on the live catalog they become
  `Cinematic imagery` (9) · `Wave 2` (6) · `Data instrument` (5) ·
  `Soft organic` (5) · `Wave 1`/`Wave 3` (5) instead of five one-site verticals.
  Same five slots, same `More →`, same geometry — the sheet's own bound is
  untouched, and the sheet's fixture chips are coarse groups, so this moves
  *toward* it.
- With a filter applied the active chip is always among the five, `.on`.
- `/app/sites?wave=2.5` now renders **1 card / "1 of 20 built"** with the
  `Wave 2.5` chip on — it rendered 20 cards before.
- Chips gained a hover `title`; no visual change at rest.

## Jobs I drove vs deferred to the lead

**Driven end-to-end in a real browser (pre-fix, on code identical to mine):** the
Dashboard's triage job (read the queue → j/k → ↵ open), the Sites browse job
(dossier → fact door → filtered portfolio → chip toggle → collapse), and the
Transcription ingest job as far as an empty shelf allows.

**Driven post-fix in real renders with real event dispatch (jsdom):** every fix,
via the 34 tests — including the drop, which dispatches an actual `drop` event
with a real `File` and asserts `defaultPrevented`.

**NOT driven post-fix in a browser, and why:** `next dev` cannot run inside a
lane (Turbopack rejects the out-of-root `node_modules` symlinks), and
`shoot-surface.mjs` refuses from a worktree by design. The exact scripts I used
are below — run them against merged main.

Save this as `/tmp/drive-s79-lane3.mjs` and run it from the repo root with the
dev server up. It re-runs every measurement quoted above and prints PASS/FAIL
against the post-fix expectation, so it is a gate and not a tour.

**It has teeth — I ran it against PRE-FIX main and it caught all ten:**

```
FAIL  D3 gap stated — pill 25, 21 rows, bound "null", tile "null"
FAIL  D5 marks paint warn — 6 marks, first lab(57.0159 …) = --act exactly
FAIL  D2 box follows the cursor — scrollTop 0
FAIL  D1 Enter reaches the Board button — /app/approve?run=aeab5224…&draft=54de377b…
FAIL  D4 waiting work is in the lane — 0 lane chips, 2 on the axis
FAIL  S1 the wave door filters — ?wave=2.5 → 20 cards, pill "20 built", active []
FAIL  S3 every resting chip is a real cut — five chips, every one → 1 site
FAIL  S2 the filter names itself while collapsed — 5 cards, active []
FAIL  T1 a refused control looks refused — disabled=true opacity=1 cursor=pointer title=null
FAIL  T2 the drop is handled, never the browser's
PASS  T3 the knobs band tracks the shelf — pill "0 sources", band absent IS correct
10 FAILED
```

D4's line is worth reading twice: **2 chips on today's axis**, which is the
`stacked`-vs-sort collapse the repro lens predicted — 21 waiting drafts, two
chips drawn, both of them a week old. On merged main every line above must read
PASS (T3 stays PASS trivially while the shelf is empty).

```js
/* global document, getComputedStyle, Event */
import puppeteer from "/home/deploy/work/thalon/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js";
const BASE = "http://localhost:3111"; // localhost, NEVER 127.0.0.1
let bad = 0;
const check = (name, ok, detail) => {
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 940 });
const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));

// ── Dashboard ──────────────────────────────────────────────────────────────
await p.goto(`${BASE}/app`, { waitUntil: "networkidle2", timeout: 60_000 });
await p.waitForSelector('section[aria-label="Needs you"] .row', { timeout: 30_000 });
await settle(1500);

// D3 — the bound is stated with a door whenever the two reads disagree.
const d3 = await p.evaluate(() => {
  const card = document.querySelector('section[aria-label="Needs you"]');
  return {
    pill: card.querySelector(".card-head .pill")?.textContent,
    rows: card.querySelectorAll(".card-rows .row").length,
    bound: card.textContent.match(/(\d+) of (\d+) shown/)?.[0] ?? null,
    door: !!Array.from(card.querySelectorAll("a")).find((a) => /oldest wait in the queue/.test(a.textContent)),
    tile: document.body.textContent.match(/\d+ of \d+ read · oldest of those \d+h/)?.[0] ?? null,
  };
});
check("D3 gap stated", d3.pill === String(d3.rows) || (d3.bound !== null && d3.door),
  `pill ${d3.pill}, ${d3.rows} rows, bound "${d3.bound}", tile "${d3.tile}"`);

// D5 — a linked waiting mark paints warn, not accent.
const d5 = await p.evaluate(() => {
  const probe = document.createElement("span");
  document.body.appendChild(probe);
  const rgb = (v) => { probe.style.color = v; return getComputedStyle(probe).color; };
  const root = getComputedStyle(document.documentElement);
  const warn = rgb(root.getPropertyValue("--warn").trim());
  const act = rgb(root.getPropertyValue("--act").trim());
  probe.remove();
  const marks = [...document.querySelectorAll(".mark-you")];
  return { n: marks.length, colors: marks.map((m) => getComputedStyle(m).color), warn, act };
});
check("D5 marks paint warn", d5.n > 0 && d5.colors.every((c) => c === d5.warn),
  `${d5.n} marks, first ${d5.colors[0]}, warn ${d5.warn}, act ${d5.act}`);

// D2 — the scroll box follows j/k.
await p.evaluate(() => document.querySelector(".content").click());
for (let i = 0; i < 12; i++) await p.keyboard.press("j");
await settle(400);
const d2 = await p.evaluate(() => {
  const box = document.querySelector('section[aria-label="Needs you"] .card-rows');
  const sel = box.querySelector(".row.sel");
  const bb = box.getBoundingClientRect(), sb = sel?.getBoundingClientRect();
  return { scrollTop: box.scrollTop, inside: sb ? sb.top >= bb.top - 1 && sb.bottom <= bb.bottom + 1 : null };
});
check("D2 box follows the cursor", d2.inside === true, `scrollTop ${d2.scrollTop}`);

// D1 — a focused control owns its own Enter.
await p.evaluate(() => [...document.querySelectorAll("button.seg-opt")].find((x) => x.textContent.trim() === "Board").focus());
await p.keyboard.press("Enter");
await settle(1200);
check("D1 Enter reaches the Board button", p.url().endsWith("/app/board"), p.url().replace(BASE, ""));

// D4 — carried waiting work is off today's clock and in the lane.
await p.goto(`${BASE}/app`, { waitUntil: "networkidle2" });
await p.waitForSelector(".week-body", { timeout: 30_000 });
await p.evaluate(() => [...document.querySelectorAll("button.seg-opt")].find((x) => x.textContent.trim() === "Today").click());
await settle(800);
const d4 = await p.evaluate(() => ({
  lane: document.querySelectorAll(".wd-wait .wd-wait-chip").length,
  onAxis: document.querySelectorAll(".wd-ev.wd-you").length,
  laneAboveBody: !!document.querySelector(".wd-wait")?.nextElementSibling?.classList.contains("week-body"),
}));
check("D4 waiting work is in the lane, not on the axis", d4.lane > 0 && d4.laneAboveBody,
  `${d4.lane} lane chips, ${d4.onAxis} on the axis (only drafts that started waiting TODAY belong there)`);

// ── Sites ──────────────────────────────────────────────────────────────────
await p.goto(`${BASE}/app/sites/sprig-and-barrow`, { waitUntil: "networkidle2" });
const href = await p.evaluate(() => [...document.querySelectorAll("a")].find((a) => /Wave\s/.test(a.textContent))?.getAttribute("href"));
await p.goto(`${BASE}${href}`, { waitUntil: "networkidle2" });
await p.waitForSelector(".site-card", { timeout: 30_000 });
const s1 = await p.evaluate(() => ({
  cards: document.querySelectorAll(".site-card").length,
  pill: document.querySelector(".sites-surface .pill-idle")?.textContent,
  on: [...document.querySelectorAll(".cat-chip.on")].map((c) => c.textContent),
}));
check("S1 the wave door filters", s1.cards === 1 && /1 of \d+ built/.test(s1.pill ?? ""),
  `${href} → ${s1.cards} cards, pill "${s1.pill}", active ${JSON.stringify(s1.on)}`);

await p.goto(`${BASE}/app/sites`, { waitUntil: "networkidle2" });
await p.waitForSelector(".cat-chip", { timeout: 30_000 });
const s3 = await p.evaluate(async () => {
  const labels = [...document.querySelectorAll(".cat-chip")].map((c) => c.textContent).filter((t) => !/More →/.test(t));
  const counts = [];
  for (const label of labels) {
    const click = () => [...document.querySelectorAll(".cat-chip")].find((c) => c.textContent === label).click();
    click(); await new Promise((r) => setTimeout(r, 250));
    counts.push({ label, n: document.querySelectorAll(".site-card").length, title: [...document.querySelectorAll(".cat-chip")].find((c) => c.textContent === label)?.title });
    click(); await new Promise((r) => setTimeout(r, 250));
  }
  return counts;
});
check("S3 every resting chip is a real cut", s3.every((c) => c.n > 1),
  s3.map((c) => `${c.label}→${c.n}`).join(" · "));

// S2 — an applied filter is never nameless after a collapse.
await p.goto(`${BASE}/app/sites?wave=3`, { waitUntil: "networkidle2" });
await p.waitForSelector(".site-card", { timeout: 30_000 });
await p.evaluate(() => [...document.querySelectorAll(".cat-chip")].find((c) => /Fewer ←/.test(c.textContent))?.click());
await settle(500);
const s2 = await p.evaluate(() => ({
  cards: document.querySelectorAll(".site-card").length,
  on: [...document.querySelectorAll(".cat-chip.on")].map((c) => c.textContent),
}));
check("S2 the filter names itself while collapsed", s2.on.length > 0, `${s2.cards} cards, active ${JSON.stringify(s2.on)}`);

// ── Transcription ──────────────────────────────────────────────────────────
await p.goto(`${BASE}/app/transcription`, { waitUntil: "networkidle2" });
await p.waitForSelector(".transcription-surface .card", { timeout: 30_000 });
await settle(1200);
const t = await p.evaluate(() => {
  const btn = document.querySelector(".transcription-surface .btn-primary");
  const form = document.querySelector(".transcription-surface .ingest");
  const over = new Event("dragover", { bubbles: true, cancelable: true });
  form.dispatchEvent(over);
  return {
    rows: document.querySelectorAll(".transcription-surface .card .row").length,
    pill: document.querySelector(".transcription-surface .pill")?.textContent,
    knobs: !!document.querySelector(".transcription-surface .shelf-knobs"),
    disabled: btn?.disabled, opacity: getComputedStyle(btn).opacity, cursor: getComputedStyle(btn).cursor,
    title: btn?.getAttribute("title"),
    dragHandled: over.defaultPrevented,
  };
});
check("T1 a refused control looks refused", t.disabled ? Number(t.opacity) < 1 && t.cursor === "not-allowed" && !!t.title : true,
  `disabled=${t.disabled} opacity=${t.opacity} cursor=${t.cursor} title=${JSON.stringify(t.title)}`);
check("T2 the drop is handled, never the browser's", t.dragHandled === true);
check("T3 the knobs band tracks the shelf", t.knobs === (t.pill !== "0 sources"),
  `pill "${t.pill}", band ${t.knobs} — the dev shelf is EMPTY today, so absent IS correct; ingest one source to see the band`);

await b.close();
console.log(bad === 0 ? "\nALL PASS" : `\n${bad} FAILED`);
process.exit(bad === 0 ? 0 : 1);
```

**T3's band and tag filter cannot be seen on today's dev data** — the shelf is
empty. To exercise them: ingest any YouTube URL on `/app/transcription` with a
tag, confirm the band appears and the tag chip lists it, flip the sort, drop a
`.srt` on the ingest box and confirm the refusal names `hosted-vendor` and
`caption-file`, then delete the source.

## Verify

**`npm run verify` — 299 files / 2339 tests passed, 9 skipped, 0 failed;
typecheck and lint clean (0 errors, 8 pre-existing `no-img-element` warnings).**

Two things worth recording, both of them the documented traps doing their job:

1. **The typecheck caught a real error the green suite did not — the FIFTH time
   on record.** A new test held an MSW resolver in a bare `let` assigned inside
   the handler; TypeScript narrows that to `never` at the call site, so
   `release?.()` was uncallable. Vitest ran it happily. The gate is
   `npm run verify`, never `vitest` alone. (Fixed by holding the resolver on an
   object, with the reason in the test's own comment.)
2. **The first two verify runs were OOM-KILLED, not failed** — `Terminated`,
   exit 143, immediately after the RUN banner, with `dmesg` showing a global
   `oom-kill` and swap fully consumed at load ~16 while lane 4 ran its own work.
   `npx vitest run --no-file-parallelism` completed the same suite cleanly at
   that same commit, and once lane 4's load dropped the **unmodified**
   `npm run verify` completed too (the numbers above are from that run). **If
   the merge gate runs both lanes' suites concurrently, expect this** — it reads
   exactly like a hang and is not one, and `--no-file-parallelism` is the way
   through. (s78 lane 1 met the same box pressure as judge-test timeouts at
   load ~13.)

Run it to a FILE and read the file; never pipe the suite through `tail`.

## Deliberately left

- **Mediums and lows** (32 across my three surfaces) — s80's, per the plan.
- **NEW, found while fixing — not in the 11, so not fixed:** in the week view,
  `marksFor` returns `[...engine, ...you, ...planned]` and the row is bounded at
  `DAY_MARK_BOUND = 3`. On the shared fixture today's row is three sweep ticks,
  so **"your review" marks — the only kind that waits on a human — are the first
  thing truncated into "+N more"**. Live data happens to have room (six were on
  screen), so this is latent rather than live. Ordering the marks by what needs a
  person first would fix it. **Belongs on the s80 list.**
- **The `.csv`/`.srt` export refusal still explains itself only in a `title`**
  where browsers never show it (an existing medium, `transcription.tsx`). T1's
  scope was the *visual* affordance; making that reason visible is one edit in the
  same card and the two should land together in s80.
- **`impeccable` hook finding left unchanged:** `sites.css:54` `.site-name`
  `font-size: 13px` is off the DESIGN.md ramp. It is a pre-existing line ported
  1:1 from the sheet's own inline style (`Sites.dc.html:78`), outside my diff;
  under DOCTRINE 0 the sheet's bytes win. Not suppressed, reported here — same
  call lane 1 made on `.mail`/`.l-bar`.
- **The transcript panel outlives a shelf filter.** Filtering the shelf does not
  close a panel the operator opened. I judged that correct — the panel is the
  entity they opened, not a shelf row — and the test says so explicitly rather
  than leaving it unstated.

## Sequence gate — honoured

No publish path was exercised and none was armed. Nothing in this lane touches a
platform driver, a send door or a mint. The Dashboard publish door named in the
s78 plan is **not** in my 11 findings and was left alone.
