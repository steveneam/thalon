# Klaviyo — teardown and what Thalon should take from it (s101, 2026-08-04)

> **Founder ask, this session:** *"deep research into Klaviyo, its features,
> models, interface, web UX/UI, frontend and backend if available, to see which
> features and functions can we apply and improve and elaborate upon for ours."*

**Method + honesty about it.** Their developer docs, help centre and engineering
blog are public and were read directly; the product surfaces were not driven
(no account), and **Mobbin has almost no Klaviyo coverage — one SMS-onboarding
screen** ([Klaviyo · Set up SMS](https://mobbin.com/screens/00897cbc-fbe3-4a0d-9ab0-cdb7e1c6f294)),
so this is a **documentation + architecture teardown, not a visual one**. Where
a claim is inferred rather than read, it says so. One Klaviyo pattern is
already in our reference library — reject-with-a-reason, taken for Approve at
s89 — and it stays.

**Why they are worth studying, and where the analogy breaks.** Klaviyo is the
best-executed example of the thing Thalon is: *a system that turns a stream of
observed behaviour into automated, gated, per-channel outbound content.* Their
loop is `events → segments → flows → messages → attribution`, ours is
`intel → create → judge → approve → schedule → analytics`. The break: **their
content is templated and human-authored; ours is generated.** So every
borrowing below has to survive the question *"does this still hold when the
message is written by a model and has to pass a judge?"* — several get better,
two get rejected on exactly that.

---

## 1. The data model, and the one idea worth stealing whole

Their [documented primitives](https://developers.klaviyo.com/en/docs/introduction_to_klaviyos_data_model):

| Klaviyo | What it is | Our nearest thing |
|---|---|---|
| **Profile** | The hub. Person, keyed by email or external `id`, with typed custom properties (string/int/float/date/bool/array/JSON) | `leads` (CRM), and nothing at all for the audience side |
| **Metric / Event** | An event is a **timestamped record with a JSON payload**; a metric is the *category* of event. Exactly one metric per event | `events` (audit), `usage_ledger` |
| **Catalog** | Products, synced natively / by JSON feed / by API; feeds templates | Library sources + Intel captures |
| **List** | **Static** membership | — |
| **Segment** | **Live** membership: profiles are added and removed programmatically as they meet or stop meeting the criteria | — |
| **Template** | Content with dynamic tags + logic (Django syntax) | Prompt chains + brand profiles |

**THE IDEA: the difference between a List and a Segment.** A list is a bag you
put things in. A segment is a **saved predicate that re-evaluates itself
forever** — nobody maintains it, and it is never stale. Klaviyo's entire
product leans on this: segments are the audience, the trigger, the report
dimension and the suppression rule, all from one construct.

**We have no equivalent, and we have the debt to prove it.** The s100 Intel
gate recorded *"no filter, no sort and no find over 58 cards, with only 4
visible at once"* — and the tempting fix is a filter box on Intel. That is the
wrong fix twice over: it is per-surface, and it is forgotten the moment you
navigate away. **The right fix is a segment primitive over our own event
stream**, rendered as saved views wherever a list exists:

- *"blocked on `g3_screen` this week"* → Approve
- *"picked from Intel but never published"* → the pipeline board's real dead-letter
- *"trends I watched whose heat has decayed"* → Intel, self-maintaining
- *"leads that opened and never replied"* → Leads (this one is nearly free — the CRM already writes the events)

**Verdict: TAKE — as a charter candidate, not a bolt-on.** It touches the
read-model, so it is a contract-window ask, and per rule 10 it wants a
prior-art sweep before it is planned (saved-view/segment engines are a solved
problem — we should not hand-roll a predicate language).

**Second idea, cheaper: events are the substrate, not the audit trail.** Ours
exist mostly so actions are auditable. Theirs are what the product is *made
of*. We are closer than it looks — `events`, `judge_results`, `edit_diffs`,
`usage_ledger` and `intel_captures` are already a timestamped typed stream —
but nothing reads them as one. Noting it, not proposing it: it is the
substrate the segment primitive would stand on.

---

## 2. Features, with verdicts

**★ Per-message send status: `draft` / `manual` / `live` — and what `manual`
does.** In Klaviyo, [every individual message inside a flow carries its own
status](https://help.klaviyo.com/hc/en-us/articles/115002779271). `manual` is
the interesting one: the recipient reaches the send point and is **moved to a
"Needs Review" tab instead of being sent to**. You can edit any message at any
status without pausing the flow, and add new draft messages beside live ones.

Two things follow, and they are the most valuable findings in this memo:

1. **It independently validates Approve.** A category leader arrived at
   *hold-the-send, queue-it-for-a-human, review-then-release* on its own. Our
   Approve is not overhead we invented; it is the shape this problem takes.
   (It also sharpens the s89 ruling that rejected Postiz's approvals as a
   model: theirs is a *permission* gate, Klaviyo's is a *content* gate, and
   ours — verdicts + eval rows — is a content gate that also learns.)
2. **Their granularity is finer than ours and we should follow.** We arm a
   whole run (the s98 sequence gate: `post = ARMED`, per-run, key rests
   empty). Klaviyo arms a *message*. Applied here: **arm a platform, or a
   stage — not the chain.** Concretely, the founder could let Bluesky go live
   while LinkedIn stays in review, from one run, without re-arming anything.
   **Verdict: TAKE. This is the highest-value, lowest-risk borrowing in the
   memo, it is squarely inside a seam we already own, and it makes the live
   grant safer rather than looser.**

**Predictive scores on the profile.** Klaviyo ships [predicted next order date,
CLV and churn risk](https://help.klaviyo.com/hc/en-us/articles/360037957832) as
fields you can segment and personalise on. The Thalon analogue is obvious and
genuinely useful: a **decay score on a capture** (Intel's stated job is *"is it
still catchable"* — today the heat pill is a snapshot with no derivative) and an
**expected-engagement score on a draft**.
**Verdict: LATER, with its dependency named — D2.** We have no outcome data to
fit anything on, and we have already ruled twice that a number we cannot ground
does not ship (Analytics' reserved engagement-by-hour box; the Composer's trend
forecast naming its D2 dependency). The shape to copy when D2 lands is
*score + the window it was computed over, on the object itself.*

**Smart Send Time.** Per-recipient optimal send time from engagement history.
Our Schedule already refuses a cadence-illegal slot and offers the next legal
instant (s95 S2) — the missing half is choosing *well* among legal slots rather
than merely legally. **Verdict: TAKE when D2 lands**; it is an upgrade to
existing machinery, not a new surface.

**Deliverability hub.** Inbox placement, sending reputation, list hygiene as a
first-class surface. **We have a real gap here and no row for it.** Channels
tells you a credential is connected; nothing tells you whether posts are
actually *landing* — rate limits, silent throttling, API deprecations, a
channel that accepted a post and buried it. **Verdict: TAKE the concept as
"channel health", park with a trigger** (the first time a live post succeeds at
the API and fails in reality). Note it needs no ML — it is mostly recording
what the platform already tells us and what Analytics can see.

**Benchmarks against a cohort** (they cite 183,000 brands; flows ≈ 41% of email
revenue from 5.3% of sends). **Verdict: REJECT today — one tenant, no cohort.**
Parked with its trigger: the moment we run several real tenants, a benchmark is
the single most valuable thing an operator can be handed, and it is a
multi-tenant *dividend* our architecture already earns.

**The visual flow builder** — canvas, drag-drop components,
[trigger split](https://help.klaviyo.com/hc/en-us/articles/115003885632) vs
[conditional split](https://help.klaviyo.com/hc/en-us/articles/115003872171),
YES/NO paths on the canvas.
**Verdict: REJECT the canvas, for the third time and the same reason** — a
node-graph grammar promises *editable wiring*, and our loop is linear with one
human gate (recorded at the Board s91, and again for FLORA/ElevenLabs Flows in
the s101 staged pass). **But TAKE the distinction it encodes**, which is a real
conceptual clarification for the fan-out profiles in `proprietary/`: a *trigger
split* branches on properties of **the event that started the run**; a
*conditional split* branches on **what you already knew** about the target.
Ours conflates them — the fan-out reads the capture and the profile through one
undifferentiated context bag. Naming the two would make the niche profiles
easier to reason about and to test.

**K:AI marketing / customer agents.** Announced-to-private-beta; an agent that
reads your site and drafts campaigns. **Verdict: n/a as a pattern — this is the
thing we already are**, and further along. Recorded so it is not re-proposed as
a finding.

---

## 3. Interface and UX

Thin, and I will not pad it. From the one Mobbin screen plus the help-centre
documentation of the builders:

- **Onboarding collects compliance facts as a plain, required form** with
  explicit `*` markers and a stated *reason* above it ("your information will
  only be used to verify a toll-free number so you can send in the US and
  Canada"). That register — *say why you are asking before you ask* — is one we
  already use on refusals; worth extending to Channels' connect dance.
- **The flow canvas puts the branch condition's outcome ON the path** (`YES` /
  `NO` labelled arms). Even having rejected the canvas, the lesson holds
  wherever we draw a branch: label the arm with the outcome, not the predicate.
- **Status is per-object and always visible** (`draft`/`manual`/`live` on each
  message) rather than one master switch. Same lesson as §2, in UI terms: **the
  smallest thing that can be armed should show its own arming state.**

Everything else about their interface is unverified. I did not drive it and I
am not going to describe screenshots I have not seen.

---

## 4. Backend and frontend

**Backend — verified, and genuinely interesting.**
Python · Django · Celery on AWS (EC2/RDS/Aurora), with MySQL, **Cassandra**,
Redis, and RabbitMQ ([their own architecture
page](https://developers.klaviyo.com/en/docs/klaviyos_architecture)). The event
pipeline is the story: originally Celery tasks over RabbitMQ with Redis for
de-duplication writing into Cassandra, [rebuilt onto
Kafka](https://klaviyo.tech/rebuilding-event-infrastructure-at-scale-bebfe764bd8f)
with priority lanes and non-blocking retries, running **~170,000 events/sec at
peak**; each event fans out to hundreds of tracked dimensions, i.e. hundreds of
thousands of Cassandra writes per second. Aggregation runs on [Apache
Flink](https://klaviyo.tech/apache-flink-performance-optimization-c7bd28acc67)
with windows up to a month and **>1.5 TB of streaming state**.

**What this means for us — mostly what NOT to do.** We are four orders of
magnitude away from that load and copying any of it would be pure cost. The one
transferable lesson is structural, not technological: **they separated the event
log from the materialisation of aggregates**, and that seam is exactly what let
them swap the whole bus (RabbitMQ → Kafka) and bolt on Flink without touching
the product. Our equivalent seam is the read-model behind `/api/analytics`. It
is currently thin and correct; the note for the day it stops being thin is
*keep the log and the aggregate separable*, and the day segments arrive that
stops being a note and becomes the design.

**Frontend — honestly, unknown.** No public design system, no component
library, no frontend engineering posts, and Mobbin has one screen. Their
[React Native SDK](https://github.com/klaviyo/klaviyo-react-native-sdk) is a
TypeScript wrapper over the native SDKs and says nothing about the web app. I
found no basis for a claim about their web stack and am not making one.

---

## 5. The short list

Ordered by value-per-risk, each tied to a seam we already own.

1. **Per-step arming** (`draft`/`manual`/`live` per message → per platform/stage
   for us). Sharpens the s98 sequence gate, makes the live grant *safer*,
   touches machinery that exists. **Do this first.**
2. **Segments — live saved predicates over our event stream**, rendered as
   saved views on every list surface. Answers the Intel filter debt properly
   instead of per-surface. **Charter candidate; prior-art sweep first (rule 10).**
3. **Channel health** (their deliverability hub, translated). Real gap, no
   surface owns it, needs no ML. **Park with trigger.**
4. **Trigger-split vs conditional-split as a naming distinction** in the
   fan-out profiles. Cheap, clarifying, `proprietary/`.
5. **Scores on objects — decay on a capture, expected engagement on a draft.**
   **LATER, dependency named: D2.** Copy the *shape* (score + its window, on the
   object) not the number.
6. **Benchmarks.** REJECT now, parked with its trigger (several real tenants).

**Rejected, with reasons on record:** the flow-builder canvas (node-graph
grammar promises editable wiring — third rejection, same reason); cohort
benchmarks today (one tenant); K:AI as a "pattern" (it is what we already are).

**What it confirmed rather than changed:** Approve is the right shape and a
category leader converged on it independently; reject-with-a-reason (already
taken s89) is theirs; and our refusal to print numbers we cannot ground is the
discipline that makes their predictive-score pattern *safe* to adopt later
rather than tempting to fake now.
