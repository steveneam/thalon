> **Status: parked** — publisher adapters are Sprint 3+; revisit at that charter. (Marker added at the s61 hygiene pass; see docs/research/README.md.)

# Per-platform publish parameters (founder question, 2026-07-07 session 20)

> **The question (founder):** every platform has its own microscopic posting parameters — IG alone splits into post/story/reel, each with hashtags, tag-people, location, AI label, audience, music, "more options" (fundraiser, hide like count, upload quality…). Some of this is deterministic and reusable across platforms, some is platform-specific. How does Thalon account for it — or do we just produce the post/video and let the user figure the rest out?
>
> **The answer in one line:** split every parameter honestly into three tiers — *generatable content* (Thalon writes it), *operator decisions the official API accepts* (Thalon asks at approve-time and sets them on publish), and *native-app-only controls* (Thalon renders an honest posting checklist — never pretends). The split is per-platform **data in a registry, never bespoke frontend code** — one schema-driven approve panel renders them all. This is the B3.1 publisher bucket's design input; nothing here changes wave 3.5.

## 1. The load-bearing constraint: what the OFFICIAL APIs accept

Thalon publishes via official APIs only (A5). So the real boundary isn't "what the IG app shows" — it's what each platform's publish API takes. Surveyed 2026-07-07 (sources §6):

| Platform (surface) | Content params (generatable) | Decision params (API-settable at publish) | Native-app-only (checklist tier) |
|---|---|---|---|
| **Instagram feed/carousel** (Graph API `/{ig-user-id}/media`) | `caption` (hashtags/@ inline), `alt_text` (per image, Mar-2025+) | `location_id`, `user_tags` (username + optional x/y), `product_tags` (needs Shopping setup), `collaborators`, `is_ai_generated`, `is_paid_partnership` + `branded_content_sponsor_ids`, carousel `children` (≤10) | licensed music, filters, audience selectors, hide-like-count, fundraiser, "upload highest quality" |
| **Instagram reel** | `caption`, `cover_url`/`thumb_offset` (derivable from beat structure) | `location_id`, `user_tags`, `collaborators`, `share_to_feed`, `audio_name` (**original audio only**), `is_ai_generated`, branded-content pair, `trial_params` (trial reels) | licensed/catalog music, interactive stickers, hide-like-count |
| **Instagram story** | media itself | `user_tags` (Jul-2025+) | links/stickers/polls, close-friends audience |
| **TikTok** (Content Posting API direct post) | caption/title (hashtags inline) | `privacy_level` (**must be operator-chosen, no default — TikTok guideline**), `disable_comment`/`disable_duet`/`disable_stitch` (**must default OFF, operator enables**), `brand_content_toggle`, `brand_organic_toggle`, **`is_aigc`** | sounds/music picker, effects, playlists |
| **YouTube** (`videos.insert`) | `title`, `description`, **`tags[]` (real structured field)**, thumbnail (separate call) | `privacyStatus`, `publishAt`, `categoryId`, `madeForKids`, license, **`status.containsSyntheticMedia`** (A/S disclosure) | end screens, cards, chapters-as-UI (chapters ride description text), premiere settings |
| **X** (`POST /2/tweets`) | `text` (hashtags/@ inline), media `alt_text` | `reply_settings` (everyone/following/mentioned), `geo.place_id`, media `tagged_user_ids`, `community_id`, polls | — (API coverage is near-complete for organic posts) |
| **LinkedIn** (versioned `/rest/posts`) | `commentary` (hashtags inline; mentions = URN annotations — org mentions work, member mentions restricted) | `visibility` (PUBLIC/CONNECTIONS/LOGGED_IN), media/article attachment | polls, documents/carousels (API-unsupported), some mention types |
| **Facebook Page** (`/{page-id}/feed`) | `message`, `link` | `published=false` + `scheduled_publish_time` (native scheduling), place/tags, Page audience `targeting` | most of the composer's long tail |

Three findings worth pinning:

1. **AI-disclosure labels are API-settable on all three video platforms now** — IG `is_ai_generated`, TikTok `is_aigc`, YouTube `status.containsSyntheticMedia`. Thalon generates AI content; the publisher should set these truthfully **by default** (invariant-grade: the same honesty doctrine as ADR 0006's claims rule and the FAQ disclosure stance). This is a differentiator, not a burden — "discloses honestly by construction."
2. **TikTok makes the approve-time panel a COMPLIANCE requirement**: its content-sharing guidelines require the operator to manually choose `privacy_level` (no pre-selected default) and manually enable interaction settings; TikTok audits the integration's UX before granting API approval. "Users figure it out themselves" is not an option there — the UI must exist for the app to be approved.
3. **Music is the honest no:** IG reels via API = original audio only (`audio_name` renames it); TikTok's sound picker is native-only. This composes cleanly with the ratified music decision (engaging-clips §6 rung 1): Thalon bakes its licensed bed INTO the video file as original audio — platform catalog music is a checklist item if the operator wants it instead.

## 2. The three-tier model (the design answer)

- **Tier A — generatable content.** Caption/text with inline hashtags/mentions, YouTube title/description/tags, alt text (generatable from the beat/visual content — an accessibility win the judge can gate), cover/thumb offset (derivable from the render's beat structure). This is generation + judge territory; `platformProfileSchema` already steers it (`hashtagPolicy`, `charLimit`, `disclosure`) — Tier A needs richer per-platform policy config, not new machinery.
- **Tier B — operator decisions the API accepts.** Location, tag-people/collaborators (relationship-bearing — never auto-set), privacy/visibility/reply settings, disclosure toggles (paid partnership / branded content), AI labels (default ON, operator can review), schedule time, duet/stitch/comment toggles. These are **approve-time structured params**: a schema-driven panel, defaults resolving tenant platform-profile → operator per-draft override, values validated per-surface and carried to the publisher verbatim.

### 2.1 Hashtag / mention intelligence (FOUNDER DIRECTION, 2026-07-07 — ratified as Tier-A first-class)

The founder wants Thalon to actively *come up with* hashtags, tags, and @mentions — for exposure and audience reach — primarily on post-based platforms (X, LinkedIn, Facebook) and secondarily in video description boxes (YouTube/TikTok/IG reels). This is not a new subsystem; it is **the intel spine feeding caption generation**:

- **Hashtag sources, in priority order — all machinery that already exists:** (1) the tenant's compiled **search targets** (B6.8 seed compiler + judged AI expansion — keywords ARE proto-hashtags; provenance/origin rides along), (2) **monitored-area** names and vocabulary (B6.4), (3) the **trend context** on promoted cards (the source item's own tags/vocabulary — the "re-use the winning format" feature applied to discovery metadata), (4) `meta.seo` keywords when the format carries them (the same SEO/AEO/GEO block, spent twice). Social search is increasingly a search-intel surface (TikTok/IG/X search, and social posts surfacing in answer engines) — hashtags/keywords in captions are the social half of A13.
- **Shaping is per-platform config, never code:** hashtag *count norms* differ by platform (X favors 1–2, LinkedIn ~3–5, IG effective range well below its 30-cap, YouTube = the structured `tags[]` field plus a few description hashtags) and shift with algorithm fashion — so counts/placement (inline vs trailing block vs first-comment) live in `platformProfileSchema` as per-tenant config with sane defaults, verified at bucket time, and the existing `hashtagPolicy` string upgrades to this structured policy.
- **Mentions are SUGGESTED, operator-confirmed — never auto-set.** Sources: identity `links` (partners/socials the profile already carries), entities the draft actually references, accounts from the tenant's watchlists. Tagging real people/orgs is relationship-bearing (and mechanically platform-specific: LinkedIn mentions = URN annotations and member-mentions are API-restricted; IG tag-people is a Tier-B param distinct from caption @'s; X @'s are plain text). So generation proposes; the approve panel's suggestions are one-click accept/strike.
- **Judged like everything else:** hashtags/mentions pass the same G1 denylist, and a grounding-flavored check applies (a suggested tag must trace to identity topics, a search target, an area, or the trend context — no invented bandwagon tags). Every suggestion carries a reason string (the house grammar): `#programmaticvideo — search target (ai_expansion), horizon: position 11 rising`.
- **Timing bonus:** none of this waits for the publisher. Hashtags/mentions are caption text — generated + judged + approved drafts are copy-paste usable TODAY. Natural slice: upgrade fanout's caption stage to consume search targets/areas/trend context (generation-side, pre-B3.1), with the structured per-platform shaping and the mention-confirm UI landing alongside the B3.1 approve panel.
- **Tier C — native-app-only.** Everything the API can't set becomes a **posting checklist** rendered on the approved draft (copy-paste-ready caption + "in the app: add music X, enable hide-like-count, attach fundraiser…"). Honest degrade, the house pattern — never silently dropped, never faked.

## 3. Where it lives in the architecture (all data, no bespoke frontend per platform)

1. **A platform-surface registry in contracts** (the B4.2 format-registry pattern, applied to publishing): per `(platform, surface)` — IG feed/carousel/reel/story are FOUR surfaces — a zod param schema with each field tagged `generatable | operator | checklist`, plus deterministic constraints (reel 5–90s @ 9:16, carousel ≤10 children, char limits) that the existing lint/validation belts can check pre-publish. Platform names stay free-form strings (the engine is generic); the registry ships as config the demo tenant exercises.
2. **Draft meta gains a `publish` block** (capability-gated like `seoMeta`): the chosen surface + Tier-B values + Tier-C checklist state. Pre-existing drafts parse unchanged (optional block — the seoMeta precedent exactly).
3. **Platform profiles gain per-surface defaults** (Tier-B): standing collaborators, default `share_to_feed`, default reply settings, "always label AI." Tenant data, never code.
4. **Approve queue: ONE schema-driven params panel** rendered from the registry (the B5.4 form-from-schema precedent) + the checklist strip. Adding a platform = adding registry data, not frontend work — this directly answers the "fine-tuning the frontend per platform" worry.
5. **The publisher (B3.1)** consumes the frozen registry: per-platform adapters map the validated `publish` block onto API fields; `publish_queue` already carries platform + idempotency key.

## 4. What this does NOT change

- **Wave 3.5 scope: nothing.** No lane touches publishing; the blog's own-site door has no platform params.
- The social publish path stays pulled until B3.1 is chartered at its own checkpoint; this doc is that bucket's design input (registry + contract window + approve-panel + adapters + TikTok-audit UX would be its natural slices).
- The multi-tenant doctrine holds: every platform-specific behavior lands as registry/config data.

## 5. Open items for the B3.1 charter (recorded, not decided)

- IG requires a Business/Creator account + FB Login for several params (branded content, product tags) — onboarding doc + capability detection per tenant.
- IG API rate: 100 API-published posts per rolling 24h per account (fine for v1).
- X free tier ~500 writes/mo suffices for testing ([you] item stands); paid tier is a bucket-time decision.
- LinkedIn member-mention restrictions and document/poll gaps — record per-surface in the registry so the UI never offers what the API can't do.
- Stories' API surface is thin (media + user_tags); decide whether story publishing is worth v1 or checklist-only.

## 6. Sources

- [IG content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/) · [IG User Media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/) · [IG collaborators](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/collaborators/) · [IG product tagging](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/product-tagging/)
- [TikTok Content Posting API direct post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) · [TikTok content-sharing guidelines (UX audit rules)](https://developers.tiktok.com/doc/content-sharing-guidelines)
- [YouTube videos.insert (`containsSyntheticMedia`)](https://developers.google.com/youtube/v3/docs/videos/insert) · [YouTube videos resource](https://developers.google.com/youtube/v3/docs/videos)
- [X create post (`reply_settings`/`geo`/`tagged_user_ids`/`community_id`)](https://docs.x.com/x-api/posts/create-post)
- [LinkedIn Posts API (versioned)](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-04)
- [FB Pages posts](https://developers.facebook.com/docs/pages-api/posts/) · [FB Page Post reference](https://developers.facebook.com/docs/graph-api/reference/page-post/)
