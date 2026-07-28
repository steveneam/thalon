# KICKOFF — lane `sched-spine` (the Postiz take: capability validator · queue producer · queue consumer, DISARMED)

> **APPROVAL ON RECORD (founder, s81 close): "I'll go with your
> recommendations"** — given against all four s82 calls: #1 was the named-lane
> launch approval for exactly these three lanes, #3 ruled your preview card
> ships as a keeper-STATE (not a sheet amendment), and #4 confirmed the
> disarmed posture below. The standing rule is that every launch needs fresh
> approval; this is it, and it covers exactly this run.

You are lane C of three running in parallel, and you are the one carrying
product-moving work rather than surface polish. **The contracts and the db
repo you build against are FROZEN** — the s82 pre-flight window merged to main
at `7fee14c` before you were launched. You do NOT edit `packages/contracts/**`
or `packages/db/**`. A mid-lane schema or contract need is a re-plan and a
message to the lead, never an ad-hoc edit (COORDINATION.md header).

Read `CLAUDE.md` first, then IN ORDER:

- **`docs/research/s82-PREPLAN.md`** — THE PLAN OF RECORD. §1 (what Postiz
  actually is and what is worth taking), §1b (the deep dig — how an
  integration really works), §2 "Lane C" (your four tasks), §3 calls #3 and
  #4, §5 (what is deliberately out of scope).
- **`packages/contracts/src/platform-capability.ts`** — read it end to end
  before writing a line of C1. It states, at length, the one distinction this
  whole lane can get wrong: the matrix is the platform's CEILING, and
  `platformProfiles[platform].charLimit` is an AUTHORING BUDGET. They are
  different numbers with different owners. Facebook's shipped budget is 5000
  against a platform that accepts 63,206 — the gap is the opinion, and it is
  correct.
- **`packages/contracts/src/publish-queue.ts`** — the rulebook. `failed` is
  terminal by decision; `processing → pending` is the only backwards edge and
  it is the stale-claim release.
- **`packages/db/src/repos/publish-queue.ts`** — your storage door, already
  built and tested. `enqueue` is idempotent on the instant; `listDue`,
  `claim` and `releaseStale` are SYSTEM-level (cross-tenant) and nothing
  tenant-facing may call them.
- **`packages/engine/src/social/publish.ts`** — the existing publish door and
  its refusal ladder a→f. **You do not modify it and you do not go around
  it.** Your consumer hands claimed rows TO it.

## Your file set (nothing outside it)

- `packages/engine/src/social/**` (the validator + the queue producer/consumer
  core)
- `apps/web/src/app/api/social/**`
- `apps/web/src/components/approve/**`
- `apps/web/src/components/calendar/**` — **C4 only**
- your own tests beside each

**Do NOT touch** `packages/contracts/**` or `packages/db/**` (frozen), any
`components/videos/**` file (lanes A and B own those), or
`app/app/workspace.css` (the lead's).

---

## C1 — the capability matrix's validator

`validateForPlatform` — pure, tested per platform, in the engine. It consumes
the frozen `PLATFORM_CAPABILITIES` and returns deterministic refusals that
name the reason, in the honest-doors grammar the rest of the engine uses.

This is **the Phase-2c sibling of the judge**: the judge gates what a post
CLAIMS; this gates whether it FITS. Today our drivers carry zero such
constraints — a 400-character X body reaches the platform call before anything
refuses it.

Wire it in three places, and no others:
1. at generation, beside `targetTerms`;
2. at Approve, as a visible fit line (C4);
3. at the queue producer, which refuses to enqueue what the platform will
   bounce (C2).

Note `text.urlWeight`: X bills every URL at a fixed 23 characters however long
it is, so a naive `body.length` is wrong for exactly one platform and right for
the rest. That is data in the matrix, not a branch in your code.

## C2 — the queue producer: Approve's *Schedule* verb

An approved `post`-family draft + a platform + a slot → a `publish_queue` row
through the frozen repo. Refuses on C1 validation before it writes.

**Keep planned slots and queue rows distinct facts.** A `planned_slot` is the
operator thinking "Tuesday-ish"; a queue row is a commitment with an
idempotency key behind it. The calendar must say which is which. Derive the
next-free-slot suggestion from the existing `planned_slots` grammar rather
than inventing a second scheduling vocabulary.

## C3 — the queue consumer tick

Mirrors the proven sweep-scheduler pattern (a systemd user unit, live since
s65 — read how that one is shaped before designing this one). Claims due rows
and walks them through the EXISTING publish door, whose refusal ladder is
untouched: an unarmed platform's rows simply fail closed and say so, which is
the correct behaviour, not a gap.

**Carry the recovery pattern from day one.** `releaseStale` exists on the repo
precisely so a consumer that dies mid-tick cannot strand rows in `processing`
forever — Postiz needed a whole `missing.post` workflow to learn this.

⛔ **IT SHIPS DISARMED, AND THIS IS NOT NEGOTIABLE.** With `SOCIAL_QUEUE_ARMED`
absent the tick REPORTS and touches nothing. **Your lane makes zero live
platform calls, ever** — not one, not to test, not to "check the wiring". Rows
sit `pending`. Arming, the per-platform GO and the per-post GO all remain the
founder's, and the standing sequence gate is verbatim: *"we're not posting
anything yet until all the walks are verified and fixed."*

## C4 — the Approve platform-true preview + the calendar's scheduled state

**Founder call #3 is decided: it ships as a keeper-STATE behind existing
chrome, NOT as a sheet amendment.** The sheet stays law. That is the two-step
doctrine's own shape — a state behind resting chrome first, permanent chrome
only after dogfood proves it earned it — and it keeps you unblocked on a
canvas round-trip.

The preview shows what the platform will actually render: the truncation
point, link handling, hashtag rendering — all powered by C1's matrix, not by
guesses.

---

## The gates you are held to

- **`npm run verify` is THE gate, and you gate on its EXIT CODE.** Never pipe
  it through `tail` — that swallows the failure (main has gone red five times;
  #3 was exactly this). Redirect to a file and read the file.
- **vitest does NOT typecheck and does not lint.**
- Every state-changing repo write already emits its event; your engine code
  must not invent a second audit path.
- Write tests WITH the code, in the same change.
- **You cannot drive or screenshot your own work** — the lead runs the jobs
  harness against Approve and Calendar at the merge gate.
- Do not rebase onto main or merge anything; the lead owns rebase, PR and
  merge. Commit on `agent/sched-spine` and stop at a verified boundary.

## The licensing rule, stated once

Postiz is **AGPL-3.0**. Its interfaces, flows and folder shapes were studied as
facts and written up in the plan; that is what "reference-only patterns"
contemplates. **No Postiz code or text enters this repo.** Everything you write
is fresh against Thalon's own contracts. Do not open their source while
implementing.

When you are done: verify green, commit, and report to the lead what you
built, what you did not, and anything you found that the plan got wrong.
