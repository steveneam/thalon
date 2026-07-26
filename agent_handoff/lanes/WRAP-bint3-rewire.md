# WRAP — lane `bint3-rewire` (B-int.3 driver rewire, s71)

Branch `agent/b-int3-rewire`, all three kickoff missions shipped with tests.
`npm run verify` gates: guard PASS, typecheck PASS (all workspaces), lint PASS
(pre-existing warnings only), full suite run recorded in the lane log.

## What shipped

1. **Social arming = tenant data** (`packages/engine/src/integrations/social-arming.ts`).
   The merged env VIEW the untouched ratchet consumes now carries an ARMED
   seat filled from tenant data: `SOCIAL_<P>_ARMED ??= "true"` when the
   platform is PRESENT in the tenant's social config block
   (`socialPublishConfigSchema`, absence = unarmed, exactly as frozen) AND
   its vault credential is `connected`. The env pair became the emergency
   override — literally set, it wins in BOTH directions ("true" force-arms,
   anything else force-disarms; blank stays "unset" per the readEnv rule).
   `resolveSocialPublisher` (registry.ts) is byte-identical in logic — only
   its missing-arm MESSAGE now names the tenant-data path, so refusals name
   the actual knob. Ladder shape, typed refusals, caps, duplicate guard: all
   untouched; rung (c)'s config checks in publish.ts still stand behind the
   env force-arm path. `vaultSocialPublisherResolver` deps widened to
   `SocialArmingDeps` (adds `brandProfiles.getActive`) — the full db Repos
   bundle satisfies it, so the s67 production caller needed zero changes.
2. **Intel drivers vault-first.** New generic merged-view module
   `integrations/env-view.ts` (see table below); `vaultIntelEnvView` opens
   `intel_youtube`/`intel_bluesky` where connected. `getTrendSource` gained
   optional `(env, {fetchImpl})` — passed a view, the keyed drivers read
   their seats from IT; no view = the B6.5 process-env behavior, unchanged.
   `tenantTrendSource(vaultDeps)` (trend/sweep-scheduler.ts) composes the
   two; `runDueSweeps` resolves the source PER TENANT inside the per-tenant
   try (a vault misconfiguration reports verbatim for that tenant and never
   blocks the others; an injected `sweepDeps.source` still skips it all, so
   tests are untouched). The manual Sweep-now caller
   (`apps/web/src/lib/intel/sweep-runner.ts`) wires the identical
   resolution — one table, one wiring. TREND_SOURCE selection stays box
   config; only credential material is tenant data. Driver refusal messages
   now name the Integrations connect path first, env knobs as override.
3. **Outreach transport vault-first.** `vaultOutreachEnvView` fills
   `RESEND_API_KEY` from `newsletter_resend`; `vaultSendTransportResolver`
   = merged view → the UNTOUCHED two-key ratchet. `OUTREACH_SEND_ARMED` is
   deliberately NOT a seat (arming ≠ credentials; test-pinned) — live send
   stays founder-gated exactly as B-crm.4 froze it. No production caller
   exists yet (none did before); the future live-send ops door wires this
   resolver.
4. **Cards honesty** (`integrations/cards.ts`): the env-override badge is
   now derived from the ONE seat table — intel and newsletter destinations
   report their env overrides too (they are vault-first seams now), website
   destinations never do. No more hand-list.

## The precedence table as built (`integrations/env-view.ts` — VAULT_ENV_SEATS)

Env wins where set; a CONNECTED vault row fills the silence; `needs_reauth`
contributes nothing; rows that exist but cannot open throw loud
(`VaultKeyMissingError`), never silent disarming.

| destination | credential field | env seat (override) |
|---|---|---|
| linkedin | accessToken | SOCIAL_LINKEDIN_ACCESS_TOKEN |
| x | accessToken | SOCIAL_X_ACCESS_TOKEN |
| facebook | accessToken · pageId | SOCIAL_FACEBOOK_ACCESS_TOKEN · SOCIAL_FACEBOOK_PAGE_ID |
| instagram | accessToken · igUserId | SOCIAL_INSTAGRAM_ACCESS_TOKEN · SOCIAL_INSTAGRAM_USER_ID |
| newsletter_resend | apiKey | RESEND_API_KEY |
| intel_youtube | apiKey | YOUTUBE_API_KEY |
| intel_bluesky | identifier · appPassword | BLUESKY_IDENTIFIER · BLUESKY_APP_PASSWORD |

Plus the social ARMING seats (social-arming.ts, tenant-data-filled, env
override): `SOCIAL_<P>_ARMED` ← platform in social config block AND
credential connected. `OUTREACH_SEND_ARMED` is intentionally absent.

Pins: `integrations/__tests__/env-view.test.ts` (intel + outreach families:
vault-only · env-only · both-set-env-wins · family walls · needs_reauth ·
loud key-missing · ARMED-never-a-seat · transport refusals),
`social-arming.test.ts` (tenant-data arming, force-arm/force-disarm,
mid-transition dogfood posture, per-platform independence),
`sweep-scheduler.test.ts` (per-tenant resolution with injected fetch, env
override, per-tenant vault-failure isolation), `cards.test.ts` (badge off
the table).

## Mid-transition posture (verified by pins)

Nothing that posts today disarms: env `SOCIAL_<P>_ARMED="true"` + env token
still arms with zero tenant data (the dogfood X 1.0a posture keeps working).
The path OFF env: put the platform in the tenant's social block + connect
the credential in Settings → Integrations, then unset the env pair.

## Contract-window asks

**None.** Mission 1 needed no contract change — `socialPublishConfigSchema`'s
absent-platform-is-unarmed semantics carried the whole rung, exactly as the
kickoff predicted. Contracts and the drizzle schema are untouched.

## What the B-int.2 surface should change in response

- **"Armed" can now be shown honestly per platform.** A social card's armed
  state = platform in the social config block + credential connected (env
  pair overrides). The surface could add an "armed / not armed" line to
  social cards (data: the same two reads the resolver does) — today cards
  only show connection state.
- **The env-override badge got broader**: intel + newsletter cards now
  badge when their env seats are set (dogfood box: YOUTUBE_API_KEY,
  BLUESKY_*, RESEND_API_KEY are likely set → those cards will now show the
  badge honestly). Copy may want to say "credentials from box env" rather
  than anything social-specific.
- **An ARMED-override badge is a candidate**: `SOCIAL_<P>_ARMED` literally
  set is an override the cards do not yet surface (the badge covers
  credential seats only). Worth a line if the founder wants full env-story
  honesty on the card.

## Files touched

- `packages/engine/src/integrations/env-view.ts` (new) · `social-arming.ts` ·
  `cards.ts` · `index.ts`
- `packages/engine/src/social/registry.ts` (message + doc only)
- `packages/engine/src/trend/source-registry.ts` · `sweep-scheduler.ts` ·
  `youtube-source.ts` + `bluesky-source.ts` (refusal messages) · `index.ts`
- `apps/web/src/lib/intel/sweep-runner.ts` · `apps/web/src/lib/approve-queue/actions.ts` (doc)
- `packages/platform/src/env.ts` (doc comments — override semantics)
- Tests: `env-view.test.ts` (new) · `social-arming.test.ts` ·
  `sweep-scheduler.test.ts` · `cards.test.ts`
