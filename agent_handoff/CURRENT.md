# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-14 (session 33, syd4) · **TEMPLATE FACTORY SCAFFOLDING DECIDED (contract: `proprietary/templates/README.md`) + WAVE-1 ① LOOPWELL BUILT, MINTED, AND BROWSER-VERIFIED LOCALLY.** Sites live at `proprietary/templates/sites/<slug>/` (self-contained static + `/guide` + hash-manifested assets via `scripts/export-template-assets.ts`); previews ship as a separate nginx image (`Dockerfile.templates` + `templates-image.yml`, per-site smoke, GHCR `thalon-previews`) with **deploy DORMANT** until the founder creates the neutral Dokploy service and flips `TEMPLATES_PREVIEW_ARMED`. Loopwell = three-ink chart-paper system, live session recorder (client-only, zero network calls), ≥3 two-lane passes logged in its `/guide`, closing-band mint pinned `aee433b6` (0.24cr, ledger in b7.2-shot-list). Suite **1138/3/0** · lint 0 errors · guard clean. Meta-prompt amended (founder direction): full hosted model roster per-slot (seedance 2.0 · nano banana pro/2 · GPT-image class · kling 3.0).

## Resume prompt (session 34, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-14, session-33 wrap.

**Resume · Thalon** — session 34, syd4 — **mint-week step 2 continues: template ② TrueBore Plumbing (physics axis, grocer precedent at `.context/clients/pujusfresh`) through the factory meta-prompt, on the s33 scaffolding.**

▎ ▸ **Read first:** `CLAUDE.md` → this file → COORDINATION.md session-32 (wave-1 plan) + session-33 (scaffolding + Loopwell) messages → `proprietary/templates/README.md` + `meta-prompt.md` + `iteration-pass-checklist.md`.

▎ ▸ **State:** main = origin @ session-33 commits · suite **1138/3/0** · guard clean · credits **~1007.8**/`plus` (video pool untouched) · pinned assets = 13 in syd4 `.data/objects/` (single copy — don't clean) · Loopwell verified locally only (preview service not yet created — founder action below) · headless chrome LIVE (`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`; scroll-walk before full-page shots so lazy images load) · leads triage + →Email dogfood + first LIVE compose spend check still pending · impeccable re-critique still QUEUED on founder go.

▎ ▸ **Session-34 plan:** **(1) ② TrueBore** via the meta-prompt verbatim (primary physics & interaction, secondary brutalist/raw; mints pinned at mint time; ≥3 two-lane passes; local browser-verify; new site dir = the scaffolding contract, tests extend automatically). **(2) If time: ③ Ember & Rye** (cinematic imagery — consider seedance/nano-banana per the restored model roster). **Build under the s33 founder directions: single-file `index.html` default (inline style/script) + be exploratory — scroll-driven scenes/choreography encouraged, perf floors + reduced-motion are the only brakes (both written into README/meta-prompt).** Sequential lead-inline default; **any lane/subagent fan-out needs fresh founder go**. Interleave when blocked: dashboard v3 (`workspace-ux-v2.md` §10) or P0.4/P0.5 (AssetSource window 2 + driver skeleton — still not started).

▎ ▸ **[founder] queue:** go/no-go on the impeccable re-critique agents · triage the staged leads queue · dogfood the →Email exit · month-end downgrade decision rides the §6 credit re-assess. **PARKED (founder call 2026-07-14): the preview-gallery Dokploy service is outreach-only, not a build gate** — templates are reviewed as local files; create the service (+ `TEMPLATES_DOKPLOY_*` secrets, `TEMPLATES_PREVIEW_HOST`, flip `TEMPLATES_PREVIEW_ARMED`) only when pitching wants shareable links; the image already builds+pushes green. ~~impeccable ignore~~ APPROVED + APPLIED s33 (`.impeccable/config.json` ignores `proprietary/templates/sites/**`).

▎ ▸ **Next checkpoint (B-crm.3–6) additions unchanged:** Postgres migration BEFORE triage/eval rows accumulate (then RLS ratchet) · B-crm.5 shortlist + `matchTerm` word-boundary · B-crm.3 enrichment provider · B-crm.4 Resend timing · approve/reject undo contract change.

▎ ▸ **Standing:** stealth holds (neutral names, no real domain; template pages disclose fictional+AI on `/guide`) · founder `.env.local` edits arrive BOM+CRLF — normalize · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · `.env.tenant-pg` syd2-only · Dokploy keys CI-secret-only · detector hook fires on UI edits (hero `text-[3.4rem]` = documented Display step, intentional).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: all session-33 commits pushed; CI green (guard/test/eval/infra + templates-image build+smoke+GHCR, deploy dormant by design); no open PRs; no worktrees; no dev servers; no mid-edit state; suite/build/guard green at HEAD.

## Pointer

Read in order: `CLAUDE.md` → this file → `COORDINATION.md` (Sprint-7 board + session-32/33 messages) → `proprietary/templates/README.md` + `meta-prompt.md` + `iteration-pass-checklist.md` → `proprietary/prompts/b7.2-shot-list.md` (ledgers).

## Delta (session 33)

- **Scaffolding (the once-decision):** `sites/<slug>/` self-contained static; `sites/`-only docroot = the leak boundary (method docs can never reach a prospect host); per-site asset manifest → export ratchet (`export-template-assets.ts`); `tests/template-portfolio.test.ts` (structure/self-containment/manifest-integrity/guide-honesty/leak-boundary, runs at 0 sites and at 25); templates-image.yml mirrors web-image.yml with deploy behind `TEMPLATES_PREVIEW_ARMED`; web-image ignores `proprietary/templates/**`; eslint browser-globals block for site scripts.
- **Loopwell shipped:** data/instrument + exceptional-palette → three-ink chart-paper world (paper/cobalt/signal-red-means-data), live session recorder + closing loop, Archivo+Martian Mono OFL vendored, honest states for reduced-motion/no-script/hidden-tab, 2 mints 0.24cr (keeper `aee433b6`, take-2 reject recorded). Local headless-chrome verify: desktop/tablet/390, reduced-motion, keyboard walk, console clean.
- **Meta-prompt amended** (founder, mid-session): hosted model roster restored (per-slot choice; video = deliberate draws).
- **Lesson (executable where possible):** reveal animations must never gate visibility — Loopwell pass 1 caught charts shipping undrawn in headless; fixed as JS-opt-in `.predraw` + failsafe; the pattern is written into the pass-log and this contract's Lane A expectations.
- **Detector friction recorded:** impeccable hook audits template sites against Thalon's DESIGN.md → false-positive class; unsuppressed per standing rule; founder decision queued (path ignore vs per-site DESIGN.md).

## Next action

Session 34: **② TrueBore through the factory prompt on the s33 scaffolding → ③ Ember & Rye if time.** Founder at their pace: preview service creation + arming · impeccable path-ignore approval · re-critique go/no-go · leads triage · →Email dogfood.
