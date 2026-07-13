"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, RefreshCw, Upload, Users, X } from "lucide-react";
import { LeadCard } from "@/components/leads/lead-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreateFamily } from "@/lib/intel/types";
import {
  fetchLeads,
  importLeadsCsv,
  promoteLeadTo,
  scoreLeadsNow,
  syncWaitlist,
  triageLeads,
} from "@/lib/leads/client";
import { compareLeadCards } from "@/lib/leads/serialize";
import type { ImportReport, LeadsPayload, TriageAction } from "@/lib/leads/types";
import { cn } from "@/lib/utils";

type QueueTab = "queue" | "dismissed";

/**
 * The Leads queue (B-crm.2): ranked lead cards with thermal grades and
 * verbatim reasons — the CRM as a doorway into the same Create surfaces
 * every other feature feeds. Bulk actions per FRONTEND §0 (multi-select +
 * mass dismiss, one confirm with a count). Empty state is a tutorial: CSV
 * import (standard CRM headers), waitlist sync, and the ICP pointer.
 */
export function LeadsSurface() {
  const router = useRouter();
  const [payload, setPayload] = useState<LeadsPayload | null>(null);
  const [tab, setTab] = useState<QueueTab>("queue");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [lastImport, setLastImport] = useState<ImportReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setPayload(await fetchLeads());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchLeads()
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setNotice(err instanceof Error ? err.message : "failed to load leads");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const leads = payload?.leads ?? [];
    const filtered =
      tab === "queue"
        ? leads.filter((l) => l.status !== "dismissed")
        : leads.filter((l) => l.status === "dismissed");
    return [...filtered].sort(compareLeadCards);
  }, [payload, tab]);

  async function run(work: () => Promise<string>) {
    setBusy(true);
    setNotice(null);
    try {
      const message = await work();
      setNotice(message);
      await reload();
    } catch (err) {
      // Engine/gateway refusals surface verbatim — an honest error beats a fake spinner.
      setNotice(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function onTriage(action: TriageAction, id: string) {
    void run(async () => {
      const result = await triageLeads(action, [id]);
      if (result.failed.length > 0) return result.failed[0].error;
      return action === "dismiss" ? "Lead dismissed — that's signal, it tunes the ranking." : "Saved.";
    });
  }

  function onBulkDismiss() {
    const ids = [...selected];
    // Destructive bulk op: confirm ONCE with the count (FRONTEND §0), never per item.
    if (!window.confirm(`Dismiss ${ids.length} selected lead${ids.length === 1 ? "" : "s"}?`)) return;
    void run(async () => {
      const result = await triageLeads("dismiss", ids);
      setSelected(new Set());
      return result.failed.length === 0
        ? `Dismissed ${result.done} lead${result.done === 1 ? "" : "s"}.`
        : `Dismissed ${result.done}; ${result.failed.length} failed (${result.failed[0].error}).`;
    });
  }

  function onPromote(id: string, family: CreateFamily) {
    void run(async () => {
      const { createHref } = await promoteLeadTo(id, family);
      router.push(createHref);
      return "Opening Create with the lead's context…";
    });
  }

  function onImportText(csv: string) {
    void run(async () => {
      const { report, scoring } = await importLeadsCsv(csv);
      setLastImport(report);
      setImportOpen(false);
      const scored = scoring.armed ? ` · ${scoring.scored} scored` : " · scoring not armed (add an ICP)";
      return `Imported ${report.added} of ${report.rows} rows (${report.duplicates} duplicates, ${report.invalid} invalid)${scored}.`;
    });
  }

  function onSelect(id: string, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const counts = payload?.counts ?? { new: 0, scored: 0, dismissed: 0 };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Leads</h1>
        <Badge variant="outline">{counts.new + counts.scored} in queue</Badge>
        <span className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setImportOpen((v) => !v)}>
            <Upload aria-hidden className="size-3.5" /> Import CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const { sync, scoring } = await syncWaitlist();
                const scored = scoring.armed ? ` · ${scoring.scored} scored` : "";
                return `Waitlist synced: ${sync.added} new lead${sync.added === 1 ? "" : "s"} (${sync.existing} already bridged)${scored}.`;
              })
            }
          >
            <Users aria-hidden className="size-3.5" /> Sync waitlist
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !payload?.scoringArmed}
            title={payload?.scoringArmed ? undefined : "Add an ICP block to your profile first"}
            onClick={() =>
              void run(async () => {
                const scoring = await scoreLeadsNow();
                if (!scoring.armed) return scoring.reason ?? "Scoring is not armed.";
                return scoring.candidates === 0
                  ? "Nothing to score — every lead is current."
                  : `Scored ${scoring.scored} lead${scoring.scored === 1 ? "" : "s"} (${scoring.rescored} re-scored after the ICP change).`;
              })
            }
          >
            <RefreshCw aria-hidden className="size-3.5" /> Score now
          </Button>
        </span>
      </div>

      {payload && !payload.scoringArmed && (
        <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
          Lead scoring isn&rsquo;t armed yet: add an <strong>ICP block</strong> (who your ideal
          customer is) to the active profile and every lead gets a deterministic score with
          readable reasons.
        </p>
      )}

      {importOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Import contacts (CSV)</CardTitle>
            <CardDescription>
              Standard CRM headers work out of the box — HubSpot, Salesforce, Pipedrive exports, or{" "}
              <a href="/leads-template.csv" download className="text-primary hover:underline">
                our minimal template
              </a>
              . Email is required; unknown columns are kept on the lead. The file is parsed and
              discarded — never stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file"
              className="text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void file.text().then(onImportText);
              }}
            />
            {lastImport && lastImport.reasons.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {lastImport.invalid} invalid row{lastImport.invalid === 1 ? "" : "s"} from the last
                  import
                </summary>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {lastImport.reasons.map((r) => (
                    <li key={`${r.row}-${r.reason}`}>
                      row {r.row}: {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}

      <div role="tablist" aria-label="Lead lists" className="flex gap-1.5">
        {(
          [
            { id: "queue", label: `Queue (${counts.new + counts.scored})` },
            { id: "dismissed", label: `Dismissed (${counts.dismissed})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              tab === t.id ? "border-primary/50 bg-primary/10" : "border-border hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
          <span className="text-xs">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={onBulkDismiss}>
            <X aria-hidden className="size-3.5" /> Dismiss selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {payload && visible.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {tab === "queue" ? "No leads yet — three ways in" : "Nothing dismissed"}
            </CardTitle>
            {tab === "queue" && (
              <CardDescription>
                <strong>Import a CSV</strong> (any CRM export works) · <strong>Sync waitlist</strong>{" "}
                (every signup becomes a lead) · or leads arrive via the API. With an ICP on your
                profile, each one gets scored against who you actually sell to — with the reasons
                spelled out, and one-click exits into a post, video, or page briefed by the
                lead&rsquo;s own context. <Flame aria-hidden className="inline size-3.5" /> Outreach
                drafts (email/DM, judge-gated, approve-to-send) arrive with B-crm.4.
              </CardDescription>
            )}
          </CardHeader>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            selected={selected.has(lead.id)}
            busy={busy}
            currentProfileHash={payload?.currentProfileHash ?? null}
            onSelect={onSelect}
            onTriage={onTriage}
            onPromote={onPromote}
          />
        ))}
      </div>
    </div>
  );
}
