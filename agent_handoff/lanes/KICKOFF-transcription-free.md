# KICKOFF — lane `transcription-free` (free + deterministic by default, AI-enhance as a toggle)

**Founder GO on record, s85 close, by name** ("A + transcription-free"). Launch
is Mode B in the `thalon` tmux session. You own `agent/transcription-free`,
worktree `.claude/worktrees/transcription-free`, branched from `e514923`.

**Zero live spend.** Every test runs on injected fakes. You must not make a
metered gateway call to prove anything.

---

## The ruling you are actioning — it is the founder's own, from s79

> Transcription is **HIS knowledge tool**. It must be **free and deterministic
> by default**, with an **AI-enhance toggle beside Ingest** — per-ingest, his
> choice.

And the constraint he stated in the same breath: **no second artifact.** He
explicitly declined a verbatim-plus-enhanced pair sitting side by side. One
source, one transcript; the toggle changes how it was made, not how many exist.

---

## Ground truth, checked before you launched — including one scope correction

The lane board's file set was **`packages/engine/src/ingest/` +
`apps/web/src/components/transcription/`**. That is incomplete: a per-ingest
toggle is an operator choice that must cross the wire, so it also needs the
request path. The corrected set is below. It is still disjoint from the other
live lane.

**What actually happens today** (verified in the code, not assumed):

1. `packages/engine/src/ingest/ingest-video-url.ts:120` —
   `deps.embedder ?? createGatewayEmbeddingDriver(model)`. The **default is
   the metered gateway**. Same line in `ingest-web-url.ts:135`.
2. `packages/engine/src/ingest/area-relevance.ts:83` — the SAME default, a
   **second** metered embed pass per ingest, scoring the transcript against the
   tenant's monitored areas. **Do not miss this one**: turning off only the
   chunk embed leaves half the spend in place, and a lane that reports "free by
   default" while this still bills is worse than one that changed nothing.
3. The **embedder is already an injectable dep** on every one of those call
   sites. That is why this lane is small: the default is a flag plus skipping
   the embed pass, not a rewrite.
4. The **transcript provider is a separate axis and is ALREADY free by
   default** — `getTranscriptProvider` resolves explicit name > env
   `TRANSCRIPT_PROVIDER` > the zero-dep `caption-file` default
   (`packages/engine/src/ingest/transcript.ts:63`). `whisper-local` is local
   and free; `hosted-vendor` is the metered one and is opt-in via env already.
   **Say plainly in your wrap which axis you changed.** If you conclude the
   provider axis needs no change, that is a fine answer — state it, don't
   quietly leave it ambiguous.

**What degrades when embeddings are absent, and it must degrade HONESTLY:**
`meta.areaRelevance` is built from the chunk-embedding centroid, and
`transcription-model.ts` reads it (`topRelevance`). Retrieval
(`retrieve.ts`) ranks on those vectors. A free ingest therefore has **no
relevance score and is not semantically retrievable** — the surface must SAY
so, in the sheet's own words. Never a 0 that reads real, never a blank that
reads like a measurement of nothing (repo rule: honesty beats polish).

---

## Your file set — DISJOINT, and it is a hard boundary

- `packages/engine/src/ingest/` (the engine half, incl. `area-relevance.ts`)
- `apps/web/src/lib/library/ingest.ts` + `apps/web/src/lib/library/client.ts`
  (the request path — the scope correction above)
- `apps/web/src/app/api/library/ingest/route.ts`
- `apps/web/src/components/transcription/`
- plus tests for all of the above

A second lane (`ig-admission`) is live in parallel on
`packages/engine/src/webpage/public-assets.ts`,
`packages/engine/src/social/publish.ts` and
`apps/web/src/app/assets/[asset]/route.ts`. **Touch nothing outside your set.**
If the work genuinely requires a file outside it, STOP and report — that is a
re-plan, not an ad-hoc edit.

---

## The design constraint you may NOT relitigate: you do not get to redesign the surface

**Design is lead-direct in this repo** (founder: *"i want you responsible for
the exact claude-design mock implementation"*), and
`docs/research/ux-refinement-program.md` **rule 7** is explicit:

> **A LANE NEVER RUNS ITS OWN MOBBIN PASS.** … A lane that needs a new control
> ships it **in its surface's existing sheet grammar** — the s82 keeper-state
> precedent: *a keeper returns as a state behind the sheet's own chrome, the
> sheet stays law*. **A lane may never amend a sheet.**

So, concretely:

- **Do NOT open Mobbin. Do NOT run a design pass. Do NOT edit
  `docs/research/mock-sheets/Library.dc.html`** or any other sheet.
- The AI-enhance toggle ships in the **existing** ingest-box grammar in
  `transcription.tsx` — the operator extras already unfold on engage
  (`ingestOpen`, the tags + pasted-captions fields, `.ingest-box .ingest-field`).
  Your toggle joins **that** unfolded group, in that vocabulary.
- The Transcription surface gets its proper design pass later, in the
  programme, where the lead designs this control against real references
  alongside everything else on the screen. Your job is that the capability
  exists and is honest, not that it is beautiful.
- **Note for your wrap** (already known, do not fix it): the sheet's
  `data-screen-label` still says "Library" while the app calls the surface
  Transcription. That is a recorded naming drift with its own go — leave it.

---

## Acceptance criteria

1. **Free + deterministic is the DEFAULT.** A default ingest makes **zero**
   metered calls — both the chunk embed and the area-relevance embed. Pin it
   with a test that fails if any gateway driver is constructed on the default
   path.
2. **AI-enhance is per-ingest**, carried from the toggle → client → the route's
   input schema → the engine call. Not an env var, not a tenant setting — his
   choice, each time.
3. **One artifact.** Enhanced and free ingests produce the same source shape;
   the enhanced one additionally has embeddings and `areaRelevance`.
4. **Honest degradation.** A free source states that it has no relevance score
   and is not semantically retrievable, in words, wherever that absence is
   visible. Absent keys stay absent (the existing convention) — never a
   fabricated 0.
5. **Existing rows are unaffected.** Anything already ingested keeps working.
6. **A test for each of the above**, and every override/correction becomes an
   eval row in the same change (AGENTS.md rule 6).

---

## Gates, and the box

- Gate on **exit code**, never on a piped tail: `npx vitest run --maxWorkers=2`
  (two lanes are live; an unbounded pool OOMs this 16 GiB box — measured s82).
- **NEVER `pkill -f vitest`** — it matches every worktree and kills the
  neighbouring lane's suite. s82: it did.
- `vitest` does **not** typecheck. Run `npm run typecheck` too.
- Before you call yourself done: `npm run verify` in your worktree, green on
  exit code.
- **Never `npm install` in a worktree** (the preinstall guard refuses); the
  worktree is already prepped. `next dev` cannot run inside a lane (Turbopack
  rejects out-of-root symlinks) — do not try to start it.

## Wrap protocol

Write `agent_handoff/lanes/WRAP-transcription-free.md`: what shipped, which
axis you changed (embed pass / provider / both) and why, what a free ingest
gives up and where the surface says so, and anything you deliberately did not
build. Commit on your branch, push, and report. **The lead does the rebase, PR
and merge — you do not merge.** Stop at the wrap.
