/**
 * Where a project's media lives ON THIS BOX: `meta.mediaRoot`, an absolute
 * path written by the import script (`npm run videos:import -w @thalon/web`).
 * Operator/box data, never committed — a project without it browses fine,
 * just with playback off. Pure module (no node imports) so the queries layer
 * can share it.
 */
export function mediaRootOf(meta: unknown): string | null {
  if (typeof meta !== "object" || meta === null) return null;
  const root = (meta as { mediaRoot?: unknown }).mediaRoot;
  return typeof root === "string" && root.startsWith("/") && root !== "/" ? root : null;
}
