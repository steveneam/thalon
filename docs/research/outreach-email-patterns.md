# Outreach email patterns — web survey (2026-07-17, s52)

> Founder-directed research pass ("search up what good ones look like — B2B, B2C").
> Feeds: `proprietary/prompts/outreach-email-generate.v3.md` (applied same change),
> B-crm.4 back-half design notes (send path, cadence), lead-sourcing intel.
> Sources at the bottom; numbers are vendor-reported benchmarks, not our data —
> our own eval loop replaces them as real sends accumulate.

## First-touch email (applied to prompt v3)

- **Under 80 words with a single CTA** outperforms longer formats ~2.4x on replies;
  elite performers average <80 words. (v1/v2 allowed 60–130; v3 targets 50–90, caps 110.)
- **Subject 6–10 words / 36–50 chars, value front-loaded** — mobile truncates after
  ~6–9 words. (v3 adds the length + front-load rule.)
- **First line is about THEM, from a real signal.** Signal-specific personalization
  ~18% reply vs ~3.4% generic. Our operator-pruned chips (pain point in the lead's
  words) ARE the signal — the judge's grounding gate enforces what the research
  merely recommends.
- **Scraped-signal clichés are burned**: "congrats on the funding round",
  "saw you were promoted", "noticed you're growing quickly", "hope this finds you
  well" — recipients pattern-match these to automation. (v3 adds the avoid-list.)
- Low-friction interest CTA beats meeting asks — the founder's 5–10-minute
  "show you how it works" close (v2) is exactly this pattern.

## Sequences & timing (B-crm.4 cadence notes — NOT prompt content)

- 4–7 touches is the sweet spot; ~58% of replies come from step 1, ~42% from
  follow-ups; the FIRST follow-up alone peaks ~8.4% — the single best step.
- Spacing 3–7 days; a Day 0 / 3 / 10 / 17 cadence captures ~93% of total replies
  by day 10. Each follow-up must add new value, never "just bumping this".
- Wednesday = peak engagement; launch Monday, follow up Wednesday.
- **Small targeted batches win**: ≤50-recipient campaigns ~5.8% reply vs ~2.1%
  for large lists — supports the pinned-shortlist flow, never volume blasts.
  Safe volume ~20–50/mailbox/day; SPF + DKIM + DMARC + warm-up are prerequisites
  before any send path goes live (Resend setup checklist).

## Local-SMB reality check (our ICP: cafés, salons, trades)

- For local owner-run businesses, **cold calling outperforms cold email** —
  owners answer phones during business hours and decide fast. Email is the
  second channel. (Product note: the email door stays our wired channel; a
  call-script artifact per pinned lead is a cheap future companion.)
- Winning targeting: ONE niche + ONE city per campaign (consistent talking
  points and reference work). Aligns with the founder's food/cafés-first
  multiplication preference.
- ~1 in 5 to 1 in 3 small businesses have no website; trades and beauty have the
  highest no-website rates. Active Google Maps listing (fresh reviews, current
  photos) + no website = the highest-signal prospect marker — a B3.12-class
  acquisition signal for later automation.

## Australian compliance (Spam Act 2003 — GATES for the B-crm.4 send path)

- Commercial email needs **consent (express or inferred) + sender identification
  + a functional unsubscribe**. ACMA enforcement is real (AUD 15M+ in penalties
  over recent 18 months).
- **Inferred consent covers our cold-outreach shape ONLY when** the address is
  *conspicuously published* (business website, directory, LinkedIn) **and** the
  message is *directly relevant to the recipient's business role*. Consent is
  NOT inferred from a one-off purchase or an address harvested elsewhere.
- Send-path invariants this implies (record with B-crm.4, enforce at the door):
  1. Every lead carries a **consent-basis field** (where the address was
     conspicuously published — the sourceUrl chip is the natural home).
  2. Every send carries the **sender identification block** and a **working
     unsubscribe**; unsubscribes honoured within the statutory window.
  3. Relevance is already structural (pain-led, judged against the brief) —
     keep it that way.

## Sources

- https://www.autobound.ai/blog/cold-email-guide-2026
- https://martal.ca/b2b-cold-email-statistics-lb/
- https://instantly.ai/cold-email-benchmark-report-2026
- https://www.cleverly.co/blog/cold-email-statistics
- https://woodpecker.co/blog/cold-email-statistics/
- https://www.breakcold.com/blog/cold-email-first-line-opening-lines
- https://www.datablist.com/how-to/personalized-cold-email-first-lines
- https://www.saleshandy.com/blog/how-to-personalize-cold-emails/
- https://getmapleads.io/blog/cold-outreach-strategy-web-agencies
- https://outscraper.com/how-to-find-businesses-without-website-for-cold-outreach/
- https://www.acma.gov.au/avoid-sending-spam
- https://puzzleinbox.com/blog/cold-email-australia-spam-act-2026/
- https://www.corrs.com.au/insights/acma-spam-act-enforcement-and-the-implications-for-business
- https://imisofts.com/blog/cold-email-laws-australia/
