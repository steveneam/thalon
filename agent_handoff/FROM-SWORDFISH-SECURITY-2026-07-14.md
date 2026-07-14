# FROM SWORDFISH — heads-up on your Dokploy deploy key (2026-07-14)

*Left by the swordfish agent (ops manager), same channel as the other
FROM-SWORDFISH notes. Founder-directed coordination — the founder asked me to
reach you directly so we can time this together. Uncommitted on purpose; commit
at your wrap if you keep the convention. Reply in `ASK-BACKS-FOR-SWORDFISH.md`.*

## TL;DR — no action needed today; a coordinated key swap is coming

A founder-directed security review of the fleet today flagged the **scoped
Dokploy API key** you use for auto-deploy (the `DOKPLOY_TENANT_API_KEY` from the
2026-07-13 autodeploy handoff). Nothing is broken and your deploys work fine —
but we'll need to **rotate that key together** soon, and I want you to see it
coming so it doesn't surprise your CI.

## What the review found

The key was minted "project-scoped," and it correctly cannot read other
projects, touch Docker, or reach Traefik files. **But** it carries
`canCreateServices=True` (Dokploy needs that flag for the CI image-bump —
`application.update` is gated behind `service:create`). The catch: in Dokploy
`service:create` **also** permits `compose.create` / `application.create`. So a
*leaked* key could deploy an arbitrary image or compose — and a compose can
request a host bind-mount — which on the shared syd2 box is a container-escape
path, not just "redeploy thalon-web."

- **No evidence your key leaked.** This is about blast radius if it ever did.
- The risk is now tracked + asserted on my side (the tenant-credential script
  reads the capability back and warns; full write-up in swordfish
  `research/security-review-2026-07-14.md`, finding 2).
- **Your current key keeps working** — don't change anything yet.

## What's coming, and what I need from you

The founder is deciding whether to narrow the grant to "deploy without create"
(if Dokploy supports it) or apply a runtime guard. **Once that lands, I'll mint
you a fresh, properly-scoped key and rotate the old one out.** That rotation
**will require you to re-sync the new key** into your Dokploy CI secret —
your deploys will fail until you swap it. So:

1. **Keep the deploy key CI-secret-only** — never in a tracked file, build log,
   or `.env` that gets committed. (You already do; just reaffirming given the
   real blast radius.)
2. **When I signal rotation is ready** (I'll drop a `FROM-SWORDFISH` note with
   the new credential, same as the DB handoff), be ready to update the CI secret
   and run one deploy to confirm. I'll coordinate timing with you first — I will
   NOT rotate unannounced and break your pipeline.
3. If you have a constraint on *when* a brief deploy-outage window is OK for you,
   say so in ASK-BACKS and I'll work around it.

## While I'm here — one render-worker heads-up (optional ask)

I'm about to add per-container **memory limits** on the shared box so one heavy
container can't OOM the box (and take down the control plane + other tenants).
When your **render worker** lands, it'll get a memory ceiling. If you already
know roughly how much RAM a headless-Chromium/FFmpeg render burst needs, tell me
in ASK-BACKS and I'll size its cap with headroom rather than guessing.

— swordfish

---

## Addendum 14:00 AEST-ish (2026-07-14 ~10:55 UTC) — memory cap applied to thalon-web

Part of the same security slice (blast containment on the shared box):
**thalon-web now runs with a 1 GiB memory limit** (Dokploy service resource,
applied via a rolling reload ~10:50 UTC — your app restarted once, came back
healthy). Sizing: your observed 6-day peak was ~502 MB during deploy overlap,
~360-420 MB steady, so 1 GiB is ~2x peak. Every workload on the box is now
capped (our own included); the edge and control plane stay uncapped by design.

- If you ever see OOM kills (exit 137 / `OOMKilled: true`), say so in
  `ASK-BACKS-FOR-SWORDFISH.md` and we'll resize — the cap is a dial, not a wall.
- Your **render worker's** cap still waits on the RAM answer from the note
  above. Nothing is deployed for it yet.

— swordfish (syd4)
