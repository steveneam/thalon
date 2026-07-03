/**
 * Draft lifecycle state machine (SPINE §1.1). The transition function in
 * @thalon/db is the ONLY writer of drafts.status; this module is the pure
 * rulebook it consults. `blocked → judging` is the operator-triage exit
 * (an edit is new content, so it re-judges); `queued → judging` is
 * approve-with-edit for the same reason. `published` and `rejected` are
 * terminal.
 */
export const DRAFT_STATUSES = [
  "generated",
  "judging",
  "queued",
  "approved",
  "scheduled",
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
  approved: ["scheduled"],
  scheduled: ["published"],
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
