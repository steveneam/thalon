# proprietary/prompts — versioned prompt files

Prompt chains live here as **data files, never inline strings** (SPINE §3.2):
`<name>.v<N>.md`. Bump the version on ANY change — `prompt_version` flows into
generation keys, judge rows, and eval rows, so an unversioned edit silently
breaks provenance and cache correctness. Prompt edits are diffs in PRs.

Empty until B1.2 (fan-out) lands the first chain.
