"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyArt } from "@/components/ui/empty-art";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { cn } from "@/lib/utils";
import { assetStages, kanbanColumns, type StageView } from "@/lib/workspace/pipeline";
import { timeAgo } from "@/lib/workspace/format";
import type { PipelineAsset } from "@/lib/workspace/types";

export type PipelineStatus = "loading" | "error" | "success";

interface PipelineBoardProps {
  status: PipelineStatus;
  assets: PipelineAsset[];
  onRetry?: () => void;
}

type Lens = "steps" | "board";

const STEPPER_CAP = 8;
const COLUMN_CAP = 6;

function assetHref(asset: PipelineAsset): string {
  return `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`;
}

function assetName(asset: PipelineAsset): string {
  return asset.format ? `${asset.platform} · ${asset.format}` : asset.platform;
}

/** One stage on the rail: a dot that is filled (done), amber (waits on you — word carried, never color alone) or hollow (not reached). */
function StageDot({ stage }: { stage: StageView }) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full border",
          stage.state === "done" && "border-foreground bg-foreground",
          stage.state === "attention" && "border-signal bg-signal",
          stage.state === "pending" && "border-border bg-transparent",
        )}
      />
      <span
        className={cn(
          "font-mono text-2xs",
          stage.state === "attention"
            ? "font-medium text-signal"
            : stage.state === "done"
              ? "text-foreground"
              : "text-muted-foreground",
        )}
      >
        {stage.label}
        {stage.state === "pending" && <span className="sr-only"> — not reached</span>}
      </span>
    </>
  );
  return stage.href ? (
    <Link
      href={stage.href}
      title={stage.detail ?? undefined}
      className="flex items-center gap-1.5 rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {body}
    </Link>
  ) : (
    <span title={stage.detail ?? undefined} className="flex items-center gap-1.5">
      {body}
    </span>
  );
}

function StepperRow({ asset }: { asset: PipelineAsset }) {
  const stages = assetStages(asset);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{assetName(asset)}</span>
        <Badge variant={asset.status === "blocked" || asset.status === "queued" ? "signal" : "outline"}>
          {asset.status}
        </Badge>
        <time dateTime={asset.generatedAt} className="ml-auto text-xs text-muted-foreground">
          {timeAgo(asset.generatedAt)}
        </time>
        <Link
          href={assetHref(asset)}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          open <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>
      <ol aria-label={`${assetName(asset)} journey`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {stages.map((stage, i) => (
          <li key={stage.key} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="h-px w-4 bg-border" />}
            <StageDot stage={stage} />
          </li>
        ))}
      </ol>
      {asset.status === "blocked" && asset.reasons.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why: </span>
          {asset.reasons[0]}
        </p>
      )}
    </li>
  );
}

function BoardCard({ asset }: { asset: PipelineAsset }) {
  return (
    <li>
      <Link
        href={assetHref(asset)}
        className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card p-2 transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="text-xs font-medium">{assetName(asset)}</span>
        <span className="u-tabular text-2xs text-muted-foreground">{timeAgo(asset.generatedAt)}</span>
        {asset.status === "blocked" && asset.reasons.length > 0 && (
          <span className="line-clamp-2 text-2xs text-muted-foreground">{asset.reasons[0]}</span>
        )}
        {asset.deployRef && <span className="text-2xs text-muted-foreground">live on site</span>}
      </Link>
    </li>
  );
}

/**
 * §10 item 3 + the kanban lens (founder direction, session 38): every recent
 * asset's journey through the pipeline — one dataset, two lenses. The stepper
 * reads each asset's lineage left to right (each reached stage opens its
 * artifact); the board groups the same rows by the stage they sit in now.
 */
export function PipelineBoard({ status, assets, onRetry }: PipelineBoardProps) {
  const [lens, setLens] = useState<Lens>("steps");
  const { columns, rejected } = kanbanColumns(assets);
  const inFlight = assets.filter((a) => a.status !== "rejected");

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle>In the pipeline</CardTitle>
          <CardDescription>
            Where every recent draft stands, capture to publish — each step opens its artifact.
          </CardDescription>
        </div>
        <div role="group" aria-label="Pipeline lens" className="flex gap-1">
          <Button
            size="sm"
            variant={lens === "steps" ? "secondary" : "ghost"}
            aria-pressed={lens === "steps"}
            onClick={() => setLens("steps")}
          >
            Steps
          </Button>
          <Button
            size="sm"
            variant={lens === "board" ? "secondary" : "ghost"}
            aria-pressed={lens === "board"}
            onClick={() => setLens("board")}
          >
            Board
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === "loading" && (
          <div className="flex flex-col gap-2" aria-label="Loading pipeline">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        {status === "error" && <ErrorNotice message="Couldn’t load the pipeline." onRetry={onRetry} />}
        {status === "success" && inFlight.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <EmptyArt asset="stepStoryboard" size="sm" />
            <p className="text-sm text-muted-foreground">
              Nothing in flight — promote an intel card or create from a prompt, and every draft&rsquo;s
              journey shows up here step by step.
            </p>
          </div>
        )}
        {status === "success" && inFlight.length > 0 && lens === "steps" && (
          <>
            <ol className="flex flex-col gap-2">
              {inFlight.slice(0, STEPPER_CAP).map((asset) => (
                <StepperRow key={asset.draftId} asset={asset} />
              ))}
            </ol>
            {inFlight.length > STEPPER_CAP && (
              <Link href="/app/approve" className="text-xs text-primary hover:underline">
                {inFlight.length - STEPPER_CAP} more in the queue →
              </Link>
            )}
          </>
        )}
        {status === "success" && inFlight.length > 0 && lens === "board" && (
          <>
            <div className="overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-4 gap-2">
                {columns.map((column) => (
                  <section key={column.key} aria-label={column.label} className="flex flex-col gap-2">
                    <p className="flex items-baseline gap-1.5 border-b border-border/60 pb-1">
                      <span className="u-eyebrow text-muted-foreground">{column.label}</span>
                      <span
                        className={cn(
                          "u-tabular ml-auto text-xs",
                          column.needsYou && column.assets.length > 0
                            ? "font-medium text-signal"
                            : "text-muted-foreground",
                        )}
                      >
                        {column.assets.length}
                      </span>
                    </p>
                    <ul className="flex flex-col gap-2">
                      {column.assets.slice(0, COLUMN_CAP).map((asset) => (
                        <BoardCard key={asset.draftId} asset={asset} />
                      ))}
                    </ul>
                    {column.assets.length > COLUMN_CAP && (
                      <p className="text-2xs text-muted-foreground">
                        +{column.assets.length - COLUMN_CAP} more
                      </p>
                    )}
                  </section>
                ))}
              </div>
            </div>
            {rejected > 0 && (
              <p className="text-xs text-muted-foreground">
                {rejected} rejected in this window — closed, not shown as cards.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
