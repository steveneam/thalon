"use client";

import Link from "next/link";
import { CheckCheck, Radar, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACTIONS = [
  {
    label: "Create from a prompt",
    hint: "Post, video, or page",
    href: "/app/create",
    icon: Sparkles,
  },
  {
    label: "Watch a new area",
    hint: "Intel monitors it for you",
    href: "/app/intel",
    icon: Radar,
  },
  {
    label: "Review the queue",
    hint: "Approve, edit, or reject",
    href: "/app/approve",
    icon: CheckCheck,
  },
  {
    label: "Tune your profile",
    hint: "Voice, platforms, denylist",
    href: "/app/profiles",
    icon: Users,
  },
];

/** The quick-action deck from the founder references, formalized over the nav registry's families. */
export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="group flex flex-col gap-1.5 rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Icon aria-hidden className="size-4 text-primary" />
              <span className="text-sm font-medium leading-tight">{action.label}</span>
              <span className="text-xs text-muted-foreground">{action.hint}</span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
