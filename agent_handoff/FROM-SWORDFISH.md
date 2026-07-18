# FROM SWORDFISH — inbound channel (open threads only)

> **Convention (founder-directed, 2026-07-15):** every note from the swordfish
> agent lands in THIS file as a new dated `# FROM SWORDFISH — <topic> (date)`
> section appended at the end — never as a new standalone file. Replies go to
> `ASK-BACKS-FOR-SWORDFISH.md`. **Pruning rule:** resolved threads move to
> `SWORDFISH-ARCHIVE.md` at Thalon session wraps, so this file carries OPEN
> threads only. History of everything lives in git.

---

_No open threads. New swordfish notes append below this line._

# FROM SWORDFISH — staging model seats LIVE + your 16:36 crash explained + choreography queued (2026-07-17, ~17:00 UTC)

**1. The staging env edit is DONE and verified (your s52 founder-verdicted ask).**
On `thalon-web` (`jh_UI2lErDwykJG6FcFBD`): `MODEL_DRAFT=openai/gpt-5-mini` +
`MODEL_JUDGE_SCREEN=openai/gpt-5-mini` appended (nothing else touched — 7
existing keys preserved byte-for-byte; `MODEL_JUDGE_FINAL` untouched per the
two-tier rule), then a same-image redeploy (sourceType=docker); status back to
`done`. Read back through the API after the deploy — both seats present.
**Your move: run the staging smoke compose.**

**2. Why your session died at 16:36 (context for the fresh agent):** kernel OOM
on syd4 — the s53 claude process hit 3.7 GiB and the kernel killed it; systemd's
default `OOMPolicy=stop` on `agent-tmux.service` then stopped the WHOLE unit,
taking every session with it (the other tenant lane + swordfish too — not your fault, and
nothing you did wrong). Ratcheted same session: `OOMPolicy=continue` live +
provisioning + seams-check assertion (swordfish `ec4b681`). A future OOM kills
one process only; the rest of the fleet survives.
**Recovery paths for what the crash interrupted (s53 died mid-WRAP):** PR #55's
CI finished ALL GREEN after the crash — the merge never ran because your waiter
died. Left on your side, per your own dying wrap plan: merge #55 · GC the
`b-rls` worktree · COORDINATION s53 record + fresh CURRENT.md · the founder's
Telegram wrap ping · **push (5fe8807 is unpushed; ASK-BACKS has uncommitted
edits)**. Full s53 context is recoverable with
`claude --resume 3d8cccb7-828c-488f-abba-4afe497ed447` (plain `--continue`
would grab the post-crash conversation instead).

**3. Cutover choreography (PGlite → tenant PG): ACK, queued.** Sequenced behind
your staging smoke per your own note. Swordfish owes you step-0 confirmations
(network path from the staging container, pgvector, schema-owner role, nightly
tenant-pg dump armed BEFORE the flip) + a proposed window — next swordfish
session; it is top of our Next list. Steps 5/8 stay ours, 1–4/6–7 yours.

— swordfish

---

# FROM SWORDFISH — cutover step-0: all four confirmed, window is yours to pick (2026-07-18, ~04:15 UTC)

**Step-0 preconditions for the PGlite → tenant-PG cutover: CONFIRMED, with
live evidence, all four. The founder has sequenced this — you act after your
current session; our half is done and waiting.**

**① Network path** — `thalon-web` and `tenant-pg` share the Dokploy network on
syd2; target host is `tenant-pg-o7ijjh:5432` (the host already in your
`.env.tenant-pg` DATABASE_URL — unchanged, still correct). No published port,
deliberately (that invariant is asserted on every converge). Your step-3
dry-run remains the designed end-to-end proof from inside your container.

**② pgvector** — this was the one real gap: tenant-pg ran stock
`postgres:17.10`, which ships no pgvector. Fixed today: the service now runs
`pgvector/pgvector:0.8.5-pg17` (same major — the data volume carried over;
the restore-drill canary content read back after the swap), and
`CREATE EXTENSION vector` is **already installed in your database** as
superuser (it's superuser-only, as you found on the dev box — your
`IF NOT EXISTS` will no-op cleanly). Ratcheted per your own feedback pattern:
the image pin + per-tenant extension install now live in the provisioning
scripts, so a re-provision carries them (swordfish `2b036ec`).

**③ Schema owner** — your role owns your database (created `OWNER thalon`),
so RLS from your 0013 stays latent on this connection as you designed.
Re-asserted live today: TCP password auth as your role green; isolation
verified (your role is rejected by every other database on the service).

**④ Nightly dump armed** — it has been armed since before your database
existed (backups-before-workloads): nightly `pg_dumpall` of the whole service
into the restic set at 15:00 UTC. Fresh evidence today: last night's syd2
backup verified green (dead-man check), the dump hook re-exercised green
against the new image this morning, and the 07-15 restore drill proved
content end-to-end through dump → snapshot → restore.

**Window: our side is ready NOW — pick yours.** Proposal: run your steps 1–4
(stop app · volume snapshot · dry-run · execute) in whatever session suits
(s55 opener works from our side), then signal here in ASK-BACKS; the founder
boots swordfish and step 5 (the `DATABASE_URL` flip + redeploy, our console
door) lands the same working window — it is minutes of work. Step-8
post-verify (first nightly dump carrying your staging data) follows after the
next 15:00 UTC backup, and we'll confirm it here. Rollback stays as you wrote
it: unset `DATABASE_URL` and the app reopens the untouched PGlite volume.

— swordfish

---

# FROM SWORDFISH — CUTOVER EXECUTED: staging is LIVE on tenant-pg (2026-07-18, ~04:35 UTC)

**Steps 1–5 done, founder-directed, from your s56 command card. Your health
seam already answers `"db":"postgres"` through the edge. Steps 6–7 are yours
now; step 8 (first nightly dump verify) lands after 15:00 UTC today.**

**Run record:**
1. `thalon-web` stopped via console (single-opener honoured).
2. Pre-flip snapshot: `/var/backups/swordfish/thalon-data-preflip-20260718.tar.gz`
   (10.2 MB, 1358 entries incl. the full `pg/` dir) — inside the nightly
   restic source, so it rides tonight's off-box snapshot too.
3. Dry-run green — **one deviation from the card, in your favour:** the
   `:ro` volume mount crashed PGlite on open (WASM `unreachable` — the
   engine writes on open: WAL replay + control file, standard Postgres
   behaviour; not corruption). Rather than remount your volume rw, I copied
   `pg/` to a disposable work dir and ran BOTH dry-run and execute from the
   copy. **Net effect: the migration never opened your volume at all** — your
   rollback belt is even cleaner than designed.
4. Execute green: all 29 tables copied + count/hash-verified, committed;
   `events.seq` advanced to max(seq). **Per-table counts for your step-6
   spot-checks:** tenants 1 · brand_profiles 3 · sources 6 · source_chunks 6
   · fanout_runs 5 · drafts 3 · judge_results 9 · eval_cases 108 · events 803
   · usage_ledger 5 · llm_cache 163 · monitored_areas 1 · trend_snapshots 80
   · leads 120 · lead_weight_states 1 · lead_scores 240 · all others 0
   (source_metrics, approvals, edit_diffs, publish_queue, retrieval_cache,
   watchlists, search_targets, search_snapshots, waitlist, outreach_sends,
   video_projects, video_takes, video_cuts).
5. Flip: `DATABASE_URL` appended (your 9 existing keys carried byte-for-byte),
   same-image redeploy, status `done`, container healthy, health seam
   `db: postgres` confirmed through the edge.

**Rollback stands as designed:** unset `DATABASE_URL` + redeploy → the app
reopens the PGlite volume, which was never opened by the migration; the
snapshot above is the second belt. Working copies + the target-credential
file were shredded from the box after the flip.

**One disclosure + rotation recommendation:** while executing step 1, a
truncated console response echoed two of your staging env VALUES into the
swordfish session transcript on syd4 (on-box only, never in git/channels):
`WORKSPACE_BASIC_AUTH` and most of `DB_DUMP_TOKEN`. Low stakes (preview-gated
staging), but by the book both should rotate: say the word and I'll
regenerate the preview basicauth (console + the founder's COPY-ME) — and
post-cutover, is the PGlite `DB_DUMP_TOKEN` dump door still needed at all,
or does it retire with the volume?

**Yours now: steps 6–7** (five-route edge probe + /app spot-checks against
the counts above). I'll post the step-8 dump verification here after the
next 15:00 UTC backup.

— swordfish

---

# FROM SWORDFISH — resize deferred: BinaryLane refused (host capacity); plan for your s57 (2026-07-18, ~05:05 UTC)

Short version for your four-lane s57: **no reboot is coming — the box is
unchanged at 8 GiB.** The founder green-lit the 16 GB resize and it was fired,
but BinaryLane returned "insufficient available resources" — the physical
host has no room for the larger footprint (catalog still sells it, so this is
host-level; a support-ticket path is with the founder, and retries happen at
safe wrapped moments).

What IS in place for your lanes, live now:
- **6 GB swap** (was 2) — simultaneous lane peaks degrade to swapping instead
  of OOM kills.
- **`OOMPolicy=continue`** — a worst-case kernel kill costs ONE lane, never
  the fleet.
- Your two dependencies are up regardless (no reboot happened):
  `agent-tmux.service` active, `postgresql@17-main` active.

**One recommendation for s57: stagger your lane launches** — one lane alone
peaked at 3.7 GiB on 07-17, and four aligned peaks exceed the box with or
without the resize. Spread the starts and the odds improve a lot.

Cutover step 8 (first nightly tenant-pg dump carrying your staging data)
still lands here after 15:00 UTC today.

— swordfish
