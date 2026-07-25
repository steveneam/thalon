"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  connectIntegration,
  disconnectIntegration,
  fetchIntegrationCards,
  fetchPublishedView,
  validateIntegration,
  type WireDestinationClass,
  type WireIntegrationCard,
  type WireProbeOutcome,
  type WirePublishedView,
} from "@/lib/integrations/client";
import { timeAgo } from "@/lib/workspace/format";

/**
 * B-int.2 (ADR 0011): Settings → Integrations — a card per destination,
 * grouped by what it powers, every card in one of the frozen honest states.
 * Mode-2 guided connect (step list + paste fields + validate ping) works
 * day one; mode 1 (one-click OAuth) arrives per platform with B-int.4's
 * partner-app approvals and is named honestly in the flow copy until then.
 * The published view underneath is the ledger's answer to "what actually
 * went out" — every item carries its way back (Source-Link Rule).
 */

/** Group order + copy — mirrors engine DESTINATION_CLASS_ORDER/LABELS (cards.ts). */
const CLASS_ORDER: WireDestinationClass[] = ["social", "website", "newsletter", "intel"];
const CLASS_LABELS: Record<WireDestinationClass, string> = {
  social: "Social publishing",
  website: "Your website",
  newsletter: "Outreach & newsletter",
  intel: "Intel sources",
};
const CLASS_HINTS: Record<WireDestinationClass, string> = {
  social: "Where approved posts go out — connecting is not arming; every platform keeps its explicit GO.",
  website: "Where approved pages and articles publish.",
  newsletter: "What sends your outreach and newsletter email.",
  intel: "What the trend sweeps read — sources in, never posting.",
};

/** Paste-field labels by schema key; a key without an entry renders as itself. */
const FIELD_LABELS: Record<string, string> = {
  accessToken: "Access token",
  pageId: "Page ID",
  igUserId: "Account ID",
  baseUrl: "Site URL",
  username: "Username",
  applicationPassword: "Application password",
  adminApiUrl: "Admin API URL",
  adminApiKey: "Admin API key",
  url: "Endpoint URL",
  secret: "Signing secret",
  apiKey: "API key",
  identifier: "Handle",
  appPassword: "App password",
};

/** Secret-shaped keys render as password inputs. */
const SECRET_KEYS = new Set([
  "accessToken",
  "applicationPassword",
  "adminApiKey",
  "secret",
  "apiKey",
  "appPassword",
]);

/**
 * The guided (mode 2) step lists — authored generic and platform-neutral:
 * every platform's portal differs in chrome, not in shape (an app, a grant,
 * a token, a paste). The validate ping after the paste is what makes the
 * card honest.
 */
const GUIDED_STEPS: Record<string, string[]> = {
  linkedin: [
    "Create (or open) an app in the platform's developer portal.",
    "Add the member-posting and image-upload products and request access where gated.",
    "Generate a member access token carrying those scopes with the portal's token tool.",
    "Paste it below — a read-only ping verifies it before anything can post.",
  ],
  x: [
    "Create (or open) an app in the platform's developer portal with write access.",
    "Generate a user access token for the account that will post.",
    "Paste it below — a read-only ping verifies it before anything can post.",
  ],
  facebook: [
    "Create (or open) an app in the platform's developer portal and connect your Page.",
    "Grant the Page posting and photo permissions.",
    "Generate a long-lived Page access token.",
    "Paste the token and your Page ID below.",
  ],
  instagram: [
    "Connect the account to a Page in the platform's developer portal.",
    "Grant the content-publishing permission and generate an access token.",
    "Paste the token and the account ID below.",
  ],
  website_hosted: [
    "No credentials needed — connecting is your opt-in to the hosted blog. Approved articles can then publish to it.",
  ],
  website_wordpress: [
    "In your site's admin, create an Application Password for your user (Users → Profile).",
    "Paste your site URL, username, and that password below.",
  ],
  website_ghost: [
    "In your site's admin, add a custom integration (Settings → Integrations) to get an Admin API key.",
    "Paste the Admin API URL and the key below.",
  ],
  website_webhook: [
    "Stand up an endpoint on your side that accepts published content as a POST.",
    "Paste its URL — and a signing secret if you want payloads signed.",
    "No ping fires on connect (firing your automation is not a probe) — the connection validates on first publish.",
  ],
  newsletter_resend: [
    "Create an API key in your email provider's dashboard.",
    "Paste it below — a read-only ping verifies it.",
  ],
  intel_youtube: [
    "In the platform's cloud console, enable the Data API and create an API key.",
    "Paste it below — a read-only ping verifies it.",
  ],
  intel_bluesky: [
    "In the platform's settings, create an app password (never your account password).",
    "Paste your handle and the app password below.",
  ],
};

const STATE_BADGE: Record<
  WireIntegrationCard["state"],
  { label: string; variant: "secondary" | "outline" | "signal" | "destructive" }
> = {
  connected: { label: "Connected", variant: "secondary" },
  not_connected: { label: "Not connected", variant: "outline" },
  needs_reauth: { label: "Needs re-auth", variant: "signal" },
  expiring: { label: "Expiring soon", variant: "signal" },
  plan_gated: { label: "Not on your plan", variant: "outline" },
  review_pending: { label: "Awaiting platform review", variant: "outline" },
};

type PanelStatus = "loading" | "error" | "success";

function probeLine(probe: WireProbeOutcome): { text: string; tone: "ok" | "warn" | "bad" } {
  switch (probe.outcome) {
    case "validated":
      return {
        text: probe.connectedAs ? `Verified — connected as ${probe.connectedAs}` : "Verified",
        tone: "ok",
      };
    case "auth_failed":
      return { text: `The platform refused the credential — ${probe.detail ?? "auth failed"}`, tone: "bad" };
    case "unreachable":
      return { text: probe.detail ?? "The platform could not be reached — nothing changed.", tone: "warn" };
    case "unsupported":
      return { text: probe.detail ?? "No read-only probe exists for this destination.", tone: "warn" };
  }
}

function ConnectFlow({
  card,
  onDone,
  onCancel,
}: {
  card: WireIntegrationCard;
  onDone: (probe: WireProbeOutcome) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = GUIDED_STEPS[card.destination] ?? [];
  const required = card.fields.filter((f) => !f.optional);
  const ready = required.every((f) => (values[f.key] ?? "").trim() !== "");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const filled = Object.fromEntries(
        card.fields
          .map((f) => [f.key, (values[f.key] ?? "").trim()] as const)
          .filter(([, v]) => v !== ""),
      );
      const result = await connectIntegration(card.destination, filled);
      onDone(result.probe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {card.class === "social" && (
        <p className="mt-2 text-xs text-muted-foreground">
          One-click connect arrives when the partner app clears this platform&rsquo;s review —
          until then, this guided setup is the honest path.
        </p>
      )}
      {card.fields.length > 0 && (
        <div className="mt-3 grid gap-2 sm:max-w-md">
          {card.fields.map((field) => {
            const label = FIELD_LABELS[field.key] ?? field.key;
            const id = `${card.destination}-${field.key}`;
            return (
              <label key={field.key} htmlFor={id} className="grid gap-1 text-xs font-medium">
                <span>
                  {label}
                  {field.optional && <span className="text-muted-foreground"> (optional)</span>}
                </span>
                <input
                  id={id}
                  type={SECRET_KEYS.has(field.key) ? "password" : "text"}
                  autoComplete="off"
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm font-normal focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                />
              </label>
            );
          })}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" disabled={!ready || busy} onClick={() => void submit()}>
          {busy ? "Connecting…" : "Connect"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DestinationCard({
  card,
  onChanged,
}: {
  card: WireIntegrationCard;
  onChanged: () => void;
}) {
  const [flowOpen, setFlowOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<WireProbeOutcome | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const badge = STATE_BADGE[card.state];
  const connected =
    card.state === "connected" || card.state === "needs_reauth" || card.state === "expiring";
  // s70 founder catch: a destination that POSTS via the box env (X's 1.0a
  // seats) must not read "Not connected" — the vault row is absent but the
  // engine is live. Env-connected is its own honest presentation.
  const envConnected = card.envOverride && card.state === "not_connected";

  async function runValidate() {
    setBusy(true);
    setActionError(null);
    try {
      const result = await validateIntegration(card.destination);
      setProbe(result.probe);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Validate failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runDisconnect() {
    setBusy(true);
    setActionError(null);
    try {
      await disconnectIntegration(card.destination);
      setConfirming(false);
      setProbe(null);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Disconnect failed.");
    } finally {
      setBusy(false);
    }
  }

  const line = probe ? probeLine(probe) : null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{card.label}</span>
          {envConnected ? (
            <Badge
              variant="signal"
              title="Live via the box environment's credential — no vault row yet; connecting here moves it onto the per-tenant vault."
            >
              Connected via env
            </Badge>
          ) : (
            <>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {card.envOverride && (
                <Badge
                  variant="signal"
                  title="The box environment fills this seat — it takes precedence over the vault row."
                >
                  env override
                </Badge>
              )}
            </>
          )}
        </div>
        {card.state !== "plan_gated" && (
          <div className="flex items-center gap-1.5">
            {connected && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void runValidate()}>
                Validate
              </Button>
            )}
            {connected && !confirming && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(true)}>
                Disconnect
              </Button>
            )}
            {!flowOpen && (
              <Button
                size="sm"
                variant={card.state === "not_connected" || card.state === "needs_reauth" ? "default" : "outline"}
                disabled={busy}
                onClick={() => {
                  setFlowOpen(true);
                  setProbe(null);
                }}
              >
                {card.state === "not_connected" ? "Set up" : "Reconnect"}
              </Button>
            )}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {card.connectedAs && <span>as {card.connectedAs} · </span>}
        {card.validatedAt && <span>verified {timeAgo(card.validatedAt)} · </span>}
        powers <code className="font-mono">{card.driver}</code>
      </p>
      {confirming && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span>Disconnect {card.label}? The sealed credential is deleted; the ledger remembers.</span>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => void runDisconnect()}>
            Disconnect
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      )}
      {line && (
        <p
          className={`mt-2 text-xs ${
            line.tone === "ok"
              ? "text-muted-foreground"
              : line.tone === "bad"
                ? "text-destructive"
                : "text-signal-foreground"
          }`}
        >
          {line.text}
        </p>
      )}
      {actionError && <p className="mt-2 text-xs text-destructive">{actionError}</p>}
      {flowOpen && (
        <ConnectFlow
          card={card}
          onCancel={() => setFlowOpen(false)}
          onDone={(outcome) => {
            setFlowOpen(false);
            setProbe(outcome);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

const PUBLISHED_SHOWN = 12;

function PublishedSection({ view, status }: { view: WirePublishedView | null; status: PanelStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Published</CardTitle>
        <CardDescription>
          What actually went out, newest first — the social ledger joined with your site&rsquo;s
          published posts. Every row keeps its way back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "loading" && <p className="text-sm text-muted-foreground">Reading…</p>}
        {status === "error" && (
          <p className="text-sm text-destructive">Couldn&rsquo;t read the published ledger.</p>
        )}
        {status === "success" && view && view.items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing published yet — approved drafts land here when they go out.
          </p>
        )}
        {status === "success" && view && view.items.length > 0 && (
          <ul className="divide-y divide-border">
            {view.items.slice(0, PUBLISHED_SHOWN).map((item) => {
              const href = item.kind === "social" ? item.permalink : item.path;
              const label =
                item.kind === "social" ? (item.excerpt ?? item.externalPostId) : item.title;
              return (
                <li
                  key={`${item.kind}-${item.kind === "social" ? `${item.platform}-${item.externalPostId}` : item.slug}`}
                  className="flex items-center gap-2 py-2"
                >
                  <Badge variant="outline" className="shrink-0 font-mono">
                    {item.kind === "social" ? item.platform : "blog"}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(new Date(item.publishedAtMs).toISOString())}
                  </span>
                  {href ? (
                    <a
                      href={href}
                      target={item.kind === "social" ? "_blank" : undefined}
                      rel={item.kind === "social" ? "noreferrer" : undefined}
                      className="shrink-0 text-primary hover:underline"
                      aria-label={`Open ${item.kind === "social" ? `the ${item.platform} post` : "the blog post"}`}
                    >
                      <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  ) : (
                    <code className="shrink-0 font-mono text-xs text-muted-foreground">
                      {item.externalPostId}
                    </code>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {status === "success" && view && view.socialTotal + view.webTotal > PUBLISHED_SHOWN && (
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            Showing {Math.min(PUBLISHED_SHOWN, view.items.length)} of {view.socialTotal + view.webTotal}{" "}
            publications on record.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function IntegrationsPanel() {
  const [cards, setCards] = useState<WireIntegrationCard[] | null>(null);
  const [cardsStatus, setCardsStatus] = useState<PanelStatus>("loading");
  const [published, setPublished] = useState<WirePublishedView | null>(null);
  const [publishedStatus, setPublishedStatus] = useState<PanelStatus>("loading");

  const reload = useCallback(() => {
    fetchIntegrationCards()
      .then((payload) => {
        setCards(payload);
        setCardsStatus("success");
      })
      .catch(() => setCardsStatus("error"));
  }, []);

  useEffect(() => {
    reload();
    fetchPublishedView()
      .then((payload) => {
        setPublished(payload);
        setPublishedStatus("success");
      })
      .catch(() => setPublishedStatus("error"));
  }, [reload]);

  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <div>
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-3.5" /> Settings
        </Link>
        <h1 className="mt-1 text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect the destinations your content ships to. Credentials seal into the per-tenant
          vault; a connected account is never an armed one — posting keeps its explicit GO.
        </p>
      </div>

      {cardsStatus === "loading" && <p className="text-sm text-muted-foreground">Reading…</p>}
      {cardsStatus === "error" && (
        <p className="text-sm text-destructive">Couldn&rsquo;t read integrations.</p>
      )}
      {cardsStatus === "success" &&
        cards &&
        CLASS_ORDER.map((cls) => {
          const group = cards.filter((c) => c.class === cls);
          if (group.length === 0) return null;
          return (
            <Card key={cls}>
              <CardHeader>
                <CardTitle>{CLASS_LABELS[cls]}</CardTitle>
                <CardDescription>{CLASS_HINTS[cls]}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {group.map((card) => (
                  <DestinationCard key={card.destination} card={card} onChanged={reload} />
                ))}
              </CardContent>
            </Card>
          );
        })}

      <PublishedSection view={published} status={publishedStatus} />
    </div>
  );
}
