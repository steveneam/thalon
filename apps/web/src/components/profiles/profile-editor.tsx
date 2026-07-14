"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Save } from "lucide-react";
import { usePulseSafe } from "@/components/workspace/pulse-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchProfiles, saveProfile } from "@/lib/profiles/client";
import { formToConfig, profileToForm, type ProfileFormState } from "@/lib/profiles/form";
import type { ProfilesPayload } from "@/lib/profiles/types";
import { timeAgo } from "@/lib/workspace/format";

type EditorStatus = "loading" | "error" | "success";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/**
 * Profile editor/switcher over the brand_profiles spine (B3.11 lands here).
 * Save = a NEW active version — profiles are versioned so drafts keep their
 * generation provenance; the first save also seeds the demo tenant
 * (first-run step 1). Identity fields are the judge's grounding surface, so
 * the copy nudges short, checkable statements.
 */
export function ProfileEditor() {
  const pulse = usePulseSafe();
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [payload, setPayload] = useState<ProfilesPayload | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfiles()
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setForm(profileToForm(data.active));
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof ProfileFormState>(key: K, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError(null);
    setSavedVersion(null);
    // Carry the active profile's window-1 blocks (icp · cadence · routing)
    // through the save — the form doesn't edit them, and dropping them
    // disarms scoring/cadence/routing (see formToConfig).
    const mapped = formToConfig(form, payload?.active?.config);
    if (mapped.error !== null) {
      setError(mapped.error);
      return;
    }
    setBusy(true);
    try {
      const profile = await saveProfile({ config: mapped.config });
      const data = await fetchProfiles();
      setPayload(data);
      setForm(profileToForm(data.active));
      setSavedVersion(profile.version);
      await pulse?.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the profile.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <p className="p-6 text-sm text-muted-foreground">Loading profile…</p>;
  if (status === "error" || !form)
    return <p className="p-6 text-sm text-destructive">Couldn&rsquo;t load the profile.</p>;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3 lg:p-6">
      <form onSubmit={submit} className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              What Thalon may say about you. Facts and offers double as judge grounding — keep them
              short, individually checkable statements.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Company">
              <input aria-label="Company" className={inputClass} value={form.company} onChange={(e) => set("company", e.target.value)} />
            </Field>
            <Field label="One-liner" hint="What the company does, for whom — one sentence.">
              <input aria-label="One-liner" className={inputClass} value={form.oneLiner} onChange={(e) => set("oneLiner", e.target.value)} />
            </Field>
            <Field label="Philosophy" hint="The why behind the content.">
              <textarea aria-label="Philosophy" rows={2} className={inputClass} value={form.philosophy} onChange={(e) => set("philosophy", e.target.value)} />
            </Field>
            <Field label="Audience">
              <textarea aria-label="Audience" rows={2} className={inputClass} value={form.audience} onChange={(e) => set("audience", e.target.value)} />
            </Field>
            <Field label="Offers" hint="One per line — short, checkable.">
              <textarea aria-label="Offers" rows={3} className={inputClass} value={form.offers} onChange={(e) => set("offers", e.target.value)} />
            </Field>
            <Field label="Facts" hint="One per line — durable company facts.">
              <textarea aria-label="Facts" rows={3} className={inputClass} value={form.facts} onChange={(e) => set("facts", e.target.value)} />
            </Field>
            <Field label="Topics" hint="One per line — the content pillars. Seeds intel areas and keyword compilation.">
              <textarea aria-label="Topics" rows={3} className={inputClass} value={form.topics} onChange={(e) => set("topics", e.target.value)} />
            </Field>
            <Field label="Links" hint={'One per line as "label: url" — site, github, socials.'}>
              <textarea aria-label="Links" rows={3} className={inputClass} value={form.links} onChange={(e) => set("links", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Denylist</CardTitle>
            <CardDescription>
              Words and claims the judge blocks outright (gate G1) — one per line.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea aria-label="Denylist" rows={4} className={inputClass} value={form.denylist} onChange={(e) => set("denylist", e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice &amp; platforms</CardTitle>
            <CardDescription>
              Open config shapes (JSON) — tone, char limits, hashtag/CTA/disclosure policy per
              platform. A friendlier editor can come later; the shapes are contract-validated on
              save.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Voice (JSON)">
              <textarea aria-label="Voice JSON" rows={6} className={`${inputClass} font-mono text-xs`} value={form.voiceJson} onChange={(e) => set("voiceJson", e.target.value)} placeholder='{ "tone": "direct, technical" }' />
            </Field>
            <Field label="Platform profiles (JSON)">
              <textarea aria-label="Platform profiles JSON" rows={6} className={`${inputClass} font-mono text-xs`} value={form.platformProfilesJson} onChange={(e) => set("platformProfilesJson", e.target.value)} placeholder='{ "linkedin": { "tone": "professional", "charLimit": 3000 } }' />
            </Field>
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {savedVersion !== null && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-primary">
            <BadgeCheck aria-hidden className="size-4" /> Saved as active version v{savedVersion}.
          </p>
        )}
        <Button type="submit" disabled={busy} className="self-start">
          <Save aria-hidden data-icon="inline-start" />
          {payload?.active ? "Save as new active version" : "Create profile"}
        </Button>
      </form>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>
              Every save is a new version — drafts record the version they were generated under.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(payload?.history.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No versions yet — your first save creates v1 and unlocks the workspace.
              </p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {payload!.history.map((entry) => (
                  <li key={entry.profileId} className="flex items-center gap-2 text-sm">
                    <span className="u-tabular font-medium">v{entry.version}</span>
                    {payload!.active?.id === entry.profileId && <Badge>active</Badge>}
                    <time dateTime={entry.at} className="ml-auto text-xs text-muted-foreground">
                      {timeAgo(entry.at)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
              Re-activating an older version isn&rsquo;t wired yet (the spine exposes
              getActive/create) — save a new version to change the active config.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
