# CURRENT

## Stamp

2026-07-29 (session 88, syd4 — **zero credit spend, zero posts**). **THE ONE
APPROVED LANE SHIPPED, THE WORKSPACE SPEC IS APPROVED, AND `main` WAS FOUND RED
AND FIXED.** Verify-on-merged-main: **exit 0, 3074 passed / 9 skipped, 0 lint
errors** (s87 closed at 3037). Worktree GC'd, branch deleted, tmux window
killed, tree clean at `3581df2`, pushed. Nothing in flight.

**HIS TWO RULINGS THIS SESSION, VERBATIM:** *"yes to all."* (the workspace-spec
verdict bundle) and *"and you're right, hold off on the W1 research, reassess
after merge is done."*

## THE HEADLINE: `main` WAS RED, AND WE SHIPPED IT THAT WAY IN s87

`tests/no-nul-in-source.test.ts` failed on `tests/repo-hygiene.test.ts` —
**two ratchets from the SAME s87 commit (`e7a46a8`) contradicting each other.**
repo-hygiene used a raw `0x00` byte as a join separator; no-nul-in-source
forbids raw NULs in tracked source. **s87 added both and did not re-run the full
suite after its final commits**, so main sat red from the s87 wrap until the
s88 lane hit it. The lane proved it was inherited (stashed its own work,
re-ran on a clean tree) and correctly left it alone — `tests/` was outside its
file set. **Lead fixed it in `30b4614`:** the two-character escape `"\0"` —
identical runtime string, nothing binary on disk. The guard's failure message
now names that fix, because a guard that only says "you are wrong" invites the
repair that guts it (drop the separator, allowlist the file). The standing
lesson is in the guard's docblock as the third recorded occurrence and the
first **deliberate** one.

**Read that as the discipline point it is:** verify-on-merged-main is THE gate,
and a session that adds ratchets after its last verify has not run the gate.

## THE LANE — `create-shells`, merged `3581df2`

Both chartered shells shipped disarmed (live drivers only behind
`AI_GATEWAY_API_KEY`, never constructed in a test; 100 create tests, was 73).
`create.describe_reference`: stored images only, content-address-verified on
read; external refs never fetched, audio refused in words, **both before the
budget guard** so an undescribable reference costs neither an assertion nor a
call. `create.ai_edit`: propose/apply. Both labels landed in the
shell-inventory ratchet **and** SPINE §1 in the same change.

**Its best work was a refusal.** The kickoff's R8 ordering (rewrite → judge the
candidate → land on pass) is **unbuildable through the shared harness**:
`runJudgePipeline` judges only a PERSISTED body and verdicts bind to the
draft's current `body_hash`, which I1 reads — so judging a candidate would mint
an **I1-valid passing verdict for text the judge never read**. Land-then-revert
is worse: it writes an `eval_cases` row asserting the operator wanted the old
text back, and that corpus is **training data**. It reported instead of faking.
**Residue, named not discovered:** on judge refusal *at apply*, the draft is
`blocked` carrying the applied body — not the spec's "keeps its prior body".
Safety unaffected (I1 walls the Composer). **`docs/create-engine/spec.md`
§Error Behavior carries the dated deviation block, flagged READ BEFORE
B-create.4.**

**Two lead-ruled deviations, both accepted:** `MODEL_VISION` defaults to
`anthropic/claude-sonnet-4.5` and NOT to the draft tier as the kickoff said —
`MODEL_DRAFT` is `meta/llama-3.3-70b`, **text-only**, so the kickoff would have
shipped a default that provably cannot do the job (no new vendor: it is already
`MODEL_JUDGE_FINAL`'s default, and `seams.test.ts` now pins vision ≠ draft). And
the lane's own unprompted wall: a `claude-cli/*` vision tier is refused by name,
since that transport is text-only and would have described a picture it never
saw.

## THE WORKSPACE SPEC IS APPROVED — the surface programme is unblocked

`docs/workspace/spec.md` = **APPROVED** on *"yes to all"*. Every ruling is
written where the decision lives: §8 carries the five **with their
consequences**, §5 carries them **in-place on the gaps**, §7's superseded
"hold both lanes" recommendation is **struck through, not deleted**. Decided:
act structure + per-surface jobs · **ONE Library** (transcription = an ingest
kind + filter) · **Channels** = social destinations / **Integrations** = AI
seats + providers / **Settings** = operator/seams/env · **Board = a Dashboard
toggle**, its route retiring in W1's ORIENT pass (nothing deleted before the
wave draws its replacement) · **wave order W1 = Approve · Dashboard · Runs** ·
onboarding/notifications/search **research-first, and no route gets scaffolded
on the strength of that ruling**.

**NOT covered by "yes to all" — still his calls:** the app-side Calendar →
Schedule rename · the Composer POPOUT state · YouTube as a destination.

## Resume prompt (session 89, syd4 — "gogogo" boots this)

**Resume · Thalon** — s88 merged `create-shells`, fixed an inherited red on
`main`, and banked the founder's approval of the workspace spec. Nothing is in
flight. **The next action is W1 research** (Approve · Dashboard · Runs +
the onboarding/notifications questions) — his own deferral, to be taken up
**after the Jul 31 11pm UTC budget reset**.

**Read first:** CLAUDE.md → this file → `docs/workspace/spec.md` (APPROVED —
§6 waves, §3 contracts) → `docs/research/ux-refinement-program.md` (the
coverage ledger) → COORDINATION.md §s88.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   doctor` · `bash ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`.

▎ ▸ **⚠️ BUDGET WAS THE BINDING CONSTRAINT ALL SESSION — 90% of the weekly limit
was already spent when the lane launched, and the lane then ran a full build on
top.** Resets **Jul 31, 11pm UTC**. W1 research was NOT started, deliberately and
on his instruction: a wave is one full lead session by the spec's own
definition, and starting it at this level risks stopping mid-wave — a
half-researched surface with ledger rows half-moved is worse than an untouched
one. **Check headroom before drawing or researching anything.**
▎ ▸ **NEXT LANE WHEN BUDGET ALLOWS: `analytics-honesty`** — kickoff committed and
current, GO still on record, nothing downstream blocked on it.
▎ ▸ **QUEUED, WITH A HOME:** the candidate-judge entry in `proprietary/judge`
(evaluate `{draft, candidateBody}`, return the verdict, append **no** hash-bound
rows) closes the R8 deviation exactly; the heavier alternative is a staged-body
column. The lane's warning worth keeping: the real risk is **copying** the gate
ladder rather than sharing it.
▎ ▸ **Six lead items from s87** remain written up in COORDINATION.md §s87.
▎ ▸ **⚠️ THE ANALYTICS SHEET'S FACEBOOK FIXTURE IS STILL WRONG** — Meta retired
`post_impressions_unique` (2025-06-15) and `post_impressions*` (2025-11-15).
Reach survives as `post_total_media_view_unique`. Read
`packages/engine/src/social/metrics/capability.ts`, not the mock's numbers.
▎ ▸ **✅ X SPEND — RULED AND CLOSED (s87):** billed only towards launch; covers
POSTING too. Analytics is NOT blocked — Bluesky/Facebook/Instagram read free, X
reads `deferred` honestly.
▎ ▸ **Still open, founder's call:** Calendar → Schedule rename · Composer POPOUT
state · YouTube as a destination (own window; `SETTINGS_DEFERRED` test fires the
day it becomes real) · the `thalon-deploy` + templates-preview credentials
(`NEEDS-STEVEN` 2026-07-29e) · the portal work in his own browser (2026-07-28n,
2026-07-29d — instructions in his Gmail draft).
▎ ▸ **⛔ SEQUENCE GATE unchanged:** bluesky armed for testing on his recorded
words; every other platform is per-platform + per-post GO; the queue consumer's
key rests EMPTY. Instagram's media path is BUILT and **disarmed**. **Nothing was
posted.**
▎ ▸ **`impeccable` still RELAXED on `docs/research/mock-sheets/**`** on his
ruling — `apps/web/**` and landing pages are NOT covered.
▎ ▸ **Traps worth keeping:** the Bash tool's working directory PERSISTS across
calls (use `git -C` / absolute paths — it bit again this session) ·
`launch-lane.sh` can leave the kickoff UNSUBMITTED in the lane's input box
(re-send Enter; it happened again on the lead's mid-lane ruling) ·
`npx vitest run -w <pkg>` is **`--watch`**, not a workspace filter · never
`pkill -f vitest` while lanes are live · vitest does NOT typecheck · zod 4's
`z.record()` over an ENUM key is **exhaustive** (use `partialRecord`).
▎ ▸ **Standing:** stealth · hermes-relay = founder · design is lead-direct, never
delegated · every lane/subagent launch needs fresh founder approval · GATE ON
EXIT CODE, never pipe the suite · **verify-on-merged-main = THE gate, and re-run
it after your LAST commit** · research before build (rule 10) · check the
ENVIRONMENT before his hands (rule 11) · specs carry ground truth (rule 12) ·
platform logins live durably in `.context` · no AGPL embedded · wrap =
verify+commit+push+restamp.
▎ ▸ **State:** main = origin at `3581df2`, pushed · staging on s85 code + the OCI
label · four social channels connected.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync; lane
worktree GC'd, branch deleted, tmux window killed.

## Pointer

CLAUDE.md → this file → `docs/workspace/spec.md` (APPROVED) →
`docs/research/ux-refinement-program.md` → `docs/research/mock-sheets/README.md`
→ COORDINATION.md → NEEDS-STEVEN.md → `docs/research/prior-art-portal-automation-s84.md`
(READ BEFORE ANY PORTAL WORK).

## Delta (session 87)

s87 froze the s87 contract window and shipped both approved lanes (B-create.2
the Create run engine, D2 the own-post analytics spine), then ran the hygiene
audit (verify 342s → ~280s) and landed the spec-ground-truth ratchet. It also
drafted the workspace spec that s88 got approved — and, unnoticed, shipped the
two contradicting ratchets that left `main` red for s88 to find.
