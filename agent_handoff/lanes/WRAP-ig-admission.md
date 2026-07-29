# WRAP — lane `ig-admission` (the publish-scoped public-asset admission)

**Status: BUILT and green.** The mechanism §2 of `WRAP-ig-post.md` designed is
implemented, tested clause by clause, and `npm run verify` is green on exit
code in this worktree (2811 passing + the new cases, 0 failed).

**Ships stayed disarmed. ZERO live calls.** No token reached Meta, no live post
was attempted, the arming ratchet is untouched, and every Graph call in the new
tests is answered by an injected fake — including the one that "fetches" the
`image_url`, which is answered by the public door's own read function rather
than by a network.

I did not merge and did not open a PR.

---

## 1. What shipped — three files, exactly the declared set

### `packages/engine/src/webpage/public-assets.ts` — the mechanism

- **`pending` row family** beside `posts`, `.default([])` → every bundle
  written before this field parses unchanged. **No `PUBLIC_ASSETS_VERSION`
  bump, no migration** (pinned by its own test).
  Row: `draftId` · `platform` · `family` (closed enum, today only
  `"social-media"`) · `contentHash` · `ext` · `expiresAtMs`.
- **`parsePendingPublicAssetRef(ref)`** — the door-side grammar: a verbatim
  `social-media/<sha256>.<ext>` becomes an admissible (family, ref) pair, or
  `null`. Fail-closed at three points: family outside the closed set, hash that
  is not 64 lowercase hex, extension the public door would refuse to serve.
- **`admitPendingPublicAsset` / `revokePendingPublicAsset`** — the write pair.
  Admission is keyed by (draft, platform, hash+ext); re-admitting replaces the
  row rather than duplicating it; **every write prunes expired rows**, so the
  bundle self-heals. Revoke never throws for an absent bundle or a second call.
- **`PENDING_PUBLIC_ASSET_TTL_MS = 5 min`**, and `pendingSourceKey` —
  `objectKey(family, contentHash, ext)`, **reconstructed, never stored**.
- **`readPublicAssetBytes(tenantId, ref, store?, {nowMs?})`** — membership in
  strict order: published row (unchanged, pin store) → else a pending row
  matching hash+ext **and** a clock was supplied **and** `expiresAtMs > nowMs`
  → derived source key, read through `getContentAddressed` → else
  `not_public`. **No clock → pending ignored entirely.**
- **`rebuildPublicAssets` drops `pending`**, with the fail-closed rationale in
  a comment.

### `packages/engine/src/social/publish.ts` — the seam's implementation

`createPublicMediaAdmitter({tenantId, appOrigin, objectStore?, now})` builds
the `admitPublicMedia` dep the s85 lane declared and left un-defaulted. It is
the **only** thing that ever writes a pending row. Origin is `APP_ORIGIN` —
**no new env key**; an absent/blank/non-absolute-http(s) origin returns
`undefined`, i.e. the un-wired seam, i.e. the driver's existing honest
`public_media_url_unavailable` refusal.

### `apps/web/src/app/assets/[asset]/route.ts` — the clock

One argument: `{ nowMs: Date.now() }`. That is the route's whole part in this;
every bound lives in the engine. Published rows are byte-identical.

---

## 2. THE BOUND I LANDED ON, and the test that pins each clause

The gate's invariant is now, exactly:

> an attacker can fetch exactly the images the blog already shows — **plus, for
> at most five minutes, the one image of a post being published right now, for
> a driver that declared it publishes by address.**

It is **not** "any `social-media` ref is public", and an approved-but-never-
published draft's image is **never** reachable: only the door's admission
writes a row, and only for the publish it is making.

| Clause of the bound | Test that fails if it is removed |
|---|---|
| per-driver opt-in (`needsPublicMediaUrl`) | `publish.test.ts` — "a byte-UPLOADING driver never widens the gate: the seam is not even consulted" (s85) **and** "a byte-UPLOADING driver writes no admission at all" (real admitter wired; the tenant bundle is never even created) |
| one draft, one platform, one ref per admission | `public-assets.test.ts` — "opens ONE image for five minutes…" asserts the row's exact contents and that `posts` stays empty; "is scoped to ONE image: a second, un-admitted social image stays private" |
| revoked on success **and** on failure | `publish.test.ts` — "hands Meta an address that RESOLVES, then takes it back" (pending is `[]` and the URL stops resolving the moment publish returns) · "a FAILED publish leaves nothing public" · the two s85 seat tests |
| expired rows are not served | `public-assets.test.ts` — "expires ON ITS OWN: served at the last millisecond, refused at expiry and after" · `route.test.ts` — "404s an EXPIRED admission" |
| no clock supplied → pending ignored | `public-assets.test.ts` — "NO CLOCK → pending rows are ignored entirely" (both the 3-arg call and `{}`) |
| hash-verified read | `public-assets.test.ts` — "re-hashes on read: tampered source bytes refuse loudly, never served" |
| the key is reconstructed, never stored | `public-assets.test.ts` — "stores NO object key — the source key is RECONSTRUCTED from the row's own hash", with the comment §2 asked for, verbatim in intent: a stored key could pair `contentHash: B` with a key naming hash `A` and serve A's bytes under B's `immutable` URL; deriving it makes that unrepresentable |
| closed `family` set + closed `ext` grammar | `public-assets.test.ts` — the 10-case `parsePendingPublicAssetRef` table (other families, prefix-match near-misses like `social-media-evil/`, `svg`, prefix-dir shape, uppercase/short hash, traversal, query smuggling) · `publish.test.ts` — "a ref the door could never SERVE gets no address at all" |
| `rebuildPublicAssets` drops pending | `public-assets.test.ts` — "rebuildPublicAssets DROPS pending" |
| an unadmitted image stays private | `route.test.ts` — "404s a social image with no admission at all — holding the bytes opens nothing" |
| the B-pub.4 path is untouched | `public-assets.test.ts` — "a PUBLISHED row still wins, and still needs no clock" · "parses a pre-B-ig.1 bundle unchanged" · every pre-existing gate test, unmodified |

**Red-checked, not assumed** (each mutation applied, suite run, then reverted):

- `expiresAtMs > nowMs` → `>=` : the expiry-boundary test goes red. ✅
- deleting the `nowMs === undefined` guard: **`tsc` fails** (TS18048 at the
  comparison) — the clock gate is pinned by the type system, and the
  *plausible* regression (defaulting the clock to `Date.now()`) goes red in
  "NO CLOCK → pending rows are ignored entirely". ✅
- The repo's own NUL-byte ratchet caught a stray `\x00` I had written into a
  sort key and failed `verify`. Fixed by sorting field-by-field instead of on
  a joined string (a joined key is wrong anyway — a separator that can appear
  inside a field makes distinct rows compare equal). Worth recording as
  evidence that ratchet earns its keep.

---

## 3. Where I judged, beyond what §2 stated — nothing redesigned

§2 was implemented as written. Five decisions it did not cover, each stated so
a drift is visible:

1. **`recordPublicAssets` carries live pending rows FORWARD** (and prunes
   expired ones). §2 said *rebuild* drops pending; it said nothing about the
   normal web-publish write. Dropping there too would silently break a
   mid-flight social publish every time a blog post is published, for no
   safety gain — rebuild's fail-closed trade is justified by "disaster
   recovery", which the hot path is not. Pinned by "a web-page publish carries
   live admissions forward (and drops dead ones)".
2. **The admitter refuses a non-absolute origin, not just an absent one.**
   `APP_ORIGIN=localhost:3111` would mint a URL Meta cannot fetch; refusing
   early gives the honest driver refusal instead of a platform-side error, and
   it is the s84 origin lesson made executable. Pinned by the 4-case table.
3. **`AdmitPublicMediaRequest.contentType` is deliberately unused.** The served
   content-type derives from the ext through the closed map — one source of
   truth. Cross-checking the draft's declared type would add a refusal path
   nobody asked for.
4. **`ttlMs` override exists for tests only**; the door never passes one, so
   production TTL is always the 5-minute constant.
5. **Concurrency is last-write-wins on the pointer**, exactly like the existing
   `recordPublicAssets`. A racing write can drop a live admission, which fails
   *that* publish loudly (the platform cannot fetch the image) and can never
   open anything extra. Stated in the function's comment rather than solved:
   solving it needs a CAS the object store does not have.

I disagreed with **nothing** in §2.

---

## 4. What I deliberately did NOT build — the last wiring hop is out of lane

The mechanism is complete and tested, but **no production caller passes the
admitter yet**, because all four files that would change are outside this
lane's declared set. Per the kickoff, I am reporting rather than reaching:

1. `packages/engine/src/webpage/index.ts` — re-export `admitPendingPublicAsset`,
   `revokePendingPublicAsset`, `parsePendingPublicAssetRef`,
   `PENDING_PUBLIC_ASSET_TTL_MS`, `pendingPublicAssetSchema`, the two types.
2. `packages/engine/src/social/index.ts` — re-export
   `createPublicMediaAdmitter` + `PublicMediaAdmitterOptions`.
3. `packages/engine/src/social/queue-consumer.ts:169` — the deps literal gains
   `admitPublicMedia: createPublicMediaAdmitter({ tenantId: row.tenantId, appOrigin: readEnv().APP_ORIGIN, now })`.
4. `apps/web/src/lib/approve-queue/actions.ts:140` — the same one line, with
   `ctx.tenantId` and the `readEnv()` already in that function.

Until (3) and (4) land, Instagram keeps refusing honestly — a correct state to
sit in, not a broken one. Nothing else is needed: no barrel-free import path is
missing for the tests, which import relatively.

Also not built, on purpose: no live call, no contracts/drizzle change, no
`PUBLIC_ASSETS_VERSION` bump, no lift of the `mediaRefs` `.max(1)` ceiling, no
second public door, and nothing touched in `packages/engine/src/ingest/` or
`apps/web/src/components/transcription/` (the parallel lane's set).

---

## 5. Found, not mine

1. **The s85 edge-auth item still blocks a real IG publish on staging** and is
   unchanged by this lane: Meta fetches `image_url` **anonymously**, so
   `STAGING_EDGE_AUTH` must exempt `/assets/` or container creation fails with
   an unreachable-image error before the app's own gate (which already exempts
   `/assets/`) gets a say. Belongs to the `staging-dogfood` lane / the
   founder-gated basicauth pass.
2. **Nothing writes `mediaRefs` in production yet** (s85 finding, re-verified:
   every `social-media/…` in the repo is still a test fixture). The admission
   path is real but has nothing to admit until the drafting/attach side exists.
3. `packages/contracts/src/integrations.ts:143` still carries the stale
   `driver: "instagram-text-refusal"` string (s85 finding #1) — display-only,
   needs a lead-owned edit at a contract window.

---

## 6. Next action for the lead

Rebase, review the bound in §2 above, land the four one-liners in §4 (or hand
them to a follow-on lane), then merge. `npm run verify` is green on exit code
in `.claude/worktrees/ig-admission` as of this wrap.
