"use client";

import "@/components/profiles/profiles.css";
import { useEffect, useState } from "react";
import {
  cadenceRows,
  carriedBlocks,
  MAX_TONES,
  nextVersion,
  readVoice,
  toneSummary,
  TONE_CHIPS,
  writeVoice,
} from "@/components/profiles/profiles-model";
import { usePulseSafe } from "@/components/workspace/pulse-context";
import { fetchProfiles, saveProfile } from "@/lib/profiles/client";
import { formToConfig, linesToList, profileToForm, type ProfileFormState } from "@/lib/profiles/form";
import type { ProfilesPayload } from "@/lib/profiles/types";
import { timeAgo } from "@/lib/workspace/format";

type Status = "loading" | "error" | "success";

/**
 * The wizard's six steps. The sheet draws step 2 (Voice) and names all six in
 * its rail; the other five carry the same `.field` grammar over the config
 * blocks each one owns. Titles for those five are written in the sheet's
 * voice (a question + one line) — the one place this port had to author copy,
 * because the canvas only ever drew one step of the six.
 */
const STEPS = [
  {
    label: "Company",
    title: "Who is Thalon writing as?",
    hint: "Facts and offers double as judge grounding — keep them short and individually checkable.",
  },
  {
    label: "Voice",
    title: "How should Thalon sound?",
    hint: "Pick the register, then let it learn from writing you already like.",
  },
  {
    label: "Topics & audience",
    title: "What does it write about, and for whom?",
    hint: "Topics seed watched areas in Intel and fall back as discoverability terms at Create.",
  },
  {
    label: "Platforms & cadence",
    title: "Where does it publish?",
    hint: "Per-platform shapes are open config; the cadence rules below are enforced by the judge.",
  },
  {
    label: "Guardrails",
    title: "What must never ship?",
    hint: "The denylist is gate G1 — the judge blocks a draft that crosses it. It gates; it never rewrites.",
  },
  {
    label: "Review",
    title: "Save this as a new version",
    hint: "Saving appends a version. Runs keep pointing at the one they used — nothing rewrites history.",
  },
] as const;

/**
 * Profiles — STEP 2 of the two-step rebuild: the byte-true port of
 * Profiles.dc.html with the live profile behind it.
 *
 * The hazard this surface exists to not repeat: `ProfileWire.config` holds
 * blocks no form field edits (icp · cadence · routing · outreach · social).
 * A save built from the form-backed blocks alone SILENTLY DROPS them and
 * disarms lead scoring, the cadence gate, routing, outreach and the social
 * publish door — found live on staging twice (2026-07-14, 2026-07-19). So the
 * save goes through `formToConfig(form, active.config)` and the review step
 * NAMES each carried block: the carry is visible provenance here, not an
 * invisible promise, and it is test-pinned.
 */
export function ProfilesSurface() {
  const pulse = usePulseSafe();
  const [status, setStatus] = useState<Status>("loading");
  const [payload, setPayload] = useState<ProfilesPayload | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [step, setStep] = useState(0);
  const [tone, setTone] = useState<string[]>([]);
  // An UNTOUCHED tone is written back exactly as stored — picking chips is
  // what replaces a free-text register, never an unrelated save.
  const [toneTouched, setToneTouched] = useState(false);
  const [sample, setSample] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfiles()
      .then((data) => {
        if (cancelled) return;
        const voice = readVoice(data.active?.config.voice ?? {});
        setPayload(data);
        setForm(profileToForm(data.active));
        setTone(voice.tone);
        setSample(voice.sample);
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = payload?.active ?? null;
  const version = nextVersion(active);
  const voiceRead = readVoice(active?.config.voice ?? {});
  const cadence = cadenceRows(active);
  const carried = carriedBlocks(active);
  // The review row reads the object the save will WRITE, never the stored one
  // — see toneSummary. Same call the save makes, so the two cannot disagree.
  const pendingVoice = writeVoice(active?.config.voice ?? {}, { tone, toneTouched, sample });
  const storedHadTone = active?.config.voice?.tone !== undefined;

  function set<K extends keyof ProfileFormState>(key: K, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleTone(chip: string) {
    setToneTouched(true);
    setTone((prev) =>
      prev.includes(chip)
        ? prev.filter((t) => t !== chip)
        : prev.length >= MAX_TONES
          ? prev
          : [...prev, chip],
    );
  }

  async function save() {
    if (!form) return;
    setError(null);
    setSavedVersion(null);
    const voice = writeVoice(active?.config.voice ?? {}, { tone, toneTouched, sample });
    const voiceJson = Object.keys(voice).length > 0 ? JSON.stringify(voice, null, 2) : "";
    // The carry: every non-form-backed block rides through verbatim.
    const mapped = formToConfig({ ...form, voiceJson }, active?.config);
    if (mapped.error !== null) {
      setError(mapped.error);
      return;
    }
    setBusy(true);
    try {
      const profile = await saveProfile({ config: mapped.config });
      const data = await fetchProfiles();
      const next = readVoice(data.active?.config.voice ?? {});
      setPayload(data);
      setForm(profileToForm(data.active));
      setTone(next.tone);
      setSample(next.sample);
      setToneTouched(false);
      setSavedVersion(profile.version);
      await pulse?.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save the profile.");
    } finally {
      setBusy(false);
    }
  }

  /** A step is `done` when the profile already carries what it asks for. */
  function isDone(index: number): boolean {
    if (!form) return false;
    switch (index) {
      case 0:
        return Boolean(
          form.company.trim() || form.oneLiner.trim() || form.philosophy.trim() || form.facts.trim(),
        );
      case 1:
        return tone.length > 0 || sample.trim().length > 0;
      case 2:
        return Boolean(form.topics.trim() || form.audience.trim());
      case 3:
        return form.platformProfilesJson.trim().length > 0;
      case 4:
        return form.denylist.trim().length > 0;
      default:
        return false;
    }
  }

  const current = STEPS[step];
  const stepLabel = (index: number) =>
    index === 5 ? `Review · save v${version}` : STEPS[index].label;

  return (
    <div className="content profiles-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Profiles</h1>
        <button
          type="button"
          className="pill pill-idle"
          aria-expanded={historyOpen}
          title="Every save appends a version — open the history"
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          {status === "success" ? `editing → v${version}` : "reading…"}
        </button>
        <div style={{ flex: 1 }} />
        <span className="t-label">runs pin the version they used — nothing rewrites history</span>
      </div>

      {historyOpen && (
        <div className="card" data-testid="version-history">
          <div className="card-head">
            <span className="t-title">Versions</span>
            <div style={{ flex: 1 }} />
            <span className="t-label">
              drafts record the version they were generated under — re-activating an older one
              isn’t wired yet
            </span>
          </div>
          {(payload?.history.length ?? 0) === 0 ? (
            <div className="ver-row">
              <span className="t-label">
                No versions yet — your first save creates v1 and unlocks the workspace.
              </span>
            </div>
          ) : (
            payload?.history.map((entry) => (
              <div className="ver-row" key={entry.profileId}>
                <span className="t-data">v{entry.version}</span>
                {active?.id === entry.profileId && <span className="pill pill-ok">active</span>}
                <div style={{ flex: 1 }} />
                <span className="t-data">{timeAgo(entry.at)}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="wiz-grid">
        <div
          className="card"
          style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}
        >
          {STEPS.map((s, index) => (
            <button
              type="button"
              key={s.label}
              data-testid={`wizard-step-${index}`}
              className={`step${index === step ? " on" : isDone(index) ? " done" : ""}`}
              aria-current={index === step ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <span className="step-dot">{isDone(index) && index !== step ? "✓" : index + 1}</span>
              {stepLabel(index)}
            </button>
          ))}
        </div>

        <div
          className="card"
          style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <div className="t-title" style={{ fontSize: 15 }}>
              {current.title}
            </div>
            <div className="t-label" style={{ marginTop: 3 }}>
              {current.hint}
            </div>
          </div>

          {status === "loading" || form === null ? (
            <span className="t-label">
              {status === "error"
                ? "Couldn’t read your profile — this is a read failure, not an empty profile."
                : "Reading your profile…"}
            </span>
          ) : (
            <>
              {step === 0 && (
                <>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-company">
                      Company
                    </label>
                    <input
                      id="profile-company"
                      className="input"
                      value={form.company}
                      onChange={(e) => set("company", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-one-liner">
                      One-liner — what it does, for whom, in a sentence
                    </label>
                    <input
                      id="profile-one-liner"
                      className="input"
                      value={form.oneLiner}
                      onChange={(e) => set("oneLiner", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-philosophy">
                      Philosophy — the why behind the content
                    </label>
                    <textarea
                      id="profile-philosophy"
                      className="input"
                      rows={2}
                      value={form.philosophy}
                      onChange={(e) => set("philosophy", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-offers">
                      Offers — one per line
                    </label>
                    <textarea
                      id="profile-offers"
                      className="input"
                      rows={3}
                      value={form.offers}
                      onChange={(e) => set("offers", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-facts">
                      Facts — one per line, each individually checkable
                    </label>
                    <textarea
                      id="profile-facts"
                      className="input"
                      rows={3}
                      value={form.facts}
                      onChange={(e) => set("facts", e.target.value)}
                    />
                    <span className="t-label">
                      The judge grounds against these — a claim no fact supports fails the gate.
                    </span>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-links">
                      Links — one per line as “label: url”
                    </label>
                    <textarea
                      id="profile-links"
                      className="input"
                      rows={2}
                      value={form.links}
                      onChange={(e) => set("links", e.target.value)}
                    />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="field">
                    <span className="field-label">Tone — pick up to three</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {TONE_CHIPS.map((chip) => {
                        const on = tone.includes(chip);
                        return (
                          <button
                            type="button"
                            key={chip}
                            className={on ? "tone-chip on" : "tone-chip"}
                            aria-pressed={on}
                            disabled={!on && tone.length >= MAX_TONES}
                            title={
                              !on && tone.length >= MAX_TONES
                                ? "Three is the cap — unpick one first"
                                : undefined
                            }
                            onClick={() => toggleTone(chip)}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                    {voiceRead.storedTone !== null && (
                      <span className="t-label">
                        Your saved tone reads “{voiceRead.storedTone}” — picking chips replaces it
                        on the next save; leaving them alone keeps it exactly as it is.
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-voice-sample">
                      Voice sample — paste a post or paragraph that sounds like you
                    </label>
                    <textarea
                      id="profile-voice-sample"
                      className="input"
                      style={{ minHeight: 74 }}
                      value={sample}
                      onChange={(e) => setSample(e.target.value)}
                    />
                    <span className="t-label">
                      The engine drafts in this register — it never copies the sample.
                    </span>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-voice-url">
                      Or point at writing you admire
                    </label>
                    <input
                      id="profile-voice-url"
                      className="input"
                      disabled
                      placeholder="Paste a URL — a post, a newsletter issue, an article…"
                    />
                    <span className="t-label">
                      Not wired yet: nothing fetches a link. The engine reads the sample above —
                      paste the writing itself and it rides into every draft.
                    </span>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-topics">
                      Topics — one per line, your content pillars
                    </label>
                    <textarea
                      id="profile-topics"
                      className="input"
                      rows={4}
                      value={form.topics}
                      onChange={(e) => set("topics", e.target.value)}
                    />
                    <span className="t-label">
                      These seed watched areas in Intel and fall back as discoverability terms when
                      a brief brings none.
                    </span>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-audience">
                      Audience — who the content speaks to
                    </label>
                    <textarea
                      id="profile-audience"
                      className="input"
                      rows={3}
                      value={form.audience}
                      onChange={(e) => set("audience", e.target.value)}
                    />
                    <span className="t-label">
                      Audience and company shape the ICP lead scoring cites.
                    </span>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="field">
                    <label className="field-label" htmlFor="profile-platform-profiles">
                      Platform profiles — tone, char limit, hashtag/CTA/disclosure policy per
                      platform (JSON)
                    </label>
                    <textarea
                      id="profile-platform-profiles"
                      className="input mono"
                      rows={8}
                      value={form.platformProfilesJson}
                      onChange={(e) => set("platformProfilesJson", e.target.value)}
                      placeholder='{ "linkedin": { "tone": "professional", "charLimit": 3000 } }'
                    />
                    <span className="t-label">
                      Open shapes by contract — validated on save, never half-written.
                    </span>
                  </div>
                  <div className="field">
                    <span className="field-label">Cadence — carried, enforced by the judge</span>
                    <div className="input">
                      {cadence.length === 0 ? (
                        <span className="t-label">
                          No cadence rules on this profile — absence disarms the gate entirely.
                        </span>
                      ) : (
                        cadence.map((row) => (
                          <div key={row.platform}>
                            {row.platform} · <span className="t-data">{row.rule}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <span className="t-label">
                      This wizard doesn’t edit cadence yet — it carries your rules through every
                      save untouched, and the judge keeps enforcing them.
                    </span>
                  </div>
                </>
              )}

              {step === 4 && (
                <div className="field">
                  <label className="field-label" htmlFor="profile-denylist">
                    Denylist — one per line
                  </label>
                  <textarea
                    id="profile-denylist"
                    className="input"
                    rows={6}
                    value={form.denylist}
                    onChange={(e) => set("denylist", e.target.value)}
                  />
                  <span className="t-label">
                    Words and claims gate G1 blocks outright. The judge gates — it never rewrites.
                  </span>
                </div>
              )}

              {step === 5 && (
                <>
                  <dl className="sum-grid">
                    <dt>Company</dt>
                    <dd>{form.company.trim() || "not set"}</dd>
                    <dt>Voice</dt>
                    <dd>
                      {toneSummary(pendingVoice, storedHadTone)}
                      {sample.trim() ? " · with a voice sample" : " · no sample"}
                    </dd>
                    <dt>Topics</dt>
                    <dd>{linesToList(form.topics).length || "no"} topics</dd>
                    <dt>Platforms</dt>
                    <dd>
                      {form.platformProfilesJson.trim() ? "configured" : "none in this profile"}
                    </dd>
                    <dt>Denylist</dt>
                    <dd>{linesToList(form.denylist).length || "no"} terms</dd>
                  </dl>
                  <div className="field">
                    <span className="field-label">Carried through this save, untouched</span>
                    <div className="input">
                      {carried.length === 0 ? (
                        <span className="t-label">
                          Nothing else is set on this profile yet — no ICP, cadence, routing,
                          outreach or social block to carry.
                        </span>
                      ) : (
                        carried.map((block) => (
                          <div key={block.label}>
                            <b>{block.label}</b> — powers {block.powers}
                          </div>
                        ))
                      )}
                    </div>
                    <span className="t-label">
                      This wizard doesn’t edit these blocks, so it never rewrites them — saving v
                      {version} keeps every one exactly as it is.
                    </span>
                  </div>
                  {error && (
                    <span className="t-label" role="alert" style={{ color: "var(--err)" }}>
                      {error}
                    </span>
                  )}
                  {savedVersion !== null && (
                    <span className="t-label" role="status" style={{ color: "var(--ok)" }}>
                      Saved as active version v{savedVersion}. Runs from here pin it.
                    </span>
                  )}
                </>
              )}
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
            >
              Back
            </button>
            <div style={{ flex: 1 }} />
            <span className="t-label">
              {step === STEPS.length - 1
                ? "every save appends — nothing is overwritten"
                : `held here until you save v${version}`}
            </span>
            {step === STEPS.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || status !== "success"}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : active ? `Save v${version}` : "Create profile"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep(step + 1)}
              >
                Continue → {stepLabel(step + 1)}
              </button>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="t-title">What this profile powers</span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>Intel</b> — your topics become watched areas; the ranker scores trends against
              them.
            </span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>Leads</b> — audience + company shape the ICP; every lead score cites them.
            </span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>Create</b> — voice + tone drive every draft; discoverability terms fall back to
              your topics.
            </span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>The judge</b> — guardrails become the denylist gate; nothing ships that crosses
              them.
            </span>
          </div>
          <div className="powers-row">
            <span style={{ flex: 1 }}>
              <b>Calendar</b> — platform cadence caps the fan-out plan.
            </span>
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">Change anything later — a new version, never a rewrite.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
