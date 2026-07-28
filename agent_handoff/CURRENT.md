# CURRENT

## Stamp

2026-07-28 (session 84, syd4 — **zero credit spend**; Fable 5). **THE REAL
ADDRESS IS LIVE, TWO PLATFORMS JOINED THE DANCE, AND THE FOUNDER CAUGHT THE
SAME CLASS OF MISTAKE THREE TIMES.** Final verify on main: **2761 passed / 9
skipped, 0 lint errors** (2740 at the s83 close). Tree clean, pushed. Zero
posts.

**THE LESSON, first, because it cost him ~3 hours and it recurred.** I opened
on the s83 handoff's "Threads portal pilot" and drove his Meta login from the
box into three rounds of reCAPTCHA, escalating headless → headed-under-Xvfb →
VNC desktop. He stopped it (*"didnt i say to use your research skills before
asking me to do manual work?"*). The memo that should have run FIRST is
`docs/research/prior-art-portal-automation-s84.md`: app registration is not
automatable anywhere (dashboard-only BY POLICY); every product in the category
registers ONE app per platform centrally; the captcha loop's cause is
**datacenter IP reputation**, so the stealth-patch class fixes the wrong layer
— REJECTED on ROI. **Then it happened twice more:** he had to ask *"dont you
have a real web address?"* (we did — staging, all day, in my own memory) and
*"you add those new callback redirects yourself"*. Root cause each time: I
treated the ENVIRONMENT as fixed scenery instead of a variable I control.
→ **AGENTS.md rule 11** now names the three tells (escalating the same
approach · a blocker that is infra the product will not ship with · a
comparable product doing it painlessly) and states that **inherited handoff
plans are hypotheses to re-test at the opener, not instructions**.

**THE REAL ADDRESS — DONE, both halves, verified.** Swordfish exempted
`/api/integrations/callback/` from the edge basicauth (priority-100 Traefik
router, keeps ratelimit+noindex; anon probe: callback 307, everything else
401) and set `APP_ORIGIN=https://preview.swordfish.cfd`. Thalon's half: the
callback joined the app gate's public list (same reasoning as `/assets/` —
the platform redirects a CREDENTIAL-LESS browser, and the route is inert
without a 32-byte single-use tenant-walled state row; the begin door stays
gated, pinned by test). **We independently found the same bug within minutes
of each other:** with APP_ORIGIN unset behind Traefik the callback 307'd to
`https://0.0.0.0:3000`, so a SUCCESSFUL connect still stranded the browser.
Closed from BOTH ends — his env, and my `c20eb05` (prefer APP_ORIGIN → the
proxy's X-Forwarded-Host → request URL; the platform-facing `redirect_uri`
stays APP_ORIGIN-only, never headers). **Live now:** the staging callback
redirects to `preview.swordfish.cfd`. His one back at me — "image pin drifted"
— is BY DESIGN (s37: deploy-only key cannot `application.update`, so CI pins
registry-side by re-tagging `:staging` to each digest); answered in ASK-BACKS
with a suggested assertion fix.

**INSTAGRAM + LINKEDIN JOINED THE DANCE, NEITHER NEEDING PORTAL WORK.**
Instagram rides the SAME Meta app, one extra Graph hop for `igUserId`.
**CONNECTED LIVE: @maxbrenner_123.** His mid-session worry — the IG test
account has a different login from his Facebook identity — is a non-issue and
worth restating: the Graph API reaches an IG account THROUGH the Page that
admins it, never through IG credentials. The connect had to be finished
out-of-band (his port-forward kept dying mid-consent; I completed the exchange
on the box from the dead redirect URL) — which is precisely what the real
address now ends. **`callbackAs` deleted a manual step rather than delegating
it:** instagram comes back on facebook's already-registered callback, and the
FLIGHT (the state row) decides what connects, not the path — a bluesky flight
still cannot cross facebook's callback (pinned). LinkedIn: one-click connect,
`refresh()` throws BY DESIGN (partner-gated) so the card flips to
needs_reauth near expiry — the 60-day chore becomes a click. **All four
social channels connected: facebook · instagram · linkedin · bluesky.**

**THE SITE ↔ WORKSPACE DOORS — he was right, I was wrong, and I had asserted
it from grep.** Both links existed in the DOM and NEITHER existed to a user:
the landing's was grey text among four grey nav items beside an amber CTA;
the workspace's was the bare wordmark, which reads as a masthead. Worse, the
way home was a **redirect loop** — the rail pointed at `/?landing` and Next
counts an empty-valued query key as ABSENT, so the escape hatch matched the
very rule it escaped. Fixed both, **screenshotted and click-driven both
directions**, pinned the loop with a regression test. New: an outlined
`Workspace` button on the landing, a labeled `View site ↗` row in the rail.

**RATCHET AUDIT (his ask — first one since the rule was written).** Ran every
documented command verbatim. **Found a rotted executable ratchet:** `npm run
doctor`'s deploy seam probed for the Vercel CLI and told the operator to
install it — an instruction for a path retired at ADR-0007, ~3 weeks stale. It
ran clean, exited 0, and lied. Repointed at the real channel (workflow present
+ staging reachable via the anon callback door — no rotating basicauth pair
needed); now reads *live-ready*. **Root cause of the rot: `doctor` was never
DOCUMENTED, so nothing ran it** — rule 8 now names both standing commands
(`verify`, `doctor`) and carries this as its second worked example. Verified
healthy: `verify`, `worktree:setup` (Linux symlink path, s60 fix holds), the 7
`tests/` ratchets. `npm run guard` in AGENTS.md is a historical citation, not
a live command — correct as written.

## Resume prompt (session 85, syd4 — "gogogo" boots this)

**Resume · Thalon** — s84 made staging the real connect origin, put instagram
+ linkedin on the dance (all four channels connected), fixed the site↔workspace
doors, and audited the ratchets. **s85 = THE D4 DESIGN WAVE + up to three
parallel lanes.**

**Lead-serial, cannot be delegated (founder rule): author the four D4 sheets**
— brief is `docs/research/d4-PREPLAN.md` (written s84 so s85 DRAWS rather than
re-derives; cites both Mobbin memos, names each sheet's OPEN CALLS). Analytics ·
Calendar→Schedule · composer band · Channels. Shoot each with
`scripts/shoot-surface.mjs` and READ the render before presenting. **His verdict
makes each sheet law; no build lane opens before it.**

**Three lanes proposed, EACH NEEDS HIS NAMED GO** (board: COORDINATION.md
§Sprint 9 / s85): `ig-post` (real IG media driver — the assets origin is
reachable now; ships DISARMED) · `d2-window` (publication_metrics + postAnalytics;
weakest payoff, drop first if only two) · `staging-dogfood` (make staging the
tenant's actual home: seed tenant #0, drive the connect dance at the real URL).
Disjoint file sets; Mode B via `scripts/launch-lane.sh`.

**Read first:** CLAUDE.md → this file → `docs/research/d4-PREPLAN.md` →
both Mobbin memos → `docs/research/prior-art-portal-automation-s84.md` (READ
BEFORE ANY PORTAL WORK) → COORDINATION §Sprint 9 + §Work queue →
`docs/research/jobs-table-s79.md` (harness ledger — TEN wrong verdicts).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units · dev 3111
   · `git status` + this stamp · **`npm run doctor`** (now honest).
1. **⛔ NEVER drive a platform LOGIN from the box** (rule 11 + the memo).
2. **Bluesky keeps its standing test grant**; every other platform's posting
   stays behind his per-platform + per-post GO.

▎ ▸ **s84 shipped:** `dc7ca88` providers · `2aadac1` callbackAs · `f0944ea`
gate · `c20eb05` proxy-host · `d1b2e86` landing loop · `3355a64` the doors ·
`ad82ab8` rule 11 · `ac2ce50` D4 pre-plan + lane board + doctor un-rot.
▎ ▸ **Open, his call:** the **cookie transplant** (one 30-second export from
his own browser → the box drives ALL portal work forever: staging callback
URLs, Threads, TikTok, launch-time thalon.org). Reddit app values still
welcome any session. Deferred items #2 (cadence pre-check — the Calendar
sheet is where it gets designed) and #3 (media-cap export) still open.
▎ ▸ **⛔ SEQUENCE GATE:** unchanged — bluesky armed for testing on his
recorded words; the queue consumer's key rests EMPTY.
▎ ▸ **Standing:** stealth · hermes-relay = founder · blanket workspace grant ·
every lane/subagent launch needs fresh founder approval · GATE ON EXIT CODE,
never pipe the suite · vitest does NOT typecheck · verify-on-merged-main = THE
gate · **research before build (rule 10)** · **check the ENVIRONMENT before
his hands (rule 11)** · platform logins live durably in `.context`, never
scrubbed · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin, pushed · budget 2M · balance 584.12 · zero
credit spend s84 · four social channels connected · staging = the real origin.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync.

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
