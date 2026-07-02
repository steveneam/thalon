#!/usr/bin/env pwsh
# ci-grep-guard.ps1 — brand-cleanliness guard.
#
# Fails (exit 1) if any git-TRACKED file references either forbidden upstream brand
# token. The two tokens are assembled from fragments at runtime (below) so THIS file
# never contains the literal strings and therefore never trips its own check — the
# guard can scan itself and pass, and no path is excluded from the grep.
#
# Runs on Windows PowerShell 5.1 and PowerShell 7+. See CI-GUARD.md for rationale.

# Locate the repo root from the SCRIPT's own location, so the guard works no
# matter what the caller's working directory is (CI runs it from repo root; a
# human may invoke it by absolute path from anywhere).
$base = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$root = (& git -C $base rev-parse --show-toplevel 2>$null)
if (-not $root) { Write-Error 'Not inside a git repository.'; exit 2 }

# Assemble the forbidden token alternation at runtime (never a literal on disk).
$tokenA  = 'ea' + 'mos'
$tokenB  = 'se' + 'lom'
$pattern = "$tokenA|$tokenB"

# Grep TRACKED files only — the correct CI semantics (CI only ever sees committed
# files), and it keeps the gitignored .context/ vault pointer out of scope.
#   -I skip binary   -i case-insensitive   -n line numbers   -E extended regex
$hits = & git -C $root grep -I -i -n -E $pattern
$code = $LASTEXITCODE          # git grep: 0 = matches found, 1 = none, >1 = error

if ($code -eq 0) {
    Write-Host "FAIL: forbidden brand token(s) found in tracked files:`n"
    $hits | ForEach-Object { Write-Host "  $_" }
    Write-Host "`nMove the offending content out of tracked files (e.g. into gitignored .context/)."
    exit 1
}
elseif ($code -eq 1) {
    Write-Host "PASS: no forbidden brand tokens in tracked files."
    exit 0
}
else {
    Write-Error "git grep errored (exit code $code)."
    exit $code
}
