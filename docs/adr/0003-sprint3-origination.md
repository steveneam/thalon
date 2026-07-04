# ADR 0003 — Sprint-3 re-charter: content origination + operator profiles (A6)

- **Status:** accepted (founder, 2026-07-05; shape delegated to lead recommendation)
- **Context home:** `CHARTER.md` (Sprint-3 bucket table + amendment A6)

## Context

The Sprint-2 exit plan assumed the founder would supply a pillar video's caption/SRT for the B2.3 dogfood. At the exit checkpoint the founder corrected the premise: **no pillar video, caption, or SRT exists, and none will be supplied — generating that content is the product.** The engine currently starts at *ingest* (source in → drafts out); the operator needs it to start one step earlier, at *origination*: a prompt, plus the operator's saved profile and optionally their website/GitHub, in → a pillar video **with caption/SRT** out. The founder also framed the product as two features — (1) content creation + posting from prompt + saved profile, (2) viral/trend intel so proven formats can be re-applied — and named a missing UX primitive: **pre-saved, switchable operator profiles** (company, brand, philosophy) so context is never re-supplied per request. Finally, the founder corrected the Remotion licence record: the free licence covers companies of up to 3 people **including for-profit use**, so it is usable now by a one-person company.

Dogfood constraint: the founder's two companies are early-stage, so override volume must come from (a) the origination loop itself across all tenants and (b) viral/trending exemplars, acquired without ToS evasion.

## Decision

1. **B3.8 — profile spine, lean (data before UX).** Rich per-tenant profile shape on the existing `tenants`/`brand_profiles` spine: company facts, brand voice, philosophy, audience, offers, links — runtime data, never code. Seed the generic demo tenant and fictional tenant #2 in-repo; the founder's two real companies enter as runtime data when supplied. Every generation resolves the active profile automatically. The profile **editor/switcher UI is deferred to B3.11** so real origination usage shapes the fields first.
2. **B3.9 — pillar origination.** Prompt + active profile + optional site/GitHub crawl (reusing the B2.5 crawl core; GitHub ingest added) → new `pillar_script` draft format (beats, narration, on-screen text, timing) → G1+G3 judged against the crawled sources + profile → the same Approve queue. Topic/hook selection grounds on the trend/viral research document and operator-dropped exemplars (B2.4 machinery, already live).
3. **B3.10 — Remotion render seam.** Approved script → Remotion composition (brand styling from the profile) → MP4 + **deterministic SRT derived from the authored script** — no ASR for our own content; the `TranscriptProvider`/Whisper driver remains for external media only. TTS voiceover sits behind a seam; the first cut may ship on-screen text + music. Renders are content-addressed. **Remotion licence is downgraded from launch gate to growth gate** (free ≤3-person companies incl. for-profit; gate re-arms on headcount growth; swap path stays behind the render seam).
4. **B3.11 — loop closure + profile UX.** B2.3 dogfood runs on the first *generated* pillar's SRT → clip plans — the waterfall closes with zero founder-supplied media. Profile editor/switcher UI lands here, shaped by B3.9/B3.10 usage. Every override → eval row; green suite gates sprint exit. The Sprint-2 exit review completes inside this bucket (its B2.5 half — the pinned docs-search demo plan — runs as the sprint opener, needing no new code).
5. **Dogfood flywheel (standing, all sprint).** Origination runs across all three tenants generate judged drafts whose approvals/edits are the eval corpus; the founder drops viral/trending posts encountered organically as exemplars (manual intake is ToS-clean). **Pull-trigger B3.12:** if manual exemplar volume runs short, charter a lean official-API trend intake (e.g. YouTube Data API trending/search metadata → exemplar candidates). Acquisition stays official-APIs-only per A5; burner accounts are never scraping identities.
6. **Parallel founder track (no code):** file the LinkedIn + X OAuth developer apps now (B3.1's long pole); gateway credit top-up (origination leans on the judge, so the ratified sonnet final-gate tier is needed this sprint); supply profile content for the two real companies.
7. **Unchanged:** B3.1–B3.7 remain pulled. B3.10 pulls only the render seam forward from B3.3/B3.4 scope; multi-ratio preview and the full demo-video pipeline stay pulled. No publish path is wired anywhere in Sprint 3.

## Consequences

- The engine gains its missing first stage: origination. After B3.11 the compounding loop from ADR 0002 §Consequences becomes fully self-supplying — Thalon writes the pillar, renders it with born-timestamped captions, and waterfalls it into clips, with the operator only prompting and approving.
- Most of Sprint 3 is recombination, not new architecture: B2.5's crawler, B1.2's fan-out, B1.3's judge, and B1.4's queue carry B3.9; the only new surfaces are the `pillar_script` format, GitHub ingest, and the render seam.
- Remotion (remotion.dev licence) enters the repo at B3.10 behind the render seam, with the growth gate recorded in tracked config/docs rather than as a launch blocker.
- Profile-as-data hardens the config-not-code invariant: if B3.9 prompts ever need a hard-coded brand fact, that is a bucket failure, not a shortcut.
- Real-company profile data is runtime input and may contain forbidden portfolio tokens — it is never committed; the grep guard continues to enforce this at the repo boundary.
