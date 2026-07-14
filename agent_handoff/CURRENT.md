# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-14 (session 31, syd4) · **MINT WEEK OPENED — P0.1–P0.3 SHIPPED (`1d64e05`) + STEP-1 IMAGES MINTED & PINNED (`8abdab5`).** The three factory artifacts are live: `proprietary/templates/meta-prompt.md` (per-vertical slots + design-axis draw + stakes line + `/guide` + repo gates), `proprietary/templates/iteration-pass-checklist.md` (two lanes: fault-hunt + ambition-push, ≥3 passes), `proprietary/prompts/b7.2-shot-list.md` (per-slot prompts, credit classes, **mint ledger**). First-mint paid-terms re-verify **PASSED** (plan `plus` MCP-verified, outputs watermark-free, every pin `licenseTier:"paid"`). 12 `soul_cinematic` mints → **8 keepers pinned** via new `scripts/pin-mint.ts` (B7.1 CLI runner): landing L1–L6 (hero backdrop · features texture · 3 popout backdrops · pricing grain · horizon band · OG base) + B1 blog-hero exemplar. **Total spend 1.44 credits** (0.12/image exact — soul_cinematic is subsidized, not unlimited; image work is effectively free). Balance **1008.56** — the video pool is untouched.

## Resume prompt (session 32, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-14, session-31 wrap.

**Resume · Thalon** — session 32, syd4 — **mint week continues: WIRE the pinned L-set into the landing (step 1 close-out), then step 2 = five template pages via the factory meta-prompt.**

▎ ▸ **Read first:** `CLAUDE.md` → this file → `proprietary/prompts/b7.2-shot-list.md` (mint ledger at bottom) → `proprietary/templates/meta-prompt.md` + `iteration-pass-checklist.md` → COORDINATION.md session-31 message.

▎ ▸ **State:** main = origin @ `8abdab5` · suite untouched since 1126/3/0 (s31 was docs+script+data only) · guard clean · CI/auto-deploy fired ×2 · **8 pinned assets live ONLY in syd4 `.data/objects/`** (content-addressed + provenance manifests; hashes in the ledger) · credits 1008.56/`plus` · leads queue still awaits founder triage · →Email dogfood + first LIVE compose spend check still pending.

▎ ▸ **Session-32 plan:** **(1) Landing wiring decision first** — pinned originals can't reach staging (its volume never sees syd4 `.data`); recommended path: export derived, optimized web copies (webp/avif, sized-to-slot) into `apps/web/public/brand/` (tracked, like the load-bearing demo mp4s) with a small manifest mapping file → pinned hash, originals stay pinned; alternatives (volume seed / S3-now) recorded in COORDINATION s31 note. **(2) Wire L1–L6** behind the existing CSS scenes (vignette product story stays CSS) with ≥3 two-lane passes per the checklist + staging browser-verify (syd4 has no headless-chrome libs). **(3) Re-run `/impeccable critique`** for the trend line (expect ~30–33/40). **(4) Step 2 prep:** draw the 5 wave-1 verticals' design axes + instantiate the meta-prompt (wave plan into COORDINATION); template pages themselves = next sessions, sequential default, **any lane fan-out needs fresh founder go**. Interleave when blocked: dashboard v3 (`workspace-ux-v2.md` §10).

▎ ▸ **Next checkpoint (B-crm.3–6) additions unchanged:** Postgres migration = "B0.5 finally lands" (migrate BEFORE triage/eval rows accumulate; then RLS ratchet) · B-crm.5 shortlist + `matchTerm` word-boundary question · B-crm.3 enrichment provider · B-crm.4 Resend domain-vs-stealth timing · approve/reject undo contract change.

▎ ▸ **[founder] queue:** **glance the 8 minted assets** (ledger in shot-list; originals in `.data/objects/<hash>/asset.png` — say if the dark-cinematic register is right before s32 wires them) · triage the staged leads queue (`preview.swordfish.cfd/app` → Leads) · dogfood the →Email exit · swordfish rotation: swap the Dokploy CI secret when the `FROM-SWORDFISH` note lands · month-end downgrade/cancel decision rides the §6 credit re-assess.

▎ ▸ **Standing:** stealth holds · founder `.env.local` edits arrive BOM+CRLF — normalize · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · any lane/subagent launch needs fresh founder go · `.env.tenant-pg` = syd2-only credential, never tracked · Dokploy deploy key stays CI-secret-only · syd4 has no headless-chrome system libs — staging previews or founder's machine for visual verify · **pinned assets: single copy on syd4 until the S3 driver — don't clean `.data/objects`**.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: both commits pushed (`1d64e05`, `8abdab5`); wrap docs committed on main; no open PRs; no worktrees; no mid-edit state; no dev servers started; all mint jobs terminal, keepers pinned, rejects recorded.

## Pointer

Read in order: `CLAUDE.md` → this file → `proprietary/prompts/b7.2-shot-list.md` → `proprietary/templates/` (meta-prompt + checklist) → `COORDINATION.md` (Sprint-7 board + session-31 message) → visual-uplift proposal §Session-29/30 addenda.

## Delta (session 31)

- **P0.1–P0.3 (`1d64e05`)**: factory meta-prompt v1 (source prompt adapted; checkpoint discipline + pinning + licensing + stealth + honesty gates written in; 10-axis draw menu, wave-unique primaries) · two-lane iteration-pass checklist (≥3 passes, ambition item mandatory) · B7.2 shot-list with per-slot Grip-II prompts + credit classes + first-mint terms checklist. `proprietary/README.md` indexes both families.
- **Step-1 mints (`8abdab5`)**: `scripts/pin-mint.ts` (CLI over B7.1 `pinAsset`) · 8 keepers pinned with full provenance (model/prompt/params/seed/credits/tier/jobId) · ledger + rejects in the shot-list · terms re-verified at first mint.
- Learned: `soul_cinematic` = 0.12 credits exact per image (preflight `get_cost:true` works); vendor mint URLs confirmed CloudFront, downloaded + pinned same-turn; L-set register (near-black + amber, sail motif) landed on-brand first take for 6 of 8 slots.

## Next action

Session 32: **landing wiring decision → wire L1–L6 (two-lane passes + staging verify) → impeccable re-critique → wave-1 template prep.** Founder at their pace: asset glance · leads triage · →Email dogfood · rotation swap when the note lands.
