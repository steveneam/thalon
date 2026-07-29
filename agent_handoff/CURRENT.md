# CURRENT

## Stamp

2026-07-29 (session 85, syd4 — **zero credit spend**; Opus 5). **THE D4 SHEETS
ARE DRAWN AND THE REFINEMENT PROGRAM IS RUNNING; BOTH LANES MERGED; THE
FOUNDER'S BOARD WENT 46 → 6.** Final verify on main: **2776 passed /
9 skipped, 0 lint errors**. Tree clean, pushed. Zero posts.

**s85 OPENED ON A HANDOFF THAT WAS WRONG, AND RULE 11 CAUGHT IT.** The s84
stamp said the Meta cookie transplant was "PROVEN" and cited a screenshot. That
screenshot shows the *"Log in to Meta for Developers"* wall. Re-tested instead of
trusting: the importer had two real bugs (every cookie written to BOTH
`.facebook.com` and `.developers.facebook.com`, so `c_user`/`xs` went twice in one
header; and no expiry, making all nine SESSION cookies that die on browser close).
**Fixing both was not enough** — Facebook cleared the auth pair server-side on the
first request, with a clean desktop user-agent too. The session is INVALIDATED, not
mis-installed. Stopped there rather than escalate to stealthier browsers, which is
the exact loop rule 11 exists to break. **Portal work is back in the founder's
hands** (`NEEDS-STEVEN` 2026-07-28n).

**THE D4 WAVE + THE REFINEMENT PROGRAM (the session's headline).** s85's earlier
half drew the four sheets but never put them where he reviews, so the verdict they
were written to ask for could not be given. All four are on the canvas now, each
rendered at the sheets' own 1440×940 and READ. He then set a standing mandate: three
passes over the workspace with Mobbin + Postiz, every feature/section/button, and —
his explicit ask — **a record so it survives session boundaries**. That record is
`docs/research/ux-refinement-program.md` and it is the thing to read first next
session: mandate verbatim, inherited rules, three-pass structure, a **cited**
reference library (Mobbin URLs + Postiz patterns), per-surface status, open
decisions, and the working loop. **Analytics pass 1 is DONE** (post rendered in-row
with avatar + media thumb, sparkline per tile and per row, 28-day area chart, real
platform marks, icon metric heads, ⓘ tooltips). **Schedule · Composer · Channels are
queued with their moves already recorded.**

**HIS TWO STEERS, AND THE RULE THAT RESOLVES THEM:** *"use visual stuff as much as
possible"* + *"less is more, but still with the same effect"* → **more visual, fewer
words**, and for tooltips: **fact on the surface, rationale behind ⓘ**, with the
guard that *a tooltip is never the only home of something that changes a decision*.

**THE RAIL SWEEP IS RATIFIED AND DONE** — Calendar → **Schedule**, Analytics joins
under it, 15 sheets, RAIL ONLY (matched on icon markup so prose was never
blind-replaced). `Profiles` cross-ref renamed by hand; **`Calendar.dc.html` is
SUPERSEDED** by `Schedule.dc.html` and says so in a banner — kept because the shipped
`/app/calendar` was built from it. **Still open: the APP half.** The product still
says Calendar, so spec and product disagree until a rebuild. That is a build task
with its own go.

**BOTH LANES MERGED, AND THE MERGE GATE EARNED ITS KEEP.** `ig-post` (`96a51a6`) and
`staging-dogfood` (`270642b`). Both were green in isolation; **merged main went RED**
on two calendar tests neither lane touched — the wall clock, because the verify ran
at 02:50 (`.nowline` only renders inside the sheet's 06:00–21:00 band; a "+N more"
fixture 2–5h old straddles two columns in the small hours). Three tests now pin their
own clock (`b2e09a8`), and a FOURTH surfaced at the wrap (dashboard D4, chip on a
06:00–21:00 axis, `waitingPlan(2)` resolving to 05:2x). **So the class got swept, not
the instance:** every component suite was re-run under a shifted TZ at 03:27 and
05:27 — 60 files / 639 tests green, i.e. the surfaces are now clock-robust below the
axis floor. (Late-night was NOT genuinely exercised: the zone I used was invalid and
silently stayed put. Unproven, not proven.) **ig-post corrected its own charter** (IG takes a public
`image_url`, never bytes) and **stopped at the checkpoint**: the allowlist admission
mechanism is designed and REPORTED, not built, gated behind an opt-in
`needsPublicMediaUrl`. Ships disarmed.

**SWORDFISH — the channel ran hot and is fully closed both directions.** Vault key
set + an env-only deploy on our GO (digest verified from the build log first; image
identical before and after). We **declined their pin** and they changed the check
instead: a digest-pinned app plus a deploy key with no `application.update` means CI
re-tags, deploys, reports success and **ships nothing** — silent, worse than what the
pin guarded. Their `staging-assert.sh` now asserts `ref == :staging`, marked opinion,
25 PASS / 0 FAIL. We landed `org.opencontainers.image.revision` so their film-import
commit check could become real (three outcomes: verified / absent→degrade /
mismatch→fail). **The s61 film import was never owed** — done 07-19, their completion
note had been in our own archive for ten days unread; a shared bookkeeping failure.

**THE FOUNDER'S BOARD: 46 → 6.** He said it was "building up with stale
notifications" and he was right. Their collector had been silently dropping our
suffixed-date lines (invisible, not mis-rendered); with that fixed, **18 of 46 were
already DONE and reading as decisions he owed**. Rebuilt: open actions only, grouped
by how long each takes HIM; everything resolved moved verbatim to
`archive/NEEDS-STEVEN-closed.md`. **Ratchet added and revert-checked** — the board may
not carry a ✅/~~ line, and the archive must exist, so the rule is "move it", never
"delete it".

## Resume prompt (session 86, syd4 — "gogogo" boots this)

**Resume · Thalon** — s85 drew + refined the D4 sheets, started the 3-pass UX
program, merged two lanes, swept the rail, and cleared the founder's board.
**s86 = CONTINUE PASS 1, then the video arc.**

**Read first:** CLAUDE.md → this file → **`docs/research/ux-refinement-program.md`**
(the program's memory — cited references, per-surface status, open decisions, the
working loop) → `docs/research/mock-sheets/README.md` §Proposals.

**TWO LANES ARE APPROVED BY NAME — launch at the boot, NO re-ask** (founder, s85
close: *"A + transcription-free"*). Board + scope: `COORDINATION.md` §Sprint 9 / s86.
**`ig-admission`** builds the admission mechanism s85's ig-post lane designed and
reported but did not build (ships disarmed) · **`transcription-free`** actions his own
s79 ruling (free + deterministic by default, AI-enhance as a toggle beside Ingest).
Disjoint file sets, neither touches the sheets.

**Lead-serial, cannot be delegated (founder rule):**
1. **Pass 1 on Schedule · Composer · Channels.** Moves already chosen and cited:
   media thumbnails in the calendar cells (Later) · full-fidelity preview with large
   media + coloured hashtags + the platform's action row (HubSpot/Sprout) · CURRENT /
   NOT CONNECTED grouping + real brand marks + per-account avatars (Rox/Postiz).
   Reuse Analytics' `.info`/`.tip` vocabulary; **exactly ONE tooltip open per sheet,
   never over the thing it explains.**
2. **Then sync all four sheets to the canvas in one batch** (project
   `f5d304cb-cd0e-484d-8542-7b6561e1ef30`) — the canvas currently holds the
   PRE-refinement Analytics.
3. **Then the VIDEO ARC** (his ask, recorded in the program file): four pieces
   (Videos Overview · Video Dossier · the editor · the ENGINE). Start from the s78
   audit + s80/s81 results, do NOT re-audit. **Postiz has no video editor** (verified
   against their live API docs) — take their per-platform video SETTINGS schema for
   Composer instead; editor craft references are VEED/Vimeo/**Descript**, and
   Descript's script-first paradigm is flagged as the one that actually fits
   beat-generated video.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units · dev 3111 ·
   `git status` + this stamp · `npm run doctor` · **`bash ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`**.

▎ ▸ **s85 shipped:** `24a2b42` sheets→canvas + portal withdrawal · `b680b70`
kickoffs · `96a51a6` IG media path · `270642b` staging tenant · `b2e09a8` clock pins ·
`dc34376` the refinement program · `3c479ee` rail sweep · `a8f6df2` tooltips ·
`f0278d8` OCI label · `c53f32f` board 46→5 + templates rolled to swordfish.
▎ ▸ **Waiting on swordfish (nothing blocked), and on ONE founder word:** they
**correctly did NOT re-issue** the `thalon-deploy` credential — a founder approval
relayed through a channel file is not an in-session confirmation, and secrets are on
their rule-10 gate. Their line is worth keeping: *"that rule exists for exactly the
case where the relayed approval is genuine and plausible, because that is the only
case where it is tempting."* Queued as ONE confirm that also covers minting the
templates-preview credential → `NEEDS-STEVEN` 2026-07-29e. Templates-preview service
**accepted as their next-session A4**; `TEMPLATES_PREVIEW_ARMED` is ours to flip, and
**`SITES_BASE_URL` must ride our NEXT REDEPLOY** — they will not redeploy the app for
an env var.
▎ ▸ **Swordfish channel CLOSED both directions** (closing note written 2026-07-29;
nothing owed either way). Their open items are their own next-session A4
(templates-preview service) and the credential, which waits on the founder's one
word, not on them.
▎ ▸ **Swordfish verified, independently of us:** staging already moved
`630737…` → `5b74b589` at 07:16:33Z carrying revision **`d656d8fc`** — so the OCI
label we landed is live and their film-import commit check is PROVEN against it (fed
a stale commit, refused exit 1 naming both). `ref == :staging` held across the digest
change (25 PASS / 0 FAIL), and **`THALON_VAULT_MASTER_KEY` SURVIVED the auto-deploy**
— the vault key persists across the normal release path, nothing to re-apply.
▎ ▸ **Founder board = 6 open** (one 30-second confirm to swordfish covering BOTH
credentials · Higgsfield credit call · portal URLs · Reddit app · B-crm.4 stealth
call · Wave 3 sequencing). **Reddit values are in the board line,
staging redirect URI corrected in `social-logins.md`.**
▎ ▸ **⛔ SEQUENCE GATE unchanged:** bluesky armed for testing on his recorded words;
every other platform is per-platform + per-post GO; the queue consumer's key rests
EMPTY. **Bluesky is now CONNECTED ON STAGING** (`@steveneam.bsky.social`) on his
explicit yes — the first real credential in that tenant, and the end-to-end proof of
the vault key. **Nothing was posted.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · design is lead-direct, never
delegated · every lane/subagent launch needs fresh founder approval · GATE ON EXIT
CODE, never pipe the suite · vitest does NOT typecheck · **verify-on-merged-main = THE
gate** (it caught this session's red) · research before build (rule 10) · check the
ENVIRONMENT before his hands (rule 11) · platform logins live durably in `.context` ·
no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin, pushed · GitHub Actions billing RESTORED by him and
verified · staging on s85 code + the OCI label · four social channels connected.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync.

## Pointer

CLAUDE.md → this file → `docs/research/ux-refinement-program.md` →
`docs/research/mock-sheets/README.md` → COORDINATION.md → NEEDS-STEVEN.md →
`docs/research/prior-art-portal-automation-s84.md` (READ BEFORE ANY PORTAL WORK).

## Delta (session 84)

s84 made staging the real connect origin, put Instagram + LinkedIn on the dance
(all four channels connected), fixed the site↔workspace doors, and ran the first
ratchet audit. Its handoff's one wrong claim — the "PROVEN" cookie transplant —
was caught and withdrawn at the s85 opener by re-testing rather than trusting.

## Next action — s86, the founder picks at the opener: (a) finish PASS 1 on Schedule · Composer · Channels then batch-sync the canvas (the default, and where the program file says to resume), (b) open the VIDEO ARC early if he wants the editor moving sooner, (c) build the app-side rail rename so the product stops saying Calendar, (d) anything his 5 open board items unblock. Reddit values are ready whenever he gets to it.
