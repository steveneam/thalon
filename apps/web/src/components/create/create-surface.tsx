"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Globe, Sparkles, Video, X } from "lucide-react";
import { HeatGrade } from "@/components/intel/heat-grade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreateContext, CreateFamily } from "@/lib/intel/types";
import { cn } from "@/lib/utils";

export type { CreateFamily } from "@/lib/intel/types";

interface CreateSurfaceProps {
  /** Prompt seed handed over by the omnibox (?prompt=) — the legacy text door. */
  initialPrompt: string;
  /** Keyword context from a ?keyword= deep link (legacy door; ctx carries it now). */
  initialKeyword: string;
  /** Family pre-pick from the omnibox heuristic — the picker stays changeable. */
  initialFamily?: CreateFamily;
  /** The structured intel context behind a capture id (wave-3 §3) — null when absent/expired. */
  context?: CreateContext | null;
}

const FAMILIES = [
  {
    id: "post" as const,
    label: "Post",
    icon: FileText,
    hint: "Platform-fanned social posts, judged before you see them",
  },
  {
    id: "video" as const,
    label: "Video",
    icon: Video,
    hint: "One-prompt or advanced staged mode with storyboard + direction",
  },
  {
    id: "page" as const,
    label: "Page",
    icon: Globe,
    hint: "A web page written against your keyword targets",
  },
];

/** The chip-renderable slice of the context, in display order. */
const CHIP_FIELDS = [
  { key: "title", label: "title" },
  { key: "angle", label: "angle" },
  { key: "hook", label: "hook" },
  { key: "areaName", label: "area" },
  { key: "keyword", label: "keyword" },
  { key: "company", label: "company" },
  { key: "contact", label: "contact" },
  { key: "role", label: "role" },
  { key: "painPoint", label: "pain point" },
  { key: "text", label: "source text" },
] as const;

type ChipKey = (typeof CHIP_FIELDS)[number]["key"];

/**
 * Create (B6.2, wave-3 context spine): prompt-first entry to the three
 * families. An intel handoff arrives as a capture id whose context renders
 * as REMOVABLE chips — the operator sees exactly what flows into
 * generation and can prune it; nothing is ever retyped. The live
 * origination wiring is B6.6 — until it lands, video routes into the
 * staged demo flow and post/page state their seam honestly.
 */
export function CreateSurface({ initialPrompt, initialKeyword, initialFamily, context }: CreateSurfaceProps) {
  // Pre-fill, never re-ask: the picked title becomes the working title.
  const [prompt, setPrompt] = useState(initialPrompt || context?.title || "");
  const [family, setFamily] = useState<CreateFamily>(
    initialFamily ??
      context?.family ??
      (initialPrompt || initialKeyword ? "post" : "video"),
  );
  const [chips, setChips] = useState<Array<{ key: ChipKey; label: string; value: string }>>(() =>
    context
      ? CHIP_FIELDS.flatMap(({ key, label }) => {
          const value = context[key];
          return typeof value === "string" && value.length > 0 ? [{ key, label, value }] : [];
        })
      : [],
  );

  function removeChip(key: ChipKey) {
    setChips((current) => current.filter((chip) => chip.key !== key));
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>What do you want to create?</CardTitle>
          <CardDescription>
            One prompt in — posts, videos, pages out. Nothing ships without your approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <textarea
            aria-label="Creation prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Announce the staged video flow — why deterministic beats timeline editors"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />

          {chips.length > 0 && (
            <div
              aria-label={context?.kind === "lead_promote" ? "Lead context" : "Intel context"}
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-2.5"
            >
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles aria-hidden className="size-3.5 text-primary" />
                {context?.kind === "lead_promote" ? "Lead" : "Intel"} context — rides into
                generation; remove anything you don&rsquo;t want.
                {typeof context?.score === "number" && (
                  <HeatGrade score={context.score} className="ml-auto" />
                )}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <li
                    key={chip.key}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-1 pr-1 pl-2.5 text-xs"
                  >
                    <span className="u-eyebrow shrink-0 text-muted-foreground">{chip.label}</span>
                    <span className="truncate">{chip.value}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${chip.label} from the context`}
                      onClick={() => removeChip(chip.key)}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <X aria-hidden className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
              {context?.sourceUrl && (
                <p className="text-xs text-muted-foreground">
                  provenance:{" "}
                  <a href={context.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {context.kind === "lead_promote" ? "the lead's website" : "original item"}
                  </a>
                </p>
              )}
            </div>
          )}

          {initialKeyword && chips.length === 0 && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              Search context from Intel:
              <Badge variant="outline" className="font-mono">{initialKeyword}</Badge>
              — rides into generation as a keyword target.
            </p>
          )}
          <div role="group" aria-label="Output family" className="grid gap-2 sm:grid-cols-3">
            {FAMILIES.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={family === f.id}
                  onClick={() => setFamily(f.id)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    family === f.id
                      ? "border-primary/50 bg-primary/10"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <Icon aria-hidden className={cn("size-4", family === f.id && "text-primary")} />
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{f.hint}</span>
                </button>
              );
            })}
          </div>

          {family === "video" ? (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
              <p className="text-sm">
                The staged video flow is live on fake drivers — feel the full
                structure → scenes → polish walk with zero spend. Your prompt seeds the demo run in
                the queue.
              </p>
              <Button asChild size="sm" className="self-start">
                <Link href="/app/approve">
                  Walk the staged demo <ArrowRight aria-hidden data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              Live {family} generation from this box wires up with the B6.6 origination loop — the
              engine and judge lane already exist; this surface connects to them next. Your prompt
              and Intel context are ready to ride along.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
