"use client";

import { useState } from "react";
import { Pause, Pencil, Play, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AreaRow } from "@/lib/intel/types";

interface AreasManagerProps {
  areas: AreaRow[];
  busy: boolean;
  onCreate: (input: { name: string; description: string }) => Promise<void>;
  onUpdate: (
    areaId: string,
    patch: { name?: string; description?: string; status?: "active" | "paused" },
  ) => Promise<void>;
}

/**
 * Monitored-areas manager (B6.4 repo, real rows): the operator DESCRIBES
 * what to watch — the description is load-bearing data (query-expansion
 * seed + relevance-embedding anchor), so the form says so. Pause, never
 * delete: a paused area keeps its history.
 */
export function AreasManager({ areas, busy, onCreate, onUpdate }: AreasManagerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await onCreate({ name: name.trim(), description: description.trim() });
      setName("");
      setDescription("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't add the area.");
    }
  }

  async function submitEdit(areaId: string) {
    setFormError(null);
    try {
      await onUpdate(areaId, { description: editDescription.trim() });
      setEditingId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't update the area.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitored areas</CardTitle>
        <CardDescription>
          Describe an area in your own words — Thalon expands it into platform queries and ranks
          what&rsquo;s rising against your description.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {areas.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            No areas yet. Try something like{" "}
            <em>&ldquo;AI content automation — agents drafting social posts and videos, approval
            workflows, grounded generation&rdquo;</em>
            . The richer the description, the better the ranking.
          </p>
        )}
        {areas.length > 0 && (
          <ul className="flex flex-col gap-2">
            {areas.map((area) => (
              <li key={area.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{area.name}</span>
                  <Badge variant={area.status === "active" ? "secondary" : "outline"}>
                    {area.status}
                  </Badge>
                  <span className="ml-auto flex gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Edit area ${area.name}`}
                      disabled={busy}
                      onClick={() => {
                        setEditingId(editingId === area.id ? null : area.id);
                        setEditDescription(area.description);
                      }}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={
                        area.status === "active" ? `Pause area ${area.name}` : `Resume area ${area.name}`
                      }
                      disabled={busy}
                      onClick={() =>
                        onUpdate(area.id, { status: area.status === "active" ? "paused" : "active" })
                      }
                    >
                      {area.status === "active" ? <Pause aria-hidden /> : <Play aria-hidden />}
                    </Button>
                  </span>
                </div>
                {editingId === area.id ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      aria-label={`Description for ${area.name}`}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <div className="flex gap-2">
                      <Button size="xs" disabled={busy || !editDescription.trim()} onClick={() => submitEdit(area.id)}>
                        Save
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{area.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submitCreate} className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="Area name"
              placeholder="Area name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-48"
            />
            <input
              aria-label="Area description"
              placeholder="What to watch, in your own words — this drives the ranking"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-8 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" size="sm" disabled={busy || !name.trim() || !description.trim()}>
              <Plus aria-hidden data-icon="inline-start" /> Add area
            </Button>
          </div>
          {formError && (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
