"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyArt } from "@/components/ui/empty-art";
import type { WorkspaceAssetKey } from "@/lib/brand-assets";

/**
 * First-run state (docs/FRONTEND.md §3 stickiness 1): the dashboard is a
 * tutorial when the dev db is unseeded — three steps to a first approved
 * draft, all on fake drivers, zero spend.
 */
export function FirstRunCard() {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="flex-row items-center gap-2">
        <Sparkles aria-hidden className="size-5 text-primary" />
        <CardTitle className="text-base">Welcome — three steps to your first draft</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="grid gap-2 text-sm sm:grid-cols-3">
          {(
            [
              { step: "1 · profile", copy: "Tell Thalon who it writes for — company, voice, topics.", href: "/app/profiles", art: "stepProfile" },
              { step: "2 · prompt", copy: "Feel the staged video flow on the built-in demo — no keys, no spend.", href: "/app/create", art: "stepStoryboard" },
              { step: "3 · approve", copy: "Nothing ships without your click — walk the queue once.", href: "/app/approve", art: "stepRelease" },
            ] as const satisfies readonly { step: string; copy: string; href: string; art: WorkspaceAssetKey }[]
          ).map(({ step, copy, href, art }) => (
            <li key={step}>
              <Link
                href={href}
                className="block h-full rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <EmptyArt asset={art} size="sm" className="my-1 w-20" />
                <span className="u-eyebrow text-primary">{step}</span>
                <p className="mt-1">{copy}</p>
              </Link>
            </li>
          ))}
        </ol>
        <Button asChild className="self-start">
          <Link href="/app/profiles">
            Set up your profile <ArrowRight aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
