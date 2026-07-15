"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, X } from "lucide-react";
import { DemoBanner } from "@/components/intel/demo-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { HorizonCard } from "@/components/intel/horizon-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyArt } from "@/components/ui/empty-art";
import { addTarget, fetchHorizon, fetchTargets, setTargetStatus, targetThis } from "@/lib/intel/client";
import type { HorizonPayload, TargetRow } from "@/lib/intel/types";
import { cn } from "@/lib/utils";

type TabStatus = "loading" | "error" | "success";

/** Provenance labels for the origin badge — first origin wins, so the label is durable. */
const ORIGIN_LABEL: Record<TargetRow["origin"], string> = {
  profile_seed: "profile seed",
  ai_expansion: "ai expansion",
  operator: "operator",
};

/**
 * Search (Intel's second half, A13): keyword targets (real repo rows,
 * origin-tagged) + horizon-opportunity cards. Demand the tenant almost
 * ranks for — position × rising impressions × below-expected CTR.
 */
export function SearchTab() {
  const router = useRouter();
  const [status, setStatus] = useState<TabStatus>("loading");
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [horizon, setHorizon] = useState<HorizonPayload | null>(null);
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([fetchTargets(), fetchHorizon()])
        .then(([targetRows, horizonPayload]) => {
          setTargets(targetRows);
          setHorizon(horizonPayload);
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

  function retry() {
    setStatus("loading");
    void load();
  }

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

  async function submitAdd(event: React.FormEvent) {
    event.preventDefault();
    await withBusy(async () => {
      await addTarget(keyword);
      setKeyword("");
      setTargets(await fetchTargets());
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {status === "loading" && (
        <div className="flex flex-col gap-3" aria-label="Loading search intel">
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-3 xl:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      )}
      {status === "error" && <ErrorNotice message="Couldn’t load search intel." onRetry={retry} />}
      {status === "success" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Keyword targets</CardTitle>
              <CardDescription>
                The queries this tenant deliberately targets. Compiles from your profile (topics ×
                offers × audience × question forms) when the B6.5/B6.6 wiring arms — add targets by
                hand any time; a dismissal survives recompiles.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {targets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <EmptyArt asset="emptySearch" />
                  <p className="text-center text-sm text-muted-foreground">
                    No targets yet. Add the searches you want to win — e.g.{" "}
                    <em>&ldquo;ai content automation for startups&rdquo;</em>.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {targets.map((target) => (
                    <li
                      key={target.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-border px-3 py-2",
                        target.status === "dismissed" && "opacity-60",
                      )}
                    >
                      <span className="font-mono text-sm">{target.keyword}</span>
                      <Badge variant="outline">{ORIGIN_LABEL[target.origin]}</Badge>
                      {target.status === "dismissed" && <Badge variant="ghost">dismissed</Badge>}
                      <span className="ml-auto">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={busy}
                          aria-label={
                            target.status === "active"
                              ? `Dismiss target ${target.keyword}`
                              : `Reactivate target ${target.keyword}`
                          }
                          onClick={() =>
                            withBusy(async () => {
                              await setTargetStatus(
                                target.id,
                                target.status === "active" ? "dismissed" : "active",
                              );
                              setTargets(await fetchTargets());
                            })
                          }
                        >
                          {target.status === "active" ? <X aria-hidden /> : <RotateCcw aria-hidden />}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={submitAdd} className="flex gap-2 border-t border-border pt-3">
                <input
                  aria-label="New keyword target"
                  placeholder="Add a keyword to target"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <Button type="submit" size="sm" disabled={busy || !keyword.trim()}>
                  <Plus aria-hidden data-icon="inline-start" /> Add target
                </Button>
              </form>
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
            </CardContent>
          </Card>

          <section aria-label="Horizon opportunities" className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">Peering over the horizon</h2>
              <p className="text-xs text-muted-foreground">
                Queries you almost rank for: position 8–20, impressions rising, CTR below what the
                position should earn — demand worth targeting before it&rsquo;s competitive.
              </p>
            </div>
            {horizon?.demo && (
              <DemoBanner arming="Search Console polling arms once the site is deployed and verified (B6.7) — until then these cards demo the horizon math on the built-in dataset." />
            )}
            <div className="grid gap-3 xl:grid-cols-2">
              {(horizon?.cards ?? []).map((card) => (
                <HorizonCard
                  key={`${card.query}:${card.page}`}
                  card={card}
                  busy={busy}
                  onTarget={(query) =>
                    withBusy(async () => {
                      const { createHref } = await targetThis(query);
                      router.push(createHref);
                    })
                  }
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
