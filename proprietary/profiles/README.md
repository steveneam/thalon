# proprietary/profiles — niche/brand profile data

Demo-tenant profile objects (tone, char limits, hashtag/CTA policy, disclosure
string) as **data validated by `brandProfileConfigSchema` in
@thalon/contracts** — never code. The repo ships a generic self/demo tenant
only; any real tenant's profiles are runtime config supplied by the operator
and are never committed.

Empty until B1.2 (fan-out) lands the first generic profiles.
