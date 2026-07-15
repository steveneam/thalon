/**
 * The ONE selected-row recipe (s40 consistency slice). DESIGN.md §2 already
 * legislates it: Action Blue covers *selection* — so the selected/current row
 * wears the action channel as a quiet blue tint. Muted washes are HOVER only;
 * before this constant existed the approve feed's selected row and any hovered
 * row were indistinguishable (`bg-muted` for both), which is the defect this
 * recipe retires. Every list surface imports this constant instead of
 * restating the classes — pinned by `__tests__/selected-row.test.ts`.
 */
export const SELECTED_ROW = "border-primary/40 bg-primary/5";
