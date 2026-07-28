"use client";

import "@/components/settings/settings.css";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FIELD_LABELS,
  GUIDED_STEPS,
  SECRET_KEYS,
  armedPill,
  capabilityNote,
  cardActions,
  platformGlyph,
  probeLine,
  seatRows,
  statePill,
  subLine,
} from "@/components/settings/integrations-model";
import {
  beginOauthIntegration,
  connectIntegration,
  disconnectIntegration,
  fetchIntegrationCards,
  fetchPendingQueueCount,
  fetchPublishedView,
  validateIntegration,
  type WireIntegrationCard,
  type WireProbeOutcome,
  type WirePublishedView,
} from "@/lib/integrations/client";
import { fetchStatus } from "@/lib/workspace/client";
import { platformLabel, timeAgo } from "@/lib/workspace/format";
import type { WorkspaceStatus } from "@/lib/workspace/types";

type ReadStatus = "loading" | "error" | "success";

/** The ledger is bounded like every row region — the count states the rest. */
const PUBLISHED_SHOWN = 12;

/**
 * Settings → Integrations — STEP 2 of the two-step rebuild: the byte-true
 * port of Integrations.dc.html with the engine behind it. This is the
 * honesty-critical surface, so the rule is narrow: the card STATE comes from
 * the one engine derivation (listIntegrationCards) and is never prettied up
 * here — an env-filled seat says so instead of reading "Not connected", a
 * `connectedAs` stamps its own card, a validate failure prints the
 * platform's own refusal verbatim (the versioned-pin proof), and the
 * published view is the ledger of what actually went out.
 *
 * Keepers re-entered as STATE behind the sheet's chrome (doctrine vii): the
 * guided mode-2 connect (steps → paste → validate ping) opens as a panel
 * from the sheet's own "Set up" action, the disconnect confirm is a line on
 * the card it destroys, and the published ledger opens from the sheet's own
 * header door. Resting chrome is exactly the sheet's.
 */
export function Integrations() {
  const [cards, setCards] = useState<WireIntegrationCard[]>([]);
  const [cardsStatus, setCardsStatus] = useState<ReadStatus>("loading");
  const [published, setPublished] = useState<WirePublishedView | null>(null);
  const [publishedStatus, setPublishedStatus] = useState<ReadStatus>("loading");
  const [publishedOpen, setPublishedOpen] = useState(false);
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [statusRead, setStatusRead] = useState<ReadStatus>("loading");
  /** Stamped when a read resolves — every "2h ago" is as-of that read. */
  const [readAt, setReadAt] = useState(0);

  const [connecting, setConnecting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [probes, setProbes] = useState<Record<string, WireProbeOutcome>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  /** Pending queue rows per destination, for the disconnect confirm (absent/null = count unavailable). Keyed by entity — a resolve landing after the confirm moved on must not show one card's count under another (the s77 keyed-state rule). */
  const [pendingCounts, setPendingCounts] = useState<Record<string, number | null>>({});
  /** The OAuth callback's outcome, read once from the return-redirect's query. */
  const [callbackBanner, setCallbackBanner] = useState<
    { tone: "ok" | "bad"; text: string; destination?: string } | null
  >(null);

  useEffect(() => {
    // The dynamic callback route lands the browser back here with the
    // outcome in the query — read it once, show it as a banner, and clear
    // the URL so a reload doesn't replay a stale verdict.
    const query = new URLSearchParams(window.location.search);
    const connected = query.get("connected");
    const failed = query.get("connect_error");
    if (!connected && !failed) return;
    setCallbackBanner(
      connected
        ? { tone: "ok", text: `Connected — the card below now shows who it posts as.`, destination: connected }
        : { tone: "bad", text: failed ?? "The connect failed." },
    );
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  /** A probe verdict belongs to the credential it ran on — it leaves with it. */
  const clearProbe = useCallback((destination: string) => {
    setProbes((p) => {
      const next = { ...p };
      delete next[destination];
      return next;
    });
  }, []);

  const loadCards = useCallback(
    () =>
      fetchIntegrationCards()
        .then((payload) => {
          setCards(payload);
          setReadAt(Date.now());
          setCardsStatus("success");
        })
        .catch(() => setCardsStatus("error")),
    [],
  );
  const loadPublished = useCallback(
    () =>
      fetchPublishedView()
        .then((payload) => {
          setPublished(payload);
          setPublishedStatus("success");
        })
        .catch(() => setPublishedStatus("error")),
    [],
  );

  useEffect(() => {
    void loadCards();
    void loadPublished();
    fetchStatus()
      .then((payload) => {
        setStatus(payload);
        setStatusRead("success");
      })
      .catch(() => setStatusRead("error"));
  }, [loadCards, loadPublished]);

  async function runValidate(card: WireIntegrationCard) {
    setBusy(card.destination);
    setActionErrors((e) => ({ ...e, [card.destination]: "" }));
    try {
      const result = await validateIntegration(card.destination);
      setProbes((p) => ({ ...p, [card.destination]: result.probe }));
      await loadCards();
    } catch (err) {
      setActionErrors((e) => ({
        ...e,
        [card.destination]: err instanceof Error ? err.message : "Validate failed.",
      }));
    } finally {
      setBusy(null);
    }
  }

  async function runDisconnect(card: WireIntegrationCard) {
    setBusy(card.destination);
    setActionErrors((e) => ({ ...e, [card.destination]: "" }));
    try {
      await disconnectIntegration(card.destination);
      setConfirming(null);
      clearProbe(card.destination);
      await loadCards();
    } catch (err) {
      setActionErrors((e) => ({
        ...e,
        [card.destination]: err instanceof Error ? err.message : "Disconnect failed.",
      }));
    } finally {
      setBusy(null);
    }
  }

  const publishedTotal = published ? published.socialTotal + published.webTotal : 0;
  const connectCard = cards.find((c) => c.destination === connecting) ?? null;

  return (
    <div className="content settings-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="t-label" href="/app/settings">
          Settings ›
        </Link>
        <h1 className="t-headline">Integrations</h1>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="card-link"
          aria-expanded={publishedOpen}
          onClick={() => setPublishedOpen((open) => !open)}
        >
          {publishedStatus === "success"
            ? `Published · ${publishedTotal} item${publishedTotal === 1 ? "" : "s"} ${publishedOpen ? "↑" : "→"}`
            : `Published ${publishedOpen ? "↑" : "→"}`}
        </button>
      </div>

      {callbackBanner && (
        <div className="card">
          <div className="row" role={callbackBanner.tone === "bad" ? "alert" : "status"}>
            <span
              className="int-sub"
              style={{
                flex: 1,
                color: callbackBanner.tone === "bad" ? "var(--err)" : undefined,
              }}
            >
              {callbackBanner.text}
            </span>
            {callbackBanner.tone === "bad" && (
              <span className="t-label">nothing was stored — connect again below</span>
            )}
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => setCallbackBanner(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {publishedOpen && (
        <div className="card">
          <div className="card-head">
            <span className="t-title">Published</span>
            <div style={{ flex: 1 }} />
            <span className="t-label">
              what actually went out, newest first — every row keeps its way back
            </span>
          </div>
          {publishedStatus === "loading" ? (
            <div className="row">
              <span className="t-label">Reading the ledger…</span>
            </div>
          ) : publishedStatus === "error" ? (
            <div className="row" role="alert">
              <span className="t-label" style={{ flex: 1 }}>
                Couldn’t read the published ledger — this is a read failure, not an empty record.
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setPublishedStatus("loading");
                  void loadPublished();
                }}
              >
                Try again
              </button>
            </div>
          ) : published && published.items.length === 0 ? (
            <div className="row">
              <span className="t-label">
                Nothing published yet — approved drafts land here when they go out.
              </span>
            </div>
          ) : (
            published && (
              <>
                <div className="card-rows">
                  {published.items.slice(0, PUBLISHED_SHOWN).map((item) => {
                    const href = item.kind === "social" ? item.permalink : item.path;
                    const label =
                      item.kind === "social" ? (item.excerpt ?? item.externalPostId) : item.title;
                    const key =
                      item.kind === "social"
                        ? `social-${item.platform}-${item.externalPostId}`
                        : `web-${item.slug}`;
                    return (
                      <div key={key} className="row">
                        <span className="pill pill-idle">
                          {item.kind === "social" ? platformLabel(item.platform ?? "") : "Blog"}
                        </span>
                        <span className="excerpt" style={{ flex: 1 }}>
                          {label}
                        </span>
                        <span className="t-data">
                          {timeAgo(new Date(item.publishedAtMs).toISOString(), readAt || undefined)}
                        </span>
                        {href ? (
                          <a
                            className="card-link"
                            href={href}
                            target={item.kind === "social" ? "_blank" : undefined}
                            rel={item.kind === "social" ? "noreferrer" : undefined}
                            aria-label={`Open ${
                              item.kind === "social"
                                ? `the ${platformLabel(item.platform ?? "")} post`
                                : "the blog post"
                            }`}
                          >
                            Open ↗
                          </a>
                        ) : (
                          <span className="t-data">{item.externalPostId}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {publishedTotal > PUBLISHED_SHOWN && (
                  <div className="row">
                    <span className="t-label">
                      Showing {Math.min(PUBLISHED_SHOWN, published.items.length)} of{" "}
                      {publishedTotal} publications on record.
                    </span>
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}

      {cardsStatus === "loading" ? (
        <div className="card">
          <div className="row">
            <span className="t-label">Reading your destinations…</span>
          </div>
        </div>
      ) : cardsStatus === "error" ? (
        <div className="card">
          <div className="row" role="alert">
            <span className="t-label" style={{ flex: 1 }}>
              Couldn’t read your integrations — this is a read failure, not a disconnected
              workspace. Nothing changed.
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCardsStatus("loading");
                void loadCards();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="card">
          <div className="row">
            <span className="t-label">
              The registry answered with no destinations — nothing to connect from here.
            </span>
          </div>
        </div>
      ) : (
        <div className="int-grid">
          {cards.map((card) => {
            const pill = statePill(card);
            const armed = armedPill(card);
            const probe = probes[card.destination];
            const line = probe ? probeLine(probe) : null;
            const error = actionErrors[card.destination];
            // While the confirm line is up, the action it belongs to steps
            // aside — one Disconnect on screen, never two.
            const actions = cardActions(card).filter(
              (action) => !(action.key === "disconnect" && confirming === card.destination),
            );
            return (
              <div key={card.destination} className="int-card">
                <div className="int-head">
                  <div className="plat-ico" aria-hidden>
                    {platformGlyph(card.destination)}
                  </div>
                  <span className="int-name">{card.label}</span>
                  <span className={pill.className}>{pill.text}</span>
                  {armed && <span className={armed.className}>{armed.text}</span>}
                </div>
                <span className="int-sub">{subLine(card, readAt || undefined)}</span>
                {armed && card.armedReason && (
                  // VISIBLE PROVENANCE: the pill states the fact, this states
                  // why — including an env force-arm, which is the one an
                  // operator most needs to see and cannot infer.
                  <span className="int-sub">{card.armedReason}</span>
                )}
                {capabilityNote(card) && (
                  // What this destination CAN do, stated before the paste —
                  // not discovered at publish time.
                  <span className="int-sub" style={{ color: "var(--warn)" }}>
                    {capabilityNote(card)}
                  </span>
                )}
                {actions.length > 0 && (
                  <div className="int-actions">
                    {actions.map((action) =>
                      action.key === "blog" ? (
                        <Link key={action.key} className="btn btn-ghost btn-sm" href="/blog">
                          {action.label}
                        </Link>
                      ) : (
                        <button
                          key={action.key}
                          type="button"
                          className={`btn ${action.variant} btn-sm`}
                          disabled={busy === card.destination}
                          onClick={() => {
                            if (action.key === "validate") void runValidate(card);
                            if (action.key === "disconnect") {
                              setConfirming(card.destination);
                              // The confirm must count what disconnecting
                              // strands: this platform's pending queue rows.
                              if (card.class === "social") {
                                void fetchPendingQueueCount(card.destination).then((count) =>
                                  setPendingCounts((c) => ({ ...c, [card.destination]: count })),
                                );
                              }
                            }
                            if (action.key === "connect") {
                              setConnecting(card.destination);
                              clearProbe(card.destination);
                            }
                          }}
                        >
                          {action.label}
                        </button>
                      ),
                    )}
                  </div>
                )}
                {confirming === card.destination && (
                  <div className="int-confirm">
                    <span className="int-sub">
                      Disconnect {card.label}? The sealed credential is deleted; the ledger
                      remembers what already went out.
                      {(pendingCounts[card.destination] ?? 0) > 0
                        ? ` ${pendingCounts[card.destination]} scheduled post${pendingCounts[card.destination] === 1 ? "" : "s"} in the queue will fail closed without it.`
                        : ""}
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy === card.destination}
                      onClick={() => void runDisconnect(card)}
                    >
                      Disconnect
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      disabled={busy === card.destination}
                      onClick={() => setConfirming(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {line && (
                  <span
                    className="int-sub"
                    role={line.tone === "bad" ? "alert" : "status"}
                    style={
                      line.tone === "bad"
                        ? { color: "var(--err)" }
                        : line.tone === "warn"
                          ? { color: "var(--warn)" }
                          : undefined
                    }
                  >
                    {line.text}
                  </span>
                )}
                {error && (
                  <span className="int-sub" role="alert" style={{ color: "var(--err)" }}>
                    {error}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {connectCard && (
        // Keyed per destination: the panel holds PASTED CREDENTIALS. Unkeyed,
        // a secret typed for one destination stays in the box when the panel
        // re-titles itself for another, and Connect seals it there — the
        // worst instance of the keyed-by-entity class (s78 sweep).
        <ConnectPanel
          key={connectCard.destination}
          card={connectCard}
          onCancel={() => setConnecting(null)}
          onDone={(probe) => {
            setConnecting(null);
            setProbes((p) => ({ ...p, [connectCard.destination]: probe }));
            void loadCards();
          }}
        />
      )}

      <div className="card">
        <div className="card-head">
          <span className="t-title">Your AI</span>
          <span className="pill pill-idle">
            {/* An unresolved read reads "–", never a confident zero. */}
            {statusRead === "success" && status
              ? `${seatRows(status).length} model seats`
              : "– model seats"}
          </span>
          <div style={{ flex: 1 }} />
          <span className="t-label">bring-your-own connect arrives with the BYO-AI bucket</span>
        </div>
        {statusRead === "error" ? (
          <div className="seat-row" role="alert">
            <span className="t-label">
              Couldn’t read the model seats — a read failure, not an unconfigured engine.
            </span>
          </div>
        ) : statusRead === "loading" || !status ? (
          <div className="seat-row">
            <span className="t-label">Reading the seats…</span>
          </div>
        ) : (
          seatRows(status).map((seat) => (
            <div key={seat.label} className="seat-row">
              <span style={{ width: 110, color: "var(--n-900)", fontSize: 12.5 }}>{seat.label}</span>
              <span style={{ flex: 1 }}>{seat.value}</span>
              <span className="pill pill-idle">env</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * The guided (mode 2) connect — the keeper that re-enters as a panel behind
 * the sheet's own action, never as extra resting chrome. Mode 1 (one-click
 * OAuth) is named honestly rather than pretended: it arrives per platform
 * with the partner-app approvals.
 */
function ConnectPanel({
  card,
  onCancel,
  onDone,
}: {
  card: WireIntegrationCard;
  onCancel: () => void;
  onDone: (probe: WireProbeOutcome) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = GUIDED_STEPS[card.destination] ?? [];
  const oauth = card.connectFlavor === "oauth2";
  const ready = card.fields
    .filter((f) => !f.optional)
    .every((f) => (values[f.key] ?? "").trim() !== "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const filled = Object.fromEntries(
        card.fields
          .map((f) => [f.key, (values[f.key] ?? "").trim()] as const)
          .filter(([, v]) => v !== ""),
      );
      onDone((await connectIntegration(card.destination, filled)).probe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
      setBusy(false);
    }
  }

  async function beginDance() {
    setBusy(true);
    setError(null);
    try {
      const { authorizeUrl } = await beginOauthIntegration(card.destination);
      // The platform's consent page takes over; its callback returns to
      // Settings with the outcome in the query. Busy stays on until we leave.
      window.location.assign(authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the connect.");
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="t-title">Connect {card.label}</span>
        <div style={{ flex: 1 }} />
        <span className="t-label">
          connecting is not arming — every platform keeps its explicit GO
        </span>
      </div>
      <div className="connect-body">
        <ol className="connect-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {card.class === "social" && !oauth && card.connectFlavor !== "app_password" && (
          <span className="int-sub">
            One-click connect arrives when the partner app clears this platform’s review — until
            then, this guided setup is the honest path.
          </span>
        )}
        {!oauth && card.fields.length > 0 && (
          <div className="connect-fields">
            {card.fields.map((field) => {
              const id = `${card.destination}-${field.key}`;
              return (
                <label key={field.key} className="connect-field" htmlFor={id}>
                  <span className="t-label">
                    {FIELD_LABELS[field.key] ?? field.key}
                    {field.optional ? " (optional)" : ""}
                  </span>
                  <input
                    id={id}
                    type={SECRET_KEYS.has(field.key) ? "password" : "text"}
                    autoComplete="off"
                    value={values[field.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  />
                </label>
              );
            })}
          </div>
        )}
        {error && (
          <span className="int-sub" role="alert" style={{ color: "var(--err)" }}>
            {error}
          </span>
        )}
        <div className="int-actions">
          {oauth ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => void beginDance()}
            >
              {busy ? "Opening the platform…" : `Continue to ${card.label} ↗`}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!ready || busy}
              onClick={() => void submit()}
            >
              {busy ? "Connecting…" : "Connect"}
            </button>
          )}
          <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
