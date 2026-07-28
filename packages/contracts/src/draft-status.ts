/**
 * Draft lifecycle state machine (SPINE §1.1). The transition function in
 * @thalon/db is the ONLY writer of drafts.status; this module is the pure
 * rulebook it consults. `blocked → judging` is the operator-triage exit
 * (an edit is new content, so it re-judges); `queued → judging` is
 * approve-with-edit for the same reason. `published` and `rejected` are
 * terminal.
 *
 * There is deliberately NO "scheduled" status (removed at the s83 window —
 * the s82 ruling made executable): scheduling is a fact about a
 * `publish_queue` ROW, never about the draft, because one draft can be
 * committed to several platforms with several instants at once. The publish
 * door opens for exactly "approved", and a scheduled-then-cancelled plan
 * leaves the draft untouched. History: statuses written before this window
 * were only ever generated/judging/queued/approved/blocked/rejected —
 * nothing ever wrote "scheduled" (verified s82, re-verified s83), so the
 * shrink strands no row.
 */
export const DRAFT_STATUSES = [
  "generated",
  "judging",
  "queued",
  "approved",
  "published",
  "blocked",
  "rejected",
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_TRANSITIONS: Readonly<
  Record<DraftStatus, readonly DraftStatus[]>
> = {
  generated: ["judging"],
  judging: ["queued", "blocked"],
  queued: ["approved", "rejected", "judging"],
  blocked: ["judging"],
  approved: ["published"],
  published: [],
  rejected: [],
};

export function isDraftStatus(value: string): value is DraftStatus {
  return (DRAFT_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: DraftStatus, to: DraftStatus): boolean {
  return DRAFT_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: DraftStatus,
    public readonly to: DraftStatus,
  ) {
    super(
      `invalid draft transition "${from}" -> "${to}" (allowed from "${from}": ${
        DRAFT_TRANSITIONS[from].join(", ") || "none — terminal state"
      })`,
    );
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: DraftStatus, to: DraftStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
