# WRAP — lane `bpub4-img` (B-pub.4 public blog images, s71)

Branch `agent/b-pub4-images`, one commit, full `npm run verify` green
(unfiltered), grep guard clean. Contracts UNTOUCHED — the allowlist schema
lives engine-side (the posts-bundle precedent), so no contract-window ask.

## What shipped

**The own-site door now serves object-store images publicly, gated.**

- **Engine `packages/engine/src/webpage/public-assets.ts`** (new): the
  public-asset allowlist — one mutable pointer per tenant at
  `public-assets/<tenantId>.json` (version 1, schema-validated, derived
  state, orphan-sweep-protected). Per-post rows `{draftId, slug, assets:
  [{contentHash, ext}]}` so admission is REVOCABLE: a republish upserts its
  draft's row wholesale; an asset stays public only while a
  currently-published artifact references it.
- **The gate is the point:** `readPublicAssetBytes` checks membership
  BEFORE any asset read (unlisted names never probe the store), the name
  grammar is strict (`<64 lowercase hex>.<ext in a CLOSED content-type
  map>` — svg and document types are never served; svg is script-capable
  same-origin), nothing ever lists (no enumeration), and the read is the
  B4.6 verified read — tampered bytes throw, never served.
- **Publish door records what went public:** `publishWebPageToSite` scans
  the deployed artifact for `/assets/<hash>.<ext>` refs
  (`extractPublicAssetRefs` — recall-first scan across img src, srcset,
  CSS url(); unknown exts dropped) and writes the allowlist BEFORE the
  posts bundle, so a live page never renders gated images.
  `rebuildPostsBundle` re-derives BOTH pointers — one disaster command.
- **Web route `apps/web/src/app/assets/[asset]/route.ts`** (new): public
  GET, engine-gated, `cache-control: public, max-age=31536000, immutable`
  (content-addressed → the URL can never serve different bytes),
  `x-content-type-options: nosniff`, honest statuses: 404 malformed or
  unlisted · 503 allowlisted-but-missing (integrity break, never a quiet
  404) · loud 500 on content-address mismatch.
- **Auth gate:** `/assets/` added to the app-level public allowlist
  (`lib/auth/gate.ts`) — the route's own allowlist is the stronger gate;
  IG/Threads and blog readers fetch anonymously.
- Ratchets beside the code: `pinnedAssetKey` exported from B7.1 pin (one
  key composition), object-keys family registry + eval sweep
  `PROTECTED_PREFIXES` gained `public-assets/` (with test pin), FEATURE-MAP
  row added. Blog pages need NO render change: artifact markup carries the
  relative URLs (self-containment already permits them) and flows through
  the existing verified-body render.

**Tests (all green, in the same change):** 14 engine (wire-shape pins ·
strict grammar incl. traversal/svg/uppercase refusals · admission scan ·
record/revoke round-trip · pinned-but-unpublished refused · verified read
refuses tampered bytes · no cross-admission), 3 publish-door (publish
records exactly the artifact's refs · rebuild heals both pointers · key
pin), 5 route (end-to-end against the real engine gate via
`THALON_DATA_DIR`), 1 gate + 1 sweep-protection pin.

## The public-URL shape (what IG/Threads will consume)

```
/assets/<sha256-of-bytes>.<ext>            site-relative (in artifact markup)
https://<public-origin>/assets/<sha256>.<ext>   absolute (what the IG container API gets)
```

Served exts: png · jpg · jpeg · webp · gif · avif · mp4 · webm.
`publicAssetPath({contentHash, ext})` composes it; prefix the deployment
origin (lib/site.ts `SITE_URL`) for the absolute form.

## What the IG connect still needs

1. **A publicly reachable origin.** The app-level gate now passes
   `/assets/` — but staging sits behind the box's EDGE auth (stealth), which
   stacks on top and would block Meta's fetchers. IG needs the real domain
   cut (thalon.org is deliberately unwired) or an edge exception for
   `/assets/` — founder call, stealth-sensitive.
2. **An admission path for social-post images.** Today only published BLOG
   artifacts admit assets. An IG post's image must go public too:
   the social publish door calls the same `recordPublicAssets` with its own
   row (additive; consider a source-kind field on the row then).
3. **The driver.** IG is a typed refusal by design (B-pub.2). The real
   driver is the Graph API two-step (media container with `image_url` →
   publish) and rides B-int's vault creds — the blocker remains platform
   posting-scope app review (the s70 Nango answer), not plumbing.
4. **Generation-side images.** The door serves the moment artifacts carry
   `/assets/...` refs; the fan-out doesn't yet emit them. Wiring pinned
   assets into web_page generation is its own (small) bucket.

Stealth holds: posts and blog stay unlinked; no cross-references added.
