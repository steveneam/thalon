export const APPROVAL_ACTIONS = ["approve", "reject", "edit"] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];
