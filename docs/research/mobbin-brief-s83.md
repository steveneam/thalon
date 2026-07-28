# Mobbin research brief — the s83 boot sweep (founder-directed, s82 close)

> **Standing facts:** the founder holds a Mobbin **Pro** account (3 months,
> $21/mo — full flow/screen access, use it, don't tiptoe around paywalled
> content). The connector is attached to his claude.ai account, so the tools
> arrive as `claude_ai_Mobbin` in-session. His ask, verbatim shape: *research
> the top app designs (onboarding, web UI/UX, calendar, video editor etc.) for
> a social platform distributor tool — find the most relevant screens, user
> flows, user interface, compare patterns across products and identify what
> the best apps do differently.*

## What Thalon is, for search purposes

A multi-tenant content engine: **generate → judge-gate → approve → schedule →
publish → learn**. Nearest Mobbin categories: social media management /
scheduler (Buffer, Later, Planable, Typefully, Hootsuite, Metricool), AI
content generation, video editing (CapCut, Descript, Veed, Opus Clip),
CRM/workspace tools (Linear, Attio, Notion). Thalon is **web-first** — prefer
Mobbin's web/desktop screens; pull mobile only where a pattern exists nowhere
else.

## Ground rules (read before the first query)

1. **Reference-only, structurally.** Mobbin's screenshots are their content —
   **no Mobbin asset is ever committed to this repo.** Findings are described
   in words + linked by app/flow name. Same licensing hygiene as Postiz:
   patterns, never material.
2. **The sheets are law.** This research feeds (a) the s83 connect-flow UI,
   (b) the D4 sheet wave (Analytics · Calendar→Schedule · composer band ·
   Channels), and (c) founder proposals. It licenses **zero** drive-by
   restyling of shipped surfaces — a finding against a shipped sheet becomes a
   proposal row, not an edit.
3. **A finding that changes no decision is noise.** Every kept finding names
   the Thalon surface + the concrete decision it would change.
4. **Bounded.** ~Half a session, hard stop; the connector seam is the s83
   headline, not this. Top 2–3 products per category, flows over screens.

## The sweep, in priority order

| # | category | products to compare | what to pull |
|---|---|---|---|
| 1 | **Connect-account / integrations flows** — FIRST, s83 builds this | Zapier · Buffer/Later channel-connect · Plaid-style consent · Make | connector gallery layout · per-platform auth steps · error/expired/reauth states · "connected as" chrome · how disconnection warns about downstream schedules |
| 2 | **Composer + per-channel preview** (D4 composer band) | Typefully · Buffer · Planable | per-channel variant tabs vs one-body-many-previews · char-limit/fit affordances (our W1 matrix + fit line) · thread/carousel handling · media attach grammar |
| 3 | **Scheduling calendar + queue** (D4 Calendar→Schedule) | Later · Buffer · Motion or Notion Calendar | how plan-vs-commitment is distinguished (our planned-slot vs queue-row split!) · drag grammar · queue-slot/"best time" suggestions · timezone honesty · week/month density |
| 4 | **Approval workflows** — Thalon's moat surface | Planable (approval-first, THE reference) · Sprout | approval states + who-approved provenance · reject-with-reason · bulk vs per-item · what nobody shows (a *gate that never rewrites* — our opening) |
| 5 | **Analytics** (D4 Analytics sheet, D2 closed-loop) | Buffer Analyze · Metricool · June/Plausible | per-post drill-down · "what worked → do it again" framing · how post metrics link back to the composer |
| 6 | **Video editor timelines** | CapCut web · Descript · Veed · Opus Clip | timeline lane grammar · version/variant management (our A1–A3 verbs) · AI-proposal UX (Descript's transcript-edit = the reference for propose-never-silently-change) · render/export states |
| 7 | **Onboarding / first-run** | Superhuman- and Linear-class + the schedulers' own | path from signup → first connected account → first scheduled post (time-to-value) · empty states that TEACH · what they defer vs demand up front — feeds the eventual tenant-instantiation wizard |
| 8 | **Workspace shells** | Linear · Attio · Notion | rail/nav density · saved views · needs-attention surfacing (our Dashboard "Needs you") · command palettes |

## Method

- Prefer Mobbin **flows** over single screens — sequence is the finding.
- Record the **words** products use (verbs, labels, refusal copy), not just
  layout; naming is half of UX.
- Per finding: *pattern → who does it → verdict* **ADOPT / ADAPT / REJECT /
  NOTE** *→ the Thalon surface + decision it changes.*
- Close the memo with three lists: **table stakes** (everyone does it — we
  must too), **differentiators** (what the best do differently — his explicit
  ask), and **gaps** (what nobody does that Thalon already can: visible judge
  provenance, approval-first with an ungameable gate, media-first approve).

## Deliverable

`docs/research/mobbin-patterns-s83.md` — founder-readable, organized by the
table above, links-not-assets, verdict-tagged, ending with the three lists and
a short "what this changes about D4" paragraph per sheet. Committed same
session; D4 mock work cites it rather than re-deriving.

## Where it flows next (the pipeline, confirmed by the founder s82 close)

The memo is the RAW MATERIAL, never the mock: D4's four sheets are authored in
**claude-design** exactly like every sheet of this era — **Fable 5 authors
design work directly** (standing rule, design-on-Fable-5), the mock goes to
the founder for VERDICT, and only the verdicted sheet gets the exact-mock
build with the screenshot-vs-sheet gate. Mobbin findings inform what the mock
tries; the founder's verdict stays the only thing that makes a sheet law.
