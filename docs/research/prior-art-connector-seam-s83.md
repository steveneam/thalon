# Prior-art memo — the connector seam (D1, s83) — rule-10 pass

> Run 2026-07-28 at the s83 boot, inline by the lead per the subagent-approval
> rule. The capability in industry terms: "social platform OAuth connect flow"
> / "social provider abstraction" / "multi-provider posting API". The heavy
> reference study already exists (`s82-PREPLAN.md` §1–§1b, the Postiz deep
> dig); this pass verifies the two proof platforms and license-triages the
> adoptable libraries, so the plan hardens on facts, not memory.

## Verdict table

| candidate | license | verdict | why |
|---|---|---|---|
| **Postiz** (provider interface + generic dance) | AGPL-3.0 | **patterns only** (standing) | The shape of D1; no code crosses, nobody opens their source while implementing. On record in the charter + s82-PREPLAN §4 |
| **Arctic v3** (`arctic` 3.7.0) — OAuth 2.0 auth-code clients, ~60 providers incl. Reddit | **MIT** (npm-verified) | **TAKE** | Exactly the OAuth-dance half: `createAuthorizationURL` / `validateAuthorizationCode` / refresh where the provider supports it, with per-provider quirks (Reddit's Basic-auth token exchange, `duration=permanent`) already encoded. Lightweight, fetch-based, runtime-agnostic. Used INSIDE a connector file as an implementation detail — the `SocialConnector` contract stays ours; Arctic never becomes the seam |
| **@atproto/api** (0.20.34) — official Bluesky SDK | **MIT** (npm-verified) | **TAKE** | Session management (`createSession` → accessJwt/refreshJwt) plus the genuinely fiddly parts: grapheme-aware 300-char counting and RichText facet detection (mentions/links). Raw XRPC through our hardened fetch stays the fallback if the dep misbehaves |
| **snoowrap** (Reddit wrapper) | MIT | **REJECT** | Stale, heavy; we need two endpoints (`/api/submit`, `/api/v1/me`) — our hardened fetch covers them |
| **Nango** (hosted OAuth broker) | ELv2 | **REJECT-for-now** (s70 verdict stands) | The real wall is platform posting-scope review, not OAuth plumbing; ELv2 isolate+swap if ever adopted. Nothing changed |
| **Temporal / queue engines** | — | **HAVE** | s82's queue + sweep-scheduler pattern; decided in the charter |

## The two proof platforms, verified 2026-07

- **Reddit** — developer app creation is instant and self-serve (web-app type,
  redirect URI, no review wall). Auth = OAuth 2.0 code flow; refresh tokens via
  `duration=permanent`; token exchange wants HTTP Basic client auth (Arctic
  encodes this). **Free tier = non-commercial use within 100 queries/min per
  OAuth client** — ample for dogfood on the founder's own account. **⚖ Launch
  gate, flagged not blocking:** commercial use is $0.24/1k calls under a
  hand-reviewed contract; when Thalon runs Reddit for paying tenants, that
  contract is a business step on the B-int/landing track (same class as the
  Meta/LinkedIn review wall — the seam is untouched either way).
- **Bluesky** — app passwords remain live and are the honest v1: no OAuth, no
  app registration, no review wall. `com.atproto.server.createSession`
  (identifier + app password) → short-lived accessJwt + refreshJwt; posting =
  `com.atproto.repo.createRecord` (`app.bsky.feed.post`); 300 graphemes; up to
  4 images via `uploadBlob`. atproto OAuth exists but adds ceremony for zero
  unlock at our scale — **LATER**, trigger: Bluesky deprecating app passwords.

## What the findings change about the plan

1. **The OAuth dance's provider quirks are a solved, MIT-licensed problem** —
   the Reddit connector's auth verbs wrap Arctic instead of hand-rolling, which
   is one fewer place for a 401-shaped surprise. The seam contract is unchanged.
2. **Bluesky's connect flow is NOT the OAuth dance** — it is a two-field guided
   paste (identifier + app password) with validate-on-connect, i.e. the mode-2
   grammar we already ship, kept for app-password platforms. D1's "replace
   token pasting" applies to OAuth platforms; app-password stays a paste by the
   platform's own design, and the contract's flavor field says which is which.
3. **The capability matrix grows two rows** (Reddit: title 300 / body 40k /
   flair; Bluesky: 300 graphemes / 4 images / no native link cards without an
   embed) — W1's schema takes them without change.
4. **No founder-recurring-manual-work step survives**: one-time app creation on
   Reddit (~5 min, his account), one-time app password on Bluesky (~1 min);
   both land in the vault through the existing guided connect. Refresh is the
   tick's job, not his. The burden test passes.
