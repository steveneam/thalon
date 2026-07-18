# Boards + content-calendar UI patterns — survey for workspace redesign Phase D

> Researched 2026-07-18 (s57, lane W-research). Input document for the Phase D
> boards + content-calendar surfaces. **Reference-only discipline**: we study
> interaction patterns and layout grammar from public documentation and
> screenshots; we never copy code, markup, or CSS from any surveyed source —
> regardless of its license. Companion to `workspace-ux-v2.md` and
> `nle-timeline-ui-patterns.md`.

## 1. Scope + license hygiene

Surveyed: one scheduling/calendar product (cal.com lineage) and five
board/project tools with good public UI documentation. Patterns below feed
Thalon's approve queue, leads, intel/trends, library, and runs/activity
surfaces (`apps/web/src/app/app/*`) plus the new Phase D board + calendar
surfaces.

**Standing rule (repeat of repo licensing hygiene): AGPL / copyleft /
fair-code code is never embedded in this repo. Patterns are re-implemented
from written description only. No source file from any surveyed project is
opened, vendored, or transcribed — the uniform discipline also covers the
MIT-licensed sources, so no per-source judgment calls are ever needed.**

| Source | License | Notes |
|---|---|---|
| cal.com → **Cal.diy** | Core product went **closed-source April 2026**; the OSS lineage relaunched as Cal.diy under **MIT** ([repo](https://github.com/calcom/cal.diy), [announcement](https://cal.com/blog/cal-com-goes-closed-source-why)) | Historically **AGPL-3.0 + commercial `/ee`** ([2021 relicense post](https://cal.com/blog/changing-to-agplv3-and-introducing-enterprise-edition)). Any pre-2026 cal.com snapshot, fork, or vendored fragment is AGPL — treat the whole lineage as reference-only. |
| Focalboard | **Multi-license**: compiled binaries MIT; source **AGPL-3.0 OR commercial**; some admin/config dirs Apache-2.0 ([LICENSE.txt](https://github.com/mattermost-community/focalboard/blob/main/LICENSE.txt)) | Community-maintained ([repo](https://github.com/mattermost-community/focalboard)). Source = copyleft; reference-only. |
| Planka | **Fair Use License** (community) + commercial Pro/Enterprise — fair-code, **not OSI open source** ([repo](https://github.com/plankanban/planka), [feature matrix](https://planka.app/features)) | v1 was AGPL-3.0. Either way: reference-only. |
| Wekan | **MIT** ([repo](https://github.com/wekan/wekan)) | Permissive, but the uniform reference-only rule still applies. |
| Vikunja | **AGPL-3.0-or-later** (desktop: GPL-3.0-or-later) ([repo](https://github.com/go-vikunja/vikunja)) | Copyleft; reference-only. |
| GitHub Projects | **Proprietary SaaS** — only the public docs at docs.github.com are surveyed | No code available; patterns from documentation only. |

Secondary sources (DeepWiki summaries, cal.com blog/help) are documentation
about the products, not code; cited inline below.

## 2. Calendar patterns

### 2.1 Month / week / agenda density trade-offs
- cal.com's booker ships **three switchable layouts** — `MONTH_VIEW`
  (date-picker grid + slot list for the chosen day), `WEEK_VIEW` (time grid),
  `COLUMN_VIEW` (day columns of slots) — the operator picks which are enabled
  and which is default; the visitor can switch between the enabled ones at
  will ([layouts blog](https://cal.com/blog/enhanced-flexibility-take-advantage-of-cal-com-s-multiple-booking-layouts),
  [booker embed docs](https://cal.com/docs/platform/atoms/booker-embed)).
  Lesson: density is a *view switch*, not a single design decision.
- GitHub Projects' roadmap does the same on the time axis: **month / quarter /
  year zoom** controls timeline density
  ([roadmap docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout)).
- Focalboard treats calendar as just **one of four views over the same cards**
  (Kanban / Table / Gallery / Calendar)
  ([architecture overview](https://deepwiki.com/mattermost-community/focalboard)).
  Lesson: the calendar is a *view of the queue*, not a separate data surface.
- Distinction to keep in mind: cal.com's calendar is **booking-first** (pick a
  free slot); a content calendar is **review-first** (see what is scheduled,
  move it). The board tools' calendar/roadmap views are the closer relatives.

### 2.2 Event chip anatomy
- GitHub roadmap items are **bars positioned by start/target date fields**;
  group headers can carry field sums; vertical markers overlay iterations,
  milestones, and key dates
  ([roadmap docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout)).
- GitHub board cards show a **configurable subset of fields** ("Fields"
  option per view) — the chip face is curated, everything else lives in the
  detail panel
  ([board docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)).
- cal.com slots are plain time buttons — chip = time + nothing else; identity
  comes from the page context
  ([booker embed docs](https://cal.com/docs/platform/atoms/booker-embed)).
- Distilled: a calendar chip earns **title + time + one status signal**;
  anything more belongs to hover/detail.

### 2.3 Drag-to-reschedule
- GitHub roadmap: "**drag items to affect their start and target dates or
  selected iteration**" — direct manipulation replaces a form edit
  ([roadmap docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout)).
- Vikunja advertises drag-and-drop rearranging of tasks across its views
  ([features](https://vikunja.io/features/)).
- The general grammar (also on boards, §3.6): **drop position IS the data
  mutation** — dropping into a date cell/column sets the date/field, no
  confirm dialog on the happy path.

### 2.4 Recurring items
- cal.com models recurrence on the **series**, with **date overrides** as
  exceptions — block or add specific dates without touching the recurring
  schedule ([recurring meetings guide](https://cal.com/blog/calcom-recurring-meetings-tips)).
- Vikunja supports repeating tasks / recurring reminders
  ([features](https://vikunja.io/features/)).
- Distilled: recurrence = edit-the-series + exception overrides; rendered
  instances need a visible recurrence marker (word/icon, not color — see §4).

### 2.5 Empty / loading states
- Public docs for all six sources are thin here — none documents its empty or
  loading grammar (survey gap, noted honestly rather than invented).
- Thalon already has the stronger convention: skeletons on Muted Wash,
  **empty states written as tutorials with a one-click seeded example**
  (`DESIGN.md` §6). Phase D calendars/boards inherit it: an empty calendar
  month should seed a demo scheduled item, an empty board column states what
  flows into it.

### 2.6 Mobile / narrow behavior
- cal.com's answer is layout substitution, not squeezing: the column/slot
  layouts serve narrow screens while the month grid serves wide ones, and the
  operator chooses which layouts exist at all
  ([layouts blog](https://cal.com/blog/enhanced-flexibility-take-advantage-of-cal-com-s-multiple-booking-layouts)).
- Distilled: below the narrow breakpoint a month grid degrades to an **agenda
  list** (chronological bounded list — which Thalon's list grammar already
  covers) rather than a shrunken grid.

### 2.7 Timezone display
cal.com is the reference here:
- **Auto-detect the viewer's timezone** and convert all displayed times; a
  visible timezone selector lets them override
  ([event settings guide](https://cal.com/blog/a-guide-to-cal-com-s-event-settings-and-features)).
- **Lock Timezone** per event for in-person events — times display in the
  organizer's fixed zone instead of converting
  ([help](https://cal.com/help/event-types/timezone-lock)).
- **Scheduled timezone changes** for planned travel
  ([blog](https://cal.com/blog/you-can-now-schedule-timezone-changes)).
- **Overlay my calendar**: the logged-in viewer's own busy blocks render over
  the host's availability so they don't double-book themselves
  ([issue CAL-2801](https://github.com/calcom/cal.com/issues/12763)).
- Distilled for a multi-tenant posting calendar: every surface needs an
  explicit, visible answer to "whose timezone is this?" — operator-local vs.
  tenant-audience is a per-surface (maybe per-tenant-config) decision, §5 Q6.

## 3. Board patterns

### 3.1 Column / swimlane models
- GitHub Projects: columns are **derived from a single-select or iteration
  field** (not free-floating structures); which columns show is configurable.
  Swimlanes come from group-by: horizontal sections per field value, and
  "if you drag an item to a new group, the value of that group is applied"
  ([board docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)).
- Wekan: **list × swimlane matrix** — cards sit at intersections; swimlanes,
  lists, and cards are all drag-reorderable; swimlanes/lists collapse to save
  space ([DeepWiki: boards/lists/swimlanes](https://deepwiki.com/wekan/wekan/2.1-boards-lists-and-swimlanes),
  [collapsible swimlanes issue](https://github.com/wekan/wekan/issues/2804)).
- Focalboard: board view groups cards by a select property; the same cards
  re-render as Table / Gallery / Calendar
  ([overview](https://deepwiki.com/mattermost-community/focalboard)).
- Distilled: **column = field value** (GitHub's model) is the schema-clean
  version — the board is a projection of a status/stage column in the DB, so
  drag = one UPDATE, and list views stay the source of truth.

### 3.2 Card anatomy — face vs. detail
- GitHub: per-view **visible-fields configuration** decides the card face;
  everything else is in the item detail panel
  ([board docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)).
- Focalboard: cards carry typed properties from shared PropertyTemplates;
  views choose what displays
  ([overview](https://deepwiki.com/mattermost-community/focalboard)).
- Planka: face carries cover image, members, due date; body holds markdown
  description, tasks, attachments, comments
  ([repo](https://github.com/plankanban/planka), [features](https://planka.app/features)).
- Distilled: face = **identity (title/thumbnail) + 2–3 decision-driving
  signals** (for Thalon: heat band, channel, scheduled time); provenance,
  history, and long text live only in the detail view. Matches the existing
  approve-queue split (row list + detail panel).

### 3.3 WIP / count signals
- GitHub Projects **column limits are advisory**: "Setting a limit does not
  restrict anyone from adding cards… nor does it restrict any automations";
  the column header shows `count / limit` and **highlights when exceeded**;
  optional field sums also render in column headers
  ([board docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)).
- Wekan: per-list WIP limits with `count + limit` in the list header and a
  soft-limit highlight state
  ([DeepWiki](https://deepwiki.com/wekan/wekan/2.1-boards-lists-and-swimlanes)).
- Distilled: advisory limit = pure **signal channel** — Thalon-native (§4).
  Caveat: both tools convey "exceeded" by **color alone**, which violates
  Thalon's no-color-alone rule; our version adds the word (e.g. an `over`
  badge).

### 3.4 Filtering + saved views
- GitHub Projects is the strongest model: **each view is a tab** capturing
  layout + filter + group + sort; an **indicator dot** marks unsaved view
  changes (keep private or "Save changes"); views duplicate, rename, and
  **tabs drag-reorder**
  ([managing views](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/managing-your-views)).
  A **slice panel** lists a field's values beside the board and composes with
  the current filter (some fields excluded from slicing)
  ([board docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)).
- Vikunja: **saved filters** — "save it once, use it always"
  ([features](https://vikunja.io/features/)).
- Wekan: search + regex-capable filtering
  ([DeepWiki](https://deepwiki.com/wekan/wekan/2.1-boards-lists-and-swimlanes)).
- Negative lesson from Planka: filters that can only *select existing labels*
  — no "no label" option, no exclusion — frustrate real triage
  ([issue #1501](https://github.com/plankanban/planka/issues/1501)). Any
  Thalon filter needs "none" and "not X" from day one.

### 3.5 Bulk actions
- Wekan supports **multi-select then drag the set together** across
  lists/swimlanes
  ([DeepWiki](https://deepwiki.com/wekan/wekan/2.1-boards-lists-and-swimlanes)).
- Thalon already owns this grammar: `x` to pick + the shared Bulk Bar with one
  named confirm (`DESIGN.md` §5). Boards extend it — multi-select + drag =
  bulk field mutation, and the Bulk Bar stays the home for verb-shaped bulk
  actions.

### 3.6 Drag semantics
- The consistent grammar across GitHub / Wekan / Planka: **drop target = new
  field value** (column → status, swimlane group → group field, date cell →
  date); lists and swimlanes themselves reorder by drag; sync is immediate
  ([GitHub board docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout),
  [Wekan DeepWiki](https://deepwiki.com/wekan/wekan/2.1-boards-lists-and-swimlanes),
  [Planka repo](https://github.com/plankanban/planka)).
- No surveyed tool puts a confirm dialog on drag; undo/reverse is by dragging
  back. **Terminal verbs must therefore never be drag targets** — a "Rejected"
  column reachable by drop would bypass Thalon's named-confirm discipline.

### 3.7 Long lists — virtualization / pagination
- Survey gap: none of the six documents a bound on column length — the
  default in Planka/Wekan-style boards is "the column grows forever", exactly
  the defect Thalon's Bounded-List Rule retires. Collapsible swimlanes with
  counts (Wekan) and advisory column limits (GitHub) are partial mitigations,
  not bounds.
- Consequence: the bound must be imposed at design time — fixed-height board
  region, columns scroll **internally**, column header keeps the count
  visible so nothing hides silently (see §4).

## 4. Distilled recommendations mapped to Thalon conventions

Workspace is LIGHT-first; blue = act, amber = signal-only; list grammar =
`DESIGN.md` §5 (Bounded-List, Selected-Row, j/k, Bulk Bar, Terminal Toast).

**Adopt (satisfies the conventions):**
1. **Column-as-field-value board** (GitHub model, §3.1) — board is a
   projection of the same rows the list surfaces show; drag = one field
   UPDATE; keeps multi-tenant schema clean.
2. **Saved views as tabs + unsaved-dot** (GitHub, §3.4) — tabs are literally
   one of the Bounded-List Rule's three sanctioned bounds; the unsaved dot is
   a textbook amber signal (dress it Bronze, add a title/word).
3. **Advisory WIP counts** (GitHub/Wekan, §3.3) — `count / limit` chip in the
   column header as a `signal`-variant badge; never blocks (blocking would
   make amber act — channel violation). Add the word `over` when exceeded
   (no-color-alone rule).
4. **Curated card face** (§3.2) — title + heat band (HeatGrade word-in-pill)
   + channel + time; all else in the detail panel the approve queue already
   has.
5. **Density as a view switch** (cal.com layouts / GitHub zoom, §2.1) —
   month / week / agenda as explicit toggles, agenda = the narrow-screen
   degradation (§2.6), which collapses back into the existing bounded-list
   grammar.
6. **Timezone always labeled** (cal.com, §2.7) — every time shown carries its
   zone context; per-tenant lock option mirrors cal.com's Lock Timezone.
7. **Filter must support "none" / exclusion** (Planka's documented gap,
   §3.4).

**Adapt (pattern good, dress violates a rule as-shipped):**
8. **Exceeded-limit highlight** ships color-only in GitHub/Wekan → add the
   word (§3.3).
9. **Drag-to-reschedule / drag-to-column with no confirm** (§2.3, §3.6) —
   adopt for non-terminal moves only; wire the Terminal Toast for the moved
   item ("Moved to Tuesday 9:00 · view") instead of a dialog. Terminal verbs
   (Approve/Reject/Dismiss/Delete) are **never drop targets** — they keep
   their named confirms and Four-Verbs dress.
10. **Swimlanes** (Wekan matrix, GitHub group-by) — adopt only with collapse
    + per-lane counts, else the page grows vertically with lane count ×
    column height and violates the Bounded-List Rule.

**Reject (violates the conventions):**
11. **Unbounded column growth** (Planka/Wekan default, §3.7) — Phase D board
    designs must state each column's bound: fixed-height board region,
    internal column scroll, count always in the header.
12. **Color-coded status as the only status channel** (common to all board
    tools' label systems) — words/attributes carry state.
13. **Dark-HUD board dressing** — the workspace stays light; near-black is
    the landing's register only (`DESIGN.md` §6).

**Gap none of the tools fill (Thalon differentiator):** no surveyed board
documents a keyboard grammar. Extending `useListKeys` (j/k + x + verb keys)
to 2D board navigation would be genuinely uncommon — see Q5.

## 5. Open questions for Phase D (designer decides)

1. **Which surfaces become boards?** Approve queue as a stage board (draft →
   gated → approved → scheduled)? Leads as a pipeline board? Or does the
   board live only on the new calendar/planning surface?
2. **Calendar cell overflow**: month-grid day cell past ~3 chips — "+N more"
   popover, or day-click drill into an agenda panel? Where does day detail
   live (side panel vs. route)?
3. **Lane dimension for the content calendar**: swimlane by channel, by
   tenant profile, or flat with filter chips? (Multi-tenant: is the calendar
   ever cross-tenant, or always scoped to the active tenant?)
4. **Reschedule undo**: drag-back is the boards' native undo; is that enough,
   or does reschedule join the queued undo-after-terminal contract work
   (B-crm)?
5. **2D keyboard grammar**: does j/k stay within-column with new keys for
   cross-column movement, and does `x` multi-select span columns?
6. **Timezone policy**: operator-local vs. tenant-audience display; where the
   zone label sits; whether per-tenant "lock timezone" is config.
7. **WIP limit ownership**: are advisory limits per-tenant config, per-view
   settings, or fixed by the product? What word marks "over"?
8. **Saved-view persistence**: per-operator, per-tenant, or shared? (GitHub's
   private-until-saved dot implies per-user drafts over shared views.)
9. **Recurring content slots**: does Phase D schedule recurring slots
   ("every Tue 9:00, carousel") with cal.com-style series + date overrides,
   or are all scheduled items one-shot for now?

---
*Sources of record: license table links in §1; pattern citations inline.
Nothing in this document licenses copying implementation from any surveyed
source — re-implement from the written descriptions above.*
