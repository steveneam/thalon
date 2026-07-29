# WRAP — lane `transcription-free` (s86)

Branch `agent/transcription-free`, worktree `.claude/worktrees/transcription-free`,
branched from `e514923`. **The lead does the rebase, PR and merge — this lane
does not merge.**

**Zero live spend, as required.** Every test runs on injected fakes; no metered
gateway call was made to prove anything, and the one place a metered driver
could still have been reached (`createGatewayEmbeddingDriver`) is asserted
never-constructed rather than exercised.

`npm run verify` green on exit code in this worktree — see the gate line at the
bottom.

---

## WHICH AXIS CHANGED — the question the kickoff asked me to answer plainly

**The EMBED axis. Not the provider axis. And both embed passes, not one.**

The kickoff's ground truth held up in the code:

- The **transcript-provider axis was already free by default** and I changed
  **nothing** on it. `getTranscriptProvider` still resolves explicit name > env
  `TRANSCRIPT_PROVIDER` > the zero-dep `caption-file` default; `whisper-local`
  is local and free; `hosted-vendor` is the metered one and stays opt-in via
  env. That axis needed no change and got none — stated here so it is not left
  ambiguous.
- The **embed axis was the spend**, in two places, and both are now gated on
  one per-ingest flag:
  1. `ingest-video-url.ts` — the chunk embed (`embedChunks`).
  2. `area-relevance.ts` via `scoreAreaRelevance` — a **second** metered pass
     that embeds the tenant's monitored-area descriptions. Gating only (1)
     would have left half the spend in place while the surface claimed to be
     free. It is now not *called at all* on the free path.

On (2) there is a trap worth recording: `scoreAreaRelevance` already returns
early on empty vectors, so skipping only the chunk embed *appears* to fix it.
That is incidental — one refactor from becoming spend again. The call site is
gated explicitly, and a test injects a counting embedder on the free path and
asserts **zero** embed calls, which fails on a half-fix regardless.

### What I deliberately did NOT change: `ingest-web-url.ts`

Its default still embeds, on purpose. It is not the transcription path — it is
the grounding web ingest, and a page ingested there exists *only* to be
retrieved: the page loop grounds drafts through `topKSimilarChunks`, which
ranks on these vectors and skips chunks without one. Making it free by default
would have produced sources that still count as grounding while citing nothing
— a silent correctness regression well outside the founder's ruling, which is
about **his knowledge tool**. The reasoning is written into the file's header so
the next reader doesn't "finish the job". If a toggle is ever wanted there it
needs its own honest story on the page-loop surface.

---

## What shipped

**Engine — `packages/engine/src/ingest/ingest-video-url.ts`**

- `VideoUrlIngestRequest.aiEnhance?: boolean` — **absent/false ⇒ free**. Not an
  env var, not a tenant setting: per ingest, the operator's choice.
- Free path: no `embedChunks`, no `scoreAreaRelevance`, and
  `createGatewayEmbeddingDriver` is **never constructed** (it defers the gateway
  lookup into `embed()`, so a constructed-but-unused driver throws nothing and
  looks exactly like a free path — construction is the only moment the metered
  default is observable without spending).
- `meta.aiEnhanced: boolean` written on **both** paths. `false` is not a
  fabricated measurement, it is the operator's recorded choice — and it is the
  only thing that distinguishes "ingested free" from "scored, nothing matched".
  Rows that predate the key simply lack it: absent = unknown. It is written
  **after** `...request.meta`, unlike every other key there: the rest are
  caller-overridable defaults, but this one records what the function actually
  did, and a caller able to stamp `aiEnhanced: true` onto an ingest that
  embedded nothing would make the surface lie about retrievability — the one
  thing the key exists to prevent. Pinned by its own test.
- `VideoUrlIngestResult.enhanced: boolean` — **measured, not echoed**. On the
  duplicate fast path it reports the EXISTING row's state (does it have
  vectors?), because that path re-processes nothing and the toggle genuinely
  had no effect.

**Request path** — `lib/library/ingest.ts` (zod `aiEnhance: z.boolean()
.optional()`, no default clause, so the single default stays engine-side and
the two can't drift), `lib/library/client.ts`, `api/library/ingest/route.ts`
(unchanged behaviour — `parsed.data` already carries it; doc note added). A
body without the flag — an old client, a curl, a replayed request — ingests
free. A non-boolean is refused rather than coerced: a truthy string must never
become spend.

**Surface** — `components/transcription/transcription.tsx` +
`transcription-model.ts`. The toggle joins the ingest box's **existing**
unfolding extras (the group the tags field and seam readout already live in),
unticked at rest and reset to free after every ingest.

---

## What a free ingest gives up, and where the surface says it

Real losses: no chunk embeddings ⇒ never scored against the monitored areas
(no `meta.areaRelevance`) ⇒ `topKSimilarChunks` skips it outright. It is found
by title, URL and tag, and its transcript, copy, export and delete doors are
untouched — free is not degraded ingest.

Said in words in **three** places, so the absence is never left to read as a
zero or as "nothing matched":

1. **At the point of choice** (before he spends): *"Free and deterministic: the
   transcript is stored verbatim, with no relevance score and no semantic
   retrieval — you'll find it by title, URL and tag."* Flips when ticked to
   name the metered call and say it goes back to free next time.
2. **On the row**, in the same slot an enhanced row states its area: *"· free
   ingest — no relevance score, not semantically retrievable"*.
3. **The shelf footer**, whose old wording had become a lie — it asserted of
   the whole shelf ("chunked and embedded once") a thing now true only of the
   ingests he paid for.

Plus one honest line the toggle itself created: a re-ingest of a transcript
already on the shelf re-processes nothing, so with the toggle on it is a
control the operator just used to no effect. It now says *"Already on the shelf
— … nothing was re-processed and AI-enhance did not apply to it."*

---

## The one scope call — approved mid-lane, flagged here

The kickoff's corrected file set covered the **request** path but not the
**response** path, and criterion 4's per-row half cannot be met without it:
`areaRelevance: []` on the wire is ambiguous between "chose free", "no
monitored areas" and "pre-rider row" — an absence with three causes that a
surface can only report honestly by staying silent.

Per the kickoff I stopped rather than editing ad-hoc, and the **lead approved
extending by two files**: `lib/library/types.ts` (optional `aiEnhanced?:
boolean`) and `lib/library/serialize.ts` (read `meta.aiEnhanced`, boolean only).
Both are in the directory the kickoff already corrected scope into and both are
disjoint from `ig-admission`. Nothing else outside the set was touched.

---

## Acceptance criteria

| # | Criterion | Where it is pinned |
|---|---|---|
| 1 | Free + deterministic is the DEFAULT; zero metered calls, both passes | `ingest-free-by-default.test.ts` — gateway-constructor spy asserts `[]`, usage ledger asserts `0/0`, and a counting embedder asserts zero calls (the half-fix catcher) |
| 2 | AI-enhance is per-ingest, toggle → client → route schema → engine | `lib/library/__tests__/ingest.test.ts` (schema + forwarding, both ways round, non-boolean refused) · `transcription-ai-enhance.test.tsx` (untouched ingest sends **no** flag; ticked sends `true`; next ingest free again) |
| 3 | One artifact | `ingest-free-by-default.test.ts` — same `kind`, same `raw_ref` family; enhanced meta = free meta **+ `areaRelevance`**, no sibling row |
| 4 | Honest degradation, absent keys stay absent | engine: `"areaRelevance" in meta === false`, never a 0 · serializer: boolean-only, pre-s86 rows emit no key · model: `freeIngestNote` speaks only for `aiEnhanced === false` · render: free row states it, enhanced row states its area, pre-s86 row states neither |
| 5 | Existing rows unaffected | `ingest-free-by-default.test.ts` — an already-embedded source keeps its vectors, its `areaRelevance` and its retrievability while free ingests land around it; `topKBySimilarity` already filters null embeddings, so retrieval never regressed |
| 6 | A test for each | 3 new test files + 4 existing files updated |

**On rule 6's eval-row half:** no operator override or correction arose in this
lane — it is a capability change, not a judge-behaviour correction, and the
golden seeds are judge-lens rows (`judge_g1_denylist`, `judge_g3_grounding`,
`judge_discoverability`, `draft_edit`). Writing a synthetic row in one of those
kinds to satisfy the letter of the rule would have put a fake into the suite of
record. The ratchet here is executable instead, which is higher on rule 8's
ladder: **the gateway-constructor spy is the durable artifact** — it goes red if
anyone restores a metered default on the transcription path.

## One ratchet-on-ratchet note for the lead

The B4.4 metering-boundary scan (`packages/engine/src/__tests__/gateway-boundary
.test.ts`) is a plain content regex over every `.ts/.tsx` in the repo, so it
fired on a **doc-comment mention** of the gateway-lookup symbol in the new test
— prose, not a call site. The tempting fix was to allowlist the test file; that
is precisely the weakening the ratchet exists to prevent, so the comment was
reworded instead and the reason recorded in it. Worth knowing before the next
lane hits the same wall: **explaining** the choke point in a comment is enough
to trip the scan.

## What I deliberately did not build

- **`ingest-web-url.ts` stays enhanced by default** — reasoning above.
- **No re-ingest-to-enhance path.** An operator who ingested free and later
  wants embeddings has no in-place upgrade: the fast path keys on the
  transcript hash and re-processes nothing. Building one is a real feature
  (re-embed an existing source, re-score, keep one row) and it was not in the
  criteria. What shipped instead is that the surface **says** the toggle did
  not apply, rather than letting it look effective. **Charter candidate.**
- **No design pass, no Mobbin, no sheet edit** (rule 7). The toggle ships in the
  existing ingest-box grammar and added **no CSS** — the surface's stylesheet is
  byte-unchanged, so the `.transcription-surface` scoping test still governs.
  Note the founder's phrasing was "a toggle **beside Ingest**"; the kickoff
  overrode the literal placement (the resting band stays byte-true to the
  sheet), so it sits in the unfolded extras. **If he meant it literally, that is
  a placement call for the surface's own design pass, not a lane's.**
- **The recorded `data-screen-label` "Library" vs "Transcription" drift** —
  left as instructed.

---

## Gate

Run in this worktree, gated on exit code (never a piped tail):

```
npx vitest run --maxWorkers=2   → 331 files passed | 4 skipped, 2804 tests passed | 9 skipped, exit 0
npm run typecheck               → exit 0
npm run lint                    → exit 0 (8 pre-existing warnings, unrelated files)
```

That is `npm run verify`'s three stages with the bounded worker pool the kickoff
requires (two lanes live; an unbounded pool OOMs this box). `pkill -f vitest` was
never used — the one stale run was stopped by task id.

**Watch out for a partial pass reading as a full one:** a `vitest run` launched
from `apps/web` runs the web project ALONE (147 files / 1248 tests) and prints a
perfectly green summary. The workspace-wide run above is 331 files / 2804 tests.
The `gateway-boundary` regression this lane hit lives in `packages/engine` and
was invisible to the narrower run.

## Files

Engine: `ingest/ingest-video-url.ts`, `ingest/ingest-web-url.ts` (doc only),
`ingest/__tests__/ingest-free-by-default.test.ts` (new),
`ingest/__tests__/ingest-video-url.test.ts`, `ingest/__tests__/ingest-metadata.test.ts`.

Web: `lib/library/ingest.ts`, `lib/library/client.ts`, `lib/library/types.ts`,
`lib/library/serialize.ts`, `lib/library/__tests__/ingest.test.ts` (new),
`lib/library/__tests__/serialize.test.ts`, `app/api/library/ingest/route.ts`
(doc only), `components/transcription/transcription.tsx`,
`components/transcription/transcription-model.ts`,
`components/transcription/__tests__/transcription-ai-enhance.test.tsx` (new),
`components/transcription/__tests__/transcription-model.test.ts`,
`components/transcription/__tests__/transcription.test.tsx`.
