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
  setIntegrationArming,
  validateIntegration,
  type WireIntegrationCard,
  type WirePostingScope,
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
 * The scope control's key in the keyed busy/error maps. It is tenant-wide, so
 * it cannot key by destination — and it must not collide with one either.
 */
const SCOPE_KEY = "__posting_scope__";

/**
 * The queue gate's three states, in ladder order: safest end first.
 *
 * `live`'s hint is a FUNCTION of the master key, not a constant. Written flat
 * it read "Due posts go out on their own" on a deployment whose tick cannot
 * send anything — the control asserting what the engine will not do, which is
 * the one defect class this surface exists to avoid (s103 caught it twice,
 * s112 fixed it here).
 */
const ARM_OPTIONS = [
  { value: "off", label: "Off", hint: () => "Due posts are held and say so." },
  { value: "review", label: "Review", hint: () => "Due posts wait for you in Approve." },
  {
    value: "live",
    label: "Live",
    hint: (queueArmed: boolean) =>
      queueArmed
        ? "Due posts go out on their own."
        : "Due posts would go out on their own — once unattended posting is switched on for this deployment.",
  },
] as const;

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
  /** Part A2's tenant-wide mode. The server is the record; this mirrors the last read. */
  const [postingScope, setPostingScope] = useState<WirePostingScope>("selective");
  /** The master key (`SOCIAL_QUEUE_ARMED`), read-only. Defaults to FALSE so a
   *  failed or pending read never claims the queue is live. */
  const [queueArmed, setQueueArmed] = useState(false);
  /** Which arm control is mid-write — keyed by entity, so one card's spinner never sits on another (the s77 rule). */
  const [armBusy, setArmBusy] = useState<string | null>(null);
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
          setCards(payload.cards);
          setPostingScope(payload.postingScope);
          setQueueArmed(payload.queueArmed === true);
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

  /**
   * The arm write, and the one place the surface is allowed to be optimistic
   * about nothing: the server answers, then the cards are re-read. An arm
   * state that renders before it is stored is exactly the class of lie this
   * surface exists not to tell.
   */
  async function runArm(
    key: string,
    change: Parameters<typeof setIntegrationArming>[0],
    onError: string,
  ) {
    setArmBusy(key);
    setActionErrors((e) => ({ ...e, [key]: "" }));
    try {
      await setIntegrationArming(change);
      await loadCards();
    } catch (err) {
      setActionErrors((e) => ({ ...e, [key]: err instanceof Error ? err.message : onError }));
    } finally {
      setArmBusy(null);
    }
  }

  const publishedTotal = published ? published.socialTotal + published.webTotal : 0;
  const connectCard = cards.find((c) => c.destination === connecting) ?? null;

  /**
   * The connected/available SPLIT (s102 research pass — Apollo and Mercury
   * both, and its top finding). One flat grid over every destination reads
   * the same on day one as on day one hundred: the four seats the operator
   * HAS sit mixed into the six they do not. `needs_reauth` and `expiring`
   * are connected — a broken credential is something you own, not something
   * you might add.
   */
  const isConnected = (card: WireIntegrationCard) =>
    card.state === "connected" || card.state === "expiring" || card.state === "needs_reauth";
  const connectedCards = cards.filter(isConnected);
  const availableCards = cards.filter((card) => !isConnected(card));
  /** The scope control governs the tick, so it appears only where a tick could act. */
  const armableCount = connectedCards.filter((card) => card.armState !== null).length;

  /**
   * One destination card. Extracted from the old single `cards.map` so the
   * connected and available groups render the SAME card — a split that grew
   * a second copy would drift, and the honesty rules live in here.
   */
  const renderCard = (card: WireIntegrationCard) => {
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
              {card.armState !== null && isConnected(card) && (
                <ArmControl
                  card={card}
                  scope={postingScope}
                  queueArmed={queueArmed}
                  busy={armBusy === card.destination}
                  error={actionErrors[card.destination]}
                  onPick={(next) =>
                    void runArm(
                      card.destination,
                      { platform: card.destination, armState: next },
                      "Couldn’t change what the queue may do here.",
                    )
                  }
                />
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
  };

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
        <>
          <div className="int-group-head">
            <span className="t-title">Connected</span>
            <span className="pill pill-idle">{connectedCards.length}</span>
            <div style={{ flex: 1 }} />
            {armableCount > 0 && (
              <PostingScopeControl
                scope={postingScope}
                queueArmed={queueArmed}
                busy={armBusy === SCOPE_KEY}
                error={actionErrors[SCOPE_KEY]}
                onPick={(next) =>
                  void runArm(SCOPE_KEY, { postingScope: next }, "Couldn’t change the posting scope.")
                }
              />
            )}
          </div>
          {connectedCards.length === 0 ? (
            <div className="card">
              <div className="row">
                <span className="t-label">
                  Nothing connected yet — connect a destination below and it moves up here.
                </span>
              </div>
            </div>
          ) : (
            <div className="int-grid">{connectedCards.map(renderCard)}</div>
          )}

          <div className="int-group-head">
            <span className="t-title">Available</span>
            <span className="pill pill-idle">{availableCards.length}</span>
            <div style={{ flex: 1 }} />
            <span className="t-label">connecting is not arming — every platform keeps its own GO</span>
          </div>
          {availableCards.length > 0 && (
            <div className="int-grid">{availableCards.map(renderCard)}</div>
          )}
        </>
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

/**
 * Control-arc part A's per-destination gate, drawn (s103).
 *
 * A **seg**, not a toggle, and that is the whole design: a toggle cannot
 * express `review`, and `review` — hold it for me, do not send it — is the
 * state the finer gate exists to make sayable.
 *
 * The seg always shows the STORED value. Under `all` the stored value is
 * still what renders, with the mode's effect stated beside it rather than
 * folded into it — blank it or rewrite it and the overlay stops being
 * legible, and flipping back stops looking lossless even though it is.
 */
function ArmControl({
  card,
  scope,
  queueArmed,
  busy,
  error,
  onPick,
}: {
  card: WireIntegrationCard;
  scope: WirePostingScope;
  queueArmed: boolean;
  busy: boolean;
  error?: string;
  onPick: (next: "off" | "review" | "live") => void;
}) {
  const stored = card.armState ?? "off";
  // What `all` actually does to THIS destination, in words, at the control it
  // affects — including the two places `all` deliberately does not mean all.
  //
  // The `postingConfigured` arm is not a detail: `all` covers destinations set
  // up for posting, so claiming this one posts because the mode says "all"
  // would be the card contradicting the engine. Found by running it — the
  // sentence read "this destination posts" on a destination the resolver
  // leaves off.
  const scopeOverlay =
    scope !== "all"
      ? null
      : card.postingConfigured === false
        ? "Scope is “all”, but it only covers destinations set up for posting — this one is not, so nothing goes out here."
        : stored === "review"
          ? "Scope is “all”, but a review you asked for is never overridden — this one still waits for you."
          : stored === "off"
            ? "Scope is “all” — this destination posts, even though its own setting says off."
            : null;
  /**
   * Would this destination send by itself, if the master key allowed it? That
   * is the only case where the control is promising an outcome, so it is the
   * only case that needs the master key restated here — the head control
   * carries the standing disclosure and repeating it on every card would be
   * noise. `all` raises `off` to `live` but never `review` (part A2).
   */
  const wouldSend = stored === "live" || (scope === "all" && stored === "off" && card.postingConfigured !== false);
  const overlay = !queueArmed && wouldSend
    ? "Held: unattended posting is switched off for this deployment, so nothing goes out here by itself yet."
    : scopeOverlay;
  return (
    <div className="int-arm">
      <div className="int-arm-head">
        <span className="t-label">The queue may</span>
        <div className="seg" role="group" aria-label={`What the queue may do with ${card.label}`}>
          {ARM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={stored === option.value}
              className={stored === option.value ? "seg-opt on" : "seg-opt"}
              disabled={busy}
              title={option.hint(queueArmed)}
              onClick={() => {
                if (option.value !== stored) onPick(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {busy && <span className="t-label">Saving…</span>}
      </div>
      {overlay && <span className="int-sub">{overlay}</span>}
      {card.postingConfigured === false && (
        // The widening, stated BEFORE the first flip rather than discovered
        // after it: this destination has no posting entry yet, and creating
        // one is also what lets you publish here by hand.
        <span className="int-sub">
          Not set up for posting yet — choosing Review or Live creates its posting settings, which
          also lets you publish here by hand.
        </span>
      )}
      {error && (
        <span className="int-sub" role="alert" style={{ color: "var(--err)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Part A2's posting SCOPE — the founder's own ask ("a toggle on whether i
 * want to post on all or just selectively"), and the head control above the
 * per-destination segs it governs.
 *
 * Its two copy obligations are both here, and both are corrections earned by
 * grounding rather than decoration:
 *  · `all` is LIVE, not a snapshot — a destination configured later is
 *    covered without coming back here. The spec's original sentence promised
 *    this for channels you CONNECT; building it proved connecting writes no
 *    posting entry, so the true word is "set up for posting".
 *  · it sits UNDER the master key, so `all` can never arm what the box has
 *    not. Said plainly, because a control named "all" that quietly obeys a
 *    switch elsewhere is the kind of thing an operator should not have to
 *    discover.
 */
function PostingScopeControl({
  scope,
  queueArmed,
  busy,
  error,
  onPick,
}: {
  scope: WirePostingScope;
  queueArmed: boolean;
  busy: boolean;
  error?: string;
  onPick: (next: WirePostingScope) => void;
}) {
  return (
    <div className="int-scope">
      <div className="int-arm-head">
        <span className="t-label">Post to</span>
        <div className="seg" role="group" aria-label="Which connected destinations may post">
          {(
            [
              { value: "selective", label: "Selected" },
              { value: "all", label: "All" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scope === option.value}
              className={scope === option.value ? "seg-opt on" : "seg-opt"}
              disabled={busy}
              onClick={() => {
                if (option.value !== scope) onPick(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {busy && <span className="t-label">Saving…</span>}
      </div>
      {/*
        The MASTER key, disclosed once and at the head of the controls it
        governs. It is the outer AND gate, so while it is off every setting
        below is a stored intention rather than a behaviour — and saying that
        plainly is the whole fix: the operator should not have to discover
        that a control named "Live" obeys a switch elsewhere. Deliberately not
        a door; arming is a deployment act.
      */}
      {!queueArmed && (
        <span className="int-sub">
          Unattended posting is switched off for this deployment, so nothing goes out on its own
          yet. What you set here is saved and takes effect when it is switched on.
        </span>
      )}
      <span className="int-sub">
        {scope === "all"
          ? "Every destination you’ve set up for posting goes live — including ones you set up later. Anything you set to Review still waits for you. Each destination keeps its own setting, so switching back to Selected restores exactly what you had."
          : "Each destination below does what its own setting says."}
      </span>
      {error && (
        <span className="int-sub" role="alert" style={{ color: "var(--err)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
