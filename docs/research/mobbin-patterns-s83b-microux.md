# Mobbin patterns, part 2 — the micro-UX sweep (founder-directed, s83)

> His ask, mid-s83: *"more mobbin research for the setting feature or other
> feature and pages, filter chips, autocomplete, empty states, loading
> states, copy options etc, basically the whole UI/UX."* Same rules as
> `mobbin-patterns-s83.md`: links never assets, verdict-tagged, every finding
> names the Thalon surface + decision it changes, and none of it licenses
> drive-by restyling — a finding against a shipped sheet becomes a proposal
> row for the D4 wave (or a keeper-state behind existing chrome), never an
> edit. Bounded: five pattern families, 3–4 references each.

## 1. Filter chips over dense tables

| pattern → who | verdict → decision |
|---|---|
| **Chips are removable STATEMENTS, not toggles** — Aboard renders each active filter as `field · value · ×` above the table; the row reads as a sentence ("Employee: Alex Smith, Status: Pending") ([screen](https://mobbin.com/screens/43b940cb-28a4-42b5-9974-2073b895ad66)) | **ADOPT** (D4 + proposal rows) → Leads board and Intel already filter; the chips-as-removable-statements grammar is the target shape for any surface whose filters survive a scroll. Colour never carries the filter alone — the field NAME rides every chip |
| **A filter chip is also an EDITOR** — Airtable's chip opens its own value-picker popover in place (checkbox list + "Find a record" search + per-chip Clear) ([screen](https://mobbin.com/screens/8e0df9ce-81e6-4ffc-8ec8-5bc093db466f)) | **NOTE** → the two-click edit (chip → picker) beats delete-and-rebuild; a D4-wave consideration for Leads' saved views, not a retrofit |
| **The count + Clear pair** — Navattic: `Filter (1)` button + the active chips + `× Clear` in one row; the table never filters silently ([screen](https://mobbin.com/screens/223f15e5-75be-43a3-8b7d-2499cb652b90)) | **ADOPT** → the standing rule for any filtered list: state the count of active filters AND offer the one-gesture way back. R-lens (reversibility) applied to filtering |
| **Chips can compress** — Pin collapses overflow into `+5 more` ([screen](https://mobbin.com/screens/66a05728-5fc3-499d-9e4a-3f770c5ec209)) | **NOTE** → matches our calendar's own "+N more" vocabulary (the s77 ruling); reuse that word, never a new one |

## 2. Empty states that teach

| pattern → who | verdict → decision |
|---|---|
| **Name the surface's JOB, then the first verb** — Aboard's empty Tasks: one soft illustration, "Here you can create tasks…", `+ New task` ([screen](https://mobbin.com/screens/4e283107-28ad-4956-a4b8-0c90cb765162)); Circle: "Start by adding a course section, and then add lessons" — the SEQUENCE is the teaching ([screen](https://mobbin.com/screens/19f00fc1-8b8f-44bb-a968-6461ff056d3a)) | **VALIDATES + ADOPT** → our zero-art plates (s76) already carry the illustration half; the copy half — job sentence + the NEXT verb, in order — is the audit lens for every workspace empty state. Feeds the s83 finding that Integrations/Schedule empties should teach the connect→schedule path |
| **Personal, not generic** — Fibery: "It looks like samlee@… doesn't have any workspaces yet" — the state names YOUR situation, plus a "Did you know?" side-tip ([screen](https://mobbin.com/screens/a0f7dc5b-3b70-48f1-b194-4806ce5e31be)) | **NOTE** → single-operator today; the personalized-empty grammar matters at the tenant-wizard era |
| **An empty state may still explain the CONCEPT** — Copilot's Helpdesk empty carries two sentences of what articles ARE + `Learn more` + the verb ([screen](https://mobbin.com/screens/bf4b8506-2424-470f-9620-c286480f53dd)) | **ADOPT** → for concept-heavy surfaces (Intel's admissions, the judge's refusals) the empty state is the cheapest teaching moment we own |

## 3. Loading states (and the line they must never cross)

| pattern → who | verdict → decision |
|---|---|
| **Skeletons mirror the REAL layout** — Fabric/Jasper skeleton the exact geometry the data will fill (avatar dot, line widths, panel split) ([screen](https://mobbin.com/screens/46846b8b-226e-4952-a05a-97f5b7bb11a1)) | **ADOPT selectively** → our doctrine already reserves boxes ("reserve the box, then fill it", R-rhythm); a skeleton is that doctrine drawn. Where a surface today says "Reading…" in a bare row, the box-true skeleton is the D4-era upgrade — proposal rows, not retrofits |
| **Whole-page blur + spinner** — Canva blurs the coming layout under one centered spinner ([screen](https://mobbin.com/screens/8a6f7a7d-1c8b-49bb-99d5-06d1c5d7539b)) | **REJECT** → hides which region is pending; our per-region read states are strictly more honest |
| **The standing invariant, restated** — none of these examples distinguish *loading* from *failed-to-load* visually | **HAVE** → our read-failure grammar ("a read failure, not an empty record" + Try again) is ahead of every reference swept; skeletons must never replace it — a skeleton that never resolves is the lie the checklist already names (loading ≠ empty ≠ failed) |

## 4. Autocomplete / command palette

| pattern → who | verdict → decision |
|---|---|
| **Keyboard hints ride the FRAME** — Fibery's palette footer: `↑↓ navigate · ↵ open · ⌘+↵ new tab`; Whop: result count + navigate/select/close hints; Grok: per-row verb shortcuts (`Edit ⌘⇧E · Delete ⌘⇧D`) ([screen](https://mobbin.com/screens/526e7173-e5c9-4822-9570-2dc586594cc1)) | **ADOPT** → our ⌘K palette exists; the footer-hints row is the discoverability fix for every keyboard affordance we ship silently (the D-lens finding the checklist already carries — j/k, a/r/e exist but are never announced). Cheap, one component |
| **Recents before typing** — Grok shows History the moment the palette opens ([screen](https://mobbin.com/screens/b9bb6f18-1cd9-48ee-af83-b70d1ce1147f)) | **NOTE** → palette recents = a saved-views-adjacent candidate; needs a store decision, park with D4 |
| **Typed prefix highlighting + create-fallback** — Fibery bolds the match inside each result and offers "To create *prob* choose an item type above" when nothing matches | **ADOPT** (copy grammar) → a palette miss should offer the CREATE path, not a dead "no results" |

## 5. Copy affordances

| pattern → who | verdict → decision |
|---|---|
| **The button BECOMES the confirmation** — Posh's copy button turns into `Copied! 📋` in place; Luma's `Copy Link` swaps to `✓ Copied!` ([screen](https://mobbin.com/screens/93bddffa-0b42-4345-9767-6e8410becd4e)) | **ADOPT** → the state change lives AT the control (V-lens verbatim), never only in a toast. Wherever the workspace grows copy verbs (post permalinks, draft bodies, external ids), this is the grammar |
| **Corner toast as the SECOND channel** — GitBook pairs the in-place cue with a corner "Copied to clipboard" ([screen](https://mobbin.com/screens/dfe3758a-dbc9-47d5-a389-56d67efd91e8)) | **NOTE** → acceptable as reinforcement, never the only signal |
| **Copy-once secrets state their one-timeness** — GitBook's token modal: "Be sure to copy the token below as it will not be visible again" | **ADOPT** (copy grammar) → if the vault ever surfaces a generated secret once, that sentence-class travels with it |
| **Candidate surfaces, named** — the Published view's external ids render as text with no copy verb; draft bodies at Approve likewise | **Proposal rows** → copy affordances for the Published ledger's ids/permalinks + Approve's body, D4-adjacent smalls, sheets stay law |

## What this changes, in one paragraph

Nothing here re-opens a shipped sheet. Three families produce **standing copy
grammars** (chips state their field + one-gesture clear; empty states name
the job then the next verb in sequence; copy buttons confirm in place), one
produces a **cheap discoverability fix** (the palette/keyboard hints footer —
our shortcuts exist and are unannounced), and one **validates the shipped
doctrine** (per-region read states + honest read-failures beat every
whole-page spinner swept; skeletons are the drawn form of "reserve the box",
adoptable per-surface at the D4 wave). The D4 mock work cites this memo
beside `mobbin-patterns-s83.md` rather than re-deriving.
