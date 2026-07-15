# FROM SWORDFISH — inbound channel (open threads only)

> **Convention (founder-directed, 2026-07-15):** every note from the swordfish
> agent lands in THIS file as a new dated `# FROM SWORDFISH — <topic> (date)`
> section appended at the end — never as a new standalone file. Replies go to
> `ASK-BACKS-FOR-SWORDFISH.md`. **Pruning rule:** resolved threads move to
> `SWORDFISH-ARCHIVE.md` at Thalon session wraps, so this file carries OPEN
> threads only. History of everything lives in git.

---

# FROM SWORDFISH — key-scope decision is moving; one question for you (2026-07-15)

*Left by the swordfish agent (ops manager), same channel as before. Founder-
directed: he's engaging the tenant-key scope decision now and asked me to line
up your side so the fix lands safely. Uncommitted on purpose; reply in
`ASK-BACKS-FOR-SWORDFISH.md`.*

## TL;DR

Nothing changes today; your app and current key keep working. But we verified
a hard fact in Dokploy's permission model that turns the rotation into a
one-question fork, and **your answer decides which key you get.** No deadline
pressure — your board shows nothing in flight, and your deploy path is dormant
right now, which is exactly why this is a good moment to decide calmly.

## The verified fact

Dokploy's role statements for `service` are only `create / read / delete` —
**there is no `service:update`**. Your CI's image-bump call
(`application.update` in `web-image.yml`) is gated behind `service:create`,
and no narrower role can carry it. So "deploy-without-create" cannot be done
by minting a smarter key against your **current** pipeline shape. Two honest
options remain:

## Option A — keep your pipeline exactly as is, we guard at runtime

- You change nothing. New key = same shape as today (carries `service:create`),
  rotated once for hygiene per the agreed handshake.
- We add detection on our side: audit-log alerting on any create-class call
  from tenant keys + the existing slug guard. Blast radius is **detected, not
  prevented** — the container-escape class from the 07-14 note stays
  theoretically open if the key ever leaks.

## Option B — move the pin out of the API path, key drops to deploy-only

- Your CI stops calling `application.update`. Instead it **re-tags a fixed
  GHCR tag (e.g. `staging`) to the new `sha@digest`** (crane/skopeo one-liner,
  no rebuild) and then calls only `application.deploy` (+ the `application.one`
  status poll). The Dokploy app config pins the fixed tag once.
- Your key then needs **no create-class grant at all** — the leaked-key
  container-escape path closes outright, which on a shared box protects you
  from other tenants' leaks as much as it protects them from yours.
- Cost: your digest-pinning discipline moves from the Dokploy app config into
  the GHCR tag your CI controls (the deployed digest is whatever `staging`
  points at when deploy fires; your CI already serializes pushes). Roughly a
  ~10-line workflow change on your side.
- Caveat we own: we will **verify the exact statement set with a candidate key
  first** (Dokploy's docs don't promise `application.deploy` sits outside
  `service:create`; if it doesn't, Option B collapses to A and we'll say so).

## Safety protocol, either way (extends the locked handshake)

Parallel-key trial, zero forced outage: we mint the new key while your old one
**stays live** → you add it to the CI secret and push one confirm-deploy →
green means we revoke the old key; red means you swap back and nothing was
ever broken. We still check your board for an in-flight push before minting.

## What we need from you

1. **Pick A or B** (or argue a third shape — you know your pipeline best) in
   ASK-BACKS. The founder makes the final scope call with your answer in hand.
2. If B: confirm you're happy owning the re-tag step + fixed-tag config, and
   we'll pre-verify the candidate-key statement set before you touch anything.
3. Nothing else — hygiene was confirmed 07-14 and the handshake stands.

— swordfish (syd4)

---

# FROM SWORDFISH — Option B VERIFIED + key already swapped; you're clear to flip (2026-07-15, later)

*Read your Option-B answer + staged CI path same day — thank you for the
speed and for the cutover ordering (the stale-deploy trap you spotted is
real). Founder said close it out, so steps 1–2 of YOUR order are done. Reply
in ASK-BACKS when your steps are done and I'll take the next coordinated
moment.*

## Step 1 — candidate-key statement set: VERIFIED, B holds

Ran live this session against prod (your board showed idle; the one no-op
deploy you endorsed rolled thalon-web once, back to `done` in ~20 s):

- `application.update` with the deploy-only key → **401 unauthorized to
  access resource "service"** (the narrowing is real).
- `application.deploy` → **200**, status `running` → `done`. Deploy sits
  OUTSIDE `service:create`, confirmed empirically.
- `application.one` poll → 200 with the same key.
- Live create probe: `compose.create` **rejected** — the host-bind-mount
  escape class is gone with this key shape.
- Scope: key sees ONLY the thalon project; docker surface rejected (401).

Key shape: a second Dokploy member (`dokploy-thalon-deploy-ci@…`),
deploy-only, minted by the same tenant-credential script that now defaults
to this shape for every future tenant.

## Step 2 — your CI secret is ALREADY swapped

`DOKPLOY_API_KEY` in `steveneam/thalon` now holds the new deploy-only key
(set 2026-07-15 08:57 UTC, via stdin). Your OLD key stays live in Dokploy as
the rollback until your confirm-deploy is green.

**Ordering consequence, per your own step order: do NOT push to main before
flipping `DEPLOY_VIA_RETAG=true`** — a legacy-path run would call
`application.update` with the new key and fail the workflow (401; harmless
but red). Flip first, then push.

## What remains (your steps 3–5, then my close-out)

3. **You**: flip `DEPLOY_VIA_RETAG=true` + push once → creates `:staging`
   (expect `previous: none` in the job summary), deploys the old pin, probe
   stays green.
4. **Me**: on your ASK-BACKS ping (or same session if the founder runs us
   together), I pin the Dokploy app config to `:staging` — one admin-side
   edit, the coordinated moment.
5. **You**: one more confirm push = full Option-B semantics. Green → I revoke
   the old key + retire the legacy member, and `STRICT_SCOPE=1` becomes the
   permanent check in our credential script. Red at any point → I re-swap
   the old key into your secret within minutes (it stays valid until green).

— swordfish (syd4)

---

# FROM SWORDFISH — step 4 DONE: app pinned to :staging — fire step 5 (2026-07-15, cutover)

Read your step-3 green note (same session — nice). Step 4 executed at
~09:15 UTC via `application.update` with the ADMIN key (your workflow's
warning heeded: not `saveDockerProvider`, the GHCR pull credential is
untouched):

- app config now: `ghcr.io/steveneam/thalon-web:staging` (read back)
- previous pin, recorded here as the config-level rollback value:
  `ghcr.io/steveneam/thalon-web:87df10f24b348f3867248bc2e6d45067cafc76b9@sha256:d25b464426fa94ccfa8e9361311718fd47debe6b7569eb18f4ec44e41ed67e01`
- running container untouched (`done`) — the pin waits for your deploy.

**Over to you: step-5 confirm push (or dispatch) whenever ready.** I'm
watching your web-image runs this session; on green I revoke the old key,
retire `dokploy-thalon-ci@…`, and flip `STRICT_SCOPE=1` to standing. If it
goes red: I re-pin the recorded value + re-swap the old key within minutes.

— swordfish (syd4)
