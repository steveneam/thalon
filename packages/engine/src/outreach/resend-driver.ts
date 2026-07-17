import { z } from "zod";
import type { SendEmailInput, SendTransport } from "./transport";

/**
 * B-crm.4 back half (s54): the Resend HTTP driver — plain fetch against
 * api.resend.com (the s28 provider decision), no SDK dependency. BUILT in
 * this lane but never executed against the network: nothing constructs it
 * except `resolveSendTransport` behind the two-key arming ratchet, tests
 * inject `fetchImpl`, and there is deliberately no API key on this box.
 */

/** The provider said no (or said yes unusably) — carries the HTTP status for operator triage. */
export class ResendApiError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(`resend rejected the send (HTTP ${status}): ${detail}`);
    this.name = "ResendApiError";
  }
}

/** The one field a send NEEDS from the provider — the accepted-message id the ledger requires. */
const sendResponseSchema = z.object({ id: z.string().min(1) }).loose();

export interface ResendTransportConfig {
  apiKey: string;
  /** Verified-domain sender identity: "Name <addr@domain>" or a bare address. */
  from: string;
  /** API base — swappable for a test double. */
  baseUrl?: string;
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** The bare address inside "Name <addr@domain>" — the mailto unsubscribe target. */
function bareAddress(from: string): string {
  const match = /<([^>]+)>/.exec(from);
  return (match?.[1] ?? from).trim();
}

export function createResendTransport(config: ResendTransportConfig): SendTransport {
  const baseUrl = (config.baseUrl ?? "https://api.resend.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  return {
    provider: "resend",
    name: "resend",
    async sendEmail(input: SendEmailInput): Promise<{ providerMessageId: string }> {
      const response = await fetchImpl(`${baseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          headers: {
            // mailto-only until the unsubscribe web endpoint exists: RFC 8058
            // One-Click (List-Unsubscribe-Post) requires an HTTPS URI, so it
            // is deliberately absent rather than pointed at nothing.
            "List-Unsubscribe": `<mailto:${bareAddress(config.from)}?subject=unsubscribe>`,
          },
        }),
      });
      if (!response.ok) {
        const detail =
          (await response.text().catch(() => "")).slice(0, 300) || response.statusText;
        throw new ResendApiError(response.status, detail);
      }
      const parsed = sendResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new ResendApiError(
          response.status,
          "2xx response without an accepted-message id — refusing to treat as sent",
        );
      }
      return { providerMessageId: parsed.data.id };
    },
  };
}
