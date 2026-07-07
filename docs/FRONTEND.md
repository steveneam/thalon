# FRONTEND — landing page + workspace design (pass 3 / Sprint 6)

> Founder-directed 2026-07-06 (planning session); elaboration delegated to lead ("elaborate, imagine and integrate — I trust your best practice and creativity"). Decision record: `docs/adr/0005-pass3-recharter.md`. Charter buckets: Sprint 6, B6.1–B6.7. Reference material (founder-supplied brand mockups + 23 workspace screenshots) lives outside the repo in founder/vault space — described here, never copied in.

## 0. The one design invariant: the 10-second rule

**A first-time visitor or operator must *get it* and be able to act within 10 seconds.** Every surface is tested against this:

- **Landing hero**: one glance communicates "prompt in → posts, videos, pages out, on every platform — and nothing ships without your approval."
- **Workspace dashboard**: one screen answers *what needs me · what is the engine doing · what can I do next*.
- **Every surface**: the primary action is the visually dominant element; the operator always **reacts to visible artifacts** (cards, previews, diffs) — never faces a blank prompt box (the B5.4 doctrine, extended app-wide).
- **Empty states are tutorials**: every empty list explains itself and offers a one-click seeded example (fake drivers make this free).

## 1. Brand direction

- **Verdict on the existing mockup** (founder, 2026-07-06): too corporate — shield + world-map + gold reads enterprise fintech. Dropped.
- **Keep**: the strong THALON wordmark; the amber/gold accent (excellent on dark).
- **New mark**: falcon / wing / talon — the name contains *talon*; the hunting metaphor sells the intel feature ("Thalon watches the horizon and strikes when something's rising"). Deliverable: 2–3 SVG mark concepts, founder picks (B6.1).
- **Palette** *(amended 2026-07-07, founder-ratified — `docs/research/workspace-ux-v2.md` §4)*: the **workspace is light-first** — white/paper base · navy-ink structure · one restrained blue for interactive elements · **amber narrowed to the signal channel** (heat scores, outlier badges, needs-you counts): *blue = you act, amber = the engine found heat*. Rationale: the operator works beside white-background platforms (YouTube/X/FB/GSC) — embedded content must not float on near-black. The **landing stays dark-cinematic** for now (revisit at B6.7); both themes live in the one token set, WCAG AA pinned executable (`tokens-contrast.test.ts`). ~~Dark-first workspace~~ superseded.
- **Continuity**: landing page and workspace share the same design tokens — the site looks like the product.
- **Typography**: a confident geometric sans for display; tabular/mono numerals for metrics (the HUD feel of the references, restrained).

## 2. Landing page (`/`) — founder's 4 sections + conversion mechanics

Founder spec: *keep it simple — 4 sections.* Lead additions are marked **[+]** (founder invited them 2026-07-06).

### §1 Hero + waitlist
- Falcon mark, one-line promise, one-field email capture. No auth (Clerk deferred).
- **[+] Animated product vignette in pure code** (CSS/SVG, no video in the hero — LCP-safe): a prompt materializes → three artifacts fan out (post · video frame · page) → judge tick → approve → platform icons light up. The 10-second story without reading a word.
- **[+] Waitlist mechanics for virality**: signup returns a queue position + a referral link ("skip the line" — referrals move you up). One `waitlist` table (email, referral code, referred-by, position), one API route, per-IP rate limit. No third-party marketing tool.
- **[+] Sticky mini-CTA** after the hero scrolls out (persistent slim bar, single button).

### §2 The three features — side-scroll cards
Founder spec: picture on top, description at the bottom; click → popout with a video/snippet of the feature working.
- Cards: **Intel** (trend cards with "why it's rising" badges) · **Create** (post + video + page from one prompt) · **Everywhere** (cross-platform, approve-then-publish).
- Popout = modal playing a short clip. **The clips are Hyperframes renders — Thalon renders its own feature demos** (the founder's stated reason for wanting Hyperframes). Ship with lightweight placeholder loops; swap in real renders as B6.3 captures them, each captioned **[+]** "this demo was rendered by Thalon" — self-referential proof.
- **[+] A thin 3-step "how it works" strip** inside this section (profile → generate → approve) as the connective story between the cards.
- **[+] Trust framing woven in**: the judge + approve gate is the differentiator vs. spam-cannon AI tools — "every claim grounded to your sources; nothing posts without your click." Lead with it, don't bury it.
- **[+] Script idea, saved for later (founder, 2026-07-08): the end-to-end flow video** — ONE walkthrough clip tracing a real item through the whole product: intel card rises (heat pill + reasons) → operator promotes → context chips land on Create → post/video/page generates → judge verdicts appear → approve click → publish. The "how Thalon works" story as a single continuous narrative rather than three isolated feature clips — natural pillar-video candidate (dogfood: Thalon renders it about itself). **Honesty gate:** the social cross-posting step is B3.1 (not built) — until it ships, the clip ends at the own-site publish (real, live today) with the platform fan-out framed as early-access roadmap, never shown as if it works. Slot it when the video family next gets a render session (B6.3-class work or the B3.1 launch content).

### §3 Pricing / CTA
- Pre-launch: **early-access framing** — tier names + "founding member" waitlist CTA; placeholder prices until founder supplies tiers ([you], non-blocking). Honest copy: no fake "was $99" anchoring.

### §4 FAQ
- Accordion, objection-driven: *Will it post junk under my name?* (approve gate) · *Where does it publish?* (platform list + roadmap honesty) · *Whose AI keys?* (gateway default, BYOK planned) · *Is AI content disclosed?* (G5/AI-Act stance) · *What data do you keep?*
- **[+] Final repeat CTA** under the FAQ (one-field waitlist, same endpoint).
- **AEO/GEO (A13):** the FAQ doubles as the answer-engine surface — `FAQPage` JSON-LD generated from it, answer-first copy; site ships `Organization` JSON-LD + `llms.txt`. Landing copy is written against the manual B6.8 keyword pass; honest-claims rule applies (optimization is claimable, rankings are not — ADR 0006).

### Landing v2 uplift *(added 2026-07-07, founder-directed — `docs/research/workspace-ux-v2.md` §8)*
Structure stays (the 4 sections + mechanics are sound); the craft rises: one hero signature moment (animated headline + depth layer) · honest stats/proof band · "old way vs new way" strip · feature-card spotlight/hover pull · ≤3 micro-interactions. Sources: the MIT landing-template set (section patterns) + ReactBits (signature moments; MIT+Commons Clause, per-component dep/license check at adoption). Lands with composition v2's demo re-cut as one landing revision, then B6.7 deploys it.

### The blog surface (`/blog`) *(added 2026-07-07, founder-proposed — `docs/research/workspace-ux-v2.md` §9)*
A site page (nav/footer link — the landing keeps its 4 sections) publishing regular posts on AI/social-media/marketing tooling + Thalon-related pieces, for SEO/AEO/GEO. It is **where the Page family lands** and **B6.6's dogfood loop**: intel → → Page → judge → approve → publish to our own site (no platform APIs; the social publish path stays pulled). **The posts are made by Thalon's own engine** (founder-confirmed) — self-referential proof per the demo-clips precedent — and each article fans out as social posts when the publisher arms post-Sprint-6. Per-post `BlogPosting` JSON-LD, llms.txt article index, sitemap, RSS. Honesty guardrails: quality-gated cadence ("regularly" until daily is proven), disclosure stance from the FAQ applies, rankings never claimed. Blog v1 (route + lead/founder-authored seed posts) rides the landing-v2 moment; the automated loop is B6.6; GSC measures after B6.7.

### Performance & meta budget
- Static-first (SSG), minimal client JS on `/` (target: interactive vignette + modal player + **one hero moment** — amended 2026-07-07), optimized OG image for link sharing, semantic HTML. The landing page is also the first Vercel deploy target (B6.7).

## 3. Workspace (`/app/*`) — command-center IA

Synthesis of the founder's 23 references (Obsidian AIOS dashboards · BenAI profile dashboard · V.A.U.L.T. HUD · dark command centers · OmniRoute's prompt-left/preview-right). One Next.js app: `/` landing, `/app` workspace. No Clerk yet — dev-seamed identity as today.

> **Wave-3 revision (2026-07-07, founder-ratified — `docs/research/workspace-ux-v2.md` §3):** every intel card becomes a **dossier + launchpad** — ready titles/angles/hook alongside score/reasons/provenance, per-family exits (→ Video · → Post · → Page), and the intel→create handoff upgrades from `?prompt=<text>` to a **structured context object** (capture id → `{title, angle, hook, sourceUrl, areaName, keyword, score}`) rendered on Create as removable context chips. Intel gains a cadence stamp (last swept · next sweep · sweep now). The principle app-wide: *cards are doorways, not reports; context flows forward, never re-asked.* **Scores read as heat grades** (founder direction 2026-07-07, refined same day to an explicit THERMAL scale): a coloured pill — stale-blue · yellow `warm` · orange `rising` · red `hot` (the universal temperature convention; hot deliberately hue-distinct from destructive-red) — with the band word inside the pill and a small magnitude bar for within-band nuance; the exact number demotes to the tooltip. The word-in-pill keeps it colourblind-proof (adjacent-band CVD ΔE ≥ 13 + AA in-pill text, validated). Rationale + values live in `components/intel/heat-grade.tsx` / `globals.css` (`--heat-*`).

### Shell
- Left sidebar (surfaces below) + top bar with **tenant/profile switcher** (feature 3 made visible from day one) and a **needs-you badge** (approve-queue count).
- **[+] Cmd-K command palette** over every action; **[+] dashboard omnibox** ("What do you want to create?") routing to the right family — the references' quick-action decks, formalized.

### Surfaces → backing seams

| Surface | What's on it | Backing (exists today unless noted) |
|---|---|---|
| **Dashboard** | Pulse row (drafts/runs/queue counts; platform metrics join later at B3.5) · needs-you card · quick actions · live activity feed · seam-status card | `events` table · drafts/runs repos · doctor internals |
| **Intel** | Two tabs (A13): **Trends** — monitored-areas manager · trend cards: outlier %-badge + plain-language reasons + engagement ratios · actions: *generate from this*, dismiss (→ eval row) · area filters; **Search** — keyword targets (seeded from profile) · horizon-opportunity cards (position × rising impressions, reasons) · *target this* → generation context | Trends: outlier/longitudinal math + `trend_snapshots`; fake TrendSource keyless; live pollers = B6.5. Search: B6.8 (`search_targets`/`search_snapshots`; GSC live after B6.7) |
| **Create** | Three families; video = existing staged flow (one-prompt & advanced), prompt-left / live-preview-right | staged-flow UI (B5.4) · origination engine |
| **Approve** | Existing queue restyled into the shell · **[+] keyboard triage** (j/k navigate, a/e/r act) · batch approve · **[+] zero-inbox state** | built (B1.4/B2.6) |
| **Profiles** | Editor/switcher: identity, voice, platforms, denylist, topics | `brand_profiles` spine (B3.8); UI = the B3.11 item, lands here |
| **Runs** | Run history, status, `lastError` triage | `fanout_runs` (B4.5) |
| **Settings** | Watchlists/areas config · budget caps · driver-selection readout | `packages/platform` env choke point |

### Stickiness mechanics **[+]**
1. **First-run**: never an empty dashboard — demo tenant pre-seeded; a guided 3-step "first draft" flow (profile → prompt → approve) runs on fake drivers: instant gratification, zero spend.
2. **Visible automation**: the activity feed attributes work to the engine ("Scout flagged 3 rising items in *ai* · 2m ago") with provenance links (event → run → draft). Visibility of automation is perceived value.
3. **Cadence widget**: planned vs. shipped this week + approval streak — operator-grade consistency signal (the references' daily-drivers/heatmaps), not gamification noise.
4. **Reaction-over-authoring** everywhere: candidates to pick from, chips to accept/tweak, diffs to review.
5. **North-star metric**: *time from prompt to first approved draft* — instrumented via the existing `events` spine; every workspace decision optimizes it.

### Parked (recorded, deliberately not in Sprint 6)
"Ask the command center" chat with per-tenant model picker (pairs with pulled B3.14) · scheduled intel digests pushed to email/Telegram (the references' cron-bot pattern) · platform-metrics pulse cards (needs B3.5 analytics join) · public changelog page.

## 4. Build notes

- `apps/web` pins a Next.js with breaking changes — **read `node_modules/next/dist/docs/` before writing frontend code** (per `apps/web/AGENTS.md`).
- shadcn/ui stays the component base; design tokens land first (B6.1) so landing + workspace share them.
- Schema additions this sprint are bounded and additive-only: `waitlist` (B6.1) and monitored-areas config (B6.4); each window re-freezes at merge.
- Every tracked asset stays brand-token-clean (grep guard); founder-supplied reference material is described, never committed.
