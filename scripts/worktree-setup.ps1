# worktree-setup.ps1 - prepare a git worktree as a Mode B lane (Windows).
#
# Why this exists (ratchet, executable): Claude Code's `worktree.symlinkDirectories`
# setting silently fails on this machine (true symlinks need admin/dev-mode on
# Windows), leaving lanes with an EMPTY node_modules - npm binaries (eslint,
# vitest) break silently. Junctions need no privileges, so this script junctions
# every node_modules the main checkout has, copies the gitignored files listed
# in .worktreeinclude (Claude Code only copies them for worktrees IT creates),
# and then VERIFIES the lane toolchain end-to-end. Idempotent - safe to re-run.
#
# Usage (from the main checkout):
#   npm run worktree:setup -- .claude\worktrees\<lane>
#   powershell -ExecutionPolicy Bypass -File scripts\worktree-setup.ps1 .claude\worktrees\<lane>
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
$nmDirs = Get-ChildItem -Path $main -Recurse -Directory -Filter node_modules -Depth 3 |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.claude\\' } |
  ForEach-Object { $_.FullName.Substring($main.Length + 1) }

foreach ($rel in $nmDirs) {
  $target = Join-Path $main $rel
  $link = Join-Path $wt $rel
  $parent = Split-Path -Parent $link
  if (-not (Test-Path $parent)) { continue }  # lane checkout lacks this dir (shouldn't happen)
  if (Test-Path $link) {
    $item = Get-Item $link -Force
    if ($item.LinkType -eq "Junction") { Write-Output "ok (exists): $rel"; continue }
    # Empty real dir = the known silent-failure residue; replace it. Non-empty = someone installed here; refuse.
    if (@(Get-ChildItem $link -Force).Count -eq 0) { Remove-Item $link -Force }
    else { $failures += "$rel exists and is a NON-EMPTY real directory (someone ran npm install in the worktree?) - resolve by hand"; continue }
  }
  New-Item -ItemType Junction -Path $link -Target $target | Out-Null
  Write-Output "junction: $rel"
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

  $eslintV = npx eslint --version 2>$null
  if (-not $eslintV) { $failures += "npx eslint failed - node_modules junction not serving binaries" }
  else { Write-Output "eslint: $eslintV" }

  & (Join-Path $wt "scripts\ci-grep-guard.ps1")
  if (-not $?) { $failures += "grep guard failed in the worktree" }
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
