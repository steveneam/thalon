"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dayStamp,
  parseTags,
  sourceFacts,
  sourceLead,
  topRelevance,
  transcriptStamp,
  webOrigin,
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
  const [transcript, setTranscript] = useState<TranscriptPayload | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // The selection is a SOURCE, not a position. Ingest prepends and delete
  // removes, so an index re-points at a different source after every one
  // of them — and the Copy/Export buttons act on the row the index lands
  // on (keyed-by-entity sweep, s78). null = the operator hasn't moved yet.
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const selectedIndex = selectedId ? rows.findIndex((row) => row.id === selectedId) : -1;
  const active = selectedIndex >= 0 ? selectedIndex : 0;
  const activeRow: LibrarySourceRow | undefined = rows[active];
  const moveTo = (index: number) => {
    const row = rows[Math.max(0, Math.min(index, rows.length - 1))];
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
    });
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
        <span className="pill pill-idle">
          {status === "success" ? `${rows.length} sources` : "– sources"}
        </span>
        <div style={{ flex: 1 }} />
        <span className="t-label">
          everything here is grounding — the judge cites these verbatim
        </span>
      </div>

      <form className="ingest" onSubmit={submitIngest}>
        <input
          className="ingest-box"
          aria-label="Video URL"
          placeholder="Paste a video URL or drop a file — transcript in, chunked, ready to ground on…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onFocus={() => setIngestOpen(true)}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !url.trim() || (captionMode && !captions.trim())}
        >
          Ingest
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
              aria-label="Captions (SRT, WebVTT, or plain text)"
              placeholder="Paste the captions here (SRT / WebVTT / plain text)…"
              rows={5}
              value={captions}
              onChange={(event) => setCaptions(event.target.value)}
            />
          )}
          <input
            className="ingest-box ingest-field"
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

      {status === "success" && (
        <div className="card">
          {rows.length === 0 ? (
            <div className="row">
              <span className="t-label">Nothing ingested yet — paste a video URL above.</span>
            </div>
          ) : (
            rows.map((row, index) => {
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(row.id);
                      void copySource(row);
                    }}
                  >
                    {copiedId === row.id ? "Copied" : "Copy transcript"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(row.id);
                      void openSource(row);
                    }}
                  >
                    Export
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
                onClick={() => void removeSource(openRow)}
              >
                Delete
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
