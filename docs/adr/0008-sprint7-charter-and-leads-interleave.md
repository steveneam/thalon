# ADR 0008 — Sprint 7 charter: visual uplift + template portfolio, with the leads-engine interleave

- **Status:** accepted (founder ratification 2026-07-13, session-26 checkpoint, via the verified relay channel)
- **Context home:** `CHARTER.md` (Sprint 7 + amendments A15/A16); proposals ratified: `docs/proposals/2026-07-11-visual-uplift-and-template-portfolio.md` · `docs/proposals/2026-07-13-leads-engine-gated-crm.md`; board record `COORDINATION.md` session-26 message.
- **Relates to:** ADR 0005/0006 (the Sprint-6 shape this sprint builds on) · ADR 0007 (the deploy channel Sprint 7 ships through — now fully automated).

## Context

Sprint 6 closed with its exit criteria met (COORDINATION session-24 entry: three-family exit reviews, the temp-jobDir fix, green suite) and the deploy thread finished end-to-end: staging serves every engine-touching route through the edge, and every push to `main` now auto-deploys through the smoke-gated CI → GHCR → Dokploy → probe pipeline. The engine's spine is ahead of its face — the founder assigned a visual/asset sprint (2026-07-11) and, two days later, a leads-engine idea whose cheapest first cut reuses the spine primitives directly.

## Decisions (founder, 2026-07-13)

1. **Sprint-6 exit RATIFIED.** The suite count of record at exit is **1013 passed / 3 skipped / 0 failed** (deterministic; the session-24 "1050" included `.next/standalone` duplicates, excluded since).
2. **Sprint 7 CHARTERED as proposed (amendment A15)** — phases 0–5 of the visual-uplift proposal become buckets B7.1–B7.4 + B7.a–e (table in `CHARTER.md`). Method rules bind every bucket: assets pinned at mint with provenance manifests (never hotlinked), ≥3 iteration passes + browser-verify per surface, judge/guard/test gates on top, stealth rules hold (neutral hosting, no real domain until the launch call).
3. **Vendor tier decision DEFERRED to 2026-07-14** ("we consider starting tomorrow"). Consequence: Phase-1 *imagery* is blocked until the paid tier lands (free tier = watermarked + vendor promo/training license — never on a shipped surface; MCP smoke-test only). Phase-0 lead work (B7.1 asset-pinning module) proceeds now — it needs no vendor account.
4. **Leads engine APPROVED per recommendation (amendment A16):** B-crm.1 (leads spine) + B-crm.2 (profile scoring + ranked queue) interleave **late in Sprint 7** so the Phase-5 portfolio outreach dogfoods them; B-crm.3–5 (enrichment seam · gated outreach · learn loop) queue for the next checkpoint. Detailed build plan: appended to the leads proposal doc.
5. **Post-migration key rotation GREENLIT** (founder-timed condition met). Console mints are founder-side (runbook: `.context/runbooks/keys.md`, rotation section); on receipt the lead fills staging env via the scoped deploy credential (read-merge-write, never blind overwrite), redeploys, and runs the live trend-sweep + gate re-check.

## Consequences

- **One contract window for Sprint 7 (opinion, carried from the one-window lesson of A13):** the AssetSource contracts (B7.3) and the leads tables (B-crm.1: `leads` + `lead_scores` + the ICP block on the profile schema) land in a **single window** opened at Phase-2 start, then freeze. Late-sprint B-crm work consumes the frozen contract; no second window.
- Sequencing: B7.1 (asset pinning, lead, now) → Phase 1 uplift when the vendor tier lands → contract window → B7.4 factory pilot (3 verticals, founder review) → waves ‖ B7.a–e ‖ B-crm.1+2 late-sprint.
- The template factory *can* fan out into lanes, but the standing rule holds: every lane/subagent launch needs fresh founder approval; default is sequential waves by the lead.
- Publish-paperwork lead times (Meta review, TikTok audit, LinkedIn Community Management) stay a parallel [you] track — they gate a *future* publish bucket, not this sprint.
- No publish path is wired in Sprint 7 (B-crm.4's send path is explicitly next-checkpoint, and it inherits the publish-door review discipline when chartered).
