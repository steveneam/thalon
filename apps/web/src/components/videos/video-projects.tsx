"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyArt } from "@/components/ui/empty-art";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { cn } from "@/lib/utils";
import { fetchProjectSummaries } from "@/lib/videos/client";
import type { ProjectSummary } from "@/lib/videos/types";
import { timeAgo } from "@/lib/workspace/format";
import { useListKeys } from "@/lib/workspace/keyboard";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";

type ListStatus = "loading" | "error" | "success";

/**
 * Videos, list (B-ve.2): every project with its keeper/reject/cut counts.
 * Read-only — a project lands here through the engine or the import script,
 * never through this surface. j/k grammar per DESIGN.md §5: selection moves,
 * Enter opens; no action letters because there are no actions.
 */
export function VideoProjects() {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<HTMLLIElement | null>(null);

  const load = useCallback(
    () =>
      fetchProjectSummaries()
        .then((data) => {
          setProjects(data);
          setSelectedId((current) => current ?? data[0]?.id ?? null);
          setStatus("success");
        })
        .catch(() => {
          setStatus("error");
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selected = projects.find((p) => p.id === selectedId);
  const moveSelection = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (projects.length === 0) return;
    event.preventDefault();
    const current = projects.findIndex((p) => p.id === selectedId);
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), projects.length - 1);
    setSelectedId(projects[next].id);
  };
  useListKeys({
    enabled: status === "success",
    bindings: {
      j: moveSelection(1),
      k: moveSelection(-1),
      Enter: (event) => {
        if (!selected) return;
        event.preventDefault();
        window.location.assign(`/app/videos/${selected.id}`);
      },
    },
  });
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <p aria-live="polite" className="sr-only">
        {selected ? `Selected ${selected.name}` : ""}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Video projects</CardTitle>
          <CardDescription className="flex flex-wrap items-baseline gap-x-3">
            <span>
              Every project with its takes, versioned cuts, and the reasons on record — the
              learning material behind each film.
            </span>
            <span className="u-eyebrow whitespace-nowrap text-muted-foreground">
              keys · j/k move · enter open
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col gap-2" aria-label="Loading video projects">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          )}
          {status === "error" && (
            <ErrorNotice
              message="Couldn’t load video projects."
              onRetry={() => {
                setStatus("loading");
                void load();
              }}
            />
          )}
          {status === "success" && projects.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-4 text-center">
              <EmptyArt asset="stepStoryboard" />
              <p className="text-sm text-muted-foreground">
                No video projects yet — a project lands here with its takes, cuts, and
                provenance the moment one is registered.
              </p>
            </div>
          )}
          {status === "success" && projects.length > 0 && (
            <ul className="flex flex-col gap-2">
              {projects.map((project) => (
                <li
                  key={project.id}
                  ref={project.id === selectedId ? selectedRef : undefined}
                  className={cn(
                    "rounded-lg border border-border",
                    project.id === selectedId && SELECTED_ROW,
                  )}
                >
                  <Link
                    href={`/app/videos/${project.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg p-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onFocus={() => setSelectedId(project.id)}
                  >
                    <Clapperboard aria-hidden className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{project.name}</span>
                    {project.description && (
                      <span className="truncate text-sm text-muted-foreground">
                        {project.description}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1.5">
                      <Badge variant="outline" className="u-tabular">
                        {project.keepers} keeper{project.keepers === 1 ? "" : "s"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="u-tabular"
                        title="Rejects carry their reasons — the learning material."
                      >
                        {project.rejects} reject{project.rejects === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="secondary" className="u-tabular">
                        {project.cuts} cut{project.cuts === 1 ? "" : "s"}
                      </Badge>
                    </span>
                    <time dateTime={project.createdAt} className="text-xs text-muted-foreground">
                      {timeAgo(project.createdAt)}
                    </time>
                    <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
