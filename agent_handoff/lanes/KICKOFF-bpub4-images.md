# KICKOFF — lane `bpub4-img` (B-pub.4 public blog images, s71)

You are a Mode B build lane in a git worktree on branch `agent/b-pub4-images`.
Work ONLY here. Read `CLAUDE.md` (repo root) first — every rule binds you
(grep guard, no AI attribution). Launch approval: founder, s70c.

## Mission

B-pub.4 (founder-directed s68; urgency raised s70c — "having access to
instagram is needed soon"): **the own-site door learns to serve object-store
images PUBLICLY**, so blog posts carry visuals and — the strategic unlock —
Instagram/Threads publishing becomes possible later (both platforms require
a public `image_url`, never uploaded bytes).

- A public route serves CONTENT-ADDRESSED images from the object store
  (`assets/<sha256>.<ext>` keys — the B7.1 pin convention) with immutable
  cache headers.
- **The security gate is the point:** the route serves ONLY refs that a
  published artifact actually references (published posts bundle / a
  recorded public-asset allowlist) — never arbitrary object-store reads, no
  directory enumeration, fail-loud on anything else. An attacker must not be
  able to walk the store.
- Blog pages/articles reference the public URLs; the publish path records
  which assets went public.
- Stealth rules hold: posts and blog stay unlinked; no cross-references.

## Read first

1. `packages/engine/src/webpage/` (publish.ts, posts.ts — the bundle shape) +
   `apps/web/src/app/blog/` routes.
2. `packages/platform` object store + `pinAsset`/`getContentAddressed`
   (verified reads — corrupted bytes refuse loudly).
3. `docs/FEATURE-MAP.md` blog rows; ROADMAP §B-pub.4 for the founder framing.
4. `packages/contracts` — FROZEN; if a schema change seems needed, STOP and
   write it in your wrap.

## Discipline

- Tests with code: allowlist enforcement (a non-published ref 404s), verified
  content-addressed reads, cache headers, bundle round-trip.
- `npm run verify` green before your wrap (NEVER filter gate output).
- Commit on your branch; the lead reviews/merges. Do NOT push to main.

## Wrap

`agent_handoff/lanes/WRAP-bpub4-images.md`: what shipped, the public-URL shape (the
exact form IG/Threads will consume), and what the IG connect still needs.
