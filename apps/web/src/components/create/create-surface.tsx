"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard, Mail, X } from "lucide-react";
import { heatBand } from "@/components/intel/heat-grade";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CreateContext, CreateFamily } from "@/lib/intel/types";
import { composeEmail } from "@/lib/outreach/client";
import type { ComposeEmailResult } from "@/lib/outreach/types";
import { fetchProfiles } from "@/lib/profiles/client";
import type { ProfileWire } from "@/lib/profiles/types";
import { cn } from "@/lib/utils";
import { generateOnePromptVideo } from "@/lib/videos/one-prompt-client";
import type { OnePromptVideoWire } from "@/lib/videos/one-prompt-types";

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

const FAMILIES: Array<{ id: CreateFamily; label: string }> = [
  { id: "video", label: "Video" },
  { id: "post", label: "Post" },
  { id: "page", label: "Page" },
  { id: "email", label: "Email" },
];

/**
 * The typed, removable chip set (Phase D Create Handoff design): the six
 * intel chips (title · angle · hook · source · area · heat) plus the lead
 * and legacy fields the same grammar carries. Removal = the Four-Verbs
 * "Remove": nothing destroyed, nothing learned — generation (and the →Email
 * compose) uses only what remains.
 */
const CHIP_FIELDS = [
  { key: "title", label: "title" },
  { key: "angle", label: "angle" },
  { key: "hook", label: "hook" },
  { key: "sourceUrl", label: "source" },
  { key: "areaName", label: "area" },
  { key: "score", label: "heat" },
  { key: "keyword", label: "keyword" },
  { key: "company", label: "company" },
  { key: "contact", label: "contact" },
  { key: "role", label: "role" },
  { key: "painPoint", label: "pain point" },
  { key: "text", label: "source text" },
] as const;

type ChipKey = (typeof CHIP_FIELDS)[number]["key"];

interface ContextChip {
  key: ChipKey;
  label: string;
  /** Display text; for the heat chip this is the band word + score, for source the link label. */
  value: string;
  /** The raw value that rides into generation (differs from `value` for heat/source). */
  raw: string;
  href?: string;
  title?: string;
}

/** Chip-strip bound (the design's "max two rows before a +N chip", count-stated). */
const CHIP_CLAMP = 8;

function buildChips(context: CreateContext): ContextChip[] {
  return CHIP_FIELDS.flatMap(({ key, label }): ContextChip[] => {
    if (key === "score") {
      const score = context.score;
      if (typeof score !== "number") return [];
      return [
        {
          key,
          label,
          value: `${heatBand(score)} · ${Math.round(score * 100)}`,
          raw: String(score),
          title: `rank score ${score.toFixed(2)} of 1`,
        },
      ];
    }
    const value = context[key];
    if (typeof value !== "string" || value.length === 0) return [];
    if (key === "sourceUrl") {
      return [{ key, label, value: chipHost(value), raw: value, href: value, title: value }];
    }
    return [{ key, label, value, raw: value }];
  });
}

function chipHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "original item";
  }
}

/** The pre-seeded prompt: angle + hook, never re-asked (workspace-ux-v2 §3.5). */
function seedPrompt(context: CreateContext | null | undefined, initialPrompt: string): string {
  if (initialPrompt) return initialPrompt;
  if (!context) return "";
  const parts: string[] = [];
  if (context.hook) parts.push(`Open on the hook: “${context.hook}”`);
  if (context.angle) parts.push(`Angle: ${context.angle}.`);
  return parts.join(" ");
}

/** A one-line reading of the profile's free-form voice record, for the settings row. */
function voiceSummary(voice: Record<string, unknown>): string | null {
  for (const key of ["tone", "style", "persona"]) {
    const v = voice[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  const first = Object.values(voice).find((v): v is string => typeof v === "string" && v.length > 0);
  return first ?? null;
}

type ProfileState = { resolved: false } | { resolved: true; profile: ProfileWire | null };

/**
 * Create (Phase I — the s59 "Create Handoff" design): the seam that never
 * re-asks. Intel carries topic context (the typed removable chips), the
 * profile carries company context (settings rows marked "profile"); the
 * brief opens complete — working title seeded, prompt pre-written from
 * angle + hook — so the operator's job is scan-and-adjust, never
 * author-from-scratch. Doors that exist are armed (→Email compose, the
 * one-prompt video run, the staged video brief); doors that don't (post/
 * page — the B6.6 seam) state it honestly.
 */
export function CreateSurface({ initialPrompt, initialKeyword, initialFamily, context }: CreateSurfaceProps) {
  const [workingTitle, setWorkingTitle] = useState(context?.title ?? "");
  const [prompt, setPrompt] = useState(() => seedPrompt(context, initialPrompt));
  const [family, setFamily] = useState<CreateFamily>(
    initialFamily ??
      context?.family ??
      (initialPrompt || initialKeyword ? "post" : "video"),
  );
  const [mode, setMode] = useState<"one" | "advanced">("one");
  const [chips, setChips] = useState<ContextChip[]>(() => (context ? buildChips(context) : []));
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>({ resolved: false });
  const [platformsOff, setPlatformsOff] = useState<string[]>([]);
  const [compose, setCompose] = useState<
    | { state: "idle" }
    | { state: "composing" }
    | { state: "done"; result: ComposeEmailResult }
    | { state: "error"; message: string }
  >({ state: "idle" });
  const [video, setVideo] = useState<VideoDoorState>({ state: "idle" });

  // The settings column reads the ACTIVE profile (never re-ask company
  // context); a missing/failed read degrades to the honest no-profile state.
  useEffect(() => {
    let cancelled = false;
    fetchProfiles()
      .then((payload) => {
        if (!cancelled) setProfileState({ resolved: true, profile: payload.active });
      })
      .catch(() => {
        if (!cancelled) setProfileState({ resolved: true, profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function removeChip(key: ChipKey) {
    setChips((current) => current.filter((chip) => chip.key !== key));
  }

  // The →Email compose payload is built from the SURVIVING chips — a pruned
  // chip never reaches the brief, so what the operator sees is exactly what
  // grounds (and bounds) the draft.
  const chipValue = (key: ChipKey) => chips.find((chip) => chip.key === key)?.raw;
  const emailArmed = context?.kind === "lead_promote" && typeof context.leadId === "string";
  const isLead = context?.kind === "lead_promote";

  async function composeEmailDraft() {
    if (!context?.leadId) return;
    setCompose({ state: "composing" });
    try {
      const result = await composeEmail({
        leadId: context.leadId,
        prompt: prompt.trim() || workingTitle.trim() || undefined,
        context: {
          contact: chipValue("contact"),
          company: chipValue("company"),
          role: chipValue("role"),
          painPoint: chipValue("painPoint"),
          notes: chipValue("text"),
          sourceUrl: chipValue("sourceUrl"),
        },
      });
      setCompose({ state: "done", result });
    } catch (err) {
      setCompose({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  // The one-prompt video run: brief (prompt, else the working title) + the
  // SURVIVING source chip — a pruned chip never reaches the flow.
  async function generateVideoDraft() {
    const brief = prompt.trim() || workingTitle.trim();
    if (!brief) {
      setVideo({
        state: "error",
        message: "Write a prompt (or a working title) first — the brief is the flow's only input.",
      });
      return;
    }
    setVideo({ state: "running" });
    try {
      const result = await generateOnePromptVideo({ prompt: brief, sourceUrl: chipValue("sourceUrl") });
      setVideo({ state: "done", result });
    } catch (err) {
      setVideo({ state: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const profile = profileState.resolved ? profileState.profile : null;
  const profilePlatforms = profile ? Object.keys(profile.config.platformProfiles) : [];
  const voice = profile ? voiceSummary(profile.config.voice) : null;
  const tenantName =
    profile && typeof profile.config.identity.company === "string"
      ? (profile.config.identity.company as string)
      : null;

  const visibleChips = chipsExpanded ? chips : chips.slice(0, CHIP_CLAMP);
  const clampedCount = chips.length - visibleChips.length;

  const suggestedFamily = context?.family;
  const suggestionNote =
    suggestedFamily && suggestedFamily !== family
      ? `intel suggested ${FAMILIES.find((f) => f.id === suggestedFamily)?.label ?? suggestedFamily} — you chose ${
          FAMILIES.find((f) => f.id === family)?.label ?? family
        }; every exit stays one click`
      : null;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Card className="gap-0 overflow-hidden py-0">
        {/* Header: title + the honest five-step goal gradient + the mode toggle. */}
        <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 lg:px-5">
          <h1 className="text-lg font-semibold tracking-tight">Create</h1>
          <GoalGradient profileDone={Boolean(profile)} contextDone={chips.length > 0} />
          <div className="flex-1" />
          <div
            role="group"
            aria-label="Brief mode"
            className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5"
          >
            {(
              [
                { id: "one", label: "One prompt", title: undefined },
                { id: "advanced", label: "Advanced", title: "staged brief: script → scenes → delivery" },
              ] as const
            ).map((seg) => (
              <button
                key={seg.id}
                type="button"
                aria-pressed={mode === seg.id}
                title={seg.title}
                onClick={() => setMode(seg.id)}
                className={cn(
                  "h-7 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  mode === seg.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Family tabs — the per-family exits; the pre-pick is a suggestion, never a lock. */}
        <div
          role="group"
          aria-label="Output family"
          className="flex flex-wrap items-center gap-1 border-b border-border px-4 pt-1 lg:px-5"
        >
          {FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={family === f.id}
              onClick={() => setFamily(f.id)}
              className={cn(
                "-mb-px inline-flex h-9 items-center border-b-2 px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                family === f.id
                  ? "border-primary text-accent-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          {suggestionNote && <span className="u-eyebrow pb-1 text-muted-foreground normal-case">{suggestionNote}</span>}
        </div>

        {/* The context chip band: what intel (or the CRM) already knew, visible and prunable. */}
        {chips.length > 0 && (
          <div
            aria-label={isLead ? "Lead context" : "Intel context"}
            className="flex flex-wrap items-center gap-1.5 border-b border-border bg-background px-4 py-2.5 lg:px-5"
          >
            <span className="u-eyebrow mr-1 text-muted-foreground">
              {isLead ? "lead" : "intel"} context{context ? ` · #${context.captureId.slice(0, 8)}` : ""} — remove any
              chip; generation uses only what remains
            </span>
            {visibleChips.map((chip) => (
              <span
                key={chip.key}
                title={chip.title}
                className="inline-flex h-7 max-w-80 items-center gap-1.5 rounded-md border border-border bg-card pr-1 pl-2.5 text-xs"
              >
                <span className="font-mono text-2xs tracking-wider text-muted-foreground uppercase">{chip.label}</span>
                {chip.href ? (
                  <a
                    href={chip.href}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {chip.value} ↗
                  </a>
                ) : (
                  <span className="truncate font-medium">{chip.value}</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${chip.label} from the context`}
                  onClick={() => removeChip(chip.key)}
                  className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            ))}
            {clampedCount > 0 && (
              <button
                type="button"
                onClick={() => setChipsExpanded(true)}
                className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2 text-xs font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                +{clampedCount} more
              </button>
            )}
          </div>
        )}

        {initialKeyword && chips.length === 0 && (
          <p className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground lg:px-5">
            Search context from Intel: <span className="font-mono">{initialKeyword}</span> — rides into generation as a
            keyword target.
          </p>
        )}

        {/* The brief: working title + prompt (left) · profile-fed settings (right). */}
        <div className="grid gap-5 p-4 lg:grid-cols-[1.5fr_1fr] lg:p-5">
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="create-working-title" className="mb-1.5 block text-xs font-semibold">
                Working title <span className="u-eyebrow font-normal text-muted-foreground">· seeded from intel, edit freely</span>
              </label>
              <input
                id="create-working-title"
                type="text"
                value={workingTitle}
                onChange={(e) => setWorkingTitle(e.target.value)}
                placeholder="e.g. Stop reviewing everything yourself — gate it instead"
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex flex-1 flex-col">
              <label htmlFor="create-prompt" className="mb-1.5 block text-xs font-semibold">
                The prompt <span className="u-eyebrow font-normal text-muted-foreground">· angle + hook pre-seeded</span>
              </label>
              <textarea
                id="create-prompt"
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Announce the staged video flow — why deterministic beats timeline editors"
                className="min-h-36 w-full flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <GenerateRow
              family={family}
              mode={mode}
              emailArmed={emailArmed}
              compose={compose}
              video={video}
              onCompose={() => void composeEmailDraft()}
              onGenerateVideo={() => void generateVideoDraft()}
              onOpenAdvanced={() => setMode("advanced")}
            />
          </div>

          <SettingsPanel
            family={family}
            profileState={profileState}
            tenantName={tenantName}
            voice={voice}
            platforms={profilePlatforms}
            platformsOff={platformsOff}
            onTogglePlatform={(p) =>
              setPlatformsOff((off) => (off.includes(p) ? off.filter((x) => x !== p) : [...off, p]))
            }
          />
        </div>
      </Card>
    </div>
  );
}

/**
 * The honest five-step goal gradient: profile ✓ and context ✓ only when they
 * are GENUINELY done (that's the point of the handoff — never fake
 * progress); judge and approve shown as the real stages ahead.
 */
function GoalGradient({ profileDone, contextDone }: { profileDone: boolean; contextDone: boolean }) {
  const steps = [
    { id: "profile", done: profileDone },
    { id: "context", done: contextDone },
    { id: "brief", current: true },
    { id: "judge" },
    { id: "approve" },
  ] as const;
  return (
    <ol aria-label="Where this brief sits in the journey" className="flex items-center gap-2">
      {steps.map((step, i) => (
        <li key={step.id} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="h-px w-6 bg-border" />}
          <span
            className={cn(
              "font-mono text-2xs tracking-wider uppercase",
              "done" in step && step.done
                ? "text-[oklch(0.5_0.1_160)]"
                : "current" in step
                  ? "font-semibold text-accent-foreground"
                  : "text-muted-foreground",
            )}
          >
            {step.id}
            {"done" in step && step.done ? " ✓" : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

type VideoDoorState =
  | { state: "idle" }
  | { state: "running" }
  | { state: "done"; result: OnePromptVideoWire }
  | { state: "error"; message: string };

/**
 * The action row under the prompt. Only doors that exist are armed
 * (honest-claims rule): →Email composes + judges for real; Video's
 * one-prompt door runs the WHOLE staged flow (B-vid.7) and the Advanced
 * staged brief remains the stage-by-stage walk; Post/Page state the B6.6
 * seam. Every armed button states its outcome and names the judge gate.
 */
function GenerateRow({
  family,
  mode,
  emailArmed,
  compose,
  video,
  onCompose,
  onGenerateVideo,
  onOpenAdvanced,
}: {
  family: CreateFamily;
  mode: "one" | "advanced";
  emailArmed: boolean;
  compose:
    | { state: "idle" }
    | { state: "composing" }
    | { state: "done"; result: ComposeEmailResult }
    | { state: "error"; message: string };
  video: VideoDoorState;
  onCompose: () => void;
  onGenerateVideo: () => void;
  onOpenAdvanced: () => void;
}) {
  if (family === "email") {
    if (!emailArmed) {
      return (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          Email drafts compose from a lead&rsquo;s own context — use the → Email exit on a lead card so the recipient
          and their pain point ride in as chips. Nothing here is ever sent automatically.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Thalon writes ONE short outreach email from the context above (pruned chips stay out).{" "}
          <span className="font-medium text-foreground">It is never sent</span> — you copy an approved draft into your
          own mail client.
        </p>
        {compose.state === "done" ? (
          <div className="flex flex-col gap-1.5" role="status">
            <p className="text-sm">
              {compose.result.status === "queued"
                ? compose.result.alreadyComposed
                  ? "This exact brief was already composed — the existing draft is in your queue."
                  : "Draft composed and judged — it's waiting for your approval."
                : compose.result.status === "blocked"
                  ? `The judge blocked this draft (${compose.result.blockedReason ?? "see the queue for the gate trail"}) — it's parked for triage.`
                  : `Draft is in state "${compose.result.status}" — see the queue.`}
            </p>
            <Button asChild size="sm" className="self-start">
              <Link href="/app/approve">
                Review it in the Approve queue <ArrowRight aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {compose.state === "error" && (
              <p className="w-full text-sm text-destructive" role="alert">
                {compose.message}
              </p>
            )}
            <Button className="h-9" disabled={compose.state === "composing"} onClick={onCompose}>
              <Mail aria-hidden data-icon="inline-start" />
              {compose.state === "composing" ? "Composing + judging…" : "Compose email draft — judged before you see it"}
            </Button>
            <span className="u-eyebrow text-muted-foreground">
              denylist + grounding checked; a blocked draft arrives with reasons
            </span>
          </div>
        )}
      </div>
    );
  }

  if (family === "video") {
    if (mode === "advanced") {
      return (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
          <p className="text-sm">
            The staged brief — <span className="font-mono text-xs">script → scenes → delivery</span> — runs live on
            fake drivers: react to visible artifacts at every stage, zero spend. Your prompt seeds the demo run in the
            queue.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="sm" className="self-start">
              <Link href="/app/approve">
                Walk the staged brief <ArrowRight aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
            <span className="u-eyebrow text-muted-foreground">judged at every stage; blocked artifacts carry reasons</span>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <p className="text-sm text-muted-foreground">
          Thalon runs the whole staged flow from this one prompt —{" "}
          <span className="font-mono text-xs">storyboard → direction doc</span>, judged at every stage — then stages
          the video project (takes plan + first cut).{" "}
          <span className="font-medium text-foreground">Nothing renders or spends until you approve.</span>
        </p>
        {video.state === "done" ? (
          <div className="flex flex-col gap-1.5" role="status">
            <p className="text-sm">
              {video.result.status === "queued"
                ? `Direction doc generated and judged — project “${video.result.projectName ?? "untitled"}” is staged with ${video.result.takeCount ?? 0} planned takes and a draft cut. The doc is waiting for your approval.`
                : `The judge blocked the ${video.result.blockedStageKey ?? "current"} stage — the draft is parked for triage with its reasons in the queue.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="self-start">
                <Link href="/app/approve">
                  Review it in the Approve queue <ArrowRight aria-hidden data-icon="inline-end" />
                </Link>
              </Button>
              {video.result.status === "queued" && (
                <Button asChild variant="outline" size="sm" className="self-start">
                  <Link href="/app/videos">Open the video project</Link>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {video.state === "error" && (
              <p className="w-full text-sm text-destructive" role="alert">
                {video.message}
              </p>
            )}
            <Button className="h-9" disabled={video.state === "running"} onClick={onGenerateVideo}>
              <Clapperboard aria-hidden data-icon="inline-start" />
              {video.state === "running"
                ? "Generating + judging every stage…"
                : "Generate video draft — judged before you see it"}
            </Button>
            <span className="u-eyebrow text-muted-foreground">
              or walk it stage by stage in{" "}
              <button
                type="button"
                aria-label="Open the Advanced staged brief"
                onClick={onOpenAdvanced}
                className="font-medium text-primary hover:underline"
              >
                Advanced
              </button>
            </span>
          </div>
        )}
      </div>
    );
  }

  // post / page: the honest B6.6 seam statement — never a dead primary button.
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border p-3">
      <p className="text-sm text-muted-foreground">
        Live {family} generation isn&rsquo;t connected on this surface yet — the engine and judge lane already exist;
        this surface wires into them next. Your brief and context are ready to ride along.
      </p>
      <span className="u-eyebrow text-muted-foreground">
        when it arms: every draft passes denylist + grounding; blocked ones arrive with reasons
      </span>
    </div>
  );
}

/**
 * The settings column: company context the PROFILE carries so Create never
 * re-asks it (each supplied row wears the "profile" word). Rows the profile
 * cannot supply yet say so — never a fabricated default dressed as one.
 */
function SettingsPanel({
  family,
  profileState,
  tenantName,
  voice,
  platforms,
  platformsOff,
  onTogglePlatform,
}: {
  family: CreateFamily;
  profileState: ProfileState;
  tenantName: string | null;
  voice: string | null;
  platforms: string[];
  platformsOff: string[];
  onTogglePlatform: (platform: string) => void;
}) {
  const profile = profileState.resolved ? profileState.profile : null;
  return (
    <section aria-label="Settings" className="flex h-fit flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Settings</span>
        {profile && (
          <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-xs font-medium">
            profile v{profile.version}
            {tenantName ? ` · ${tenantName}` : ""}
          </span>
        )}
        <div className="flex-1" />
        {profile && <span className="u-eyebrow text-muted-foreground">defaults pre-set</span>}
      </div>

      {!profileState.resolved ? (
        <p className="py-2 text-sm text-muted-foreground">Loading profile…</p>
      ) : !profile ? (
        <p className="py-2 text-sm text-muted-foreground">
          No profile yet — settings arrive from your profile so Create never re-asks them.{" "}
          <Link href="/app/profiles" className="font-medium text-primary underline-offset-2 hover:underline">
            Create one in Profiles
          </Link>
          .
        </p>
      ) : (
        <dl className="flex flex-col">
          <SettingRow label="Voice">
            {voice ? (
              <>
                {voice} <span className="u-eyebrow">profile</span>
              </>
            ) : (
              <>
                not set <span className="u-eyebrow">profile</span>
              </>
            )}
          </SettingRow>
          <div className="flex items-start justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
            <dt className="pt-0.5 text-xs font-medium">Platforms</dt>
            <dd className="m-0 flex flex-wrap justify-end gap-1.5">
              {platforms.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  none in profile yet <span className="u-eyebrow">profile</span>
                </span>
              ) : (
                platforms.map((p) => {
                  const on = !platformsOff.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onTogglePlatform(p)}
                      className={cn(
                        "inline-flex h-6 items-center rounded-full border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        on
                          ? "border-accent bg-accent font-medium text-accent-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p}
                    </button>
                  );
                })
              )}
            </dd>
          </div>
          {family === "video" && (
            <>
              <SettingRow label="Length">
                — <span className="u-eyebrow">not in profile yet</span>
              </SettingRow>
              <SettingRow label="Aspect">
                — <span className="u-eyebrow">not in profile yet</span>
              </SettingRow>
              <SettingRow label="Captions">
                — <span className="u-eyebrow">not in profile yet</span>
              </SettingRow>
            </>
          )}
        </dl>
      )}
      <p className="u-eyebrow mt-2 border-t border-border pt-2.5 text-muted-foreground">
        advanced (script · scenes · delivery) lives behind the toggle — the one-prompt path is the default door
      </p>
    </section>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <dt className="text-xs font-medium">{label}</dt>
      <dd className="m-0 flex items-center gap-1.5 text-right text-xs text-muted-foreground">{children}</dd>
    </div>
  );
}
