# worktree-setup.ps1 - prepare a git worktree as a Mode B lane (Windows + Linux).
#
# Why this exists (ratchet, executable): Claude Code's `worktree.symlinkDirectories`
# setting silently fails on this machine (true symlinks need admin/dev-mode on
# Windows), leaving lanes with an EMPTY node_modules - npm binaries (eslint,
# vitest) break silently. Junctions need no privileges, so this script junctions
# every node_modules the main checkout has (SymbolicLink on Linux - Junction is
# a Windows-only concept and silently materializes NOTHING under pwsh/Linux,
# the s60 lesson), copies the gitignored files listed in .worktreeinclude
# (Claude Code only copies them for worktrees IT creates), and then VERIFIES
# the lane toolchain end-to-end. The verification checks the LINK itself, not
# just `npx eslint` - Node resolves node_modules by walking ancestors, so a
# missing link still finds the repo root's install and hides the failure
# (exactly how the s60 no-op stayed invisible). Idempotent - safe to re-run.
#
# Usage (from the main checkout):
#   npm run worktree:setup -- .claude/worktrees/<lane>          (pwsh 7, both OSes)
#   pwsh -ExecutionPolicy Bypass -File scripts/worktree-setup.ps1 .claude/worktrees/<lane>
#
# Standing rule this pairs with: NEVER run `npm install` inside a worktree -
# npm v7+ deletes a linked node_modules and replaces it with a real folder.
# Installs run in the MAIN checkout only (the junction makes them visible to
# every lane instantly). scripts/guard-worktree-install.mjs enforces this.

param(
  [Parameter(Mandatory = $true)]
  [string]$WorktreePath
)

$ErrorActionPreference = "Stop"
$main = Split-Path -Parent $PSScriptRoot   # repo root (this script lives in scripts/)
$wt = Resolve-Path $WorktreePath | Select-Object -ExpandProperty Path

# Sanity: target must be a git worktree (its .git is a FILE pointing home), not the main checkout.
$dotGit = Join-Path $wt ".git"
if (-not (Test-Path $dotGit)) { throw "$wt is not a git checkout (no .git)" }
if ((Get-Item $dotGit -Force) -is [System.IO.DirectoryInfo]) { throw "$wt looks like a MAIN checkout (.git is a directory) - refusing" }

$failures = @()

# --- 1. Junction every node_modules the main checkout has (discovered, not hardcoded) ---
# Separator classes, not '\' literals - backslash-only patterns never match on
# Linux, so nested node_modules inside the real tree leaked into the link set (s60).
$nmDirs = Get-ChildItem -Path $main -Recurse -Directory -Filter node_modules -Depth 3 |
  Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' -and $_.FullName -notmatch '[\\/]\.claude[\\/]' } |
  ForEach-Object { $_.FullName.Substring($main.Length + 1) }

# Junction on Windows; SymbolicLink elsewhere (needs no privileges on Linux).
$linkType = if ($IsWindows) { "Junction" } else { "SymbolicLink" }

foreach ($rel in $nmDirs) {
  $target = Join-Path $main $rel
  $link = Join-Path $wt $rel
  $parent = Split-Path -Parent $link
  if (-not (Test-Path $parent)) { continue }  # lane checkout lacks this dir (shouldn't happen)
  if (Test-Path $link) {
    $item = Get-Item $link -Force
    if ($item.LinkType -in @("Junction", "SymbolicLink")) { Write-Output "ok (exists): $rel"; continue }
    # Empty real dir = the known silent-failure residue; replace it. Non-empty = someone installed here; refuse.
    if (@(Get-ChildItem $link -Force).Count -eq 0) { Remove-Item $link -Force }
    else { $failures += "$rel exists and is a NON-EMPTY real directory (someone ran npm install in the worktree?) - resolve by hand"; continue }
  }
  New-Item -ItemType $linkType -Path $link -Target $target | Out-Null
  Write-Output "${linkType}: $rel"
  # The link must MATERIALIZE and resolve - a no-op here hides behind Node's
  # ancestor node_modules resolution and only surfaces mid-lane (s60).
  if (-not (Test-Path (Join-Path $link "."))) { $failures += "$rel link did not materialize/resolve - lane would run on ancestor resolution" }
}

# --- 2. Copy .worktreeinclude'd gitignored files if missing (env, vault pointer, local settings) ---
$includes = @(".env", ".claude\settings.local.json")
$includes += Get-ChildItem -Path $main -Filter ".env.*" -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
if (Test-Path (Join-Path $main "apps\web\.env.local")) { $includes += "apps\web\.env.local" }
foreach ($rel in $includes) {
  $src = Join-Path $main $rel
  $dst = Join-Path $wt $rel
  if ((Test-Path $src) -and (-not (Test-Path $dst))) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
    Copy-Item $src $dst
    Write-Output "copied: $rel"
  }
}
$ctxSrc = Join-Path $main ".context"
$ctxDst = Join-Path $wt ".context"
if ((Test-Path $ctxSrc) -and (-not (Test-Path $ctxDst))) {
  Copy-Item $ctxSrc $ctxDst -Recurse
  Write-Output "copied: .context\ (vault pointer - a lane without it has no product context)"
}

# --- 3. Verify the lane toolchain end-to-end (fail loud, never silently degrade) ---
Push-Location $wt
try {
  $email = git config user.email
  if (-not $email) { $failures += "git user.email is empty in the worktree - set it before committing" }
  else { Write-Output "git identity: $email" }

  # Check the lane's OWN link serves binaries - `npx eslint` alone would pass
  # via ancestor resolution even with the link missing (the s60 masking bug).
  if (-not (Test-Path (Join-Path $wt "node_modules/.bin/eslint"))) {
    $failures += "node_modules link is not serving binaries (no .bin/eslint through the link)"
  }
  $eslintV = npx eslint --version 2>$null
  if (-not $eslintV) { $failures += "npx eslint failed - node_modules junction not serving binaries" }
  else { Write-Output "eslint: $eslintV" }

  # (The brand-token grep guard that used to smoke-test here was retired
  #  2026-07-26 by founder call; the eslint/binary checks above remain the
  #  worktree's proof that its node_modules link actually serves.)
}
finally { Pop-Location }

if ($failures.Count -gt 0) {
  Write-Output ""
  Write-Output "WORKTREE SETUP FAILED:"
  $failures | ForEach-Object { Write-Output "  - $_" }
  exit 1
}
Write-Output ""
Write-Output "WORKTREE READY: $wt"
Write-Output "Reminder: npm installs run in the MAIN checkout only (never in a lane - npm would replace the junction with a real folder)."
