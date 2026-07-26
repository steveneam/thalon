"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SHELF_DEFAULTS,
  SHELF_SORT_WORDS,
  applyShelfFilters,
  dayStamp,
  parseTags,
  shelfNarrowed,
  shelfTags,
  sourceFacts,
  sourceLead,
  topRelevance,
  transcriptStamp,
  webOrigin,
  type ShelfFilters,
  type ShelfSort,
} from "@/components/transcription/transcription-model";
import { SourceThumb } from "@/components/media/source-thumb";
import { deleteSource, fetchLibrary, fetchTranscript, ingestVideo } from "@/lib/library/client";
import {
  EXPORT_BUILDERS,
  formatTimecode,
  hasTimings,
  toMarkdownBrief,
  type BriefInfo,
  type ExportFormat,
} from "@/lib/library/export";
import { useListKeys } from "@/lib/workspace/keyboard";
import type { LibraryPayload, LibrarySourceRow, TranscriptPayload } from "@/lib/library/types";

type ReadStatus = "loading" | "error" | "success";

/** What the ingest box's advertised drop will actually read (see `acceptDrop`). */
const CAPTION_EXTENSIONS = [".srt", ".vtt", ".txt"];

/**
 * Transcription, rebuilt exactly from Library.dc.html (DOCTRINE 0 — the sheet is
 * the blueprint): the headline + source count, the ingest band, one card of
 * source rows (thumb → lead/facts → copy/export doors → day stamp), and the
 * per-tenant grounding footer.
 *
 * Step 2 wires the EXISTING library clients (no API changes) and weaves the
 * old surface's keepers back in BEHIND byte-true resting chrome: the ingest
 * door is the sheet's own box+button, and the operator extras it grew
 * (tags, pasted captions, the transcript seam's honest readout) unfold only
 * once the operator engages the box; the transcript doors (read, copy the
 * Markdown brief, .md/.txt/.csv/.srt export) and Delete live in the panel a
 * row opens — the sheet draws no panel at rest, so neither do we. The one
 * list keyboard grammar rides the sheet's `.row.sel` (j/k move · ↵ open ·
 * d delete, still behind the named confirm).
 */
export function Transcription() {
  const [status, setStatus] = useState<ReadStatus>("loading");
  const [payload, setPayload] = useState<LibraryPayload | null>(null);
  const [url, setUrl] = useState("");
  const [captions, setCaptions] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [ingestOpen, setIngestOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Neutral channel for what a dropped file did — refusals stay in actionError. */
  const [dropNote, setDropNote] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPayload | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // The selection is a SOURCE, not a position. Ingest prepends and delete
  // removes, so an index re-points at a different source after every one
  // of them — and the Copy/Export buttons act on the row the index lands
  // on (keyed-by-entity sweep, s78). null = the operator hasn't moved yet.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ShelfFilters>(SHELF_DEFAULTS);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now] = useState(() => new Date());

  const load = useCallback(
    () =>
      fetchLibrary()
        .then((data) => {
          setPayload(data);
          setStatus("success");
        })
        .catch(() => {
          setStatus("error");
        }),
    [],
  );

  useEffect(() => {
    void load();
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [load]);

  const rows = payload?.sources ?? [];
  const seam = payload?.seam;
  const captionMode = seam?.selected === "caption-file";
  // The shelf the operator is actually looking at. Every downstream index — the
  // `.row.sel` cursor, j/k, ↵ open, d delete — walks THIS list, never the
  // unnarrowed one: a cursor that can land on a row the filter removed is the
  // same keyed-by-entity hazard the s78 sweep closed here, one step removed.
  const shown = applyShelfFilters(rows, filters);
  const narrowed = shelfNarrowed(filters);
  const tags = shelfTags(rows);
  const selectedIndex = selectedId ? shown.findIndex((row) => row.id === selectedId) : -1;
  const active = selectedIndex >= 0 ? selectedIndex : 0;
  const activeRow: LibrarySourceRow | undefined = shown[active];
  const moveTo = (index: number) => {
    const row = shown[Math.max(0, Math.min(index, shown.length - 1))];
    if (row) setSelectedId(row.id);
  };
  const openRow = transcript ? (rows.find((row) => row.id === transcript.sourceId) ?? null) : null;
  const timed = transcript ? hasTimings(transcript.segments) : false;

  async function withBusy(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      // Server refusals surface VERBATIM (a source that still grounds drafts
      // is refused by name) — never a generic "something went wrong".
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitIngest(event: React.FormEvent) {
    event.preventDefault();
    await withBusy(async () => {
      const tags = parseTags(tagsRaw);
      const result = await ingestVideo({
        url,
        captions: captions.trim() ? captions : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      setPayload(await fetchLibrary());
      setTranscript(await fetchTranscript(result.sourceId));
      setUrl("");
      setCaptions("");
      setTagsRaw("");
      setIngestOpen(false);
      setDropNote(null);
      // A write must not land behind a filter: an ingest the operator cannot
      // see reads as a failed ingest. The narrowing clears (the sort, which
      // hides nothing, stays).
      setFilters((f) => ({ ...SHELF_DEFAULTS, sort: f.sort }));
    });
  }

  /**
   * The ingest box's advertised file drop (s79 verify round, T2 3/3).
   *
   * The sheet's own placeholder says "or drop a file" and nothing read one, so
   * a dropped .srt was handled by the BROWSER: Chrome navigates the tab to the
   * file (losing the typed URL and tags), Firefox pastes a file:// path into
   * the box that then fails ingest's https-only refine. So the first duty here
   * is `preventDefault` on both events — the drop can never leave the surface.
   *
   * WHAT THE NAIVE FIX WOULD HAVE DONE (the audit's own sketch): read the file
   * into `captions` and stop. That is worse than the bug. Captions are consumed
   * ONLY by the caption-file provider (packages/engine transcript.ts) — the
   * live seam is hosted-vendor, which fetches from the link and ignores them —
   * and the captions textarea is not even rendered outside caption mode. The
   * file would have vanished into invisible state under a button still disabled
   * by `!url.trim()`. So a drop the seam cannot use is REFUSED BY NAME instead,
   * and a drop it can use opens the panel so the operator sees where it landed.
   */
  async function acceptDrop(file: File) {
    const name = file.name.toLowerCase();
    if (!CAPTION_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      setDropNote(null);
      setActionError(
        `“${file.name}” isn’t a caption file — drop a .srt, .vtt or .txt transcript, or paste the video URL instead.`,
      );
      return;
    }
    if (!captionMode) {
      setDropNote(null);
      setActionError(
        `This workspace transcribes from the link (provider “${seam?.selected ?? "unknown"}”), so a dropped caption file has nothing to read it — paste the video URL instead. A dropped transcript only applies on the caption-file provider.`,
      );
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      // A read that fails is a read that failed — never a silent no-op.
      setDropNote(null);
      setActionError(
        `Couldn’t read “${file.name}”: ${err instanceof Error ? err.message : "the file could not be read"}`,
      );
      return;
    }
    setCaptions(text);
    setIngestOpen(true);
    setActionError(null);
    // The schema requires a URL regardless — the source keeps its provenance —
    // so say so at the moment the captions land rather than at submit.
    setDropNote(
      `Read ${text.split(/\r?\n/).length} lines from ${file.name}${
        url.trim() ? "" : " — paste the video URL above to ingest it"
      }.`,
    );
  }

  async function openSource(row: LibrarySourceRow) {
    await withBusy(async () => {
      setTranscript(await fetchTranscript(row.id));
    });
  }

  async function copySource(row: LibrarySourceRow) {
    await withBusy(async () => {
      // Copy-all IS the AI brief: the destination is an agent context window,
      // so the clipboard gets the same token-efficient Markdown as the .md
      // download. A row that isn't open fetches its transcript first.
      const payloadForRow =
        transcript?.sourceId === row.id ? transcript : await fetchTranscript(row.id);
      setTranscript(payloadForRow);
      await navigator.clipboard.writeText(toMarkdownBrief(payloadForRow.segments, briefInfo(row)));
      setCopiedId(row.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 1_500);
    });
  }

  /** Delete (founder direction, s39): ONE confirm, named by title; the server's refusal shows verbatim. */
  async function removeSource(row: LibrarySourceRow) {
    if (!window.confirm(`Delete "${sourceLead(row)}" from the library?`)) return;
    await withBusy(async () => {
      await deleteSource(row.id);
      if (transcript?.sourceId === row.id) setTranscript(null);
      setPayload(await fetchLibrary());
    });
  }

  function briefInfo(row: LibrarySourceRow | null): BriefInfo {
    if (!row) return {};
    return { title: row.title ?? undefined, uri: row.uri, tags: row.tags, createdAt: row.createdAt };
  }

  function download(format: ExportFormat) {
    if (!transcript) return;
    const { build, mime } = EXPORT_BUILDERS[format];
    const blob = new Blob([build(transcript.segments, briefInfo(openRow))], {
      type: `${mime};charset=utf-8`,
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `transcript-${transcript.sourceId.slice(0, 8)}.${format}`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  useListKeys({
    enabled: status === "success" && !busy && rows.length > 0,
    bindings: {
      j: (event) => {
        event.preventDefault();
        moveTo(active + 1);
      },
      k: (event) => {
        event.preventDefault();
        moveTo(active - 1);
      },
      Enter: (event) => {
        if (!activeRow) return;
        event.preventDefault();
        void openSource(activeRow);
      },
      // d is this surface's Four-Verbs word — Delete, behind the named confirm.
      d: (event) => {
        if (!activeRow) return;
        event.preventDefault();
        void removeSource(activeRow);
      },
    },
  });

  return (
    <div className="content transcription-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Transcription</h1>
        {/* A narrowed shelf never passes for the whole shelf: the pill states
            the bound, so the count can't assert a number nothing on screen
            supports. */}
        <span className="pill pill-idle">
          {status !== "success"
            ? "– sources"
            : narrowed
              ? `${shown.length} of ${rows.length} sources`
              : `${rows.length} sources`}
        </span>
        <div style={{ flex: 1 }} />
        <span className="t-label">
          everything here is grounding — the judge cites these verbatim
        </span>
      </div>

      <form
        className="ingest"
        onSubmit={submitIngest}
        // Both are required: without onDragOver's preventDefault the drop event
        // never fires at all, and without onDrop's the browser owns the file.
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer?.files?.[0];
          if (file) void acceptDrop(file);
        }}
      >
        <input
          className="ingest-box"
          name="video-url"
          aria-label="Video URL"
          placeholder="Paste a video URL or drop a file — transcript in, chunked, ready to ground on…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onFocus={() => setIngestOpen(true)}
        />
        {/* A dimmed control must say WHICH kind of not-now it is: the label
            flips while the ingest is in flight (running ≠ not ready), and the
            resting refusal names what it is waiting for instead of leaving the
            operator to guess why the primary button is inert. */}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !url.trim() || (captionMode && !captions.trim())}
          aria-busy={busy || undefined}
          title={
            busy
              ? undefined
              : !url.trim()
                ? "Paste a video URL first — it becomes the source's provenance."
                : captionMode && !captions.trim()
                  ? "The caption-file provider can’t fetch from a link — paste the captions below."
                  : undefined
          }
        >
          {busy ? "Ingesting…" : "Ingest"}
        </button>
      </form>

      {/* The ingest door's operator extras (keepers) unfold once the box is
          engaged — the resting band stays the sheet's box + button. */}
      {ingestOpen && (
        <div
          className="card"
          style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}
        >
          {captionMode && (
            <textarea
              className="ingest-box ingest-field"
              name="captions"
              aria-label="Captions (SRT, WebVTT, or plain text)"
              placeholder="Paste the captions here (SRT / WebVTT / plain text)…"
              rows={5}
              value={captions}
              onChange={(event) => setCaptions(event.target.value)}
            />
          )}
          <input
            className="ingest-box ingest-field"
            name="tags"
            aria-label="Tags (comma-separated, optional)"
            placeholder="Tags, comma-separated (optional) — e.g. hooks, ai tools"
            value={tagsRaw}
            onChange={(event) => setTagsRaw(event.target.value)}
          />
          {seam && (
            <span className="t-label">
              transcript provider · <span className="t-data">{seam.selected}</span>
              {captionMode
                ? " — fetching straight from a link isn’t armed; paste the captions above."
                : seam.selected === "hosted-vendor" && !seam.vendorConfigured
                  ? " — selected but not keyed yet; URL-only ingest works once its key is set."
                  : ""}
            </span>
          )}
        </div>
      )}

      {actionError && (
        <span className="t-label" style={{ color: "var(--err)" }} role="alert">
          {actionError}
        </span>
      )}

      {dropNote && (
        <span className="t-label" role="status">
          {dropNote}
        </span>
      )}

      {status === "loading" && (
        <div className="card">
          <div className="row">
            <span className="t-label">Reading the library…</span>
          </div>
        </div>
      )}

      {status === "error" && (
        <section
          className="card"
          style={{
            padding: "14px 16px",
            borderColor: "color-mix(in oklab, var(--err) 40%, var(--n-400))",
          }}
          role="alert"
        >
          <p className="t-title">Couldn’t read the library</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <span className="t-label">
              The shelf couldn’t be read — this is a read failure, not an empty shelf.
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
        </section>
      )}

      {/* THE VIEW KNOBS. Gated on a shelf that HAS rows: a filter row above
          "Nothing ingested yet" would be a control with nothing to control —
          the exact dead affordance this pass exists to remove. */}
      {status === "success" && rows.length > 0 && (
        <div className="shelf-knobs">
          <input
            className="find-input"
            type="search"
            name="find-source"
            aria-label="Find a source"
            placeholder="Find title, URL, tag…"
            value={filters.find}
            onChange={(event) => setFilters((f) => ({ ...f, find: event.target.value }))}
          />
          {tags.length > 0 && (
            <div className="btn btn-ghost btn-sm sel-ctl">
              {filters.tag === "" ? "All tags" : filters.tag}
              <span className="chev" />
              <select
                className="sel-native"
                name="tag-filter"
                aria-label="Tag filter"
                value={filters.tag}
                onChange={(event) => setFilters((f) => ({ ...f, tag: event.target.value }))}
              >
                <option value="">All tags</option>
                {/* The shelf's own vocabulary — a tag exists as a filter option
                    only because a source carries it. */}
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="btn btn-ghost btn-sm sel-ctl">
            {SHELF_SORT_WORDS[filters.sort]}
            <span className="chev" />
            <select
              className="sel-native"
              name="sort-order"
              aria-label="Sort order"
              value={filters.sort}
              onChange={(event) =>
                setFilters((f) => ({ ...f, sort: event.target.value as ShelfSort }))
              }
            >
              {(Object.keys(SHELF_SORT_WORDS) as ShelfSort[]).map((value) => (
                <option key={value} value={value}>
                  {SHELF_SORT_WORDS[value]}
                </option>
              ))}
            </select>
          </div>
          {narrowed && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setFilters((f) => ({ ...SHELF_DEFAULTS, sort: f.sort }))}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {status === "success" && (
        <div className="card">
          {rows.length === 0 ? (
            <div className="row">
              <span className="t-label">Nothing ingested yet — paste a video URL above.</span>
            </div>
          ) : shown.length === 0 ? (
            <div className="row">
              {/* The KNOB emptied it, never "nothing here" — lane 1's rule
                  across leads/board/runs, one grammar. */}
              <span className="t-label" style={{ flex: 1 }}>
                No source matches {filters.find.trim() !== "" ? `“${filters.find.trim()}”` : "this tag"}
                {filters.tag !== "" && filters.find.trim() !== "" ? ` tagged ${filters.tag}` : ""} —{" "}
                {rows.length} {rows.length === 1 ? "source is" : "sources are"} on the shelf.
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setFilters((f) => ({ ...SHELF_DEFAULTS, sort: f.sort }))}
              >
                Clear
              </button>
            </div>
          ) : (
            shown.map((row, index) => {
              const relevance = topRelevance(row);
              const origin = webOrigin(row.uri);
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className={index === active ? "row sel" : "row"}
                  style={{ cursor: "pointer" }}
                  aria-label={sourceLead(row)}
                  onClick={() => {
                    setSelectedId(row.id);
                    void openSource(row);
                  }}
                  onFocus={() => setSelectedId(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void openSource(row);
                  }}
                >
                  {/* Media-first, through the one component (B-media.0): the
                      resolved oEmbed poster, contained when it is portrait,
                      the striped box when the source never had media, and a
                      distinct "gone" when the poster died on the platform. */}
                  <SourceThumb resolution={row.media} legend="video" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="src-lead">{sourceLead(row)}</div>
                    <div className="excerpt" title={relevance?.reason}>
                      {sourceFacts(row)}
                      {relevance && ` · relevant to ${relevance.area}`}
                      {origin && (
                        <>
                          {" · "}
                          {/* The way back to the origin (DESIGN.md §5 Source-Link Rule). */}
                          <a
                            href={origin}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open the original source of ${sourceLead(row)}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            original ↗
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(row.id);
                      void copySource(row);
                    }}
                  >
                    {copiedId === row.id ? "Copied" : busy ? "Working…" : "Copy transcript"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(row.id);
                      void openSource(row);
                    }}
                  >
                    {busy ? "Working…" : "Export"}
                  </button>
                  <span className="t-data">{dayStamp(row.createdAt, now)}</span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* The opened row's panel — the transcript doors and Delete live here,
          so the shelf's resting chrome stays byte-true to the sheet. */}
      {transcript && (
        <div className="card">
          <div className="card-head">
            <span className="t-title">{openRow ? sourceLead(openRow) : "Transcript"}</span>
            <span className="t-data">{transcriptStamp(transcript.segments)}</span>
            <div style={{ flex: 1 }} />
            {(Object.keys(EXPORT_BUILDERS) as ExportFormat[]).map((format) => (
              <button
                key={format}
                type="button"
                className="btn btn-quiet btn-sm"
                disabled={busy || (EXPORT_BUILDERS[format].timed && !timed)}
                aria-busy={busy || undefined}
                title={
                  EXPORT_BUILDERS[format].timed && !timed
                    ? "This transcript has no cue timings (plain-text ingest) — timed exports would invent timestamps."
                    : undefined
                }
                onClick={() => download(format)}
              >
                .{format}
              </button>
            ))}
            {openRow && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => void removeSource(openRow)}
              >
                {busy ? "Working…" : "Delete"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => setTranscript(null)}
            >
              Close
            </button>
          </div>
          <div className="card-rows">
            {transcript.segments.length === 0 ? (
              <div className="row">
                <span className="t-label">
                  This source has no transcript segments — the ingest recorded none.
                </span>
              </div>
            ) : (
              transcript.segments.map((segment, index) => (
                <div className="row" key={index}>
                  {segment.startMs !== undefined && (
                    <span className="t-data">{formatTimecode(segment.startMs).slice(0, 8)}</span>
                  )}
                  <span className="t-body">{segment.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* The sheet's footer is ONE label — unlike the Dashboard sheet, this
          one draws no j/k chips, so the keyboard grammar stays invisible
          chrome here rather than growing the band. */}
      <div style={{ display: "flex" }}>
        <span className="t-label">
          Sources are per-tenant, chunked and embedded once — drafts cite them; nothing generates
          ungrounded.
        </span>
      </div>
    </div>
  );
}
