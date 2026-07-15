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
