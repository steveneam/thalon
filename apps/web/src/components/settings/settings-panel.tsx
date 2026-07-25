"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchStatus } from "@/lib/workspace/client";
import type { WorkspaceStatus } from "@/lib/workspace/types";

type PanelStatus = "loading" | "error" | "success";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="font-mono">
        {value}
      </Badge>
    </div>
  );
}

/**
 * Settings (B6.2): watchlists/areas config lives on Intel; here — budget
 * caps and the driver-selection readout. Everything is READ-ONLY display of
 * the platform env choke point: drivers flip via env, never in the UI
 * (SPINE §3.2 — the one Zod-validated config module).
 */
export function SettingsPanel() {
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [data, setData] = useState<WorkspaceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStatus()
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Connect destinations — social accounts, your website, newsletter, intel sources.
            Credentials seal into the per-tenant vault; every card states its honest status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/app/settings/integrations"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Manage integrations <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Watchlists &amp; monitored areas</CardTitle>
          <CardDescription>
            What the intel pollers watch is per-tenant runtime config — managed on the Intel
            surface, next to what it produces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/intel" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Manage monitored areas <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget caps</CardTitle>
          <CardDescription>
            Every model call meters through the gateway guard; the daily token budget is a hard
            operational halt, not a verdict.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "success" && data && (
            <Row label="daily token budget / tenant" value={data.budget.tenantDailyTokens.toLocaleString("en-US")} />
          )}
          {status === "loading" && <p className="text-sm text-muted-foreground">Reading…</p>}
          {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t read settings.</p>}
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            Set via <code className="font-mono">TENANT_DAILY_TOKEN_BUDGET</code>.
          </p>
        </CardContent>
      </Card>

      {status === "success" && data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Drivers</CardTitle>
              <CardDescription>
                Which driver each registry seam selected — env-flipped at the platform choke point,
                read-only here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Row label="render (RENDER_DRIVER)" value={data.drivers.render} />
              <Row label="transcript (TRANSCRIPT_PROVIDER)" value={data.drivers.transcript} />
              <Row label="search intel (SEARCH_INTEL_SOURCE)" value={data.drivers.searchIntel} />
              <Row label="operated tenant (DEMO_TENANT_SLUG)" value={data.tenantSlug} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seams &amp; models</CardTitle>
              <CardDescription>The dev→prod seams and the model tiers in use.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-6 sm:grid-cols-2">
              <div>
                <Row label="database" value={data.seams.db} />
                <Row label="object store" value={data.seams.objectStore} />
                <Row label="queue" value={data.seams.queue} />
                <Row label="auth" value={data.seams.auth} />
                <Row label="gateway" value={data.seams.gateway} />
                <Row label="tracing" value={data.seams.tracing} />
              </div>
              <div>
                <Row label="draft model" value={data.models.draft} />
                <Row label="judge screen" value={data.models.judgeScreen} />
                <Row label="judge final" value={data.models.judgeFinal} />
                <Row label="embedding" value={data.models.embedding} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
