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

`tenants/` (B2.1) holds shipped **fictional demo tenant** run-configs —
`dogfoodInputSchema`-shaped data files fed to `npm run -w @thalon/eval
dogfood -- <path>`. Every file here is validated in CI by the eval suite;
adding a tenant is a data change, never code (Sprint-2 exit criterion). Real
tenants remain runtime config supplied by the operator and are never
committed.
