export const SOURCE_KINDS = ["url", "prompt", "doc", "feature"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
