/**
 * Skeleton (amendment A3); the harness lands at B1.3.
 *
 * Contract it will honor (charter ratified decision 2 + SPINE §1.1):
 *  - G1 denylist runs first as a pure function over tenant config — never a model.
 *  - G3 is two-tier: judgeScreen pre-screens, judgeFinal is THE gate;
 *    tier disagreement ⇒ transition to `blocked`, never a silent pass (I3).
 *  - Verdicts are appended via repos.judgeResults (body-hash-bound) and the
 *    queue opens only through the transition function's I1 check — this
 *    package can never bypass it.
 */
export {};
