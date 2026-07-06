"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Globe, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CreateFamily = "post" | "video" | "page";

interface CreateSurfaceProps {
  /** Prompt seed handed over by Intel ("generate from this" / "target this"). */
  initialPrompt: string;
  /** Keyword context from the Search tab — rides into generation as a search target. */
  initialKeyword: string;
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

/**
 * Create (B6.2): prompt-first entry to the three families. The live
 * origination wiring is B6.6 — until it lands, video routes into the staged
 * demo flow (fake drivers, zero spend, reachable in the queue) and
 * post/page state their seam honestly instead of dead-ending. The prompt
 * box is the omnibox's landing target, pre-seeded by Intel handoffs.
 */
export function CreateSurface({ initialPrompt, initialKeyword }: CreateSurfaceProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [family, setFamily] = useState<CreateFamily>(initialPrompt || initialKeyword ? "post" : "video");

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
          {initialKeyword && (
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
