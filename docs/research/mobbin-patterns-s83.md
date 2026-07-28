# Mobbin patterns — the s83 sweep (deliverable of `mobbin-brief-s83.md`)

> Run 2026-07-28 (s83 boot) over the founder's Mobbin Pro account via the
> claude.ai connector. **Links, never assets** — no Mobbin screenshot enters
> this repo; every finding is described and linked by app/flow. Verdicts:
> **ADOPT** (take the pattern) · **ADAPT** (take it, reshaped to our doctrine)
> · **REJECT** (stated reason) · **NOTE** (real, no decision changed today).
> Every kept finding names the Thalon surface + the decision it changes.
> Bounds honestly stated: Planable and Metricool web were not in Mobbin's
> results for the queries run; Sprout Social covers the approval-first class,
> Assembly the approvals-inbox class. Coverage per category = top 2–3 products
> that Mobbin web actually carries.

## 1. Connect-account / integrations flows (s83 builds this — findings feed the D1 connect UI directly)

| # | pattern → who | verdict → Thalon decision it changes |
|---|---|---|
| 1.1 | **Connect doors live where the work lives, not only in Settings** — Buffer's rail lists "Connect Instagram / Threads / LinkedIn / Bluesky" as permanent rows; the empty queue's CTA is *"Connect a channel to start scheduling posts"* ([flow](https://mobbin.com/flows/c245490f-504a-44aa-baea-d6207d664dfe)). Adobe Express opens connect at the point of need — the share panel's *"Start connecting"* + inline refusal *"Please select at least one channel"* ([flow](https://mobbin.com/flows/1180f321-12ae-4881-a244-bc007b115552)) | **ADOPT** → s83 connect UI: Settings → Integrations stays the home, but Calendar/Approve empty states gain the connect door. Point-of-need connect is a D4 sheet consideration, proposal row not an edit |
| 1.2 | **Pre-auth choice step states feature consequences per option** — Buffer's "Which type of Instagram account…" modal: two cards, per-option capability bullets, "Recommended" chip ([flow](https://mobbin.com/flows/ea926fdc-fa8e-43e6-9026-75713d49457f)) | **ADAPT** → the per-platform pre-connect panel states what the connection will be able to do (scopes + capability-matrix preview) BEFORE redirecting. Merges with our honest-doors grammar |
| 1.3 | **Redirect interstitial** — Buffer renders a full-screen *"Connecting Instagram"* wait state while the dance runs | **ADOPT** → the D1 callback route needs a rendering state during code exchange, not a blank page |
| 1.4 | **The connect failure is honest and has a way out** — Buffer: *"Looks like we've hit a snag. Would you mind trying again?"* + troubleshooting link + **Back To Channels** | **ADOPT** → the callback route's failure state: verbatim platform refusal (our refusal grammar) + retry door + way back. This is the connect-flow face of honest-doors |
| 1.5 | **Callback landing page** — Adobe Express: *"Channel successfully connected"* + **Return to Adobe Express** on a standalone page | **ADOPT** → D1's ONE dynamic callback route renders exactly this on success: "Connected as @handle" + return door |
| 1.6 | **Reauth grammar** — Klaviyo: breadcrumb badge **"Action Required"**, banner *"Your credentials have expired. Please re-authenticate with Shopify to resume syncing"*, floating **Re-Authenticate** CTA ([screen](https://mobbin.com/screens/53552905-983e-4059-8fd4-c2ecb4aeb062)) | **ADOPT** → Integrations cards gain an `expired` state with a re-auth verb (feeds D4 Channels sheet + the s83 refresh tick's surface half). LinkedIn's 60-day tokens are exactly this case |
| 1.7 | **"Connected as" chrome carries facts** — Adobe: *"Connected as Diana Ford"* + the connect DATE; Deel: Connected chip + *"Synced: Dec 17th 2025 06:22 PM"* + a partial-failure banner with its own fix verb (*"Match accounts"*) ([screen](https://mobbin.com/screens/7b7a9f07-cad9-4c17-807a-d9e2df6f45ac)) | **ADOPT** → cards state connectedAs + connectedAt + lastValidatedAt (we already stamp connectedAs since s70; the timestamps are the delta) |
| 1.8 | **Disconnect warns about downstream consequences by name** — Claude: *"You won't be able to continue any previous chats that reference…"*; Otter: *"Otter will stop publishing your conversations to Slack…"* ([screen](https://mobbin.com/screens/787d4c6e-1097-4a5d-af61-3c7af5e5add4)) | **ADOPT** → our disconnect confirm must count and name the platform's pending queue rows ("N scheduled posts will fail closed"). The brief asked exactly this; nobody warns about *schedules* specifically — we can |
| 1.9 | **Connection gallery with per-app counts + "Missing authorization" chips** — Zapier ([flow](https://mobbin.com/flows/f4089a08-2c71-4a79-8deb-03b9792e15e7)) | **NOTE** → multi-account-per-platform is not our v1; the broken-state chip grammar folds into 1.6 |
| 1.10 | **Auth-scheme taxonomy** — Zapier's developer platform offers API Key / OAuth v2 / Session / Basic / Digest as first-class flavors ([flow](https://mobbin.com/flows/51b05375-de73-4b99-8592-a97444a591e3)) | **NOTE** → validates the D1 contract's flavor split: `oauth2` (Reddit) vs `app-password` (Bluesky) vs env-override (X 1.0a posture) are peer flavors of one contract, not exceptions |
| 1.11 | **Platform-side consent shows granular scopes** — Later's Instagram consent renders per-scope toggles; X's consent enumerates every permission | **NOTE** → the platform owns that page; our half is 1.2 (state scopes before redirect) |

## 2. Composer + per-channel preview (D4 composer band)

| # | pattern → who | verdict → decision |
|---|---|---|
| 2.1 | **The composer IS the platform preview** — Typefully renders your draft inside a real tweet (avatar, handle, colored mentions/hashtags) as you type ([flow](https://mobbin.com/flows/e5d0031a-4f5d-4b06-a728-1b0674f8f7ff)) | **ADAPT** → Thalon drafts are generated, not typed: Approve's platform-true preview card (s82 keeper-state) renders the body in platform chrome. Confirms in-chrome beats side-by-side for the single-channel read |
| 2.2 | **Side preview pane for the many-field case** — Buffer's Create Post: "Instagram Preview ⓘ" pane with REAL truncation ("… more") ([flow](https://mobbin.com/flows/75259d32-c222-4997-970c-a71c9538bfa2)) | **ADOPT** → truncation-point honesty is the point of our preview card; the capability matrix already carries the numbers |
| 2.3 | **Per-platform fields under the body** — Buffer: content-type radio (Post/Reel/Story), Music, First Comment; per-image **ALT badges**; char counter | **ADOPT** (D3/D4) → per-platform settings schemas render as fields under the body, Buffer's grammar. ALT-per-media = a contracts candidate for a later window (accessibility fact on mediaRefs) — flagged, not built |
| 2.4 | **Preview honesty caveat** — Sprout: *"Preview approximates how your content will display when published. Tests and updates by social networks may affect the final appearance."* ([flow](https://mobbin.com/flows/c44b3587-9e9f-4485-a2bd-76a5d8a53723)) | **ADOPT** → that sentence-class joins our preview card. An honest bound, stated — our own doctrine in their words |
| 2.5 | **Per-platform variant toggles + auto-variant setting** — Typefully's Platforms modal ("Add LinkedIn version to new drafts automatically") | **NOTE** → our fan-out already produces per-platform variants at generation; ahead, no work |

## 3. Scheduling calendar + queue (D4 Calendar → Schedule)

| # | pattern → who | verdict → decision |
|---|---|---|
| 3.1 | **The schedule modal's verbs** — Typefully: natural-language time ("tomorrow at 9am"), **Next free slot**, **Add to a queue slot**, **Find best time**; timezone stated at the top; the confirm button carries the RESOLVED absolute time (*"Confirm Monday Jul 24, 00:01 EDT"*) ([flow](https://mobbin.com/flows/3c937fff-23cc-4a60-bcd4-8333a15053e2)) | **ADOPT** → C2's next-free-slot suggestion has its drawn reference. Timezone honesty = zone stated at the point of commitment; the commitment door carries the absolute fact it commits to |
| 3.2 | **Reversibility lives on the confirmation** — Typefully's "Post Scheduled" panel: *"This will be published on Jul 24, 00:01 EDT"* + **Unschedule** right there | **ADOPT** → after Schedule, the confirmation states the queue-row fact + its cancel verb (W1's `cancel` already exists; this is its surface) |
| 3.3 | **The queue is a standing per-channel schedule** — Buffer: per-channel timezone, posting goal/week, weekday×time grid; the queue view renders EMPTY dated slots as "+ New" doors ([flow](https://mobbin.com/flows/762c7d0e-ed91-4a61-a9cd-1e1cb3402068)) | **ADAPT** → our planned_slots are per-draft intent, not a standing grid. Empty-slots-as-doors is a real D4 mock decision; a standing posting-times grid joins the cadence config family, founder-verdicted at the sheet |
| 3.4 | **Queue cards carry provenance + escape hatches** — Buffer: *"You created this 8 hours ago"*, per-post **Publish Now**, Notify-vs-auto chip | **ADOPT/⛔** → provenance line yes; "Publish Now" IS the per-post GO door and ships disarmed under the sequence gate — the pattern names the door, the founder still owns the key |
| 3.5 | **Calendar cell verbs** — Sprout's calendar card menu: Approve / Reschedule / Duplicate / Activity / Delete on the cell ([flow](https://mobbin.com/flows/92aa98f4-c45b4-fd5-aa2c-29b2dc5d19cd)); Buffer: week/month toggle, channel-avatar + time chips, timezone dropdown in the toolbar | **ADOPT** (D4) → calendar cards get verbs; the three-fact chips ride 3.6 |
| 3.6 | **Nobody draws plan-vs-commitment** — every tool's calendar shows one kind of "scheduled"; our planned slot (intent) / queue row (commitment) / publication (fact) split exists in no product swept | **GAP** → the D4 Schedule sheet draws three visually distinct facts. This is a differentiator, not parity |

## 4. Approval workflows (the moat surface)

| # | pattern → who | verdict → decision |
|---|---|---|
| 4.1 | **Approval panel with steps + audit trail** — Sprout's Activity view: *"Product Approval — Step 1 — 0 of 1 required approvals"*, **Approve / Reject Post / Skip this step**, and below it every event attributed + timestamped (*"Jane Smith made changes"*, *"Jane Smith created this post"*) ([flow](https://mobbin.com/flows/92aa98f4-c45b-4fd5-aa2c-29b2dc5d19cd)) | **ADOPT** → who-approved-when joins the post's provenance surface (our events already record it; surfacing is the delta). Multi-step chains = LATER (single-operator by design) |
| 4.2 | **A dedicated approvals inbox, split by direction** — Assembly: "Awaiting your approval" vs "Approvals I've requested", approver counts (0/1) ([flow](https://mobbin.com/flows/9b6852d2-0e80-4ff2-92cf-b45b62d5779f)) | **NOTE** → teams-era shape; our Approve queue is the single-operator analog and already media-first |
| 4.3 | **Every approval swept is human-only** — no product shows a machine gate, refusal reasons, or grounding. The judge does not exist in this category | **GAP** → visible judge provenance ("the judge gates — it never rewrites"), refusal-as-button (s82 B3), grounding receipts: already ours, and nobody else can draw them. Say it on the D4 sheets loudly |

## 5. Analytics (D4 Analytics sheet · D2 closed loop)

| # | pattern → who | verdict → decision |
|---|---|---|
| 5.1 | **Per-post performance table** — Sprout: cross-network table, sortable metric columns (impressions, reach/post, engagement rate per impression…), list/card toggle, date-range COMPARE ("7/1–7/31 vs 6/1–6/30"), filters (source/type/status/author), and an honest end-of-data line (*"You have read all the posts in this date range"*) ([screen](https://mobbin.com/screens/0a753d8c-c569-4943-98a7-7e8fea4afcf5)) | **ADOPT** → the D4 Analytics per-post view's shape of record. Range-compare = cheap and high-value |
| 5.2 | **Metric gaps rendered honestly** — Sprout prints **N/A** where a network doesn't report a metric | **ADOPT** → charter D2's "say so per platform" has its drawn grammar |
| 5.3 | **Engagement-by-hour** — Typefully: "Engagement during the day" hour-by-hour average with timezone stated ([screen](https://mobbin.com/screens/10423d95-119f-43f3-b6dd-47a20486e715)) | **ADOPT-LATER** (D2+D3) → the analytics-derived slotting flying car has its reference drawing. Needs publication_metrics data first |
| 5.4 | **"What worked → do it again"** — nothing swept closes the loop; analytics end at charts everywhere | **GAP** → D2's learning tie-in stays ours alone |

## 6. Video editor timelines

| # | pattern → who | verdict → decision |
|---|---|---|
| 6.1 | **Propose, never silently change** — Descript's "Edit for clarity": the AI's edit renders as a strikethrough DIFF, and the operator picks **Apply edits to script** / **Copy edits to new composition** / Done, under a stated bound (*"Underlord can make mistakes"*) ([flow](https://mobbin.com/flows/da674652-2a21-4868-a87d-01123efa69fa)) | **VALIDATES** → our proposal marks + A1–A3 verbs shipped this exact grammar in s80–s82. "Copy edits to new composition" is our save-as-named-variant twin. No new build; cite on D4 mocks |
| 6.2 | **AI verbs grouped by outcome, not by model** — Descript's panel: *Sound Good / Look Good / Repurpose* | **ADOPT** (copy grammar) → when the editor's AI verbs multiply, group by outcome. A naming pattern, zero engine cost |
| 6.3 | **Transcript-as-timeline** — words are timeline blocks bound to waveform lanes, scene rail left | **NOTE** → our EDL timeline has its own lane grammar, founder-verdicted; nothing changes |

## 7. Onboarding / first-run

| # | pattern → who | verdict → decision |
|---|---|---|
| 7.1 | **A getting-started checklist with progress** — Later: dismissible widget, "25%", steps *Connect Your Social Profiles ✓ → Upload Your Media → Schedule Your First Post → Elevate Your Strategy* ([flow](https://mobbin.com/flows/08e58488-68b4-4518-9d35-cf4dbb81a256)) | **ADOPT-LATER** → the eventual tenant-instantiation wizard's spine: connect-first, time-to-first-scheduled-post as THE metric. Parked with the wizard |
| 7.2 | **Empty states teach the next verb** — Later's empty calendar: *"Drop Media Here to Upload — then drag media to the Calendar to schedule posts"* | **ADOPT** → s83's Integrations/Schedule empty states teach the connect→schedule path (joins 1.1) |
| 7.3 | **The plan + trial timeline stated at signup** — Later's signup page shows the selected plan and both dates | **NOTE** → entitlements-era fact; no surface today |

## 8. Workspace shells

| # | pattern → who | verdict → decision |
|---|---|---|
| 8.1 | **Needs-attention inbox** — Linear: unread count in the rail, filters (type/project/priority), snooze ("Snoozed for 1d"), self-set reminders surfacing as rows ([screen](https://mobbin.com/screens/694e4396-adeb-4a76-8d21-8e70bb322e4e)) | **NOTE** → Dashboard "Needs you" already exists; snooze is a candidate verb, proposal row only |
| 8.2 | **Saved views as first-class rail rows** — Linear's Workspace/Views split | **NOTE** → our saved-views door (/api/views, s62) exists; rail placement = D4-adjacent proposal, the sheets stay law |
| 8.3 | **Every state change attributed in an activity trail + properties rail** — Linear's issue detail | **NOTE** → validates the provenance doctrine we already ship |

## The three lists

**Table stakes** (everyone does it — we must too): a connect gallery with
honest card states · redirect interstitial + an honest failure with a way out ·
a success callback page with a return door · "Connected as" + dates · an
`expired` state with a re-auth verb · disconnect confirm naming downstream
consequences · per-platform fit/char counter · platform-true preview with an
honesty caveat · timezone stated at the point of commitment · next-free-slot ·
unschedule on the confirmation · calendar week/month with per-cell verbs ·
per-post analytics table with honest N/A · empty states that teach.

**Differentiators** (what the best do differently — the founder's ask):
Typefully's composer-is-the-preview and natural-language scheduling with
Find-best-time · Descript's propose-diff-apply grammar and outcome-grouped AI
verbs · Sprout's stepped approvals with a full attributed audit trail · Later's
progress checklist onboarding · Buffer's per-image ALT accessibility grammar ·
Zapier's auth-flavor taxonomy and missing-authorization chips.

**Gaps** (nobody does it — Thalon already can): a visible MACHINE gate with
refusal reasons — "the judge gates, it never rewrites" · grounding receipts on
every draft · planned (intent) vs queued (commitment) vs published (fact) drawn
as three distinct facts · analytics that feed generation (the closed loop) ·
judge-gated evergreen · disconnect warnings that count the actual scheduled
posts they'd strand.

## What this changes about D4, per sheet

- **Analytics** — the per-post view takes Sprout's table shape: sortable metric
  columns, list/card toggle, date-range compare, filters, honest N/A per
  platform, an end-of-data line. The engagement-by-hour chart is drawn but
  waits on D2's publication_metrics.
- **Calendar → Schedule** — draw the three-fact split (planned/queued/published)
  as the sheet's organizing idea; per-cell verb menus; timezone in the toolbar;
  the schedule modal takes Typefully's verb set (next free slot · queue slot ·
  best-time placeholder) and its confirm-carries-the-absolute-time rule; the
  scheduled confirmation carries Unschedule. Empty-slots-as-doors = a mock-time
  decision for the founder's verdict.
- **Create/Approve composer band** — per-platform settings fields under the
  body in Buffer's grammar (from D3 schemas); the fit line is a counter with
  refusal reasons; the preview card carries the Sprout-class honesty caveat and
  real truncation points.
- **Integrations → Channels** — cards gain `expired`/action-required (Klaviyo
  grammar) beside the s70 states; connectedAs + connectedAt + lastValidatedAt;
  disconnect confirm counts pending queue rows; the connect dance gets its
  three drawn states (interstitial · success-with-return · honest failure with
  retry and a way back); pre-connect panel states scopes + capabilities.

**Pipeline unchanged:** this memo is raw material. D4's sheets are authored in
claude-design (Fable 5 directly, standing rule), the founder's verdict makes a
sheet law, and only verdicted sheets get built.
