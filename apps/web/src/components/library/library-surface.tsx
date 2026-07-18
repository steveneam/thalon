"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import { HeatGrade } from "@/components/intel/heat-grade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyArt } from "@/components/ui/empty-art";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionToast, type ToastState } from "@/components/workspace/action-toast";
import { BulkBar } from "@/components/workspace/bulk-bar";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { deleteSource, fetchLibrary, fetchTranscript, ingestVideo } from "@/lib/library/client";
import { useListKeys } from "@/lib/workspace/keyboard";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import {
  EXPORT_BUILDERS,
  formatTimecode,
  hasTimings,
  toMarkdownBrief,
  type BriefInfo,
  type ExportFormat,
} from "@/lib/library/export";
import type { AreaRelevance, LibraryPayload, LibrarySourceRow, TranscriptPayload } from "@/lib/library/types";
import { cn } from "@/lib/utils";

type SurfaceStatus = "loading" | "error" | "success";

/** Only web origins get a click-out — a non-http uri (local media path) is identity, not a link. */
function webOrigin(uri: string | null): string | null {
  return uri && /^https?:\/\//.test(uri) ? uri : null;
}

/** "ai, hooks , ai" → ["ai", "hooks"] — trimmed, deduped, capped to the ingest schema's 12. */
export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

/**
 * The relevance badge (session-19 rider): the engine's top-scored monitored
 * area, worn in the SAME thermal grammar as intel cards (heat-grade.tsx
 * bands/tokens); the reason string rides the tooltip. Renders nothing when
 * the engine hasn't scored the row — pre-rider rows never invent heat.
 */
function RelevanceBadge({ relevance }: { relevance: AreaRelevance[] }) {
  if (relevance.length === 0) return null;
  const top = [...relevance].sort((a, b) => b.score - a.score)[0];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{top.areaName}</span>
      <HeatGrade score={top.score} detail={top.reason} />
    </span>
  );
}

/**
 * Library (B6.5 + the session-19 polish rider): paste a video URL → a timed
 * transcript you can read, copy, and export (.txt / .csv / .srt). The
 * transcript seam readout is honest about which provider is armed:
 * caption-file wants the captions pasted alongside the URL; hosted-vendor
 * fetches from the URL once its key is configured; whisper-local
 * transcribes local media. Every ingest lands as a `video_transcript`
 * source — the same grounding shelf generation retrieves from, so a
 * transcript here is immediately usable context, not a dead file. Shelf
 * rows lead with the oEmbed title and wear operator tags + the engine's
 * area-relevance score (META-KEY MINI-CONTRACT keys — absent on pre-rider
 * rows, where everything degrades to the URL-only look).
 */
export function LibrarySurface() {
  const [status, setStatus] = useState<SurfaceStatus>("loading");
  const [payload, setPayload] = useState<LibraryPayload | null>(null);
  const [url, setUrl] = useState("");
  const [captions, setCaptions] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPayload | null>(null);
  // Collapsed-by-default after ingest (founder feedback, session 19): the
  // fresh wall of segments buried the shelf. Opening from the shelf IS the
  // expand-on-demand click, so that path opens expanded.
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Multi-select for bulk Delete (FRONTEND §0 parity, s40) + the terminal-
  // action toast. "Picked" = the checkbox set; "open" = the row whose
  // transcript shows (the selected-row recipe + what keyboard keys act on).
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const openRowRef = useRef<HTMLLIElement | null>(null);

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

  async function withBusy(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
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
      setTranscript(await fetchTranscript(result.sourceId));
      setSegmentsOpen(false);
      setPayload(await fetchLibrary());
      setUrl("");
      setCaptions("");
      setTagsRaw("");
    });
  }

  async function openSource(row: LibrarySourceRow) {
    await withBusy(async () => {
      setTranscript(await fetchTranscript(row.id));
      setSegmentsOpen(true);
    });
  }

  function togglePick(id: string, isPicked: boolean) {
    setPicked((current) => {
      const next = new Set(current);
      if (isPicked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // Delete (founder direction, session 39). One confirm, named by title (the
  // leads-surface destructive-bulk precedent); the server refuses a source
  // that grounds drafts, and that refusal surfaces verbatim below the form.
  async function removeSource(row: LibrarySourceRow) {
    if (!window.confirm(`Delete "${row.title ?? row.uri ?? row.id}" from the library?`)) return;
    await withBusy(async () => {
      await deleteSource(row.id);
      if (transcript?.sourceId === row.id) setTranscript(null);
      togglePick(row.id, false);
      setPayload(await fetchLibrary());
      setToast({ message: `Deleted "${row.title ?? row.uri ?? row.id}".` });
    });
  }

  // Bulk Delete (s40 parity; FRONTEND §0 — BulkBar carries the ONE named
  // confirm). Sequential through the same endpoint; a refuse-while-referenced
  // failure never silently vanishes — partial results surface as the error,
  // and the refresh shows exactly what survived.
  async function bulkDelete() {
    const rows = (payload?.sources ?? []).filter((row) => picked.has(row.id));
    await withBusy(async () => {
      let done = 0;
      const failures: string[] = [];
      for (const row of rows) {
        try {
          await deleteSource(row.id);
          done += 1;
          if (transcript?.sourceId === row.id) setTranscript(null);
        } catch (err) {
          failures.push(err instanceof Error ? err.message : "delete failed");
        }
      }
      setPicked(new Set());
      setPayload(await fetchLibrary());
      if (failures.length > 0) {
        throw new Error(`Deleted ${done}; ${failures.length} refused (${failures[0]})`);
      }
      setToast({ message: `Deleted ${done} transcript${done === 1 ? "" : "s"}.` });
    });
  }

  /** The .md brief's header facts, from whatever the shelf row knows (Deliverable D). */
  function currentBriefInfo(): BriefInfo {
    if (!transcript) return {};
    const row = payload?.sources.find((r) => r.id === transcript.sourceId);
    return { title: row?.title, uri: transcript.uri, tags: row?.tags, createdAt: row?.createdAt };
  }

  async function copyText() {
    if (!transcript) return;
    // Copy-all IS the AI brief (Deliverable D): the destination is an agent
    // context window, so the clipboard gets the same token-efficient
    // Markdown as the .md download — not the old single-line squash.
    await navigator.clipboard.writeText(toMarkdownBrief(transcript.segments, currentBriefInfo()));
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1_500);
  }

  function download(format: ExportFormat) {
    if (!transcript) return;
    const { build, mime } = EXPORT_BUILDERS[format];
    const blob = new Blob([build(transcript.segments, currentBriefInfo())], { type: `${mime};charset=utf-8` });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `transcript-${transcript.sourceId.slice(0, 8)}.${format}`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  const seam = payload?.seam;
  const captionMode = seam?.selected === "caption-file";
  const timed = transcript ? hasTimings(transcript.segments) : false;
  const openRow = transcript
    ? (payload?.sources.find((row) => row.id === transcript.sourceId) ?? null)
    : null;

  // Keyboard grammar parity (s40): j/k move the open row exactly like the
  // approve queue's grid selection (selection drives the detail), x picks it
  // for bulk, d is the surface's Four-Verbs word — Delete, still behind the
  // named confirm inside removeSource.
  const shelfRows = payload?.sources ?? [];
  const moveOpenRow = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (shelfRows.length === 0) return;
    event.preventDefault();
    const current = shelfRows.findIndex((row) => row.id === transcript?.sourceId);
    const next =
      current === -1 ? 0 : Math.min(Math.max(current + delta, 0), shelfRows.length - 1);
    void openSource(shelfRows[next]);
  };
  useListKeys({
    enabled: status === "success" && !busy,
    bindings: {
      j: moveOpenRow(1),
      k: moveOpenRow(-1),
      x: (event) => {
        if (!openRow) return;
        event.preventDefault();
        togglePick(openRow.id, !picked.has(openRow.id));
      },
      d: (event) => {
        if (!openRow) return;
        event.preventDefault();
        void removeSource(openRow);
      },
    },
  });

  // Keep the open row in view while j/k cruises the shelf (jsdom-safe call).
  const openSourceId = transcript?.sourceId;
  useEffect(() => {
    openRowRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [openSourceId]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* j/k moves the open row silently for screen readers without this
          (the approve queue's live-region precedent). */}
      <p aria-live="polite" className="sr-only">
        {openRow ? `Opened ${openRow.title ?? openRow.uri ?? openRow.id}` : ""}
      </p>
      {status === "loading" && (
        <div className="flex flex-col gap-3" aria-label="Loading library">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {status === "error" && (
        <ErrorNotice
          message="Couldn’t load the library."
          onRetry={() => {
            setStatus("loading");
            void load();
          }}
        />
      )}
      {status === "success" && payload && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Ingest a video</CardTitle>
              <CardDescription>
                Paste a video URL — the transcript lands here as a timed source you can read, copy,
                export, and ground generation on.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form onSubmit={submitIngest} className="flex flex-col gap-3">
                <input
                  aria-label="Video URL"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                {captionMode && (
                  <textarea
                    aria-label="Captions (SRT, WebVTT, or plain text)"
                    placeholder="Paste the captions here (SRT / WebVTT / plain text)…"
                    value={captions}
                    onChange={(e) => setCaptions(e.target.value)}
                    rows={5}
                    className="rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                )}
                <input
                  aria-label="Tags (comma-separated, optional)"
                  placeholder="Tags, comma-separated (optional) — e.g. hooks, ai tools"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" disabled={busy || !url.trim() || (captionMode && !captions.trim())}>
                    <FileText aria-hidden data-icon="inline-start" /> Get transcript
                  </Button>
                  {seam && (
                    <span className="text-xs text-muted-foreground">
                      provider: <Badge variant="outline">{seam.selected}</Badge>
                    </span>
                  )}
                </div>
              </form>
              {captionMode && (
                <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  Fetching straight from a video link isn&rsquo;t armed yet — paste the captions
                  alongside the URL for now. It arms when the hosted transcript vendor is keyed
                  {seam && !seam.vendorConfigured ? " (not configured yet — Settings shows the seam)" : ""};
                  local Whisper covers media files on this machine.
                </p>
              )}
              {seam?.selected === "hosted-vendor" && !seam.vendorConfigured && (
                <p className="rounded-lg border border-dashed border-signal/50 bg-signal/10 p-3 text-xs">
                  The hosted transcript vendor is selected but not keyed — add its URL and API
                  key to the environment, then URL-only ingest works end to end. Settings shows
                  the seam readout.
                </p>
              )}
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
            </CardContent>
          </Card>

          {transcript && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {/* Title-first here too: the shelf row's oEmbed title beats the word "Transcript". */}
                  {openRow?.title ?? "Transcript"}
                  {transcript.provider && <Badge variant="outline">{transcript.provider}</Badge>}
                  <span className="text-xs font-normal text-muted-foreground u-tabular">
                    {transcript.segments.length} segments
                    {timed && transcript.segments.length > 0
                      ? ` · ${formatTimecode(transcript.segments[transcript.segments.length - 1].endMs ?? 0).slice(0, 8)}`
                      : ""}
                  </span>
                </CardTitle>
                {transcript.uri &&
                  (webOrigin(transcript.uri) ? (
                    // The way back to the source (DESIGN.md §5 Source-Link Rule) —
                    // the stored uri is a link at every representation, never plain text.
                    <CardDescription className="break-all">
                      <a
                        href={transcript.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {transcript.uri} ↗
                      </a>
                    </CardDescription>
                  ) : (
                    <CardDescription className="break-all">{transcript.uri}</CardDescription>
                  ))}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyText}
                    disabled={busy}
                    title="Copies the Markdown AI brief — paste straight into an agent"
                  >
                    {copied ? <Check aria-hidden data-icon="inline-start" /> : <Copy aria-hidden data-icon="inline-start" />}
                    {copied ? "Copied" : "Copy brief"}
                  </Button>
                  {(Object.keys(EXPORT_BUILDERS) as ExportFormat[]).map((format) => (
                    <Button
                      key={format}
                      size="sm"
                      variant="outline"
                      onClick={() => download(format)}
                      disabled={busy || (EXPORT_BUILDERS[format].timed && !timed)}
                      title={
                        EXPORT_BUILDERS[format].timed && !timed
                          ? "This transcript has no cue timings (plain-text ingest) — timed exports would invent timestamps."
                          : undefined
                      }
                    >
                      <Download aria-hidden data-icon="inline-start" /> .{format}
                    </Button>
                  ))}
                </div>
                {/* Collapsed-by-default after ingest (session-19 rider): copy/
                    export stay one click; the segment wall is opt-in. */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSegmentsOpen((open) => !open)}
                  aria-expanded={segmentsOpen}
                  className="self-start"
                >
                  {segmentsOpen ? (
                    <ChevronDown aria-hidden data-icon="inline-start" />
                  ) : (
                    <ChevronRight aria-hidden data-icon="inline-start" />
                  )}
                  {segmentsOpen ? "Hide transcript" : `Show transcript (${transcript.segments.length} segments)`}
                </Button>
                {segmentsOpen && (
                  <ol className="max-h-96 overflow-y-auto rounded-lg border border-border" aria-label="Transcript segments">
                    {transcript.segments.map((segment, i) => (
                      <li
                        key={i}
                        className={cn("flex gap-3 px-3 py-1.5 text-sm", i % 2 === 1 && "bg-muted/40")}
                      >
                        {segment.startMs !== undefined && (
                          <span className="shrink-0 pt-px font-mono text-xs text-muted-foreground u-tabular">
                            {formatTimecode(segment.startMs).slice(0, 8)}
                          </span>
                        )}
                        <span>{segment.text}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Shelf</CardTitle>
              <CardDescription>
                Every transcript ingested so far — click one to reopen it. Each is a grounding
                source generation can already retrieve from.
              </CardDescription>
              {payload.sources.length > 0 && (
                <p className="u-eyebrow text-muted-foreground">
                  keys · j/k open · x pick · d delete
                </p>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <BulkBar
                count={picked.size}
                busy={busy}
                actionLabel={
                  <>
                    <Trash2 aria-hidden className="size-3.5" /> Delete selected
                  </>
                }
                confirmMessage={`Delete ${picked.size} transcript${picked.size === 1 ? "" : "s"} from the library?`}
                destructive
                onAction={() => void bulkDelete()}
                onClear={() => setPicked(new Set())}
              />
              {payload.sources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <EmptyArt asset="emptyLibrary" />
                  <p className="text-center text-sm text-muted-foreground">
                    Nothing ingested yet — paste a video URL above.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {payload.sources.map((row) => (
                    <li
                      key={row.id}
                      ref={transcript?.sourceId === row.id ? openRowRef : undefined}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.title ?? row.uri ?? row.id}`}
                        checked={picked.has(row.id)}
                        onChange={(e) => togglePick(row.id, e.target.checked)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      {/* Title-first rows (session-19 rider): the oEmbed title
                          is the row's identity, the URL demotes to secondary
                          text. Pre-rider rows have no title — the URL stays
                          primary, no invented text. */}
                      <button
                        type="button"
                        onClick={() => openSource(row)}
                        disabled={busy}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          transcript?.sourceId === row.id && SELECTED_ROW,
                        )}
                      >
                        {/* Visual identity for visual sources (Source-Link Rule):
                            the oEmbed thumbnail, when the ingest captured one.
                            Pre-rider rows and non-visual sources simply have none. */}
                        {row.thumbnailUrl && (
                          <img
                            src={row.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className="h-9 w-14 shrink-0 rounded-md border border-border object-cover"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {row.title ?? row.uri ?? row.id}
                          </span>
                          {row.title && row.uri && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {row.uri}
                            </span>
                          )}
                          {row.tags.length > 0 && (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {row.tags.map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </span>
                          )}
                        </span>
                        <RelevanceBadge relevance={row.areaRelevance} />
                        {row.provider && <Badge variant="outline">{row.provider}</Badge>}
                        {row.segmentCount !== null && (
                          <span className="shrink-0 text-xs text-muted-foreground u-tabular">
                            {row.segmentCount} segments
                          </span>
                        )}
                      </button>
                      {/* The way back to the origin (Source-Link Rule) — a
                          sibling anchor, never nested inside the open button. */}
                      {webOrigin(row.uri) && (
                        <a
                          href={row.uri!}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open the original source of ${row.title ?? row.uri}`}
                          title="Open the original source"
                          className="flex items-center self-stretch rounded-lg border border-border px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <ExternalLink aria-hidden className="size-3.5" />
                        </a>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void removeSource(row)}
                        disabled={busy}
                        aria-label={`Delete ${row.title ?? row.uri ?? "this transcript"}`}
                        title="Delete this transcript from the library"
                        className="h-auto self-stretch"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
      <ActionToast toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
