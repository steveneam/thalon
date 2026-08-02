"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SHELF_DEFAULTS,
  SHELF_SORT_WORDS,
  applyShelfFilters,
  dayStamp,
  freeIngestNote,
  hasTranscript,
  kindTabs,
  kindWord,
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
} from "@/components/library/library-model";
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
 * The row region's bound (Bounded-List, the Settings ledger's own pattern:
 * the count states the rest, nothing is truncated silently). The §5.3
 * widening put the WHOLE shelf behind this card — on dev that is ~190
 * admission captures at once — and the foot row names the two lenses that
 * narrow it. The keyboard cursor walks the RENDERED rows only.
 */
const SHELF_SHOWN = 50;

/**
 * Library, rebuilt exactly from Library.dc.html at its s90 W2 amendment
 * (DOCTRINE 0 — the sheet is the blueprint; s94, the founder's §5.3 ruling:
 * "ONE Library surface; transcription becomes an ingest kind + a filter,
 * not a second route"). The headline + source count, the ingest band with
 * the Free-transcript | AI-enhance seg, the kind qtabs over one card of
 * source rows (thumb → lead/facts → doors → day stamp), and the per-tenant
 * grounding footer. `/app/transcription` retired with this rebuild.
 *
 * What is honestly narrower than the sheet's demo shelf, each a fact the
 * surface states rather than a dead door:
 *  - the band INGESTS video/audio URLs (the transcript seam) plus dropped
 *    caption files on the caption-file provider; article/file/text ingest
 *    has no live door yet (`ingestWebUrl` exists engine-side with no route),
 *    so the extras state the deferral instead of the box pretending;
 *  - a mid-transcription row state ("Transcribing · ~3m left") has no data
 *    behind it — ingest is synchronous, so the in-flight state lives on the
 *    band's own button ("Ingesting…") and a row only exists once recorded;
 *  - transcript doors (open, copy, export, delete) belong to transcript
 *    rows; other kinds carry their facts and their original ↗ — the
 *    transcript read and delete routes are kind-guarded server-side, and a
 *    door the server refuses is not drawn.
 *
 * Keepers carried whole from the s74–s86 surface, each behind byte-true
 * resting chrome: the ingest extras (tags, captions on the caption-file
 * seam, the seam's honest readout), the advertised drop with its refusal
 * branches, the view knobs (find · tag · sort), the one list keyboard
 * grammar (j/k move · ↵ open · d delete behind the named confirm), and the
 * transcript panel with its export doors.
 */
export function Library() {
  const [status, setStatus] = useState<ReadStatus>("loading");
  const [payload, setPayload] = useState<LibraryPayload | null>(null);
  const [url, setUrl] = useState("");
  const [captions, setCaptions] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  // Free + deterministic is the RESTING state, and it returns to it after every
  // ingest (founder ruling s79: per-ingest, his choice each time — never a
  // setting that quietly stays on). The W2 sheet drew the s86 control properly:
  // a seg in the band, free leading.
  const [aiEnhance, setAiEnhance] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Neutral channel for what a dropped file did — refusals stay in actionError. */
  const [dropNote, setDropNote] = useState<string | null>(null);
  /** Neutral channel for what the last INGEST did — the no-op re-ingest says so. */
  const [ingestNote, setIngestNote] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPayload | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // The selection is a SOURCE, not a position (keyed-by-entity sweep, s78).
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
  // unnarrowed one (the keyed-by-entity hazard, one step removed).
  const shown = applyShelfFilters(rows, filters);
  const rendered = shown.slice(0, SHELF_SHOWN);
  const beyondBound = shown.length - rendered.length;
  const narrowed = shelfNarrowed(filters);
  const tags = shelfTags(rows);
  const tabs = kindTabs(rows);
  const selectedIndex = selectedId ? rendered.findIndex((row) => row.id === selectedId) : -1;
  const active = selectedIndex >= 0 ? selectedIndex : 0;
  const activeRow: LibrarySourceRow | undefined = rendered[active];
  const moveTo = (index: number) => {
    const row = rendered[Math.max(0, Math.min(index, rendered.length - 1))];
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
      const enhanceAsked = aiEnhance;
      const result = await ingestVideo({
        url,
        captions: captions.trim() ? captions : undefined,
        tags: tags.length > 0 ? tags : undefined,
        // Omitted unless asked: the free default lives engine-side, once.
        aiEnhance: enhanceAsked ? true : undefined,
      });
      setPayload(await fetchLibrary());
      setTranscript(await fetchTranscript(result.sourceId));
      setUrl("");
      setCaptions("");
      setTagsRaw("");
      setAiEnhance(false);
      setIngestOpen(false);
      setDropNote(null);
      // A RE-INGEST RE-PROCESSES NOTHING. Content identity is the transcript,
      // so pasting a video already on the shelf resolves to the existing row —
      // and with the seg on enhance, that is a control the operator just used
      // which had no effect. Silence there would read as "enhanced"; say it.
      setIngestNote(
        result.created
          ? null
          : `Already on the shelf — the same transcript was ingested before, so nothing was re-processed${
              enhanceAsked ? " and AI-enhance did not apply to it" : ""
            }.`,
      );
      // A write must not land behind a filter: an ingest the operator cannot
      // see reads as a failed ingest. The narrowing clears (the sort, which
      // hides nothing, stays).
      setFilters((f) => ({ ...SHELF_DEFAULTS, sort: f.sort }));
    });
  }

  /**
   * The ingest box's advertised file drop (s79 verify round, T2 3/3). The
   * first duty is `preventDefault` on both events — the drop can never leave
   * the surface (Chrome navigates the tab to the file; Firefox pastes a
   * file:// path that then fails ingest's https-only refine).
   *
   * Captions are consumed ONLY by the caption-file provider — the live seam
   * is hosted-vendor, which fetches from the link and ignores them — so a
   * drop the seam cannot use is REFUSED BY NAME, and a drop it can use opens
   * the panel so the operator sees where it landed.
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
    // Only a transcript row has a panel to open — the read route itself
    // refuses other kinds, and a door the server refuses is not offered.
    if (!hasTranscript(row)) return;
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
    // The delete route is transcript-scoped (other kinds' cascade rules are
    // uncharted) — so is this verb.
    if (!hasTranscript(row)) return;
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
    <div className="content library-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Library</h1>
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
          placeholder="Paste a video or audio URL, or drop a caption file — it transcribes on ingest and lands chunked, ready to ground on…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onFocus={() => setIngestOpen(true)}
        />
        {/* The W2 seg: the s86 free/enhance control designed properly — free
            leads, enhance says it is metered, and picking enhance unfolds the
            extras so its cost words are on screen BEFORE the run. */}
        <div
          className="seg"
          title="free transcript is the default; AI enhance is metered and its cost shows before the run"
        >
          <button
            type="button"
            className={aiEnhance ? "seg-opt" : "seg-opt on"}
            aria-pressed={!aiEnhance}
            onClick={() => setAiEnhance(false)}
          >
            Free transcript
          </button>
          <button
            type="button"
            className={aiEnhance ? "seg-opt on" : "seg-opt"}
            aria-pressed={aiEnhance}
            onClick={() => {
              setAiEnhance(true);
              setIngestOpen(true);
            }}
          >
            AI enhance
          </button>
        </div>
        {/* A dimmed control must say WHICH kind of not-now it is: the label
            flips while the ingest is in flight (running ≠ not ready), and the
            resting refusal names what it is waiting for. */}
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
          engaged — the resting band stays the sheet's box + seg + button. */}
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
          {/* The seg's consequence, in words, before anything spends (founder
              ruling s79; the W2 sheet's own title says the cost shows before
              the run). */}
          <span className="t-label">
            {aiEnhance
              ? "This ingest embeds its chunks and scores them against your monitored areas — one metered call. It goes back to free for the next one."
              : "Free and deterministic: the transcript is stored verbatim, with no relevance score and no semantic retrieval — you'll find it by title, URL and tag."}
          </span>
          {/* §5.3 names URL · file · text as ingest kinds; the band takes what
              the engine has a door for TODAY, and states the rest as the
              deferral it is — never a box that pretends. */}
          <span className="t-label">
            Article, file and pasted-text ingest land with their own pass — today the band
            transcribes video/audio URLs; article captures arrive from Intel’s admission door.
          </span>
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

      {ingestNote && (
        <span className="t-label" role="status">
          {ingestNote}
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
          "Nothing ingested yet" would be a control with nothing to control. */}
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
          {/* The §5.3 kind lens — the sheet's qtab row, over a shelf that has
              rows to lens. Counts are the WHOLE shelf's (the tab is the
              census; find/tag narrow inside the pick, and the pill states
              that bound). */}
          {rows.length > 0 && (
            <div className="qtabs" role="tablist" aria-label="Source kind">
              {tabs.map((tab) => {
                const on = filters.kind === (tab.kind ?? "");
                return (
                  <button
                    key={tab.kind ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    className={on ? "qtab on" : "qtab"}
                    onClick={() => setFilters((f) => ({ ...f, kind: tab.kind ?? "" }))}
                  >
                    {tab.label}
                    <span className="n">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          )}
          {rows.length === 0 ? (
            <div className="row">
              <span className="t-label">Nothing ingested yet — paste a video URL above.</span>
            </div>
          ) : shown.length === 0 ? (
            <div className="row">
              {/* The KNOB emptied it, never "nothing here". */}
              <span className="t-label" style={{ flex: 1 }}>
                No source matches{" "}
                {filters.find.trim() !== ""
                  ? `“${filters.find.trim()}”`
                  : filters.tag !== ""
                    ? "this tag"
                    : "this kind"}
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
            rendered.map((row, index) => {
              const relevance = topRelevance(row);
              const freeNote = freeIngestNote(row);
              const origin = webOrigin(row.uri);
              const transcriptRow = hasTranscript(row);
              return (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className={index === active ? "row sel" : "row"}
                  style={{ cursor: transcriptRow ? "pointer" : "default" }}
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
                  {/* Media-first, through the one component (B-media.0). The
                      striped placeholder's legend is the row's own kind word
                      — a capture is not a "video" box. */}
                  <SourceThumb resolution={row.media} legend={kindWord(row.kind).toLowerCase()} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="src-lead">{sourceLead(row)}</div>
                    <div className="excerpt" title={relevance?.reason}>
                      {sourceFacts(row)}
                      {relevance && ` · relevant to ${relevance.area}`}
                      {/* …and where an enhanced row states its area, a free one
                          states why it has none — same slot, same grammar. */}
                      {freeNote && ` · ${freeNote}`}
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
                  {/* Transcript doors belong to transcript rows — the sheet's
                      per-kind door grammar, gated by what the server serves.
                      A non-transcript row's doors are its facts + original ↗
                      (no text read route exists yet — nothing is pretended). */}
                  {transcriptRow && (
                    <>
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
                    </>
                  )}
                  <span className="t-data">{dayStamp(row.createdAt, now)}</span>
                </div>
              );
            })
          )}
          {beyondBound > 0 && (
            <div className="row">
              {/* The stated bound — never a silent truncation: the rest is
                  counted, and the two lenses that reach it are named. */}
              <span className="t-label">
                +{beyondBound} more — narrow with find or the kind tabs to reach them.
              </span>
            </div>
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

      {/* The sheet's footer is ONE label. Its drawn wording ("chunked and
          embedded once") became a LIE the moment free ingest landed: it
          asserted of the whole shelf a thing true only of the ingests the
          operator paid for. The shelf-wide honest statement stands (s86
          divergence, recorded), so a row with no "relevant to …" clause reads
          as a known free ingest rather than as an area that scored nothing. */}
      <div style={{ display: "flex" }}>
        <span className="t-label">
          Sources are per-tenant and chunked once. AI-enhanced ingests are embedded too — scored
          against your monitored areas and retrievable by meaning; free ingests are stored verbatim,
          with no relevance score and no semantic retrieval. Drafts cite them; nothing generates
          ungrounded.
        </span>
      </div>
    </div>
  );
}
