# proprietary/prompts — versioned prompt files

Prompt chains live here as **data files, never inline strings** (SPINE §3.2):
`<name>.v<N>.md`. Bump the version on ANY change — `prompt_version` flows into
generation keys, judge rows, and eval rows, so an unversioned edit silently
breaks provenance and cache correctness. Prompt edits are diffs in PRs.

`fanout-generate.v1.md` (B1.2) is the first chain: the fan-out shell's
generation system prompt, read at runtime by
`packages/engine/src/fanout/shell/prompt-file.ts`. `prompt_version` (derived
from the filename) is recorded on every `fanout_runs` row and every
generated draft's `meta` — provenance for next month's eval suite.
