# KICKOFF — lane `bint3-rewire` (B-int.3 driver rewire, s70b)

You are a Mode B build lane in a git worktree on branch `agent/b-int3-rewire`.
Work ONLY here. Read `CLAUDE.md` (repo root) first — every rule in it binds
you, especially the grep-guard constraint and no-AI-attribution. Launch
approval: founder, s70b ("parallel work flow... one for the B-int work").

## Mission

ADR 0011's B-int.3: **arming moves onto tenant data; every credentialed seam
resolves vault-first by tenant.** Today only the social production caller
resolves vault-first (`vaultSocialPublisherResolver`); intel sweep drivers and
the outreach transport still read env directly, and social arming still
requires the `SOCIAL_<P>_ARMED` env flags. After this lane:

1. **Social arming = tenant data.** The refusal ladder's "unarmed platform"
   rung reads: platform PRESENT in the tenant's social config block
   (`socialPublishConfigSchema` — an absent platform is already defined as
   the unarmed rung, so NO contract change is needed) AND the destination's
   vault credential `connected`. The `SOCIAL_<P>_ARMED` env pair becomes the
   emergency OVERRIDE (env wins where set — B-int.1 precedence semantics),
   not the requirement. The ladder's SHAPE (typed refusals, per-platform
   caps, duplicate guard) is untouchable.
2. **Intel drivers vault-first:** the sweep scheduler's YouTube/Bluesky
   driver resolution opens `intel_youtube` / `intel_bluesky` from the vault
   where connected, env seats as override — same merged-view pattern as
   `vaultSocialEnvView` (extend it or mirror it; one precedence table, one
   set of tests).
3. **Outreach transport vault-first:** `newsletter_resend` from the vault,
   `RESEND_API_KEY` as override. The B-crm.4 two-key arming discipline
   (`OUTREACH_SEND_ARMED`) stays exactly as is — arming ≠ credentials here;
   live send remains founder-gated.

## Read first

1. `docs/adr/` — the 0011 integrations ADR (decision of record).
2. `packages/engine/src/integrations/vault.ts` + `social-arming.ts` — the
   doors and the existing vault-first merged-view precedent (env wins).
3. `packages/engine/src/social/registry.ts` + `publish.ts` — the arming
   ratchet + refusal ladder you are re-rooting (shape frozen).
4. `packages/engine/src/trend/` — sweep scheduler driver resolution.
5. `packages/engine/src/outreach/transport.ts` — outreach transport seam.
6. `packages/contracts/src/social.ts` — `socialPublishConfigSchema` (FROZEN,
   as is ALL of `packages/contracts` + the drizzle schema; if you believe a
   contract change is needed, STOP and write it in your wrap instead — but
   see Mission 1: the absent-platform-is-unarmed semantics already exist).
7. `packages/engine/src/integrations/cards.ts` — the surface's env-override
   flag; when a platform arms via vault+tenant-data, the card's env-override
   badge should reflect only a REAL env override.

## Discipline

- Tests with code at every seam (the precedence table gets its own pins:
  vault-only · env-only · both-set-env-wins · neither-refuses).
- Zero live platform calls — injected fetch fakes only.
- The dogfood tenant's CURRENT posture must keep working mid-transition:
  env-armed platforms stay armed (override semantics) — nothing that posts
  today may silently disarm.
- `npm run verify` green before your wrap (suite backgrounded, guard/
  typecheck/lint foreground; NEVER pipe gate output through tail/grep).
- Commit on your branch with clean conventional messages; the lead rebases,
  reviews, and merges. Do NOT push to main.

## Wrap

Write `agent_handoff/lanes/WRAP-bint3-rewire.md`: what shipped, the precedence
table as built, any contract-window asks, and anything the Integrations
surface (B-int.2, shipped s70) should change in response.
