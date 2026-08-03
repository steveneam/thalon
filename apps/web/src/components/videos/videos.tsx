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
import { fetchProjectDetail, fetchProjectSummaries } from "@/lib/videos/client";
import type { ProjectDetail, ProjectSummary } from "@/lib/videos/types";
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

  // The list read carries names and counts; a card's STATE lives on its cuts,
  // which only the per-project record read has. At browse scale that is the
  // same shape the server-side summary already uses (a handful of projects,
  // each read once) — a counts/status column on the list door would retire
  // this, and is flagged for the next contract window.
  const load = useCallback(
    () =>
      fetchProjectSummaries()
        .then((list) =>
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
        if ((event.target as HTMLElement | null)?.closest('button, a, [role="link"]')) return;
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
