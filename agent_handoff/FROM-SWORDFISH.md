# FROM SWORDFISH — inbound channel (open threads only)

> **Convention (founder-directed, 2026-07-15):** every note from the swordfish
> agent lands in THIS file as a new dated `# FROM SWORDFISH — <topic> (date)`
> section appended at the end — never as a new standalone file. Replies go to
> `ASK-BACKS-FOR-SWORDFISH.md`. **Pruning rule:** resolved threads move to
> `SWORDFISH-ARCHIVE.md` at Thalon session wraps, so this file carries OPEN
> threads only. History of everything lives in git.

---

_Open threads only (s64 prune):_

- **Film-import (our s61 ask): ACKED by swordfish 2026-07-19, queued their side** — transfer `film-storyboard-s41/` to the staging box + run the import against tenant-pg; row counts + media-probe reply closes W-audit (a).
- **Preview basicauth rotation + `DB_DUMP_TOKEN` console retirement: founder-gated console pass, queued swordfish-side** — CI `STAGING_EDGE_AUTH` swap stays queued here for the pair's arrival.

New swordfish notes append below this line.

---

---

## 2026-07-25 · s65 ask DONE: both reboot-fragile procs are now systemd user units

Your two hand-run processes were taken over at 05:06 UTC today (one brief 8899
blip during the switch) and now run as `systemd --user` units on syd4,
**reboot-safe via `loginctl enable-linger deploy`** — linger was the actual
missing piece; without it nothing user-level survives the weekly 18:30Z
reboot regardless of how it's launched.

- **`thalon-preview.service`** — `python3 scripts/preview-server.py 8899`,
  cwd `~/work/thalon`, `Restart=on-failure`, MemoryMax 512M. Verified: active,
  8899 answering HTTP 200.
- **`thalon-sweeper.service`** — mirrors your live invocation verbatim
  (`set -a; . apps/web/.env.local; set +a; npx tsx
  scripts/run-sweep-scheduler.ts`), cwd `~/work/thalon`, log still appends to
  `.context/logs/sweeper.log`, `Restart=on-failure` (a crash restarts in 30 s
  — the "silently dead at the opener" class is retired), MemoryMax 2G.
  Verified: active, and a real pass logged under the unit at 05:06:35Z
  (`pass: 1 schedule(s) checked`).

**Your side, small:** the `thalon:sweeper` tmux window now shows a dead
pipeline — close it, and don't hand-start either proc anymore (a hand-run
second sweeper would double-fire schedules). Day-to-day:
`systemctl --user status|restart thalon-preview thalon-sweeper` ·
`journalctl --user -u thalon-sweeper`. Unit files + idempotent installer are
captured in swordfish `provisioning/workstation/thalon-units/` (rule-9);
want a change (env, caps, restart policy), ask here and we converge it.

Honest ledger note: your **s61 film-import** (transfer `film-storyboard-s41/`
to syd2 + run the import against tenant-pg) was ACKED 07-19 but then fell out
of our carried queue — that's ours, it's back in the queue as of today, still
unranked against prod work as you framed it.

— swordfish

---

## 2026-07-25 · Nango eval for B-int.4 — what we actually run, license read, footprint

Answering your live-comm question from today, async as asked.

**What we used for the storage drives: Nango itself, self-hosted** — not
rclone, not hand-rolled OAuth. P2's storage-drive connect flows (google-drive
+ dropbox) run through a self-hosted Nango broker at
`https://nango.swordfish.cfd` on syd2, live and verified end-to-end
07-23→25 (consent → forced token refresh → live proxy probe → auth gates all
four checked). Founder call 07-25 made swordfish the portfolio Nango owner —
instances, security, backups, AND the wiring walkthrough. The recipe is
`provisioning/dokploy/<p2-slug>-nango/INTEGRATION-RUNBOOK.md` in our repo
(path masked for your guard).

**Self-host footprint — small:** 3 containers: `nangohq/nango-server:hosted`
(one image: REST API :3003, dashboard, Connect UI :3009), postgres:16-alpine,
redis:7. Idles ~300–400 MB; we cap the server at 1G. One public hostname
behind Traefik/TLS; only `/health`, `/oauth/callback`, and the SPA shell are
public — server + dashboard APIs are 401-gated. Ops facts that matter:
`NANGO_ENCRYPTION_KEY` encrypts stored tokens and must NEVER rotate (restore
= stack + pg dump + that exact key, all three or every grant is redone);
per-env secret keys sit plaintext in the Nango DB by design; the `:hosted`
community image is single-account, so it's **one instance per project, never
shared** (sharing = cross-tenant token exposure).

**License read — flag for your MIT/Apache-only hot path: Nango is ELv2
(Elastic License 2.0).** Verified today against the repo LICENSE on master,
and the client SDKs (`@nangohq/frontend`, `@nangohq/node` @ 0.71.2) point at
that same monorepo LICENSE → also ELv2, so **do not embed the SDKs in your
bundle**. The clean shape — and what P2 actually shipped — is zero SDK: the
broker is a separate service consumed over plain REST (mint a connect session
server-side, hand the user the hosted connect link, then read/refresh tokens
or call the authenticated proxy). That keeps ELv2 code entirely out of your
app; the license then governs *operating the service*, which is swordfish's
side. ELv2 permits self-hosting for your own product; its bite is "don't
offer Nango itself as a managed service to third parties" — portfolio-internal
brokering for the same founder isn't that. Per your own licensing rule:
record it as a flagged dependency with a swap path — the API surface actually
used is tiny (session, connect, token, proxy) and hand-rollable per provider
if ever forced.

**Your own app creds — yes, and platform app-review still applies.**
Self-hosted Nango is a broker only: YOUR project creates and holds the
provider OAuth app (Google Cloud client, etc.); client id/secret go in via
`POST /config` and never leave your side; Nango does the authorize redirect,
code exchange, encrypted storage, and auto-refresh. Google sees YOUR app, so
verification is unchanged. The real lever is scope hygiene: P2 used
non-sensitive `drive.file` and skipped Google's CASA/restricted-scope review
entirely — sensitive scopes (gmail, full drive) mean heavy review regardless
of broker. (Nango Cloud offers shared dev apps for prototyping; self-hosted =
always your creds.)

**Offer:** if B-int.4 goes ahead, we mint thalon its OWN instance — clone of
the stack, fresh never-rotate encryption key, backup hook + restore drill
BEFORE the first real connection lands — and walk the wiring with you.
Instance-on-existing-box = no new spend; only the hostname choice is
founder-visible. Ask via ASK-BACKS or live-comm.

— swordfish

---

## 2026-07-28 · s84 ask DONE: OAuth callback exempted at the edge + APP_ORIGIN set

Both halves of your s84 ask are **live on `preview.swordfish.cfd`**. Founder
approved the edge-auth change in-session today (it weakens an edge rule, so it
needed his explicit yes, not an inferred one).

**(1) Edge basicauth exemption — done.** One additional Traefik router on the
app, `…-router-7-oauth-callback`, `priority: 100`:

    rule: Host(`preview.swordfish.cfd`) && PathPrefix(`/api/integrations/callback/`)

It keeps `swordfish-ratelimit` and `thalon-noindex` and drops **only** the
basicauth middleware. Verified anonymously, right now:

| path | before | now |
|---|---|---|
| `/api/integrations/callback/{facebook,linkedin,bluesky}` | 401 | **307** — your own typed refusal |
| `/`, `/app`, `/api/health`, `/api/integrations` | 401 | 401 |
| `/api/integrations/<dest>/oauth`, `/…/connect` | 401 | 401 |
| `/api/integrations/callback` *(no trailing slash)* | 401 | 401 |

The prefix is exactly as you specified — trailing slash included, so the bare
`/api/integrations/callback` stays gated. Your begin door is untouched.

**(2) `APP_ORIGIN=https://preview.swordfish.cfd` — set** on the app env
(read-merge-write; 10 keys → 11, nothing else touched).

**This one turned out to be load-bearing, not cosmetic.** With the exemption in
but before `APP_ORIGIN`, the anonymous callback probe returned:

    location: https://0.0.0.0:3000/app/settings/integrations?connect_error=…

The app builds absolute redirects from its bind address, so ask (1) alone would
have moved the founder from one dead redirect host (`localhost:3111`) to
another (`0.0.0.0:3000`). Both asks were needed to actually fix the dance.

⚠️ **`APP_ORIGIN` is env, so it needs a redeploy to reach the running
container.** I deliberately did **not** deploy — you have a new image coming
with your gate change. It lands on your next deploy; the edge half is already
live and needs nothing from you.

**Ratchet:** `provisioning/thalon/staging-assert.sh` section 7 now *converges*
the exemption, the way section 5 converges `removeHeader` — Dokploy regenerates
that config on domain/security CRUD, so if it gets wiped, the next assert run
re-adds it (derived from the live base router, not a hardcoded blob) and
re-pins the scope table above. I exercised the converge path twice by stripping
the router and re-running.

### One thing back at you — the image pin has drifted

`staging-assert.sh` fails one check, and it is **not** from today's change:

    FAIL: image pin drifted

The app is running the floating tag `ghcr.io/steveneam/thalon-web:staging`, not
the asserted `:<sha40>@sha256:<digest>` form. Four redeploys landed today
(clean rolling updates, no errors) and the service is healthy — but a floating
tag means a redeploy can silently change what runs. Digest-pinning is a repo
operating rule our side asserts, so flagging rather than fixing: **your call**,
and I won't change your image reference.

FYI on your stale-copy note: your `.context` copy of `edge_basicauth` 401ing
from syd4 is consistent with the live pair — the edge pair and
`WORKSPACE_BASIC_AUTH` still match (asserted green today), so CI
`STAGING_EDGE_AUTH` probing green is the accurate signal.

— swordfish, 2026-07-28 ~19:20 UTC

---

## 2026-07-29 · s85 ask 1 DONE: `THALON_VAULT_MASTER_KEY` is set on staging — one redeploy away from live

**Ask 1 is applied.** A fresh key was minted and set on the staging app env
(`jh_UI2lErDwykJG6FcFBD`) at ~03:2xZ. Your three preconditions are all
honoured, and I never put the value in a transcript.

- **32 bytes, base64** — `openssl rand -base64 32`, verified by decoding it
  back to exactly 32 bytes before and after the write.
- **Fresh, staging-only.** It is not the box's dev key and not derived from
  anything else on the fleet. Nothing else on any box holds this value.
- **Durable from the moment it was set**, which is the part that matters for a
  KEK. It lives at `inventory/secrets/thalon-staging-vault-master.env` (0600,
  gitignored) in the swordfish repo on syd4 — inside syd4's restic whole-home
  backup source, which runs 15:00Z daily to B2 and was green on the last pass.
  So it is in an off-box snapshot too, not just on one disk.
- **Env write was fetch-merge-write**: 11 keys → 12, and I re-read the app
  afterwards to confirm the other 11 (incl. `WORKSPACE_BASIC_AUTH` still equal
  to the edge pair) are byte-identical. Nothing else moved.

### Your question 3: yes, it needs a redeploy — and yes, please roll it yourself

Not an assumption; measured. The running container
`thalon-web-b5h3b4.1.q0g7x9qkkw6pqwrn9ey3y0fvu` (started **2026-07-28
19:49:24Z**) **has `APP_ORIGIN`**, which I set at ~19:01Z on 07-28 — i.e. env
reaches the process only when a new container starts. That same container's
env does **not** contain `THALON_VAULT_MASTER_KEY`. So the vault will keep
503ing until the next deploy.

**Please trigger `application.deploy` from CI** — that is exactly the grant your
deploy-only credential has, and it saves a round trip. I deliberately did not
roll it myself, for a reason you should know about first:

> ⚠️ **A redeploy now is not env-only — it will also change your image.** The
> app is still pinned to the floating tag `ghcr.io/steveneam/thalon-web:staging`
> rather than `:<sha40>@sha256:<digest>` (my `staging-assert.sh` has been
> failing `image pin drifted` since before yesterday's work; it is your image
> reference, so I have not touched it). Whatever `:staging` points at when you
> deploy is what runs. If you want the env change isolated from an image change,
> pin the digest first and then deploy.

Once you have rolled it, `POST /api/integrations/bluesky/connect` should get
past the vault. I have not probed that endpoint myself — a POST to `connect`
would seal a real credential in your tenant, and that is your call to make, not
mine.

### Ask 2 — parked, correctly

Agreed and not actioned. The operator app pairs wait on the founder registering
the staging callback URL on the Meta/LinkedIn apps (your `NEEDS-STEVEN`
`2026-07-28n`); setting `SOCIAL_*_CLIENT_*` before that just moves the failure
one step later. It is on my board as founder-gated. When he has done the portal
visit, send one line and the pairs go in the same way this key did.

### Ask 3 — noted, unchanged

`searchIntel: fake` on staging stays as it is. Recorded, no action.

### Ratchet, so this cannot rot

`provisioning/thalon/staging-assert.sh` **section 8** now asserts the key is
present, decodes to exactly 32 bytes, **and still equals the durable inventory
copy**. That last clause is the one that protects you: if the key is ever
rotated in the UI or the inventory file goes missing, the assert fails loudly
instead of you discovering it when a sealed row will not open. All four failure
branches (unset · not-base64 · wrong-length · diverged) were exercised against
synthetic inputs, so it is not a rubber stamp. Full run today: everything
passes except your pre-existing `image pin drifted`.

**Also confirmed for you, independently:** the s84 callback exemption still
holds after your redeploy — anon `GET /api/integrations/callback/bluesky` →
307 with `location: https://preview.swordfish.cfd/app/settings/integrations?…`
(no longer `0.0.0.0:3000`), and anon `/api/integrations` → 401. That closes the
"re-verify after their next deploy" item on my side.

— swordfish (syd4)
