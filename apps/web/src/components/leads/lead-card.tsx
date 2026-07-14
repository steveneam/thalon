"use client";

import { ExternalLink, FileText, Flame, Globe, Mail, Video, X } from "lucide-react";
import { HeatGrade } from "@/components/intel/heat-grade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { CreateFamily } from "@/lib/intel/types";
import type { LeadCard as LeadCardData } from "@/lib/leads/types";
import { timeAgo } from "@/lib/workspace/format";

const EXITS: Array<{ family: CreateFamily; label: string; icon: typeof Video }> = [
  { family: "post", label: "Post", icon: FileText },
  { family: "video", label: "Video", icon: Video },
  { family: "page", label: "Page", icon: Globe },
  // B-crm.4 front half: drafts an outreach email from this lead's context —
  // judged, parked in the approve queue, sent manually by the operator.
  { family: "email", label: "Email", icon: Mail },
];

interface LeadCardProps {
  lead: LeadCardData;
  selected: boolean;
  busy: boolean;
  /** The current ICP hash — a card scored under a different one is honestly stale. */
  currentProfileHash: string | null;
  onSelect: (id: string, selected: boolean) => void;
  onTriage: (action: "dismiss" | "pin" | "unpin", id: string) => void;
  onPromote: (id: string, family: CreateFamily) => void;
}

/**
 * One lead as a ranked card + launchpad (the trend-card grammar): WHO it is,
 * the thermal grade, WHY it scored that way (reason strings verbatim), and
 * per-family exits — the CRM feeds the same Create surfaces every other
 * feature feeds (context flows forward, never retyped).
 */
export function LeadCard({
  lead,
  selected,
  busy,
  currentProfileHash,
  onSelect,
  onTriage,
  onPromote,
}: LeadCardProps) {
  const headline = lead.name || lead.company || lead.email;
  const stale =
    lead.profileHash !== null &&
    currentProfileHash !== null &&
    lead.profileHash !== currentProfileHash;

  return (
    <Card data-testid={`lead-card-${lead.id}`} className="gap-3">
      <CardHeader className="flex-row flex-wrap items-center gap-2">
        <input
          type="checkbox"
          aria-label={`Select ${headline}`}
          checked={selected}
          onChange={(e) => onSelect(lead.id, e.target.checked)}
          className="size-4 accent-primary"
        />
        <span className="text-sm font-medium">{headline}</span>
        {lead.company && lead.name && (
          <span className="text-xs text-muted-foreground">{lead.company}</span>
        )}
        {lead.role && <Badge variant="outline">{lead.role}</Badge>}
        <Badge variant="outline" className="font-mono">{lead.source}</Badge>
        {lead.pinned && (
          <Badge variant="signal">
            <Flame aria-hidden className="size-3" /> hot pick
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-2">
          {lead.score !== null ? (
            <HeatGrade score={lead.score} detail={lead.reasons[0]} />
          ) : (
            <Badge variant="outline">not scored yet</Badge>
          )}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {/* Contact info is the card's point (founder dogfood rider, s28): the address reads as foreground, copyable text — not card chrome. */}
        <p className="text-xs text-muted-foreground">
          <a
            href={`mailto:${lead.email}`}
            className="select-all text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {lead.email}
          </a>
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the lead's website"
              className="ml-1.5 inline-flex align-middle hover:text-primary"
            >
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
          <span className="ml-2">added {timeAgo(lead.createdAt)}</span>
          {stale && (
            <span className="ml-2 text-amber-700 dark:text-amber-500">
              scored against an older ICP — Score now refreshes it
            </span>
          )}
        </p>
        {lead.painPoint && (
          <p className="text-sm leading-snug">
            <span className="u-eyebrow mr-1.5 text-muted-foreground">pain point</span>
            {lead.painPoint}
          </p>
        )}
        {lead.notes && <p className="text-sm leading-snug">{lead.notes}</p>}
        {lead.reasons.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              why this score
            </summary>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {lead.reasons.map((reason) => (
                <li key={reason}>· {reason}</li>
              ))}
            </ul>
          </details>
        )}
        {/* s28 dogfood rider: a real export's extra columns (phones, tiers, …) were preserved but invisible — surface them. */}
        {lead.extras.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              everything else from the import ({lead.extras.length})
            </summary>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {lead.extras.map(({ key, value }) => (
                <span key={key} className="contents">
                  <dt className="font-medium">{key}</dt>
                  <dd className="break-all">{value}</dd>
                </span>
              ))}
            </dl>
          </details>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-1.5">
        {EXITS.map(({ family, label, icon: Icon }) => (
          <Button
            key={family}
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onPromote(lead.id, family)}
          >
            <Icon aria-hidden className="size-3.5" /> {label}
          </Button>
        ))}
        <span className="ml-auto flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onTriage(lead.pinned ? "unpin" : "pin", lead.id)}
          >
            <Flame aria-hidden className="size-3.5" /> {lead.pinned ? "Unmark hot" : "Mark hot"}
          </Button>
          {lead.status !== "dismissed" && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onTriage("dismiss", lead.id)}>
              <X aria-hidden className="size-3.5" /> Dismiss
            </Button>
          )}
        </span>
      </CardFooter>
    </Card>
  );
}
