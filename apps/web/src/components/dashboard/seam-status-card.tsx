"use client";

import { Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceStatus } from "@/lib/workspace/types";

export type StatusCardStatus = "loading" | "error" | "success";

interface SeamStatusCardProps {
  status: StatusCardStatus;
  data: WorkspaceStatus | null;
}

/** One row of the readout: seam name → the driver the env choke point selected. */
function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant={ok === false ? "outline" : "secondary"} className="font-mono">
        {value}
      </Badge>
    </div>
  );
}

/**
 * The doctor's internals as a dashboard card: every dev→prod seam and which
 * driver the platform env choke point selected (read-only — drivers flip via
 * env, never in the UI).
 */
export function SeamStatusCard({ status, data }: SeamStatusCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Gauge aria-hidden className="size-4 text-primary" />
        <CardTitle>Seams &amp; drivers</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "loading" && <p className="text-sm text-muted-foreground">Reading seams…</p>}
        {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t read seam status.</p>}
        {status === "success" && data && (
          <div className="grid gap-x-6 sm:grid-cols-2">
            <div>
              <p className="u-eyebrow mb-1 text-muted-foreground">infrastructure</p>
              <Row label="database" value={data.seams.db} />
              <Row label="object store" value={data.seams.objectStore} />
              <Row label="queue" value={data.seams.queue} />
              <Row label="auth" value={data.seams.auth} />
              <Row label="gateway" value={data.seams.gateway} ok={data.seams.gateway === "configured"} />
              <Row label="tracing" value={data.seams.tracing} ok={data.seams.tracing === "configured"} />
            </div>
            <div>
              <p className="u-eyebrow mb-1 text-muted-foreground">drivers · models</p>
              <Row label="render" value={data.drivers.render} />
              <Row label="transcript" value={data.drivers.transcript} />
              <Row label="search intel" value={data.drivers.searchIntel} />
              <Row label="draft model" value={data.models.draft} />
              <Row label="judge final" value={data.models.judgeFinal} />
            </div>
          </div>
        )}
        {status === "success" && data && (
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            Selected by env at the platform choke point — see Settings for the full readout.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
