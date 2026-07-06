"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routeForPrompt } from "@/lib/workspace/palette";

/**
 * Dashboard omnibox (B6.2 [+]): "What do you want to create?" — routes the
 * prompt to Create with the family pre-picked by a transparent keyword
 * heuristic (the picker stays visible and changeable there).
 */
export function Omnibox() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    router.push(routeForPrompt(prompt));
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-ring"
    >
      <Sparkles aria-hidden className="size-4 shrink-0 text-primary" />
      <input
        aria-label="What do you want to create?"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="What do you want to create? (⌘K for everything else)"
        className="h-9 flex-1 bg-transparent text-sm focus:outline-none"
      />
      <Button type="submit" size="sm" disabled={!prompt.trim()}>
        Create <ArrowRight aria-hidden data-icon="inline-end" />
      </Button>
    </form>
  );
}
