"use client";

import { useState } from "react";
import type { JoinResult } from "@/lib/waitlist/join";
import { SPOTS_PER_REFERRAL } from "@/lib/waitlist/position";

type FormState =
  | { phase: "idle" | "busy" }
  | { phase: "done"; result: JoinResult }
  | { phase: "error"; message: string };

/**
 * The one-field email capture (§1 + the §4 repeat CTA — same endpoint).
 * Reads `?ref=` at submit time so referred visits attribute without any
 * server-side dynamic rendering; success answers with the queue position
 * and the visitor's own skip-the-line link.
 */
export function WaitlistForm({ id }: { id: string }) {
  const [state, setState] = useState<FormState>({ phase: "idle" });
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    if (typeof email !== "string" || email.trim() === "") return;
    setState({ phase: "busy" });
    try {
      const ref = new URLSearchParams(window.location.search).get("ref") ?? undefined;
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, ref }),
      });
      const body = (await res.json()) as JoinResult & { error?: string };
      if (!res.ok) {
        setState({ phase: "error", message: body.error ?? "Something went wrong — try again." });
        return;
      }
      setState({ phase: "done", result: body });
    } catch {
      setState({ phase: "error", message: "Network error — try again." });
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied — the link is visible and selectable either way.
    }
  }

  if (state.phase === "done") {
    const { result } = state;
    return (
      <div
        role="status"
        className="max-w-md rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm"
      >
        <p className="font-semibold">
          {result.created ? "You're in." : "Welcome back."} You&apos;re{" "}
          <span className="u-tabular text-primary">#{result.effectivePosition}</span> of{" "}
          <span className="u-tabular">{result.total}</span> in line.
        </p>
        <p className="mt-1.5 leading-6 text-muted-foreground">
          Skip the line: every signup from your link moves you up {SPOTS_PER_REFERRAL} spots
          {result.referrals > 0 && (
            <>
              {" "}
              — <span className="u-tabular text-primary">{result.referrals}</span> applied so far
            </>
          )}
          .
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs">
            {result.referralUrl}
          </code>
          <button
            type="button"
            onClick={() => copyLink(result.referralUrl)}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-85"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <input
          id={id}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="h-11 min-w-0 flex-1 rounded-lg border bg-background/70 px-3.5 text-sm placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={state.phase === "busy"}
          className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_0_28px_-6px] shadow-primary/50 transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {state.phase === "busy" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {state.phase === "error" && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Early access rolls out in waitlist order. No spam — one email when it&apos;s your turn.
      </p>
    </form>
  );
}
