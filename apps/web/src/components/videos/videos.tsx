"use client";

import "@/components/videos/videos.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  FILTERS,
  cardDate,
  cardPoster,
  family,
  headlineCut,
  passesFilter,
  projectKind,
  provenance,
  runtime,
  statePill,
  type FilterId,
} from "@/components/videos/videos-model";
import { srcOf } from "@/lib/media/resolve";
import {
  fetchProjectDetail,
  fetchProjectSummaries,
  renameProject,
  restoreProject,
  retireProject,
} from "@/lib/videos/client";
import type { ProjectDetail, ProjectSummary, RetiredProjectView } from "@/lib/videos/types";
import { useListKeys } from "@/lib/workspace/keyboard";

type ReadStatus = "loading" | "error" | "success";

/** A project whose own record could not be read — never a project with nothing in it. */
const UNREADABLE = "unreadable";
type ProjectRecord = ProjectDetail | typeof UNREADABLE;

/**
 * Videos overview — STEP 2 of the two-step rebuild: the byte-true port of
 * Videos Overview.dc.html with the real project list behind it. The sheet
 * owns every band, class and copy grammar; this layer only decides what is
 * TRUE to render:
 *
 *  - the grid is every registered video project, each card speaking for its
 *    HEADLINE cut (the furthest-along one) so the state pill, the runtime
 *    badge and the provenance stamp can never describe different cuts;
 *  - the state pill says what the engine records — draft · rendered ·
 *    approved — because no publish path carries a video to a platform, so
 *    the sheet's "published"/"live on 3" would be an invented state;
 *  - the family line carries the three derivative dimensions this engine
 *    actually has (versions · aspect cuts · takes); platform renders are
 *    named once in the closing record line rather than implied zero on
 *    every card;
 *  - the poster is the project's own take frame (s96 — the B-media.0
 *    posters are on the wire; the s75 "placeholder until bmedia ready" hold
 *    is spent), and a card with no frame says "no preview yet" in WORDS —
 *    the amended sheet's deliberate no-preview tile, never a blank;
 *  - importing media has no browser door: the band keeps the sheet's exact
 *    chrome and the two buttons open the disclosure that names the real
 *    path, instead of offering an upload that does not exist;
 *  - an unreadable project record is a READ state on its own card, never a
 *    project silently rendered as empty.
 *
 * Keeper woven back in (old-design-keepers, s73): the one list keyboard
 * grammar — j/k move · ↵ open — marking the picked card with the sheet's
 * own `.row.sel` accent. Nothing is selected at rest.
 */
export function VideosOverview() {
  const router = useRouter();
  const [status, setStatus] = useState<ReadStatus>("loading");
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [records, setRecords] = useState<Map<string, ProjectRecord>>(new Map());
  const [filter, setFilter] = useState<FilterId>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [readAt, setReadAt] = useState(0);
  const pickedRef = useRef<HTMLAnchorElement | null>(null);
  /*
   * Window 0026 — the project doors. `renaming` is the card whose name is
   * being edited (and the draft text), absent at rest like every other state
   * on this surface; `notice` carries a door's own sentence, because a
   * refusal here (a name collision) is an ANSWER the operator must read
   * rather than a silent no-op.
   */
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [retiredProjects, setRetiredProjects] = useState<RetiredProjectView[]>([]);
  const [retiredOpen, setRetiredOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [busy, setBusy] = useState(false);

  // The list read carries names and counts; a card's STATE lives on its cuts,
  // which only the per-project record read has. At browse scale that is the
  // same shape the server-side summary already uses (a handful of projects,
  // each read once) — a counts/status column on the list door would retire
  // this, and is flagged for the next contract window.
  const load = useCallback(
    () =>
      fetchProjectSummaries()
        .then(({ projects: list, retired }) =>
          Promise.all(
            list.map((project) =>
              fetchProjectDetail(project.id)
                // A 404 here means the row vanished between the two reads —
                // unreadable, which is what the card says, not "empty".
                .then((detail): [string, ProjectRecord] => [project.id, detail ?? UNREADABLE])
                .catch((): [string, ProjectRecord] => [project.id, UNREADABLE]),
            ),
          ).then((read) => {
            setSummaries(list);
            setRetiredProjects(retired);
            setRecords(new Map(read));
            setReadAt(Date.now());
            setStatus("success");
          }),
        )
        .catch(() => setStatus("error")),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const cards = summaries.map((summary) => {
    const record = records.get(summary.id) ?? UNREADABLE;
    const detail = record === UNREADABLE ? null : record;
    const cut = detail === null ? null : headlineCut(detail.cuts);
    return { summary, detail, cut };
  });
  const shown = cards.filter(({ detail, cut }) =>
    // An unreadable record has no state to match — it stays visible under All
    // (with its read failure said out loud) rather than vanishing silently.
    detail === null ? filter === "all" : passesFilter(cut, filter),
  );

  // Derived, not effect-synced: filtering away the picked card simply leaves
  // nothing picked until the operator moves again.
  const picked =
    pickedId !== null && shown.some(({ summary }) => summary.id === pickedId) ? pickedId : null;

  const move = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (shown.length === 0) return;
    event.preventDefault();
    const current = shown.findIndex(({ summary }) => summary.id === picked);
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), shown.length - 1);
    setPickedId(shown[next].summary.id);
  };
  useListKeys({
    enabled: status === "success",
    bindings: {
      j: move(1),
      k: move(-1),
      Enter: (event) => {
        if (picked === null) return;
        // A focused control owns its own Enter — the filters and the import
        // disclosure must still act after the operator has moved with j/k.
        // `[role="button"]` joined the list at window 0026: the card's own
        // Rename…/Retire doors are role-bearing spans (anchor-in-anchor is
        // invalid), and without it Enter on a focused Retire would fire the
        // door AND navigate into the project it just retired.
        if (
          (event.target as HTMLElement | null)?.closest(
            'button, a, [role="link"], [role="button"]',
          )
        )
          return;
        event.preventDefault();
        router.push(`/app/videos/${picked}`);
      },
      // The rest state ("nothing selected") is reachable again — a pick
      // without a way back is a one-way door (s99 fe-check).
      Escape: (event) => {
        if (picked === null) return;
        event.preventDefault();
        setPickedId(null);
      },
    },
  });
  useEffect(() => {
    pickedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [picked]);

  /**
   * Window 0026 — RENAME. The refusal (a name collision) is the repo's and
   * arrives as a 409 carrying its sentence; it goes in the notice band
   * verbatim and the field STAYS OPEN with the rejected name still in it, so
   * the operator edits rather than retypes.
   */
  function commitRename() {
    if (renaming === null) return;
    const { id, draft } = renaming;
    const name = draft.trim();
    if (name === "") {
      setNotice({ text: "A project needs a name — it is what the record is filed under.", tone: "err" });
      return;
    }
    setBusy(true);
    renameProject(id, name)
      .then((outcome) => {
        if (!outcome.ok) {
          setNotice({ text: outcome.error, tone: "err" });
          return;
        }
        setRenaming(null);
        void load();
        setNotice(
          outcome.changed
            ? { text: `Renamed to ${outcome.name}.`, tone: "ok" }
            : { text: `Already called ${outcome.name} — nothing to change.`, tone: "ok" },
        );
      })
      .catch((err: unknown) =>
        setNotice({ text: err instanceof Error ? err.message : "the rename refused", tone: "err" }),
      )
      .finally(() => setBusy(false));
  }

  /** Window 0026 — RETIRE a project: off the grid, whole tree intact, reversible below. */
  function onRetireProject(summary: ProjectSummary) {
    setBusy(true);
    setNotice(null);
    retireProject(summary.id)
      .then((outcome) => {
        if (!outcome.ok) {
          setNotice({ text: outcome.error, tone: "err" });
          return;
        }
        setPickedId(null);
        void load();
        setNotice({
          text: `Retired ${summary.name} — its takes, cuts and renders are untouched. Restore it under “Retired projects”.`,
          tone: "ok",
        });
      })
      .catch((err: unknown) =>
        setNotice({ text: err instanceof Error ? err.message : "the retire refused", tone: "err" }),
      )
      .finally(() => setBusy(false));
  }

  /** Window 0026 — RESTORE: the whole tree comes back exactly as it left. */
  function onRestoreProject(project: RetiredProjectView) {
    setBusy(true);
    setNotice(null);
    restoreProject(project.id)
      .then((outcome) => {
        if (!outcome.ok) {
          setNotice({ text: outcome.error, tone: "err" });
          return;
        }
        void load();
        setNotice({ text: `Restored ${project.name} — back on the grid, whole.`, tone: "ok" });
      })
      .catch((err: unknown) =>
        setNotice({ text: err instanceof Error ? err.message : "the restore refused", tone: "err" }),
      )
      .finally(() => setBusy(false));
  }

  const countPill =
    filter === "all"
      ? `${summaries.length} project${summaries.length === 1 ? "" : "s"}`
      : `${shown.length} of ${summaries.length} projects`;

  return (
    <div
      className="content videos-surface"
      style={{ gap: 16 }}
      // The band invites "Drop a video… or paste a URL" but no upload door
      // exists yet — the browser default would NAVIGATE AWAY from the
      // workspace on a drop (s99 fe-check). The invited gesture lands on the
      // honest answer instead: the disclosure naming the real import path.
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        setImportOpen(true);
      }}
      onPaste={(e) => {
        const paste = e.clipboardData;
        if (paste.files.length > 0 || paste.getData("text/plain").trim().length > 0) {
          setImportOpen(true);
        }
      }}
    >
      {/* j/k selection is a silent context change for screen readers without this. */}
      <p aria-live="polite" className="sr-only">
        {picked === null
          ? ""
          : `Selected ${shown.find(({ summary }) => summary.id === picked)?.summary.name ?? ""}`}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Videos</h1>
        {status === "success" && (
          // The pill's box is sized by its WIDEST text for this dataset (the
          // invisible sizer), so narrowing the filter never reflows the seg
          // under the pointer — reserve the box, then fill it (s99 fe-check).
          <span className="pill pill-idle count-pill">
            <span className="count-sizer" aria-hidden="true">
              {`${summaries.length} of ${summaries.length} projects`}
            </span>
            <span>{countPill}</span>
          </span>
        )}
        <div className="seg" role="group" aria-label="Project states">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={filter === option.id ? "seg-opt on" : "seg-opt"}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-expanded={importOpen}
          onClick={() => setImportOpen((open) => !open)}
        >
          Import media
        </button>
        <Link className="btn btn-primary btn-sm" href="/app/create?family=video">
          + New video
        </Link>
      </div>

      <div className="imp">
        <div className="imp-box">
          <strong>Bring your own.</strong> Drop a video, images or a music bed — or paste a URL.
          Your files join the media pool beside Thalon-made assets, provenance kept, ready for any
          cut.
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded={importOpen}
          onClick={() => setImportOpen((open) => !open)}
        >
          Browse files
        </button>
      </div>

      {importOpen && (
        <div className="card imp-panel">
          <span className="t-label">How media actually gets in today</span>
          <span>
            There is no browser upload door yet — and no URL registration either, the other half of
            the band’s promise — a project and its takes enter through the import script, which
            walks a folder and registers every file with its disposition and reason:
          </span>
          <span className="t-data">
            npm run videos:import -w @thalon/web -- --root &lt;folder&gt; --name &lt;project&gt;
          </span>
          <span>
            The folder shape is the record: <span className="t-data">keepers/</span> and{" "}
            <span className="t-data">rejects/</span> carry the verdict, a{" "}
            <span className="t-data">beat-NN</span> in the filename carries the slot,{" "}
            <span className="t-data">cuts/</span> holds outputs (a cut is never a take), and{" "}
            <span className="t-data">music-candidates/</span> holds slotless audio. A reject
            without a reason is refused — the reasons are the learning material.
          </span>
        </div>
      )}

      {/*
        Window 0026 — the RENAME band. It lives OUTSIDE the grid on purpose: a
        card is an anchor, and a text field inside one is a field the operator
        cannot reliably click into. The dossier's ☆ Mark band is the same
        shape for the same reason.
      */}
      {renaming !== null && (
        <div className="card" style={{ padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <label className="numfield" style={{ flex: 1 }}>
            rename to
            <input
              autoFocus
              value={renaming.draft}
              disabled={busy}
              onChange={(e) => setRenaming({ ...renaming, draft: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(null);
              }}
            />
          </label>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={commitRename}>
            {busy ? "Renaming…" : "Rename"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(null)}>
            Cancel
          </button>
        </div>
      )}

      {notice !== null && (
        <div className={notice.tone === "err" ? "card notice-band refused" : "card notice-band"}>
          <span className="t-label" role={notice.tone === "err" ? "alert" : "status"}>
            {notice.text}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {status === "error" ? (
        <div className="card">
          <div className="row" role="alert">
            <span className="t-label" style={{ flex: 1 }}>
              Couldn’t read your video projects — this is a read failure, not an empty grid.
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setStatus("loading");
                void load();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      ) : status === "loading" ? (
        <div className="card">
          <div className="row">
            <span className="t-label">Reading your video projects…</span>
          </div>
        </div>
      ) : summaries.length === 0 ? (
        <div className="card">
          <div className="row">
            <span className="t-label">
              No video projects yet — a project arrives with its takes, its versioned cuts and the
              reasons on record. Start one from a prompt, or import a folder you already have.
            </span>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="card">
          <div className="row">
            <span className="t-label" style={{ flex: 1 }}>
              No projects in this state — {summaries.length} registered, none{" "}
              {FILTERS.find((f) => f.id === filter)?.label.toLowerCase()}.
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilter("all")}>
              Show all
            </button>
          </div>
        </div>
      ) : (
        <div className="vgrid">
          {shown.map(({ summary, detail, cut }) => {
            const pill = detail === null ? null : statePill(cut);
            const kind = detail === null ? null : projectKind(detail);
            /*
             * AMENDED s95: a STILL drops its duration badge — a still has no
             * duration, and 0:00 was a claim about time an image does not
             * have. The kind token says image instead.
             */
            const badge = detail === null || kind === "image" ? null : runtime(cut);
            const poster = detail === null ? null : cardPoster(detail);
            const isPicked = summary.id === picked;
            return (
              <Link
                key={summary.id}
                ref={isPicked ? pickedRef : undefined}
                href={`/app/videos/${summary.id}`}
                className={isPicked ? "vcard sel" : "vcard"}
                onFocus={() => setPickedId(summary.id)}
              >
                {/*
                  AMENDED s95 (VEED projects grid): the STATE rides the
                  picture — pill on the thumb, opaquely composited (the s94
                  Sites lesson: subtle tints vanish over real posters). The
                  thumb wears the project's own take frame (s96 — the
                  B-media.0 posters are finally on the wire), and with no
                  frame it says so in WORDS: a deliberate no-preview tile,
                  never a blank or a borrowed image.
                */}
                <div
                  className={poster === null ? "thumb-lg" : "thumb-lg framed"}
                  // The poster rides a custom property so .framed can layer it
                  // OVER the striped placeholder — a poster the store no longer
                  // serves degrades to the stripes, never a silent blank (CSS
                  // backgrounds have no error channel to say more).
                  style={
                    poster === null
                      ? undefined
                      : ({ "--poster": `url("${srcOf(poster)}")` } as CSSProperties)
                  }
                >
                  {poster === null && <span>no preview yet</span>}
                  {pill === null ? (
                    <span className="pill pill-err">record unreadable</span>
                  ) : (
                    <span className={pill.className}>{pill.text}</span>
                  )}
                  {badge && <span className="dur">{badge}</span>}
                </div>
                <div className="vbody">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="t-title" title={summary.name}>
                      {summary.name}
                    </span>
                  </div>
                  <div className="fam">
                    {detail === null ? (
                      <span className="subtle">
                        {summary.cuts} cut{summary.cuts === 1 ? "" : "s"} ·{" "}
                        {summary.keepers + summary.rejects} takes on the list read
                      </span>
                    ) : (
                      family(detail).map((part, i) => (
                        <span key={part.text} style={{ display: "contents" }}>
                          {i > 0 && <span className="sep">·</span>}
                          {part.door && part.target ? (
                            // A DISTINCT door inside the card Link (anchor-in-
                            // anchor is invalid, so a role=link span carries
                            // it): the fact lands ON its evidence — the
                            // dossier disclosure — not the page top (s99).
                            <span
                              role="link"
                              tabIndex={0}
                              className="fam-link"
                              title={`open the ${part.target} on the dossier`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/app/videos/${summary.id}?open=${part.target}`);
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/app/videos/${summary.id}?open=${part.target}`);
                              }}
                            >
                              {part.text}
                            </span>
                          ) : (
                            <span className={part.door ? "fam-link" : "subtle"}>{part.text}</span>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {/* AMENDED s95 (ClickUp): the stamp's first token is the KIND. */}
                    <span className="prov">
                      {detail === null ? (
                        "record unread"
                      ) : (
                        <>
                          <span className="kind">{kind}</span> · {provenance(detail)}
                        </>
                      )}
                    </span>
                    <div style={{ flex: 1 }} />
                    {/* The exact stamp rides BOTH channels — hover title and
                        the accessible name (touch/AT can't open a title). */}
                    <span
                      className="t-data"
                      title={`created ${summary.createdAt}`}
                      aria-label={`created ${summary.createdAt}`}
                    >
                      {cardDate(summary.createdAt, readAt)}
                    </span>
                  </div>
                  {/*
                    Window 0026 — the project doors, in the card's own in-anchor
                    door dialect (a role-bearing span, because an anchor inside
                    an anchor is invalid markup). Retire needs no confirm: it
                    destroys nothing, says so, and the Restore door below is
                    named in the same sentence.
                  */}
                  <div className="fam">
                    <span
                      role="button"
                      tabIndex={0}
                      className="fam-link"
                      title={`Rename ${summary.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setNotice(null);
                        setRenaming({ id: summary.id, draft: summary.name });
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        e.stopPropagation();
                        setNotice(null);
                        setRenaming({ id: summary.id, draft: summary.name });
                      }}
                    >
                      Rename…
                    </span>
                    <span className="sep">·</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="fam-link"
                      title={`Retire ${summary.name} — nothing is deleted, and Restore brings it back whole`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRetireProject(summary);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        e.stopPropagation();
                        onRetireProject(summary);
                      }}
                    >
                      Retire
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          <Link className="newcard" href="/app/create?family=video">
            <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
            <span className="t-label">One prompt → a full cut</span>
            <span className="prov">or import a folder you already have</span>
          </Link>
        </div>
      )}

      {/*
        Window 0026 — RETIRED PROJECTS, the destination the retire notice
        names. Absent at rest (nothing retired = no band at all, not an empty
        one), and a disclosure rather than a section, because it is a way back
        rather than a place to work.
      */}
      {retiredProjects.length > 0 && (
        <div className="card" style={{ padding: 12 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-expanded={retiredOpen}
            onClick={() => setRetiredOpen((open) => !open)}
          >
            Retired projects ({retiredProjects.length}) {retiredOpen ? "▾" : "▸"}
          </button>
          {retiredOpen && (
            <>
              <span className="t-label" style={{ display: "block", marginTop: 8 }}>
                Off the grid, nothing lost — every take, cut and rendered file is exactly where it
                was. Restore brings the project back whole.
              </span>
              {retiredProjects.map((project) => (
                <div
                  key={project.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}
                >
                  <span className="t-title">{project.name}</span>
                  <span className="prov">retired {cardDate(project.retiredAt, readAt)}</span>
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => onRestoreProject(project)}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex" }}>
        <span className="t-label">
          Derivatives never clutter this grid — every project folds its takes, cuts and versions
          behind one card. Open a project for the full family. Platform renders aren’t joined to a
          project yet, so no card claims one.
        </span>
      </div>
    </div>
  );
}
