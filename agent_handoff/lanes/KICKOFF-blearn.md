# KICKOFF — lane `blearn` (B-learn wave 1: knobs as area data · durable cap · honest multi-platform trends)

> **CHARTER + PARALLEL APPROVAL ON RECORD (founder, s72 close): "approve
> b-learn charter. that can be parallel for next session?" — launch at the
> s73 boot WITHOUT re-asking, but ONLY AFTER the lead freezes the B-learn L0
> contract window (this lane builds on those frozen shapes). The lead
> fast-forwards this worktree to the window-freeze commit before launch.**

Read `CLAUDE.md` (repo protocol) first, then:
- `agent_handoff/lanes/WRAP-exemplar-arm.md` § "Contract-window ask" — the L0 spec
  this lane executes against;
- `packages/engine/src/trend/admission.ts` — module header + the "Cap
  honesty" comment (the documented race you close);
- `agent_handoff/ROADMAP.md` §B-learn (CHARTERED s72) — L2 context.

You are on branch `agent/b-learn`. Work ONLY here. The contracts/db shapes
you consume are EXACTLY the ones the lead's window froze — invent no schema.

## Mission (three slices, in order)

1. **Admission knobs become AREA DATA.** The frozen window added
   `admission` (the `admissionKnobOverridesSchema` shape) to
   `monitoredAreaConfigSchema`. Make the sweep read per-area overrides from
   the monitored-area ROW config; two-layer resolution unchanged (tenant
   defaults ← row override, field-by-field, the explicit-overrides
   semantics — never `.partial()`). The transitional request-level
   `admissionConfig.areas` override map DEPRECATES: migrate its engine-side
   readers, then remove it (`TREND_ADMISSION_CONFIG` env stays, carrying
   tenant DEFAULTS only). Every existing admission test keeps its meaning.

2. **The UTC-day cap becomes DURABLE.** Replace the read-then-advance
   in-memory count (`countTodayAdmissions` + `capRemaining--`) with the
   window's durable mechanism, so two sweeps racing one tenant cannot
   overshoot. Pin it with a test that today's code cannot pass.

3. **L2 slice 1 — the trends surface stops lying by omission.** The s72
   multi-source soak sweeps every listed driver but ONE per-tenant bundle
   object means the LAST source owns the trends read (documented interim,
   `getTrendSources` header). Give sweep bundles a per-source home and make
   the trends READ (engine + `/api/intel/trends` route only) merge all
   sources honestly — every card already carries `source`; merged read =
   score-ordered union with per-source sweep stamps. **DO NOT touch the
   intel surface UI** — the lead is rebuilding every surface exact-mock
   (plan §5 DOCTRINE 0); your ceiling is the API response shape (additive).

## Constraints

- Zero spend, zero live network in tests (fixture-fetched drivers, fakes).
- Fail-closed floor semantics UNCHANGED (invariant, s68).
- Full `npm run verify` at the repo root before wrap — never filtered,
  never piped through tail. Grep guard before every commit.
- `next dev` cannot run in this worktree (symlinks) — no visual work here
  (you have none anyway).

## Wrap

`agent_handoff/lanes/WRAP-blearn.md`: what shipped per slice, the deprecation
diff (request-level areas map removal), the durable-cap shape, the merged
trends read contract, test deltas. Commit everything on the branch, leave
the worktree clean. The lead merges behind a full post-merge verify.
