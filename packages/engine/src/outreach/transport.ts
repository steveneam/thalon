import type { OutreachSendProvider } from "@thalon/contracts";
import type { ThalonEnv } from "@thalon/platform";
import { createResendTransport } from "./resend-driver";

/**
 * B-crm.4 back half (s54): the send transport seam. The send door
 * (./send.ts) takes a `SendTransport` through deps — there is deliberately
 * NO default that reaches the network: tests inject the fake, and the only
 * production wiring is `resolveSendTransport`, whose two-key arming ratchet
 * returns a REFUSING transport unless the operator set both the credential
 * AND the founder-GO flag. Live sending is a separate founder GO that does
 * not exist in this lane.
 */

export interface SendEmailInput {
  /** The judged draft's recipient address (meta.recipient.email) — the audit snapshot the ledger records. */
  to: string;
  /** The judged subject verbatim (meta.subject). */
  subject: string;
  /** The judged email body verbatim (meta.emailBody) — the door verified it; the transport must not alter it. */
  text: string;
}

export interface SendTransport {
  /** Ledger vocabulary: which contracts OUTREACH_SEND_PROVIDERS entry a recorded send carries. */
  readonly provider: OutreachSendProvider;
  /** Driver label for messages and tests ("resend" | "fake" | "disarmed"). */
  readonly name: string;
  /** One provider call. Resolves ONLY on a provider-accepted send — the id becomes the ledger row's provider_message_id. */
  sendEmail(input: SendEmailInput): Promise<{ providerMessageId: string }>;
}

/** The refusing transport's error — names every missing arm so the operator knows exactly what stays unset. */
export class TransportDisarmedError extends Error {
  constructor(public readonly missing: readonly string[]) {
    super(
      `outreach send transport is DISARMED — missing arm(s): ${missing.join(
        ", ",
      )}. Live sending is a separate founder GO; every arm must be deliberately set.`,
    );
    this.name = "TransportDisarmedError";
  }
}

export interface FakeSendTransport extends SendTransport {
  /** Every input the door handed over, in order — the tests' assertion surface. */
  readonly calls: SendEmailInput[];
}

/**
 * The tests' transport: deterministic accepted-message ids, zero network.
 * `failWith` simulates a provider failure AFTER the door reached the
 * transport — the call is still recorded so tests can assert the door got
 * this far while proving nothing landed in the ledger.
 */
export function createFakeSendTransport(opts: { failWith?: Error } = {}): FakeSendTransport {
  const calls: SendEmailInput[] = [];
  return {
    provider: "resend",
    name: "fake",
    calls,
    async sendEmail(input) {
      calls.push(input);
      if (opts.failWith) throw opts.failWith;
      return { providerMessageId: `fake-msg-${calls.length}` };
    },
  };
}

export interface ResolveSendTransportOptions {
  /**
   * Verified-domain sender identity ("Name <addr@domain>" or a bare
   * address). The frozen s54 contract sanctions exactly two env keys, and a
   * sender identity is per-deployment operator data the future live-send
   * ops door supplies — absent, the transport stays disarmed even with both
   * env arms set (never half-arm a live driver).
   */
  from?: string;
}

/**
 * The arming ratchet (kickoff item 4): the Resend driver is returned ONLY
 * when BOTH `RESEND_API_KEY` and `OUTREACH_SEND_ARMED=true` are set — two
 * distinct keys, because the founder GO is the flag and the credential
 * alone must never arm — AND a sender identity is supplied. Anything less
 * returns a refusing transport whose error names every missing arm.
 */
export function resolveSendTransport(
  env: ThalonEnv,
  opts: ResolveSendTransportOptions = {},
): SendTransport {
  const apiKey = env.RESEND_API_KEY;
  const from = opts.from;
  const missing: string[] = [];
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (env.OUTREACH_SEND_ARMED !== "true") {
    missing.push('OUTREACH_SEND_ARMED (exactly "true" — the founder GO)');
  }
  if (!from) missing.push("sender identity (options.from — the live-send ops door supplies it)");
  if (!apiKey || !from || missing.length > 0) {
    return {
      provider: "resend",
      name: "disarmed",
      async sendEmail() {
        throw new TransportDisarmedError(missing);
      },
    };
  }
  return createResendTransport({ apiKey, from });
}
