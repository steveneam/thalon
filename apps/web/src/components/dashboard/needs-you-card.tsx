"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PulseCounts } from "@/lib/workspace/types";

interface NeedsYouCardProps {
  counts: PulseCounts;
  needsYou: number;
}

/**
 * The 10-second rule's centerpiece: ONE card answering "what needs me",
 * with the queue as its one dominant action.
 */
export function NeedsYouCard({ counts, needsYou }: NeedsYouCardProps) {
  if (needsYou === 0) {
    return (
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <CircleCheck aria-hidden className="size-5 text-primary" />
          <CardTitle>Queue clear — nothing waits on you</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          New drafts land here after the judge passes them. Start something from a prompt, or point
          Intel at an area worth watching.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">
          <span className="u-tabular text-primary">{needsYou}</span>{" "}
          {needsYou === 1 ? "draft waits" : "drafts wait"} on you
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span>
          <span className="u-tabular font-semibold">{counts.queued}</span>{" "}
          <span className="text-muted-foreground">queued for review</span>
        </span>
        <span>
          <span className="u-tabular font-semibold">{counts.blocked}</span>{" "}
          <span className="text-muted-foreground">blocked by the judge</span>
        </span>
        <Button asChild className="ml-auto">
          <Link href="/app/approve">
            Review queue <ArrowRight aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
