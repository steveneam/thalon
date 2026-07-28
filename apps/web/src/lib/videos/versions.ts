import { nextVersionFor } from "./editor";
import type { CutView, RenderJobView } from "./types";

/**
 * VERSION MANAGEMENT's pure reads (s82 A2/A3/A4) — what the editor's three new
 * version verbs may honestly say, decided here rather than inside the
 * component. No DOM, no I/O, no fetch: every one of these is a fact about the
 * cuts already in hand.
 */

/** The delete verb's minimum: what the surface knows about the cut being edited. */
export interface DeletableCut {
  id: string;
  name: string;
  version: number;
  status: string;
}

/**
 * WHY THIS VERSION CANNOT BE DELETED — the founder's three ratified refusals
 * (plan §3 call #2), mirrored from `videoCuts.remove` in the same order the
 * repo applies them.
 *
 * Mirrored, not duplicated as policy: the repo is where the refusals are
 * ENFORCED (a client cannot talk its way past a transaction), and this is how
 * the surface can ANSWER instead of round-tripping to be told no. When the two
 * ever disagree, the server's verbatim refusal is what the notice band shows —
 * the door is the authority, this is the courtesy.
 *
 * A refusal here must never become a disabled button (s81's standing lesson):
 * the control stays focusable, says `aria-disabled`, and answers with this
 * sentence when pressed.
 */
export function deleteRefusalFor(cut: DeletableCut, cuts: readonly CutView[]): string | null {
  if (cut.status === "approved") {
    return `${cut.name} v${cut.version} is approved — an approved cut carries its judge receipt, and deleting it would delete the evidence that the gate passed.`;
  }
  if (cuts.length <= 1) {
    return `${cut.name} v${cut.version} is this project's only cut — deleting it would leave the project with nothing to open. Deleting the project is a different, deliberate act.`;
  }
  const child = cuts.find((row) => row.id !== cut.id && row.lineage?.parentCutId === cut.id);
  if (child) {
    return `${cut.name} v${cut.version} is the lineage parent of ${child.name} v${child.version} — delete the derived cut first, or its provenance would point at nothing.`;
  }
  return null;
}

/**
 * WHAT SAVING UNDER THIS NAME WILL DO (A2). The save door already derives the
 * version from the name (`planCutSave` → `nextVersionFor`), so a named save
 * needs no new door — but it does need the operator to know which of the two
 * things they are about to do, BEFORE they press:
 *
 *  - a new name starts a variant at v1, the current version untouched;
 *  - an existing name is the next version of THAT cut, which is the same act
 *    the primary button performs and is easy to trigger by accident.
 */
export function variantSaveNote(
  name: string,
  cuts: readonly { name: string; version: number }[],
  currentName: string,
): string {
  const trimmed = name.trim();
  if (trimmed === "") return "A variant needs a name — it is what the version series is counted under.";
  const version = nextVersionFor(cuts, trimmed);
  if (version === 1) {
    return `“${trimmed}” is a new variant — it starts at v1, and ${currentName} is left exactly as it is.`;
  }
  return trimmed === currentName
    ? `“${trimmed}” is this cut — this saves as v${version}, the same as the primary button.`
    : `“${trimmed}” already exists — this saves as v${version} of it, not a new variant.`;
}

/**
 * WHAT IS STILL RENDERING (A4). A render is minutes of local x264 in an
 * in-process registry, so leaving the surface (or reloading it) used to lose
 * every trace of it: the poll started fresh, the player looked idle, and
 * ffmpeg went on working where nobody could see it.
 *
 * The jobs come from the registry's `listRunning(projectId)`, which is why
 * this takes the project's cuts too — a job knows a cut ID, and the operator
 * knows a version.
 */
export function inFlightLine(
  jobs: readonly RenderJobView[],
  cuts: readonly { id: string; name: string; version: number }[],
  currentCutId: string,
): string | null {
  const parts = jobs
    .filter((job) => job.status === "running")
    .map((job) => {
      const cut = cuts.find((c) => c.id === job.cutId) ?? null;
      const which = cut === null ? "another cut" : `v${cut.version}`;
      if (job.kind === "preview") {
        // A preview renders an UNSAVED EDL that lives only in the browser, so
        // a reload has already lost the working copy it belongs to. Saying so
        // beats attaching it to whatever is on screen now.
        return job.cutId === currentCutId
          ? `a preview render for ${which} is still running — it belongs to an earlier working copy, not to this one`
          : `a preview render is still running for ${which}`;
      }
      return job.cutId === currentCutId
        ? `a render is in flight for ${which} — this page picked the job back up and is polling it`
        : `a render is in flight for ${cut === null ? "another cut on this project" : `${cut.name} ${which}`}`;
    });
  return parts.length === 0 ? null : parts.join(" · ");
}

/**
 * The running RENDER this surface should adopt and keep polling. Previews are
 * deliberately never adopted: adopting one would let an unsaved EDL's output
 * land on the cut as its `outputRef` when it finished — an EDL nobody can
 * reproduce, claiming to be the version.
 */
export function adoptableRender(
  jobs: readonly RenderJobView[],
  cutId: string,
): RenderJobView | null {
  return (
    jobs.find((job) => job.status === "running" && job.kind === "render" && job.cutId === cutId) ??
    null
  );
}
