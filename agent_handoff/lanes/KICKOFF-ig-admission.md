# KICKOFF — lane `ig-admission` (the publish-scoped public-asset admission)

**Founder GO on record, s85 close, by name** ("A + transcription-free"). Launch is
Mode B in the `thalon` tmux session. You own `agent/ig-admission`, worktree
`.claude/worktrees/ig-admission`, branched from `e514923`.

**SHIPS DISARMED. ZERO live calls.** Nothing you build may reach Meta or any
live platform. The sequence gate is untouched: Bluesky alone has a standing
test grant; Instagram posting needs the founder's per-platform GO, which he has
NOT given. Your proof is tests, never a live post.

---

## You are building ONE thing, and it is already designed

The s85 `ig-post` lane built the driver and the address seam, then **stopped at
the checkpoint** and REPORTED the admission mechanism rather than building it.
That report is your specification and it was reviewed by the lead.

**READ FIRST, in this order:**

1. `agent_handoff/lanes/WRAP-ig-post.md` **§2** — the chosen design, in full,
   including the rejected alternatives and their reasons. Do not redesign it.
   If you believe a part of it is wrong, say so in your wrap and stop at that
   point; do not silently substitute your own.
2. `packages/engine/src/social/publish.ts` — the `admitPublicMedia` dep is
   already declared and **un-defaulted** (line ~77, called at ~194 gated by
   `publisher.needsPublicMediaUrl`). The seam exists. You are supplying its
   implementation, not inventing its shape.
3. `packages/engine/src/webpage/public-assets.ts` — the bundle and the
   allowlist you are extending.
4. `apps/web/src/app/assets/[asset]/route.ts` — the public door.

---

## Your file set — DISJOINT, and it is a hard boundary

You own exactly these, plus their tests:

- `packages/engine/src/webpage/public-assets.ts`
- `packages/engine/src/social/publish.ts`
- `apps/web/src/app/assets/[asset]/route.ts`

A second lane (`transcription-free`) is live in parallel on
`packages/engine/src/ingest/` and `apps/web/src/components/transcription/`.
**Touch nothing outside your set.** If the work genuinely requires a file
outside it, STOP and report — that is a re-plan, not an ad-hoc edit. The lead
does not touch either set (the lead's track is `docs/research/mock-sheets/`).

---

## The build, restated as acceptance criteria

Everything here is from §2 of the wrap; it is repeated so a drift is visible.

1. **`pending` row family** beside `posts` in the per-tenant bundle
   `public-assets/<tenantId>.json`, with `.default([])` so existing bundles
   parse unchanged — **no `PUBLIC_ASSETS_VERSION` bump, no migration.**
   Row shape: `draftId` · `platform` · `family` (a **CLOSED enum**, today only
   `"social-media"`) · `contentHash` (sha256 hex) · `ext` (`^[a-z0-9]+$`) ·
   `expiresAtMs`.

2. **The source key is RECONSTRUCTED, never stored.**
   `objectKey(family, contentHash, ext)`. Storing a key would let a row pair
   `contentHash: B` with a key naming hash `A` and serve A's bytes under B's
   URL — breaking the `immutable` cache promise on a content-addressed door.
   Reconstruction makes that **unrepresentable**. Pin this with a test whose
   comment says exactly that, so a future refactor that "simplifies" it by
   storing the key fails loudly.

3. **Membership + expiry in `readPublicAssetBytes`**, in this order:
   published rows first (unchanged, pin store) → else a pending row matching
   `contentHash`+`ext` **and** a clock was supplied **and** `expiresAtMs > nowMs`
   → read the derived source key → else `not_public`.
   The clock arrives as a new **optional `{nowMs}` argument** (house rule: the
   clock is an argument, never read in core). **No clock → pending rows are
   ignored entirely**, so every existing caller stays byte-identical and
   enabling the pending path is a deliberate act.

4. **TTL = 5 minutes.** Each admission write also prunes expired rows, so the
   bundle self-heals.

5. **Revocation is the normal path**, in a `finally`, the instant
   `publisher.publish()` returns — success or failure. Revoke errors are
   swallowed so they can never replace the publish's own error; the TTL is the
   crash backstop, not that call.

6. **`rebuildPublicAssets` drops `pending`.** Rebuild is disaster recovery, not
   a hot path — a rebuild racing a publish breaks that one publish loudly.
   Fail-closed is the intended trade; state it in a comment.

7. **Origin = `APP_ORIGIN`**, already in the platform env schema. **No new env
   key.** No `APP_ORIGIN` → the seam is never built → the driver's existing
   honest refusal (`public_media_url_unavailable`) fires.

---

## THIS LANE WIDENS A SECURITY GATE — so state the bound and pin it

The gate's invariant moves from *"an attacker can fetch exactly the images the
blog already shows"* to *"…plus, for at most five minutes, the one image of a
post being published right now, for a driver that declared it publishes by
address."*

**Your wrap must state the bound it actually landed on, in those terms**, and
each bound below must have a test that fails if it is removed:

- per-driver opt-in (`needsPublicMediaUrl`) — a byte-uploading driver never
  consults the seam at all;
- one draft, one platform, one ref per admission (scope, not a blanket);
- revoked on success **and** on failure;
- expired rows are not served;
- no clock supplied → pending ignored;
- hash-verified read (`getContentAddressed` re-hashes and refuses on mismatch);
- closed `family` set and closed `ext` grammar;
- `rebuildPublicAssets` drops pending.

It is explicitly **NOT** "any `social-media` ref is public", and it must never
make an approved-but-unpublished draft's image reachable. If your implementation
cannot honour that, stop and report rather than shipping a wider gate.

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
  worktree is already prepped.

## Wrap protocol

Write `agent_handoff/lanes/WRAP-ig-admission.md`: what shipped, the security
bound you landed on with the test that pins each clause, anything in §2 you
disagreed with, and anything you deliberately did not build. Commit on your
branch, push, and report. **The lead does the rebase, PR and merge — you do
not merge.** Stop at the wrap.
