# proprietary/profiles — niche/brand profile data

Demo-tenant profile objects (tone, char limits, hashtag/CTA policy, disclosure
string) as **data validated by `brandProfileConfigSchema` in
@thalon/contracts** — never code. The repo ships a generic self/demo tenant
only; any real tenant's profiles are runtime config supplied by the operator
and are never committed.

`linkedin.v1.json` and `x.v1.json` (B1.2) are the first generic profiles —
each one a `platformProfileSchema`-shaped data file (tone, char limit,
hashtag/CTA policy, disclosure string), loaded at runtime by
`packages/engine/src/fanout/profiles.ts`. A tenant's own
`brand_profiles.platformProfiles[platform]` (DB, versioned) always wins when
present; these files are only the shipped generic fallback for the self/demo
tenant. Bump the version (`<platform>.v<N>.json`) on any change — the loader
always picks the highest version present, and the resolved version string is
recorded as provenance on every generated draft's `meta`.

`tenants/` (B2.1) holds shipped tenant run-configs —
`dogfoodInputSchema`-shaped data files fed to `npm run -w @thalon/eval
dogfood -- <path>`. Every file here is validated in CI by the eval suite;
adding a tenant is a data change, never code (Sprint-2 exit criterion).
Two kinds ship: **fictional demo tenants** (`fernwood.v1.json`) and — B6.3 —
**tenant #0's real self profile** (`self.v1.json`: Thalon-markets-Thalon,
ratified decision 3; tracked because the self tenant carries no guarded
tokens, and its `prompt` field is the locked pillar-#1 topic). Its
`identity.style` block (hex colors + font, mirroring the landing tokens) is
the B5.1 composition styling seam — `deriveBrandStyle` reads it at render
time. Any OTHER real tenant remains runtime config supplied by the operator
and is never committed.

`demo-clips/` (B6.3) holds the landing feature-demo clip specs — data files
(hook/beats/cta, `demoClipSpecSchema` in eval) rendered by `npm run -w
@thalon/eval render:demos` through the SAME pillar render pipeline tenants
use ("this demo was rendered by Thalon" is literal). Every file here is
validated in CI by the eval suite.
