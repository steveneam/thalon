# WRAP — lane `ig-post` (Instagram media publishing)

**Status: the driver and the address seam are BUILT and green. The admission
mechanism is DESIGNED and REPORTED, not implemented — that is the checkpoint
the kickoff demanded, and I stopped at it deliberately.**

Ships stayed disarmed. No token reached Meta, no live post was attempted, and
the arming ratchet in `registry.ts` is untouched. Every Graph call in this lane
was answered by an injected fake.

---

## 1. What shipped

### `packages/engine/src/social/drivers/instagram.ts` — the driver

The blanket refusal is gone; the two-step official flow replaces it behind the
same factory seat:

```
POST /{ig-user-id}/media          image_url + caption [+ alt_text] → container id
POST /{ig-user-id}/media_publish  creation_id                      → media id
```

- `name` changed `instagram-text-refusal` → **`instagram-media-publish`**.
- Calls through `hardenedPlatformFetch` (the D1 convention for every NEW
  driver): 429 → Retry-After honoured, 401 → `SocialTokenExpiredError`,
  anything else → `SocialDriverApiError` with the platform's own words.
- Token in the `Authorization` header only — never a query/body
  `access_token`. Pinned by a test that greps the URL and body for the token.
- `INSTAGRAM_GRAPH_VERSION = "v23.0"`, pinned separately from
  `FACEBOOK_GRAPH_VERSION` so the two drivers bump independently.
- **No permalink is invented** (ADR 0002) — IG only returns one from a
  separate GET on the media node. `meta` carries `igUserId`, `creationId`,
  `apiVersion`.
- A step-2 failure leaves an unpublished container, which Meta expires on its
  own (~24h). The error names the container id for triage; no cleanup call is
  invented.

**Two refusals, by cause — both before any network call:**

| Case | Error | `refusal` |
|---|---|---|
| text-only draft | `InstagramTextOnlyUnsupportedError` (kept) | `platform_requires_media` |
| image present, no public URL | `InstagramPublicMediaUrlRequiredError` (new) | `public_media_url_unavailable` |

The first survives because the platform constraint survives — it was never a
placeholder. It is pinned by a test whose comment says out loud that deleting
it is how a future change quietly starts posting captions with no picture.
The second exists because posting the caption alone would publish a different
post than the operator approved — the same invariant `loadDraftMedia` already
states for a missing artifact.

Format constraints are **not** re-litigated in the driver: the frozen
capability matrix already carries `instagram.media = {required: true,
imageContentTypes: ["image/jpeg"]}`, so `capability.ts` refuses a PNG or a
text-only draft one rung earlier, before a call is spent.

### `packages/engine/src/social/registry.ts` — the seam (additive)

- `SocialPostMedia.publicUrl?: string` — the address, present only when the
  door admitted one.
- `SocialPublisher.needsPublicMediaUrl?: boolean` — **the opt-in that makes
  the door widen its gate at all.** Silence means "uploads bytes", so no image
  is ever made public for a driver that never needed an address. This is the
  single most important line in the lane: it is what keeps the widening scoped
  to Instagram instead of to publishing in general.

### `packages/engine/src/social/publish.ts` — the threading

`loadDraftMedia` no longer throws the address away: it returns
`{ref, media}[]`. Drivers still receive bytes only — they never touch the
object store — but the door now holds the ref it needs.

New optional dep, un-defaulted exactly like `resolvePublisher`:

```ts
admitPublicMedia?(request: AdmitPublicMediaRequest): Promise<PublicMediaAdmission | null>
```

Called **only** when the resolved publisher declared `needsPublicMediaUrl`,
**only** for the refs this draft carries, and revoked in a `finally` the
instant the platform call returns — success or failure. Revoke errors are
swallowed on purpose: they must never replace the publish's own error, and the
mechanism's expiry (below) is the crash backstop, not that call.

**Unwired seam → no address → honest refusal.** Nothing is public by default.

### Tests

- `__tests__/drivers.test.ts` — 8 IG cases: both refusals, the exact two-step
  wire shape (endpoint, version, `image_url`, verbatim caption, `alt_text`
  present/absent), header-only auth, container failure short-circuits step 2,
  2xx-without-id on both steps, 401 → refresh signal.
- `__tests__/publish.test.ts` — 5 door cases: admission is scoped to
  draft+platform+ref and revoked on success; **revoked on failure too**; a
  byte-uploading driver never consults the seam at all; an unwired seam and a
  refused (`null`) admission are the same fail-closed answer.

`npx vitest run --maxWorkers=2` on both files: **68 passed**. Workspace
`npm run typecheck`: clean across all seven packages.

---

## 2. THE REPORTED DECISION — how an image becomes public for a publish that has not happened yet

This is the part the kickoff said to report before building, and it is not
built. Everything above is inert without it.

### The problem, restated with the store mismatch nailed down

`mediaRefs` live at `social-media/<sha256>.<ext>`, read via
`getContentAddressed`. The public door serves the **pin** store
`assets/<hash>/asset.<ext>` via `readPinnedAsset`, gated by an allowlist that
admits only refs a **currently-published web_page artifact** references. A
social image is not necessarily pinned at all, and at publish time the IG post
does not exist, so nothing admits it. Chicken and egg, across two stores.

### Chosen: a publish-scoped PENDING admission, TTL-bounded, revoked in the `finally`

Extend the existing per-tenant bundle at `public-assets/<tenantId>.json` with a
second row family beside `posts`:

```ts
pending: z.array(z.object({
  draftId:     z.string().min(1),
  platform:    z.string().min(1),
  family:      z.enum(["social-media"]),   // CLOSED set, not a free prefix
  contentHash: z.string().regex(SHA256_HEX_RE),
  ext:         z.string().regex(/^[a-z0-9]+$/),
  expiresAtMs: z.number(),
})).default([])
```

`.default([])` means existing bundles parse unchanged — no
`PUBLIC_ASSETS_VERSION` bump, no migration.

**Why `family` + `contentHash` and not a stored source key.** The obvious move
is to store the object key the bytes live at. Don't: a row pairing
`contentHash: B` with a key naming hash `A` would serve A's bytes under B's URL
and quietly break the `immutable` cache promise on a content-addressed door.
Storing the family instead and reconstructing the key as
`objectKey(family, contentHash, ext)` makes that class of mistake
unrepresentable — **the hash in the URL is the hash in the key, by
construction**, and `getContentAddressed` still re-hashes and refuses on
mismatch. The family enum keeps it from becoming an arbitrary-prefix read.

**Membership + expiry**, in `readPublicAssetBytes`:

1. published rows first (unchanged) → pin store read;
2. else a pending row matching `contentHash`+`ext`, **and** a clock was
   supplied, **and** `expiresAtMs > nowMs` → read the derived source key;
3. else `not_public`.

The clock arrives as a new optional `{nowMs}` argument (the house rule: the
clock is an argument, never read in core). **No clock supplied → pending rows
are ignored entirely.** That keeps every existing caller byte-identical and
makes enabling the pending path a deliberate act rather than a side effect.

**TTL: 5 minutes.** Long enough for Meta to dereference `image_url` during the
`/media` call; short enough that a process that dies between admit and revoke
leaks one image for minutes, not forever. Each admission write also prunes
already-expired rows, so the bundle self-heals.

**Revocation** is the normal path, not the backstop: the door revokes the
instant `publisher.publish()` returns. Meta fetches the bytes *during* step 1,
so the address is not needed after that response — which is exactly why
revoking this early is safe.

**`rebuildPublicAssets` drops `pending`.** It re-derives from published
artifacts; a rebuild racing a publish then breaks that one publish loudly
(Meta 404s, the driver surfaces the platform error, nothing is recorded).
Rebuild is disaster recovery, not a hot path — fail-closed is the right trade.

**The origin** is `APP_ORIGIN`, already in the platform env schema and already
used by the OAuth dance for the same reason (a real registered address, never
derived from proxy headers). No new env key. `publicAssetPath` already returns
the site-relative form and the module's own doc comment already says "prefix
the deployment's origin to hand it to the platform". No `APP_ORIGIN` → the
seam is never built → honest refusal.

### What it costs — stated plainly

The gate's invariant weakens from *"an attacker can fetch exactly the images
the blog already shows"* to *"…plus, for at most five minutes, the one image of
a post being published right now, for a driver that declared it publishes by
address."*

That widening is bounded by, in order: per-driver opt-in
(`needsPublicMediaUrl`); one draft, one platform, one ref per admission;
immediate revoke; a 5-minute TTL; a hash-verified read; a closed family set;
a closed extension set; and the pre-existing strict name grammar.

It is explicitly **not** "any `social-media` ref is public" — the thing the
kickoff forbade — and it never makes an approved-but-unpublished draft's image
reachable.

### Rejected, with reasons

- **Pin + admit at APPROVE time.** The address would exist before publish is
  attempted, which is genuinely simpler to order. Rejected because admission
  then has no natural end: an approved-never-published draft's image stays
  public indefinitely, which is a bigger hole than the one being closed. It
  also needs `pinAsset` provenance (vendor/model/prompt/credits/licenseTier)
  that a social media ref simply does not carry, and it touches the approve
  door — out of lane.
- **Admit on the queue row.** More viable than the kickoff assumed —
  `repos.publishQueue` exists now (`queue-consumer.ts` calls `listDue`), so
  the "no repository yet" parenthetical is stale. Still rejected: it puts a
  *security* fact in a *scheduling* table and needs a drizzle column, i.e. a
  schema change, i.e. STOP territory.
- **A second public door** (`/social-media/<hash>.<ext>` with its own
  allowlist), leaving B-pub.4's gate literally untouched. Rejected because it
  duplicates the hardened name grammar, the verified read, the
  nosniff/immutable serve and the auth-gate allowlist entry — two doors to
  keep correct instead of one, and the newer one would be the less proven.

### The one line outside my lane this needs

`apps/web/src/app/assets/[asset]/route.ts` must pass `{nowMs: Date.now()}` to
`readPublicAssetBytes` or the pending path can never open. Additive, one
argument, zero behaviour change for published rows. **Not done** — flagging it
rather than reaching into `apps/web` unasked.

---

## 3. What I refused to do

- **Did not widen the allowlist to "any social-media ref."** Named explicitly
  in the kickoff; the design above is the narrow alternative.
- **Did not implement the admission** before reporting it, per the checkpoint.
- **Did not touch `packages/contracts` or any drizzle schema.** Nothing in the
  design needs either.
- **Did not lift the `mediaRefsSchema` `.max(1)` ceiling.** IG carousels
  (`is_carousel_item` + a carousel container) and Reels/video (which *do* need
  `status_code` polling, unlike images) are real follow-ons, but both are
  ceiling lifts and neither is mine to take quietly.
- **Did not make a single live call.** Every fetch is injected.

---

## 4. Found, not mine

1. **`packages/contracts/src/integrations.ts:143` is now stale.** The
   integrations catalog carries `driver: "instagram-text-refusal"` plus a
   comment saying the driver "stays a typed text-only refusal until the public
   assets origin lands". Nothing *resolves* a driver by that string (drivers
   resolve per-platform via `productionSocialDrivers`), so it is display/doc
   only and typecheck is green — but the settings UI will now describe
   Instagram wrongly. Needs a lead-owned one-line edit at a contract window;
   `apps/web/src/components/settings/__tests__/integrations-model.test.ts:211`
   and `integrations.test.tsx:58,367` carry the same string as fixtures and
   would follow.

2. **Staging edge auth will break Meta's fetch, and the app's own gate is not
   the one that matters.** `lib/auth/gate.ts` correctly exempts `/assets/` —
   its comment even anticipates "IG/Threads fetching a public image_url". But
   staging also sits behind the **edge** basic auth (`STAGING_EDGE_AUTH` /
   preview basicauth, swordfish side). Meta fetches `image_url` **anonymously**
   — no credential — so if the edge challenges `/assets/`, every IG publish
   fails at container creation with an unreachable-image error, and the app
   gate never gets a say. **Whoever owns the edge needs a path exemption for
   `/assets/` before IG can work on staging**; this belongs to the
   `staging-dogfood` lane / the founder-gated basicauth pass, not here.

3. **Nothing writes `mediaRefs` in production yet.** Every `social-media/…`
   reference in the repo is a test fixture. So the IG media path has no way to
   receive an image today even with admission wired — the drafting/attach side
   is unbuilt. Worth knowing before anyone plans a dogfood IG post.

---

## 5. Next action for the lead

Say yes/no/amend on §2. On a yes it is one focused function in
`public-assets.ts` (+ its tests) plus the production wiring that builds
`admitPublicMedia` from `APP_ORIGIN` and the object store, plus the one-line
route change in §2. On a no, the driver and seam stand as built and Instagram
keeps refusing honestly — which is a correct state to sit in, not a broken one.

I did not merge and did not open a PR.
