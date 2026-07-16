"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AudioLines, Clapperboard, Film, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { cn } from "@/lib/utils";
import { fetchProjectDetail, mediaUrl } from "@/lib/videos/client";
import type { CutView, ProjectDetail, TakeView } from "@/lib/videos/types";
import { timeAgo } from "@/lib/workspace/format";
import { useListKeys } from "@/lib/workspace/keyboard";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";

type ViewStatus = "loading" | "error" | "missing" | "success";

const KIND_ICONS = { motion: Film, still: ImageIcon, audio: AudioLines } as const;

/** Last path segment — rows read as the file, the full ref stays in the detail pane. */
function baseName(ref: string): string {
  return ref.split("/").at(-1) ?? ref;
}

/**
 * Videos, detail (B-ve.2): one project's takes (keeper/reject with the
 * reason inline — the learning material), versioned cuts with their EDL
 * summaries, and per-take provenance. Strictly read-only: the retake verb
 * and the approve door arrive with B-ve.3/4 behind the judge gate.
 */
export function ProjectBrowser({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null);
  const [openCutId, setOpenCutId] = useState<string | null>(null);
  const selectedRef = useRef<HTMLLIElement | null>(null);

  const load = useCallback(
    () =>
      fetchProjectDetail(projectId)
        .then((data) => {
          if (!data) {
            setStatus("missing");
            return;
          }
          setDetail(data);
          setSelectedTakeId((current) => current ?? data.takes[0]?.id ?? null);
          setStatus("success");
        })
        .catch(() => {
          setStatus("error");
        }),
    [projectId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const takes = detail?.takes ?? [];
  const selectedTake = takes.find((t) => t.id === selectedTakeId) ?? null;
  const moveSelection = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (takes.length === 0) return;
    event.preventDefault();
    const current = takes.findIndex((t) => t.id === selectedTakeId);
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), takes.length - 1);
    setSelectedTakeId(takes[next].id);
  };
  useListKeys({
    enabled: status === "success",
    bindings: { j: moveSelection(1), k: moveSelection(-1) },
  });
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedTakeId]);

  const keepers = takes.filter((t) => t.disposition === "keeper").length;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <p aria-live="polite" className="sr-only">
        {selectedTake ? `Selected ${baseName(selectedTake.ref)}` : ""}
      </p>
      <Link
        href="/app/videos"
        className="inline-flex items-center gap-1 self-start text-xs text-primary hover:underline"
      >
        <ArrowLeft aria-hidden className="size-3" /> All projects
      </Link>

      {status === "loading" && (
        <div className="flex flex-col gap-3" aria-label="Loading project">
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
        </div>
      )}
      {status === "error" && (
        <ErrorNotice
          message="Couldn’t load this project."
          onRetry={() => {
            setStatus("loading");
            void load();
          }}
        />
      )}
      {status === "missing" && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            This project doesn’t exist (or belongs to another tenant).
          </CardContent>
        </Card>
      )}

      {status === "success" && detail && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Clapperboard aria-hidden className="size-4 text-muted-foreground" />
                {detail.name}
                <span className="ml-auto flex items-center gap-1.5">
                  <Badge variant="outline" className="u-tabular">
                    {keepers} keeper{keepers === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline" className="u-tabular">
                    {takes.length - keepers} reject{takes.length - keepers === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="secondary" className="u-tabular">
                    {detail.cuts.length} cut{detail.cuts.length === 1 ? "" : "s"}
                  </Badge>
                </span>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-baseline gap-x-3">
                <span>{detail.description ?? "No description."}</span>
                <span className="u-eyebrow whitespace-nowrap text-muted-foreground">
                  keys · j/k move take
                </span>
              </CardDescription>
            </CardHeader>
            {!detail.playable && (
              <CardContent className="pt-0 text-xs text-muted-foreground">
                No media root configured on this box — refs and reasons listed, playback off.
              </CardContent>
            )}
          </Card>

          {/* min-w-0 on both grid items: a grid item's min-width:auto would let
              the nowrap/truncate rows dictate page width on mobile. */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Takes</CardTitle>
                <CardDescription>
                  Keepers and rejects per beat — every reject carries its reason, on record.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {takes.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    No takes recorded for this project yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {takes.map((take, i) => {
                      const KindIcon = KIND_ICONS[take.kind];
                      const slotHeads =
                        i === 0 || takes[i - 1].slot !== take.slot ? (
                          <p className="u-eyebrow mt-2 mb-1 text-muted-foreground first:mt-0">
                            {take.slot ?? "unslotted"}
                          </p>
                        ) : null;
                      return (
                        <li
                          key={take.id}
                          ref={take.id === selectedTakeId ? selectedRef : undefined}
                        >
                          {slotHeads}
                          <button
                            type="button"
                            onClick={() => setSelectedTakeId(take.id)}
                            aria-pressed={take.id === selectedTakeId}
                            className={cn(
                              "flex w-full flex-wrap items-center gap-2 rounded-lg border border-border p-2.5 text-left",
                              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                              take.id === selectedTakeId ? SELECTED_ROW : "hover:bg-muted/60",
                            )}
                          >
                            <KindIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-xs">
                                {baseName(take.ref)}
                              </span>
                              {take.disposition === "reject" && take.reason && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {take.reason}
                                </span>
                              )}
                            </span>
                            <Badge
                              variant={take.disposition === "reject" ? "destructive" : "secondary"}
                            >
                              {take.disposition}
                            </Badge>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <TakePanel projectId={detail.id} take={selectedTake} playable={detail.playable} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cuts</CardTitle>
              <CardDescription>
                Versioned outputs and the EDL that built each — an edit is always a new version.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.cuts.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No cuts recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {detail.cuts.map((cut) => (
                    <CutRow
                      key={cut.id}
                      projectId={detail.id}
                      cut={cut}
                      playable={detail.playable}
                      open={openCutId === cut.id}
                      onToggle={() => setOpenCutId((c) => (c === cut.id ? null : cut.id))}
                    />
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

/** Right pane: the selected take — preview, verdict + reason, provenance. */
function TakePanel({
  projectId,
  take,
  playable,
}: {
  projectId: string;
  take: TakeView | null;
  playable: boolean;
}) {
  return (
    <Card className="min-w-0 self-start lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle>Take</CardTitle>
        <CardDescription>
          {take ? "Preview, verdict, and pinned provenance." : "Select a take to inspect it."}
        </CardDescription>
      </CardHeader>
      {take && (
        <CardContent className="flex flex-col gap-3">
          {playable && <TakePreview projectId={projectId} take={take} />}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={take.disposition === "reject" ? "destructive" : "secondary"}>
              {take.disposition}
            </Badge>
            {take.slot && <Badge variant="outline">{take.slot}</Badge>}
            <Badge variant="outline">{take.kind}</Badge>
            <time dateTime={take.createdAt} className="ml-auto text-xs text-muted-foreground">
              {timeAgo(take.createdAt)}
            </time>
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">{take.ref}</p>
          {take.reason && (
            <div className="rounded-md bg-destructive/10 px-2.5 py-1.5">
              <p className="u-eyebrow text-destructive">why rejected</p>
              <p className="text-sm text-destructive">{take.reason}</p>
            </div>
          )}
          <div>
            <p className="u-eyebrow mb-1 text-muted-foreground">provenance</p>
            {Object.keys(take.provenance).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing pinned for this take.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                {Object.entries(take.provenance)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="text-xs text-muted-foreground">{key}</dt>
                      <dd className="break-all font-mono text-xs">
                        {typeof value === "string" ? value : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function TakePreview({ projectId, take }: { projectId: string; take: TakeView }) {
  const src = mediaUrl(projectId, take.ref);
  if (take.kind === "motion") {
    // Raw takes have no caption track — captions are an EDL lane, burned in at render.
    return <video controls preload="metadata" src={src} className="w-full rounded-lg border border-border bg-muted" />;
  }
  if (take.kind === "still") {
    return (
      <img
        src={src}
        alt={`Still take ${baseName(take.ref)}`}
        loading="lazy"
        className="w-full rounded-lg border border-border bg-muted"
      />
    );
  }
  return <audio controls preload="metadata" src={src} className="w-full" />;
}

function CutRow({
  projectId,
  cut,
  playable,
  open,
  onToggle,
}: {
  projectId: string;
  cut: CutView;
  playable: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const canPlay = playable && cut.outputRef !== null;
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{cut.name}</span>
        <Badge variant="outline" className="u-tabular">
          v{cut.version}
        </Badge>
        <Badge variant={cut.status === "draft" ? "outline" : "secondary"}>{cut.status}</Badge>
        <span className="u-tabular text-xs text-muted-foreground">
          {cut.edl.beats} beat{cut.edl.beats === 1 ? "" : "s"} · {cut.edl.captionLines} caption
          {cut.edl.captionLines === 1 ? "" : "s"} · music {cut.edl.audio} · {cut.edl.width}×
          {cut.edl.height} @ {cut.edl.fps}fps · {cut.edl.duration}s
        </span>
        <span className="ml-auto flex items-center gap-2">
          <time dateTime={cut.createdAt} className="text-xs text-muted-foreground">
            {timeAgo(cut.createdAt)}
          </time>
          {canPlay && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {open ? "hide" : "play"}
            </button>
          )}
        </span>
      </div>
      {cut.outputRef && (
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{cut.outputRef}</p>
      )}
      {open && canPlay && (
        <video
          controls
          preload="metadata"
          src={mediaUrl(projectId, cut.outputRef as string)}
          className="mt-2 w-full rounded-lg border border-border bg-muted"
        />
      )}
    </li>
  );
}
