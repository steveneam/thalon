# KICKOFF — lane `ig-post` (Instagram media publishing)

**Founder GO on record, s85, by name** ("ig-post + staging-dogfood"). Launch is
Mode B in the `thalon` tmux session. You own `agent/ig-post`, worktree
`.claude/worktrees/ig-post`, branched from `24a2b42`.

**Ships DISARMED.** Nothing you build may post to a live platform. The sequence
gate is untouched: Bluesky alone has a standing test grant; Instagram posting
needs the founder's per-platform GO, which he has NOT given. Your proof is
tests + a dry-run path, never a live post.

---

## What you are replacing

`packages/engine/src/social/drivers/instagram.ts` is today an honest refusal: a
`SocialPublisher` whose `publish()` always throws
`InstagramTextOnlyUnsupportedError` ("the official content-publish flow requires
image or video media"). That refusal is CORRECT for a text-only draft and must
survive — Instagram genuinely has no text-only feed post. What you add is the
media path: `POST /{ig-user-id}/media` → `POST /{ig-user-id}/media_publish`,
the two-step container flow, behind the same factory seat.

---

## READ THIS FIRST — the lead's pre-flight, and the charter was wrong

The lane board says *"Driver-local; no contract change."* **That is false, and
finding out at hour three would cost you the session.** Three facts, each
ground-truthed in the code before you launched:

1. **Instagram never accepts uploaded bytes.** `/media` takes `image_url` — a
   PUBLIC URL that Meta's own servers fetch anonymously. Every other driver we
   have uploads bytes.

2. **The driver seam hands you bytes and throws the address away.**
   `SocialPostMedia` (`packages/engine/src/social/registry.ts`) is
   `{ bytes, contentType, altText }`. The publish door's `loadDraftMedia`
   (`packages/engine/src/social/publish.ts:207`) reads `meta.mediaRefs` — which
   DOES carry `ref` — loads the bytes, and drops the ref. **You cannot build a
   URL from what the driver receives.** Something has to carry the address
   through.

3. **The public door will 404 the image at exactly the moment you need it.**
   `/assets/<sha256>.<ext>` (`apps/web/src/app/assets/[asset]/route.ts`) is
   allowlist-gated by `packages/engine/src/webpage/public-assets.ts`, and the
   allowlist admits **only refs a CURRENTLY-PUBLISHED artifact references**. At
   publish time the IG post does not exist yet, so its image is not admitted →
   `not_public` → 404 → Meta's fetch fails → the post fails. **Chicken and egg.**
   Worse, the two stores differ: `mediaRefs` are `social-media/<sha256>.<ext>`
   loaded via `getContentAddressed`, while the public door reads the PIN store
   `assets/<hash>/asset.<ext>` via `readPinnedAsset`. An image being social-posted
   is not necessarily pinned at all.

**So the real shape of this lane is:** make a to-be-published image reachable at
a public URL, revocably, without weakening the gate — then thread its address to
the driver — then make the two Graph calls.

### The one thing you must REPORT BEFORE BUILDING

Point 3 is a **security-gate design decision**, not a detail. The allowlist is
the thing standing between the public internet and arbitrary object-store reads;
its whole stated value is "an attacker can fetch exactly the images the blog
already shows, nothing else."

Write up your proposed admission mechanism — how an image becomes public for a
publish that has not happened yet, and how it is revoked if the publish fails —
and **put it in your wrap file and tell the lead before you implement it.** Do
not widen the allowlist to "any social-media ref" and carry on. Options worth
weighing (not an exhaustive list, and not a decision handed to you): a
publish-scoped pending admission written before the Graph call and rolled back on
failure; admitting on the queue row rather than the published artifact; or
pinning + admitting at APPROVE time so the address exists before publish is ever
attempted. Say which you chose and what it costs.

**If your answer requires a `packages/contracts` or drizzle-schema change, STOP
and report** — the contract is frozen per sprint, and a lane editing it
mid-flight is a re-plan, not an ad-hoc edit (AGENTS.md). Changes confined to
`packages/engine` internals are yours.

---

## Scope (your files)

- `packages/engine/src/social/drivers/instagram.ts` + its tests — the driver.
- `packages/engine/src/social/registry.ts` — the `SocialPostMedia` seam, IF
  that is how you carry the address. Additive only.
- `packages/engine/src/social/publish.ts` — `loadDraftMedia` threading.
- `packages/engine/src/webpage/public-assets.ts` + tests — the admission
  mechanism, AFTER you have reported it.
- Platform env extras for any new IG config seat, declared in the schema.

**Do NOT touch:** `apps/web` surfaces, the Analytics/Schedule/Composer/Channels
sheets (unverdicted proposals), `packages/contracts`, or the other lane's files
(`staging-dogfood` owns env/ops + seeding + `agent_handoff/`).

## How to work

- **Zero live calls.** No token of the founder's may reach Meta. Tests inject
  fakes; the Graph calls are exercised against a fake fetch, never the network.
- The existing typed-refusal behaviour must still hold for a text-only draft,
  pinned by a test that fails if you delete it.
- A driver that cannot attach media must throw rather than silently post the
  text alone — `loadDraftMedia`'s comment states the invariant ("never a silent
  text-only post"); the same honesty applies to yours.
- `mediaRefsSchema` is `image/*` and `.max(1)`. Video is out of scope; if you
  want it, say so in the wrap rather than lifting the ceiling quietly.
- Gate on `npx vitest run --maxWorkers=2` (two lanes are live on a 16 GiB box —
  three full suites OOM it, measured s82). **Never `pkill -f vitest`**: it
  matches every worktree and kills the other lane's suite.
- `vitest` does NOT typecheck — run the workspace typecheck before you call it
  done.
- Never `npm install` in a worktree (the preinstall guard exists for this).

## When you finish

Write `agent_handoff/lanes/WRAP-ig-post.md`: what shipped, the admission
mechanism you chose and why, what you refused to do, anything you found that is
not yours. Then tell the lead. **The lead rebases, reviews and merges** — do not
merge to `main` yourself, and do not open a PR.
