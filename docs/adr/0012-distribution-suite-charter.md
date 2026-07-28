# ADR 0012 — B-dist: the distribution suite charter (the "Postiz charter")

- **Status:** accepted (founder ratification 2026-07-28, session 81, live in
  chat: *"ratify the charter, and go with your recommendations on the rest.
  but we start next session."*)
- **Context home:** `docs/research/distribution-charter.md` (the ratified
  charter — full capability matrix, phases D0–D6, the flying cars); study
  record `docs/research/s82-PREPLAN.md` §1/§1b/§4 (the Postiz dig, repo facts
  verified in code/DB at plan time).
- **Relates to:** ADR 0011 (integrations charter — D1 is B-int.4 pulled
  forward and reshaped) · B-pub.1/2 (the publish door + drivers D0/D1 build
  on) · B-learn (D2's closed loop lands in its eval/exemplar machinery) ·
  the frontend doctrine of record (D4 rides mock → verdict → exact-build).

## Context

Thalon's generation loop (fan-out → judge → approve) is the moat, but the
post-approve half — scheduling, per-platform fit, publishing at scale,
measuring, feeding results back — is half-built: `publish_queue` existed as a
table with no repo, producer, or consumer; drivers carry no per-platform
constraints; `social_publications` records a post id and stops. The reference
study (Postiz, AGPL-3.0 — patterns only, re-implemented, never code) showed a
mature distribution suite with **no brain**: no grounding, no gate, no
learning. The founder widened the take beyond integrations: *"if Postiz has it
and does it better, then take it … don't limit it to just connector work …
this means we need a workspace redesign phase 4/5."*

## Decisions (founder, 2026-07-28)

1. **The charter is ratified as drafted** — the §1 capability matrix's
   verdicts (TAKE / TAKE+ / HAVE / REJECT / LATER) and the D0–D6 phasing are
   the plan of record. Explicit REJECTs stand so nobody re-litigates
   silently: marketplace · cookie-extension posting (ToS) · Temporal (the
   sweep-scheduler pattern stays) · teams/billing before customers.
2. **The lead's recommendations adopted wholesale:**
   - **D4 design wave** starts after s82 wraps: the four sheets (Analytics ·
     Calendar→Schedule · composer band · Channels) are mocked on the canvas
     for founder verdict, running beside D1 engine work.
   - **D1 → D2 order stands**, with the honesty note on record: D2's
     dashboards stay thin until posting is routine, and posting volume is
     gated on the founder's sequence gate + per-platform GOs.
   - **Short links** stay a seam with an empty default; a real shortener
     needs an owned domain = a stealth call reserved to the founder.
3. **Execution begins s82** (D0's three lanes carry their own s81 approval and
   are charter-independent); D1 targets s83.
4. **The flying cars are chartered scope, not stretch:** the closed loop
   (own-post metrics → B-learn, so Intel says the market, analytics says us,
   and the fan-out steers by both) · judge-gated evergreen · RSS entering at
   generation so the gate binds it · measured slotting over folklore.

## Consequences

- Contract windows freeze per phase, before that phase's lanes: D1 (connector
  contract + OAuth state table) · D2 (`publication_metrics` + the
  `postAnalytics` connector verb) · D3 (per-platform settings schemas).
- The connector seam (D1) reshapes the four existing drivers behind one
  contract; proof = Reddit + Bluesky live in the same session (instant
  developer apps, no posting-scope review wall). The Meta/LinkedIn/TikTok
  review wall stays on the ADR-0011 mode-1 track and is untouched by code.
- D4 adds four sheets to the mock-sheet canon under the unchanged doctrine:
  sheet → founder verdict → exact-mock build, screenshot-gated.
- ⛔ The sequence gate binds every phase: nothing arms, posts, or spends
  without the founder's standing per-platform + per-post GOs.
- **A process ratchet rides this ratification** (founder, same message): the
  integrations arc cost him manual platform work that prior-art research
  would have avoided — *"you should have researched the integration part
  first … If I found it tedious, more people out there think the same thing
  and have likely developed an open source solution."* The box-level
  `prior-art` skill (`~/.claude/skills/prior-art/SKILL.md`) + AGENTS.md build
  rule 10 are that lesson made durable: research existing solutions BEFORE
  writing a charter/plan for a new capability family, and BEFORE any plan
  that assigns the founder manual work.
