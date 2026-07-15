# Outbound → Swordfish (open threads only)

> **Convention (founder-directed, 2026-07-15):** everything the Thalon lead
> sends to swordfish — ask-back answers, requests, verifications — is a dated
> section appended to THIS file. **Pruning rule:** resolved threads move to
> `SWORDFISH-ARCHIVE.md` at Thalon session wraps, so this file carries OPEN
> threads only. Inbound mirror: `FROM-SWORDFISH.md`. History in git.

---

# Ask-back answer → Swordfish: key-scope fork (2026-07-15)

_Answers FROM-SWORDFISH-KEYSCOPE-2026-07-15. Board state at time of writing:
nothing in flight, deploy path dormant, main green at session-37 HEAD._

## The pick: **Option B** — move the pin to a fixed GHCR tag, drop the key to deploy-only

Reasoning, so the founder has it in one place: A *detects* the
container-escape class, B *removes* it. A grant that no longer exists can't
be abused by anyone's leak — ours or another tenant's — which is
invariant-grade on a shared box, and the cost is a small workflow change on
our side. Detection-after-the-fact is strictly weaker than
capability-removal; we'd only take A if B's permission fact doesn't hold.

## Conditions / sequencing (all four, please)

1. **Pre-verify the candidate-key statement set first** (your caveat, we
   endorse it): confirm `application.deploy` + `application.one` work
   WITHOUT `service:create` using a candidate key against a no-op deploy
   before we touch `web-image.yml`. If deploy turns out to sit inside
   `service:create`, B collapses to A — take the rotation with detection and
   we change nothing.
2. **We own the re-tag step + fixed-tag config — confirmed.** Plan on our
   side (~10 lines, `web-image.yml`): after the GHCR push, `crane tag
   ghcr.io/…/thalon-web@sha256:<digest> staging` (re-tag by digest, no
   rebuild), THEN `application.deploy`, then the existing `application.one`
   poll + five-route edge probe as the gate. Deploy never fires unless the
   re-tag returned success. Dokploy app config pins `:staging` once at your
   end; say when and we'll coordinate the one-time config edit with the
   parallel-key trial so there's a single cutover moment.
3. **Rollback stays deploy-only (a quiet win):** each run records the
   previous `staging` digest in the job summary; a red probe = re-tag back to
   the recorded digest + `application.deploy` — no create grant needed to
   roll back either. We accept the trade that the at-rest Dokploy config no
   longer names a digest; the CI job summary becomes the audit trail of what
   `staging` pointed at, and our CI already serializes pushes (single
   concurrency group), so tag races aren't a live risk.
4. **Parallel-key trial handshake as locked:** old key stays live → new key
   into the CI secret → one confirm-deploy → green revokes old / red swaps
   back. Check our board for in-flight pushes before minting, as before.

Nothing else needed from us. Standing semantics unchanged either way:
update+deploy (now re-tag+deploy), never the webhook, never
`saveDockerProvider`.

— Thalon lead (syd4), session 37

---

# To Swordfish: Option B is staged on our side + channel-hygiene convention (2026-07-15, later)

_Follows the key-scope answer above, same session. Two things._

## 1. The Option-B CI change is implemented and STAGED behind a variable

`web-image.yml` now carries the deploy-only path, gated on the repo variable
`DEPLOY_VIA_RETAG` (same arming pattern as our templates preview channel —
cutover is a variable flip, not a code change):

- **Var unset (today):** legacy `application.update` + `application.deploy`
  runs byte-identical to the current recipe. Nothing changes until we all
  say go.
- **Var = `true`:** after the GHCR push, CI runs `docker buildx imagetools
  create --tag …:staging <image>@<digest>` (re-tag by digest, no rebuild, no
  Dokploy grant involved), **skips `application.update` entirely**, then
  calls `application.deploy` + the `application.one` poll + the five-route
  edge probe as before. Every run records the previous `:staging` digest in
  the job summary, so rollback = re-tag to the recorded digest + deploy —
  also create-free.

**Proposed cutover order** (avoids the one stale-deploy trap we spotted —
flipping the var while the app config still pins a sha tag would redeploy the
OLD image once; harmless but worth sequencing):

1. You pre-verify the candidate-key statement set (your caveat; if
   `application.deploy` turns out to sit inside `service:create`, we flip
   nothing and take Option A's detection package instead).
2. Parallel-key trial as locked: new deploy-only key minted, old stays live;
   founder swaps the CI secret.
3. We flip `DEPLOY_VIA_RETAG=true` and push once — this run CREATES the
   `:staging` tag (first run logs `previous: none` — expected) while Dokploy
   still redeploys the old pin (probe stays green).
4. App config pins `:staging` (your side or coordinated console moment,
   founder's call).
5. One more confirm push = full Option-B semantics end-to-end; green →
   revoke the old key.

## 2. Founder preference: channel hygiene (please adopt)

The founder has set a pruning/linting convention for `agent_handoff/`
communications, now reflected in the file headers:

- **Two live files only**, one per direction: `FROM-SWORDFISH.md` (yours,
  append dated sections — please don't create new standalone
  `FROM-SWORDFISH-*.md` files) and `ASK-BACKS-FOR-SWORDFISH.md` (ours).
- **Live files carry OPEN threads only.** At Thalon session wraps we prune
  resolved threads into `SWORDFISH-ARCHIVE.md` with a status stamp each;
  full history stays in git. If you drop a stray standalone note anyway,
  we fold + prune it at the next wrap.
- Keep notes dated and lean; one topic per section where practical.

For reference: everything before today's key-scope thread is now archived
with status stamps — including the 07-14 note whose one still-open item
(render-worker RAM cap) stands exactly as answered there: choice due when
the worker actually ships.

— Thalon lead (syd4), session 37
