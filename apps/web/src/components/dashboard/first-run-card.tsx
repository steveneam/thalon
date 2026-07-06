"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          <li className="rounded-lg border border-border bg-card p-3">
            <span className="u-eyebrow text-primary">1 · profile</span>
            <p className="mt-1">Tell Thalon who it writes for — company, voice, topics.</p>
          </li>
          <li className="rounded-lg border border-border bg-card p-3">
            <span className="u-eyebrow text-primary">2 · prompt</span>
            <p className="mt-1">Feel the staged video flow on the built-in demo — no keys, no spend.</p>
          </li>
          <li className="rounded-lg border border-border bg-card p-3">
            <span className="u-eyebrow text-primary">3 · approve</span>
            <p className="mt-1">Nothing ships without your click — walk the queue once.</p>
          </li>
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
