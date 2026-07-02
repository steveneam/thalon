# CI Guard — brand-cleanliness check

This repository ships a hard invariant: it must contain **zero references to the two forbidden upstream brand names** (the portfolio's anchor product and its sibling) in any **git-tracked** file — no files, strings, config, dependencies, or wiring. The engine is generic; it needs neither.

## The check

`scripts/ci-grep-guard.ps1` runs a case-insensitive grep for the two forbidden brand tokens over **git-tracked files only** and:

- prints every offending `path:line`, if any;
- exits **0** when there are zero hits (clean);
- exits **1** when there is at least one hit (fails the build).

Run it locally before every commit, and wire it as a required CI step:

```powershell
pwsh -File scripts/ci-grep-guard.ps1        # PowerShell 7+
# or, Windows PowerShell 5.1:
powershell -ExecutionPolicy Bypass -File scripts/ci-grep-guard.ps1
```

Equivalent one-liner (the semantics the script implements), returning non-zero on any hit:

```bash
git grep -I -i -n -E "$FORBIDDEN" -- . ; test $? -ne 0
```

where `$FORBIDDEN` is the two-token alternation the script assembles at runtime.

## Why tracked-files-only is correct

CI only ever sees **committed** files, so grepping the tracked set is the true guarantee that the *shipped* repo is clean. It also keeps the repo pristine while the local build agent still has full context:

- The vault pointer lives under `.context/`, which is **gitignored**. The research vault's absolute path itself contains a forbidden token, so `.context/` must never be tracked. Because the guard greps only tracked files, `.context/` is correctly out of scope.
- The forbidden tokens are **assembled from fragments at runtime** inside `scripts/ci-grep-guard.ps1` (and referred to only obliquely in this document), so the guard, this file, and the rest of the tracked tree never contain the literal strings and therefore never trip their own check. The guard can scan itself and pass — no path is excluded from the grep.

## What this does NOT do

This is the brand-cleanliness guard only. It is intentionally **not** a full CI pipeline (no lint/test/build orchestration) — that arrives with the charter-approved build. Adding this one guard now keeps the invariant enforceable from commit one.
