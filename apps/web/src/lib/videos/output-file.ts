import { rm } from "node:fs/promises";
import { resolveMediaFile } from "./media";

/**
 * DELETING A VERSION'S FILES (s82 A3). `videoCuts.remove` hands back the
 * deleted row's `outputRef` precisely because a repo cannot reach the object
 * store — so this is the caller's half of the bargain, and skipping it would
 * leave a rendered mp4 on disk that nothing in the product can ever name
 * again. A delete that silently orphaned a render is the quieter bug.
 *
 * Server-only (node:fs), and it goes through the media guard rather than
 * joining paths itself: the ref is server-written and therefore trusted, but
 * "trusted" is a claim about today's writers, and containment under the
 * project's media root costs nothing to prove.
 */

export type FileRemoval =
  | { removed: true; ref: string }
  | { removed: false; reason: string };

/** Remove one project-relative file. A file that is already gone counts as removed. */
async function removeUnderRoot(root: string, ref: string): Promise<FileRemoval> {
  const resolved = resolveMediaFile(root, ref);
  if (!resolved.ok) return { removed: false, reason: `${ref}: ${resolved.reason}` };
  try {
    // `force` so an already-missing file is not an error: the row is what the
    // product reads, and a re-run of a half-finished delete must converge.
    await rm(resolved.absPath, { force: true });
    return { removed: true, ref };
  } catch (err) {
    return {
      removed: false,
      reason: err instanceof Error ? err.message : `could not remove ${ref}`,
    };
  }
}

/**
 * Everything on disk that belonged to a deleted cut: its rendered output, and
 * the overwritable working-copy preview written under `cuts/previews/<cutId>`.
 * The preview is included because it is addressed by the cut id — once the row
 * is gone nothing can name that file again either.
 */
export async function removeCutFiles(
  root: string | null,
  cut: { id: string; outputRef: string | null },
): Promise<FileRemoval> {
  if (root === null) {
    return {
      removed: false,
      reason:
        "this box has no media root for the project — the row is gone; any rendered file is on the box that rendered it",
    };
  }
  // Best-effort and unreported: a preview may never have existed, and its
  // absence is not news.
  await removeUnderRoot(root, `cuts/previews/${cut.id}.mp4`);
  if (cut.outputRef === null) {
    return { removed: false, reason: "this version was never rendered — there was no file to remove" };
  }
  return removeUnderRoot(root, cut.outputRef);
}
