"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, RefreshCw, Upload, Users, X } from "lucide-react";
import { LeadCard } from "@/components/leads/lead-card";
import { WeightsProvenance } from "@/components/leads/weights-provenance";
import { Badge } from "@/components/ui/badge";
import { EmptyArt } from "@/components/ui/empty-art";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionToast, type ToastState } from "@/components/workspace/action-toast";
import { BulkBar } from "@/components/workspace/bulk-bar";
import type { CreateFamily } from "@/lib/intel/types";
import {
  fetchLeads,
  importLeadsCsv,
  learnWeightsNow,
  promoteLeadTo,
  scoreLeadsNow,
  syncWaitlist,
  triageLeads,
} from "@/lib/leads/client";
import { compareLeadCards } from "@/lib/leads/serialize";
import type { ImportReport, LeadsPayload, TriageAction } from "@/lib/leads/types";
import { cn } from "@/lib/utils";
import { useListKeys } from "@/lib/workspace/keyboard";

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
  // The keyboard cursor (s40 grammar parity): the card j/k moved to — what
  // x/d/h act on. Distinct from `selected`, the checkbox set bulk acts on.
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
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

  // Terminal outcomes (dismiss) confirm via the toast with a way back to the
  // Dismissed tab; informational results return a string for the notice line.
  async function run(work: () => Promise<string | null>) {
    setBusy(true);
    setNotice(null);
    try {
      const message = await work();
      if (message !== null) setNotice(message);
      await reload();
    } catch (err) {
      // Engine/gateway refusals surface verbatim — an honest error beats a fake spinner.
      setNotice(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const viewDismissed = { label: "View dismissed", onClick: () => setTab("dismissed") };

  function onTriage(action: TriageAction, id: string) {
    void run(async () => {
      const result = await triageLeads(action, [id]);
      if (result.failed.length > 0) return result.failed[0].error;
      if (action !== "dismiss") return "Saved.";
      setToast({
        message: "Lead dismissed — that signal tunes the ranking.",
        action: viewDismissed,
      });
      return null;
    });
  }

  function onBulkDismiss() {
    // The ONE named confirm lives in BulkBar (FRONTEND §0), never per item.
    const ids = [...selected];
    void run(async () => {
      const result = await triageLeads("dismiss", ids);
      setSelected(new Set());
      if (result.failed.length > 0) {
        return `Dismissed ${result.done}; ${result.failed.length} failed (${result.failed[0].error}).`;
      }
      setToast({
        message: `Dismissed ${result.done} lead${result.done === 1 ? "" : "s"}.`,
        action: viewDismissed,
      });
      return null;
    });
  }

  function onPromote(id: string, family: CreateFamily) {
    void run(async () => {
      const { createHref } = await promoteLeadTo(id, family);
      router.push(createHref);
      return "Opening Create with the lead's context…";
    });
  }

  function onLearnWeights() {
    void run(async () => {
      const report = await learnWeightsNow();
      if (!report.armed) return report.reason ?? "Learning is not armed.";
      if (report.verdicts === 0) {
        return "Nothing to learn from yet — dismiss or hot-pick a few scored leads; every verdict teaches the ranking.";
      }
      if (!report.created) return "No change — the learned weights already reflect every verdict.";
      return `Learned new weights from ${report.verdicts} verdict${report.verdicts === 1 ? "" : "s"} — Score now applies them.`;
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

  // Keyboard grammar parity (s40, the approve queue's j/k + act keys): j/k
  // move the cursor, x picks it for bulk, d is this surface's Four-Verbs
  // word — Dismiss — and h toggles the hot pick.
  const cursorIndex = visible.findIndex((lead) => lead.id === cursorId);
  const cursorLead = cursorIndex === -1 ? null : visible[cursorIndex];
  const moveCursor = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (visible.length === 0) return;
    event.preventDefault();
    const next =
      cursorIndex === -1 ? 0 : Math.min(Math.max(cursorIndex + delta, 0), visible.length - 1);
    setCursorId(visible[next].id);
  };
  useListKeys({
    enabled: !busy && payload !== null,
    bindings: {
      j: moveCursor(1),
      k: moveCursor(-1),
      x: (event) => {
        if (!cursorLead) return;
        event.preventDefault();
        onSelect(cursorLead.id, !selected.has(cursorLead.id));
      },
      d: (event) => {
        if (!cursorLead || cursorLead.status === "dismissed") return;
        event.preventDefault();
        // Triage keeps flowing: the cursor lands on the neighbour before the
        // dismissed card leaves the list.
        const neighbour = visible[cursorIndex + 1] ?? visible[cursorIndex - 1] ?? null;
        setCursorId(neighbour?.id ?? null);
        onTriage("dismiss", cursorLead.id);
      },
      h: (event) => {
        if (!cursorLead) return;
        event.preventDefault();
        onTriage(cursorLead.pinned ? "unpin" : "pin", cursorLead.id);
      },
    },
  });

  // Keep the cursor card in view while j/k cruises (jsdom-safe call).
  useEffect(() => {
    if (!cursorId) return;
    document
      .querySelector(`[data-testid="lead-card-${cursorId}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [cursorId]);

  const counts = payload?.counts ?? { new: 0, scored: 0, dismissed: 0 };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* j/k is a silent context change for screen readers without this
          (the approve queue's live-region precedent). */}
      <p aria-live="polite" className="sr-only">
        {cursorLead
          ? `Selected lead ${cursorLead.name || cursorLead.company || cursorLead.email}`
          : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Leads</h2>
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

      {payload?.scoringArmed &&
        (payload.leads.length > 0 ||
          payload.learnedWeights.state !== null ||
          payload.learnedWeights.staleForProfile) && (
          <WeightsProvenance
            info={payload.learnedWeights}
            leads={payload.leads}
            busy={busy}
            onLearn={onLearnWeights}
          />
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

      {visible.length > 0 && (
        <p className="u-eyebrow text-muted-foreground">
          keys · j/k select · x pick · d dismiss · h hot
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

      <BulkBar
        count={selected.size}
        busy={busy}
        actionLabel={
          <>
            <X aria-hidden className="size-3.5" /> Dismiss selected
          </>
        }
        confirmMessage={`Dismiss ${selected.size} selected lead${selected.size === 1 ? "" : "s"}?`}
        onAction={onBulkDismiss}
        onClear={() => setSelected(new Set())}
      />

      {payload && visible.length === 0 && (
        <Card>
          <CardHeader>
            {tab === "queue" && <EmptyArt asset="emptyLeads" />}
            <CardTitle>
              {tab === "queue" ? "No leads yet — three ways in" : "Nothing dismissed"}
            </CardTitle>
            {tab === "queue" && (
              <CardDescription>
                <strong>Import a CSV</strong> (any CRM export works) · <strong>Sync waitlist</strong>{" "}
                (every signup becomes a lead) · or leads arrive via the API. With an ICP on your
                profile, each one gets scored against who you actually sell to — with the reasons
                spelled out, and one-click exits into a post, video, or page briefed by the
                lead&rsquo;s own context. <Flame aria-hidden className="inline size-3.5" /> The
                →Email exit drafts judge-gated outreach you send yourself; DM drafts come later.
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
            cursor={lead.id === cursorId}
            busy={busy}
            currentProfileHash={payload?.currentProfileHash ?? null}
            onSelect={onSelect}
            onTriage={onTriage}
            onPromote={onPromote}
          />
        ))}
      </div>
      <ActionToast toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}
