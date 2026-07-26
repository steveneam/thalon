# agent_handoff — what lives here, and what does not

**The top level holds STANDING files only.** Six of them, each with one owner
and one job:

| file | what it is |
|---|---|
| `CURRENT.md` | the wrap stamp — overwritten every session, never appended |
| `NEEDS-STEVEN.md` | open founder decisions |
| `ROADMAP.md` | the forward plan |
| `ASK-BACKS-FOR-SWORDFISH.md` · `FROM-SWORDFISH.md` | the swordfish channel, both directions |
| `SWORDFISH-ARCHIVE.md` | that channel's history |

**`lanes/` holds per-lane paperwork** — `KICKOFF-*.md` and `WRAP-*.md`. These
are session ephemera: a kickoff is instructions to a lane that has since
merged, and a wrap is its report. They are kept because `COORDINATION.md` cites
them as the record of what each lane actually did, not because anything reads
them at boot.

**Why the split (s78).** The top level had reached **49 files, 43 of them dead
lane paperwork** from every wave since s65 — `WRAP-pub2-drivers.md` was still
sitting beside `CURRENT.md` a dozen sessions after its lane merged. The
founder's call: *"where's your sense of repo hygiene? how you expect to write
good code and build proper products with this mess of a repo"*. He is right —
a directory where the live file is 1-in-8 is a directory nobody can read.

**The rule, and it is enforced:** no `KICKOFF-*.md` or `WRAP-*.md` at the top
level **or at the repo root**, ever, and every `agent_handoff/lanes/…` link in
tracked markdown must resolve. `tests/agent-handoff-hygiene.test.ts` fails the
suite on any of the three, because a documented convention rots and an
executable one does not (AGENTS.md rule 8).

**The root check exists because the first version of this guard missed the very
file the founder named.** `WRAP-pub2-drivers.md` had never been in
`agent_handoff/` at all — it sat at the REPO ROOT from s65, so the cleanup glob
never saw it and this suite went green around it. A guard scoped to the drawer
you just tidied is not a guard. The link check exists because the bulk path
rewrite that accompanied the cleanup pointed four references at the new
location while the file was still at the root — turning one misfiled file into
four dead links, and surfacing five older ones that had been rotting since
their lanes were deleted.

**That file is also the answer to "is it still needed?" — yes.**
`NEEDS-STEVEN.md` cites it as the per-platform **pre-live checklist** for a
first live post. It is live content that had been misfiled, not dead
paperwork.

**When a lane's content still matters, it does not live here.** Move the
durable part into its real home — `COORDINATION.md` for the lane record,
`ROADMAP.md` for what it changed about the plan, `docs/research/` for findings,
a test for anything that must never regress — and let the wrap be history.
Link, don't copy.
