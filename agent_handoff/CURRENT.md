# CURRENT

## Stamp

2026-07-28 (session 83, syd4 — **zero credit spend**; Fable 5, set with
`/model` before "gogogo"). **THE CONNECTOR SEAM (charter D1) SHIPPED
LEAD-DIRECT, RESEARCH-FIRST, IN ONE SESSION:** the founder-ratified Mobbin
sweep and the rule-10 prior-art pass ran BEFORE the plan hardened, he answered
two questions mid-boot ("you have a Bluesky account already" — TRUE, the soak's
env pair; "Postiz connects without me?" — only their HOSTED product, because
Postiz-the-company registered its own platform apps once), gave GO, and the
whole D1 stack landed: window → engine seam → connect flow → live Bluesky
proof. Final verify on main: **2740 passed / 9 skipped, 0 lint errors** (2694
at the s82 close). Tree clean, pushed. ⛔ One live
platform call all session: Bluesky's read-only validate ping on connect (the
s70 precedent); zero posts, zero spend.

**RESEARCH FIRST, AND IT CHANGED THE PLAN.** `mobbin-patterns-s83.md` (8
categories, verdict-tagged, links-never-assets) + `prior-art-connector-seam-
s83.md`. Three findings altered the build: (1) **Bluesky's connect is NOT the
OAuth dance** — app passwords are the platform's own designed paste, so the
mode-2 grammar STAYS for that flavor and the contract's `connect.flavor` field
says which is which; (2) **arctic (MIT, npm-verified) owns the OAuth quirks**
— Reddit's Basic-auth exchange and `duration=permanent` live in the dependency,
inside the connector file, never as the seam; (3) **@atproto/api was TAKEN
then deliberately NOT USED** — the SDK owns its transport and would bury the
injectable-fetch seam every driver test rides; raw XRPC + deterministic
UTF-8-byte link facets shipped instead, SDK recorded as the swap path when D3
wants mentions. Reddit's commercial API contract = a flagged launch gate
(free non-commercial 100 q/min covers all dogfood).

**THE WINDOW (0021_s83_d1_window):** SOCIAL_PLATFORMS += reddit + bluesky
(matrix rows, config schemas — reddit's cadence block carries `subreddit`,
absent = the account's own profile) · DESTINATIONS += both + the
`connect.flavor` vocabulary (manual | oauth2 | app_password; pre-D1 entries
untouched = manual) · `oauth_states` (single-use consume = DELETE‑RETURNING
inside the tenant wall; expired refuses with the instant on its face; a
stranger's probe is indistinguishable from no flight) · env: SOCIAL_REDDIT_* /
SOCIAL_BLUESKY_* seats + the REDDIT client pair + **APP_ORIGIN** (a redirect
URI must match the registered app EXACTLY — never derived from headers) ·
**deferred item 4 CLOSED**: `scheduled` is no longer a draft status (nothing
ever wrote it, re-verified; approved → published is the edge, I2 guard
intact; scheduling is a queue-ROW fact). Completeness ratchets caught the new
table twice (COPY_ORDER + the tenancy set) — they work.

**THE SEAM:** `hardenedPlatformFetch` (429 → Retry-After capped ×2 · 401 →
typed `SocialTokenExpiredError`, never retried · else verbatim body) — the
four live-proven drivers were deliberately NOT re-shaped onto it (s69 receipts
outrank tidiness); the two NEW drivers ride it. Reddit driver: self posts via
`/api/submit`, title = first line clamped ≤300 with the FULL body preserved,
target = configured subreddit else `u_<username>` from `/api/v1/me`, media =
typed refusal (upload-lease flow is its own reviewed change). Bluesky driver:
createSession per publish (stateless), uploadBlob → embed, link facets by
UTF-8 byte offset. The door passes the platform's cadence block through as
`settings` (the D3 settings seam, born small). `integrations/connect.ts`: ONE
begin door + ONE complete door + refresh verbs behind `OAUTH_PROVIDERS` — a
new oauth2 platform ≈ one provider entry + one env pair + one registry row.
Refusals typed and named (`not_oauth2` · `missing_client_pair` ·
`missing_origin` · `state_mismatch` · `no_refresh_token` — a pair with no
refresh token REFUSES TO STORE: that is a connection built to die silently).
The refresh tick rides the ONE periodic runner (`run-sweep-scheduler.ts`,
45-min horizon; a vault row that will not OPEN throws loud — box misconfig is
never laundered into needs_reauth).

**THE FLOW + THE PROOF.** One dynamic callback route serves every oauth2
destination; its refusals REDIRECT with the reason in the query (a browser
mid-consent must never strand on JSON). Cards gained `connectFlavor`; the
panel switches: oauth2 = "Continue to Reddit ↗" (no paste fields at all),
app_password/manual = the guided paste unchanged. Disconnect confirm now
COUNTS the platform's pending queue rows ("N scheduled posts will fail
closed") — the Mobbin finding nobody ships. **Bluesky is CONNECTED FOR REAL:**
the soak's env pair went through the actual connect door, validate ping green,
card reads *Connected · Posting as @steveneam.bsky.social · Not armed — the
active profile's social block has no "bluesky" entry*. That card IS the
sequence gate rendered honestly. Reddit is one founder step from the same
(`.context/developer-apps.md` §6, ~5 min, once ever). 33 new tests (16 driver
· 10 connect · 7 route) + 3 arming proofs + the window probes; render gate
shot both modes and READ; inventory driven.

## Resume prompt (session 84, syd4 — "gogogo" boots this)

**Resume · Thalon** — s83 shipped D1 (connector seam + connect flow + Bluesky
connected live; Reddit waits only on his 5-min app step). **s84 candidates, his
call at the opener:** (a) **D4 DESIGN WAVE** (ratified to start "after s82"):
four sheets mocked in claude-design — Analytics · Calendar→Schedule · composer
band · Channels — **Fable 5 authors directly (standing rule)**, citing
`mobbin-patterns-s83.md` §"What this changes about D4" rather than re-deriving;
founder verdict makes a sheet law; (b) **D2 pre-work** (publication_metrics
window + postAnalytics verb) — honest note: thin value until posting is
routine; (c) the two open s82 deferred items (cadence pre-check design ·
media-cap export) as a lead-direct small.

**Read first:** CLAUDE.md → this file → `docs/research/mobbin-patterns-s83.md`
→ `docs/research/distribution-charter.md` (D2–D4) → COORDINATION §Work queue →
`docs/research/jobs-table-s79.md` (the harness ledger — TEN wrong verdicts;
READ BEFORE TRUSTING A VERDICT).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units
   (`XDG_RUNTIME_DIR=/run/user/$(id -u)`) · dev 3111 · `git status` + this
   stamp.
1. **If his Reddit values landed in `social-logins.md`:** wire
   SOCIAL_REDDIT_CLIENT_ID/SECRET + APP_ORIGIN=http://localhost:3111 into
   `.env.local`, restart the sweeper (units capture env at start — s72
   lesson), then drive the REAL dance in the browser: Settings → Integrations
   → Reddit → Continue → approve → the card must come back "Connected as
   u/…". Still zero posts (sequence gate).
2. **Arming Bluesky** = adding `bluesky` to the active profile's social block
   + his per-platform GO — HIS call, never yours; the card already names the
   missing half.

▎ ▸ **s83 shipped:** research memos `6e66d62` · window + seam + flow + proof
(commits at this push) · Mobbin claude.ai connector live, box-local fallback
REMOVED (one registration) · `.context/developer-apps.md` §6 = the Reddit
click-path.
▎ ▸ **Deferred items now:** #1 arming pieces (his per-platform GO) · #2
cadence pre-check (needs design) · #3 media-cap export (still open — the
driver re-shape that would have carried it deliberately didn't happen) · #4 ✅
CLOSED (this window).
▎ ▸ **⛔ THE SEQUENCE GATE, unchanged:** *"we're not posting anything yet until
all the walks are verified and fixed."* Queue consumer disarmed structurally;
Bluesky connected-not-armed; arming + per-platform GO + per-post GO all his.
▎ ▸ **Standing:** stealth · hermes-relay = founder · blanket workspace grant ·
every lane/subagent launch needs fresh founder approval · GATE ON THE SUITE'S
EXIT CODE — never pipe it · vitest does NOT typecheck · verify-on-merged-main
= THE gate + MEASURED render + DRIVE the surface · research before build (rule
10) · no AGPL code embedded, ever · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin, pushed · budget 2M · balance 584.12 · zero spend
s83 (one read-only validate call).
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

## Next action — s84: the founder picks (a) the D4 design wave (four sheets in claude-design, Mobbin memo as raw material), (b) D2 pre-work, or (c) the deferred smalls. If his Reddit app values are in social-logins.md, step 1 wires + live-drives the dance first (still zero posts).
