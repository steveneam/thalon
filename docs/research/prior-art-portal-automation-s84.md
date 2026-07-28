# Prior-art memo — better-auth + developer-portal automation (s84)

> Run 2026-07-28 per AGENTS.md rule 10 / ADR 0012. Capability in industry terms:
> "third-party OAuth token acquisition for background posting" / "social API app
> registration automation" / "authenticated browser automation on datacenter IPs".
> Companion to `prior-art-connector-seam-s83.md`.

## Q1 — better-auth (founder ask)

**What it is:** MIT, ~29k stars, very active. A framework for authenticating *your
own app's users* — sign-in, sessions, org/2FA, social login as a consumer of
identity. Its generic-OAuth plugin's design center is "sign a user in via any
OAuth provider"; provider tokens land in its `account` table (plaintext by
default; `encryptOAuthTokens: true` opt-in), and `getAccessToken` auto-refreshes —
**but only inside an authenticated user session**, keyed to its own
user/session/account schema (one account row per user×provider).

**Thalon's need is the other shape:** per-tenant, per-*destination* posting
credentials (a page, a subreddit identity, multiple destinations per platform)
consumed by a background queue with no user session, with platform quirks
better-auth doesn't do (FB long-lived + page-token derivation, Reddit Basic-auth
exchange) already handled by `arctic` + `connect.ts`, and storage already stronger
(AAD-bound AES-GCM envelope vault vs opt-in symmetric). Adopting it would mean
adopting its whole user/session/DB model to get a worse fit. It also does nothing
for the actual blocker (portal registration). **Not a knock on the library — it
answers a different question.**

## Q2 — the portal / captcha blocker

**(a) App registration is NOT automatable** on Meta, LinkedIn, TikTok, or Reddit —
no API, CLI, or Terraform provider; dashboard-only by policy (developer-identity
verification). The class exists where platforms choose it (Entra/Okta/Auth0 have
app-registration APIs + Terraform), proving absence here is deliberate, not a gap
anyone tooled around. Threads apps are created in the same Meta App Dashboard.

**(b) What the products do:** every one registers **ONE app per platform,
centrally**, and onboards all customers purely via OAuth consent. SaaS (Buffer,
Ayrshare, Blotato) = their app; self-hosted (Postiz AGPL, Mixpost MIT) = the
*operator* creates one BYO app per platform, once, then every workspace connects
through it. Ayrshare's BYO-keys option is the exception that proves it: still one
app, owned by the operator. **Implication:** Thalon needs N platforms × 1 app,
owned by the founder, forever — tenants (self or future paying) only ever do a
consent click. App creation never scales with tenants.

**(c) Stealth automation state of the art, honestly:** the captcha loop's root
cause is **IP reputation** — datacenter ASNs get 80–100% challenge rates and
documented endless-grid loops regardless of browser fingerprint. patchright
(Apache-2.0, active) and rebrowser-patches (**no license file**, stale since
2025-05) fix CDP/`Runtime.enable` leaks — the wrong layer. undetected-chromedriver
(GPL-3.0, fading) same class. browser-use (MIT) adds an LLM driver, not IP trust.
The fix that works is residential proxies — an arms race, ToS-adverse (automated
login breaches Meta/LinkedIn ToS regardless of intent), and absurd overhead for a
**one-time** bootstrap. Rejected on ROI, not just posture.

**(d) The boring path wins.** Portal app creation is genuinely one-time per
platform (app ID/secret are permanent). Residual recurring work, which no vendor
on earth escapes: Meta's annual Data-Use-Checkup recert (~15 min/yr, 60-day
notice; missing it disables the app) and one-time App Review per advanced scope.
So: **the founder does the ~10-min portal session per platform in his own
browser** (no captcha — his IP, his cookies), lead dictates every field live and
does everything else; OAuth consent already runs from his own device (proven on
Facebook, s83). Cookie transplant (his export → box's persistent Chrome profile;
`c_user`+`xs` for Meta) is the *fallback* if he prefers the lead to drive the
portal — it skips login (where the captcha lives), both ends are Sydney so geo
delta is small, but a checkpoint remains possible and export needs a transport
(no clipboard bridge). Same-account setup work, not scraping — still gray under
platform ToS; keep it fallback.

## Verdicts

| candidate | license | verdict | why |
|---|---|---|---|
| better-auth (connector/token store) | MIT | **REJECT** | App-user identity framework; session-bound token model, wrong schema, weaker storage than the vault; solves nothing we lack |
| better-auth (future workspace end-user auth) | MIT | **LATER** | Trigger: multi-user tenant logins for the workspace itself |
| arctic + connect.ts + vault | MIT/ours | **HAVE** | Proven live on 3 platforms; per-destination, session-free, AAD-bound |
| Portal-registration automation (any) | — | **REJECT** | No API exists anywhere; one-time cost ≈ 10 min/platform; ROI ~0 |
| One-app-per-platform, consent-only onboarding (Postiz/Mixpost/Ayrshare pattern) | pattern | **TAKE** | Already our shape; makes explicit that app creation never recurs per tenant |
| patchright / rebrowser-patches / u-chromedriver / browser-use for login | Apache-2 / none / GPL-3 / MIT | **REJECT** | Wrong layer (IP reputation), arms race, ToS-adverse, one-time job |
| Founder's own-browser portal session, lead-guided | — | **TAKE** | Deletes the captcha entirely; matches the s83 grant's intent |
| Cookie/profile transplant into box Chrome | — | **LATER** | Trigger: founder prefers lead-driven portal despite checkpoint risk |

## What this changes about the plan

1. **Stop fighting the captcha.** The Threads blocker is resolved by moving the
   one-time portal session to the founder's own browser, lead dictating values
   live — not by stealth tooling. The s83 portal-setup grant survives with the
   *driving seat* swapped for portal steps only.
2. **better-auth is answered:** no adoption for the connector seam; parked with a
   real trigger for workspace auth.
3. **Burden test:** app creation = once per platform (~5 total, no prior art can
   delete it — cite (a)); OAuth consent = inherent, every competitor has it;
   Meta DUC = 15 min/yr, industry-universal → calendar it; App Review prose =
   lead drafts, founder submits; token refresh already automated. No recurring
   founder-manual step survives that prior art could remove.
