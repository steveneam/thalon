"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchLibrary, fetchTranscript, ingestVideo } from "@/lib/library/client";
import { EXPORT_BUILDERS, formatTimecode, hasTimings, toPlainText, type ExportFormat } from "@/lib/library/export";
import type { LibraryPayload, LibrarySourceRow, TranscriptPayload } from "@/lib/library/types";
import { cn } from "@/lib/utils";

type SurfaceStatus = "loading" | "error" | "success";

/**
 * Library (B6.5): paste a video URL → a timed transcript you can read, copy,
 * and export (.txt / .csv / .srt). The transcript seam readout is honest
 * about which provider is armed: caption-file wants the captions pasted
 * alongside the URL; hosted-vendor fetches from the URL once its key is
 * configured; whisper-local transcribes local media. Every ingest lands as a
 * `video_transcript` source — the same grounding shelf generation retrieves
 * from, so a transcript here is immediately usable context, not a dead file.
 */
export function LibrarySurface() {
  const [status, setStatus] = useState<SurfaceStatus>("loading");
  const [payload, setPayload] = useState<LibraryPayload | null>(null);
  const [url, setUrl] = useState("");
  const [captions, setCaptions] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLibrary()
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

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
      const result = await ingestVideo({
        url,
        captions: captions.trim() ? captions : undefined,
      });
      setTranscript(await fetchTranscript(result.sourceId));
      setPayload(await fetchLibrary());
      setUrl("");
      setCaptions("");
    });
  }

  async function openSource(row: LibrarySourceRow) {
    await withBusy(async () => {
      setTranscript(await fetchTranscript(row.id));
    });
  }

  async function copyText() {
    if (!transcript) return;
    await navigator.clipboard.writeText(toPlainText(transcript.segments));
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1_500);
  }

  function download(format: ExportFormat) {
    if (!transcript) return;
    const { build, mime } = EXPORT_BUILDERS[format];
    const blob = new Blob([build(transcript.segments)], { type: `${mime};charset=utf-8` });
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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {status === "loading" && <p className="text-sm text-muted-foreground">Loading library…</p>}
      {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t load the library.</p>}
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
                  (TRANSCRIPT_PROVIDER=hosted-vendor{seam && !seam.vendorConfigured ? ", key not configured" : ""});
                  local Whisper (whisper-local) covers media files on this machine.
                </p>
              )}
              {seam?.selected === "hosted-vendor" && !seam.vendorConfigured && (
                <p className="rounded-lg border border-dashed border-signal/50 bg-signal/10 p-3 text-xs">
                  hosted-vendor is selected but not keyed — set TRANSCRIPT_VENDOR_URL and
                  TRANSCRIPT_VENDOR_API_KEY, then URL-only ingest works end to end.
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
                  Transcript
                  {transcript.provider && <Badge variant="outline">{transcript.provider}</Badge>}
                  <span className="text-xs font-normal text-muted-foreground u-tabular">
                    {transcript.segments.length} segments
                    {timed && transcript.segments.length > 0
                      ? ` · ${formatTimecode(transcript.segments[transcript.segments.length - 1].endMs ?? 0).slice(0, 8)}`
                      : ""}
                  </span>
                </CardTitle>
                {transcript.uri && (
                  <CardDescription className="break-all">{transcript.uri}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={copyText} disabled={busy}>
                    {copied ? <Check aria-hidden data-icon="inline-start" /> : <Copy aria-hidden data-icon="inline-start" />}
                    {copied ? "Copied" : "Copy text"}
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
            </CardHeader>
            <CardContent>
              {payload.sources.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Nothing ingested yet — paste a video URL above.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {payload.sources.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => openSource(row)}
                        disabled={busy}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          transcript?.sourceId === row.id && "border-primary/40 bg-primary/5",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{row.uri ?? row.id}</span>
                        {row.provider && <Badge variant="outline">{row.provider}</Badge>}
                        {row.segmentCount !== null && (
                          <span className="shrink-0 text-xs text-muted-foreground u-tabular">
                            {row.segmentCount} segments
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
