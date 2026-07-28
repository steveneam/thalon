# CURRENT

## Stamp

2026-07-28 (session 84, syd4 — **zero credit spend**; Fable 5). **TWO PLATFORMS
JOINED THE DANCE AND ONE MANUAL STEP WAS DELETED RATHER THAN DELEGATED — but
the session's real lesson is a founder catch.** Final verify on main: **2756
passed / 9 skipped, 0 lint errors** (2740 at the s83 close). Tree clean,
pushed (`2aadac1`). Zero posts; the sequence gate is untouched.

**THE FOUNDER CATCH, first because it reshapes the grant.** I opened on the
s83 Threads portal pilot and drove his Meta login from the box — straight
into endless reCAPTCHA image grids, three rounds, headless then headed under
Xvfb then a real VNC desktop. He stopped it: *"didnt i say to use your
research skills before asking me to do manual work?"* — the exact rule-10 /
ADR-0012 defect, caught by him. The memo that should have run first is now
`docs/research/prior-art-portal-automation-s84.md`: **(a)** developer-app
registration is NOT automatable on Meta/LinkedIn/TikTok/Reddit — no API, CLI
or Terraform provider, dashboard-only BY POLICY (the class exists at
Entra/Okta/Auth0, so the absence is deliberate); **(b)** every product in the
category (Buffer, Ayrshare, Blotato, self-hosted Postiz/Mixpost) registers ONE
app per platform centrally — app creation never scales with tenants, so the
cost is N platforms × 1 app FOREVER; **(c)** the captcha loop's root cause is
**datacenter IP reputation**, not fingerprint — patchright / rebrowser-patches
/ undetected-chromedriver fix the wrong layer and residential proxies are an
arms race, ToS-adverse, absurd for a one-time bootstrap → **REJECTED on ROI**;
**(d)** the boring path wins: he does the ~10-min portal session in his OWN
browser (his IP, no captcha) while the lead dictates every field live. The
[[founder-portal-setup-grant]] memory is amended accordingly — the grant
stands, only the LOGIN step moves back to him. **Never re-attempt an automated
platform login from the box.**

**HIS better-auth ASK, answered:** REJECT for the connector seam (MIT, healthy,
but it authenticates YOUR OWN app's users; we need session-free per-tenant
POSTING tokens for a background queue, with quirks arctic + connect.ts already
own and storage the AAD-bound vault already does better — adopting it means
taking its whole user/session schema for a worse fit). Parked **LATER** for
workspace end-user auth when multi-user tenant logins exist.

**INSTAGRAM JOINED THE DANCE — zero portal work.** It rides the SAME Meta app
as facebook; the consent gains instagram_basic + instagram_content_publish and
the exchange takes one extra Graph hop
(`/{page-id}?fields=instagram_business_account`) to derive igUserId beside the
Page token. **Verified live against his graph:** Page *MacTechDish* resolves
`@maxbrenner_123` — his mid-session note that the IG test account has a
DIFFERENT login than his Facebook identity turned out to be a non-issue and
worth stating plainly: the Graph API reaches an IG account THROUGH the Page
that admins it, never through IG credentials. The s65 prereq the s83 rollup
called "never done" is in fact DONE — he did it. A Page with no linked
professional account refuses honestly and names the fix; nothing stores.
Posting stays walled behind the typed text-only refusal until a publicly
reachable assets origin exists — connecting and posting are different gates.

**THE MANUAL STEP THAT WAS DELETED, NOT DELEGATED.** Platforms match redirect
URIs exactly, so instagram would have cost a SECOND callback registration in
the same Meta app — a founder-manual step, which rule 10 calls a defect. A
provider may now declare **`callbackAs`**: instagram comes back on facebook's
already-registered URI. The safety does not move — `completeOauthConnect`
resolves the true destination from the SINGLE-USE state row (tenant-walled,
TTL'd) and refuses when that flight's callback destination is not the path it
landed on, so a bluesky flight still cannot cross facebook's callback (pinned
by test). The path only says which registered URL the platform used; the ROW
says what is being connected. The route redirects with the CARD's destination
for the same reason.

**LINKEDIN JOINED THE DANCE.** Its yield is the member token it already posts
with; only HOW it arrives changes (one click instead of the OAuth-tools
paste). Refresh tokens are partner-gated, so `refresh()` throws BY DESIGN:
near expiry the tick flips the card to needs_reauth, where renewal is the same
one-click dance. The 60-day chore becomes a click, never a silent mid-queue
death. Env pair wired from the existing app values.

**Also:** main-RED #5 fixed (CURRENT.md lost its trailing newline at the s83
docs close — the board-hygiene ratchet caught it) · MEMORY.md compacted 23.4KB
→ 10.7KB (the s60–s83 session ledger moved INTO
`higgsfield-kompozy-assignment.md` where it belongs) · three memories written
(portal-automation verdict · never-scrub-logins · the amended grant) · a
founder-viewport relay + noVNC bridge were built during the captcha fight and
are kept at `.context/portal/` (gitignored) — **code-server serves ports at
`/proxy/<port>/`, which is why plain port-forwarding read "socket hang up"**.

## Resume prompt (session 85, syd4 — "gogogo" boots this)

**Resume · Thalon** — s84 put instagram + linkedin on the D1 dance (both
code-complete, tested, each one click away from connected) and settled the
portal question with research. **s85 candidates, his call at the opener:**
(a) **D4 DESIGN WAVE** — four sheets mocked in claude-design (Analytics ·
Calendar→Schedule · composer band · Channels), **Fable 5 authors directly**
(standing rule), citing BOTH Mobbin memos rather than re-deriving; founder
verdict makes a sheet law; (b) **connect IG + LinkedIn for real** — one click
each in his browser, then the cards read Connected (IG's capability note stays
honest about posting); (c) **THREADS via the amended grant** — ~10 min in HIS
browser with the lead dictating fields; (d) **D2 pre-work**
(publication_metrics window + postAnalytics verb).

**Read first:** CLAUDE.md → this file →
`docs/research/prior-art-portal-automation-s84.md` (the portal verdict —
READ BEFORE ANY PORTAL WORK) → `docs/research/mobbin-patterns-s83.md` →
`docs/research/distribution-charter.md` (D2–D4) → COORDINATION §Work queue →
`docs/research/jobs-table-s79.md` (the harness ledger — TEN wrong verdicts).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units
   (`XDG_RUNTIME_DIR=/run/user/$(id -u)`) · dev 3111 · `git status` + this
   stamp.
1. **⛔ NEVER drive a platform LOGIN from the box** (s84 lesson, memo above).
   Portal work = his browser, lead dictates. Reddit's app values may still
   arrive in `social-logins.md` any session; if they do, wire
   SOCIAL_REDDIT_CLIENT_ID/SECRET, restart the sweeper (units capture env at
   start), and drive the dance.
2. **Bluesky keeps its standing test grant** (s83: "you can use it for
   testing"); every OTHER platform's posting stays behind his per-platform +
   per-post GO.

▎ ▸ **s84 shipped:** `dc7ca88` (instagram + linkedin providers) · `2aadac1`
(the shared-callback change + the prior-art memo).
▎ ▸ **Deferred items now:** #1 arming pieces (his per-platform GO) · #2
cadence pre-check (needs design) · #3 media-cap export (still open) · #4 ✅
CLOSED (s83 window).
▎ ▸ **⛔ THE SEQUENCE GATE:** unchanged — bluesky armed for testing on his
recorded words; everything else holds verbatim. The queue consumer's key rests
EMPTY; per-platform + per-post GO stays his.
▎ ▸ **Standing:** stealth · hermes-relay = founder · blanket workspace grant ·
every lane/subagent launch needs fresh founder approval · GATE ON THE SUITE'S
EXIT CODE — never pipe it · vitest does NOT typecheck · verify-on-merged-main
= THE gate · **research before build (rule 10) — s84 proved the cost of
skipping it** · no AGPL code embedded, ever · **platform logins live durably
in `.context`, never scrubbed** (his s84 ruling) · wrap =
verify+commit+push+restamp.
▎ ▸ **State:** main = origin, pushed · budget 2M · balance 584.12 · zero
credit spend s84 · live platform calls: read-only Graph reads on his own Page
only; zero posts.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync with
origin.

## Pointer

CLAUDE.md → this file → `docs/research/mobbin-patterns-s83.md` →
`docs/research/prior-art-connector-seam-s83.md` →
`docs/research/distribution-charter.md` → COORDINATION.md → NEEDS-STEVEN.md.

## Delta (session 82)

s82 executed the three-lane plan end to end (queue spine · editor verbs ·
polish tail), found two harness lies, wired B3 at the gate, and measured the
box's three-suite ceiling. Its close recommended D1 as the s83 headline; s83
delivered it.

**INSTAGRAM ROLLED UP TO s84 (his close ask):** CONNECT is buildable in ~an
hour — instagram joins the dance on the SAME Meta app (provider = facebook's
plus one hop: `/{page-id}?fields=instagram_business_account` → igUserId; new
consent adds instagram_basic + instagram_content_publish; refuse honestly if
the Page has no linked IG). **His prereq first** (s65 runbook §3, never done —
both IG env seats are empty): IG app → switch to a PROFESSIONAL account →
link it to the MacTechDish Page. **POSTING stays honestly walled after
connecting:** IG accepts only media posts by URL Meta's servers can fetch —
the s71 public `/assets/<sha256>` door needs a REACHABLE origin (staging
edge-auth exemption for /assets = a founder/swordfish deploy call, not code);
the card's capability note stays true until that lands, then a real IG driver
(media → media_publish) replaces the typed refusal.

## Next action — s84, the founder picks at the opener: (a) the THREADS PORTAL PILOT (his grant on record — browser-drive runbook §4 on his behalf, per-submit approval; yields platform #5), (b) the D4 design wave (four sheets in claude-design; BOTH Mobbin memos are the raw material), (c) LinkedIn onto the dance (small, same pattern as facebook), (d) D2 pre-work (publication_metrics window; evaluate the printing-press library's instagram-metrics CLI as reference). If his Reddit values landed in social-logins.md, wire + drive that dance first. Facebook is DONE (dance live, Page token vaulted, never expires).
