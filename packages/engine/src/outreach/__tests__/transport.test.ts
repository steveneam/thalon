import { readEnv } from "@thalon/platform";
import { describe, expect, it } from "vitest";
import { createResendTransport, ResendApiError } from "../resend-driver";
import {
  createFakeSendTransport,
  resolveSendTransport,
  TransportDisarmedError,
  type SendEmailInput,
} from "../transport";

const INPUT: SendEmailInput = {
  to: "sam@riverbendplumbing.example",
  subject: "A quick thought",
  text: "Body with an unsubscribe line.",
};
const FROM = "Thalon <hello@thalon.example>";

async function refusal(transport: ReturnType<typeof resolveSendTransport>): Promise<TransportDisarmedError> {
  const rejection = await transport.sendEmail(INPUT).catch((err) => err);
  expect(rejection).toBeInstanceOf(TransportDisarmedError);
  return rejection as TransportDisarmedError;
}

describe("resolveSendTransport (the two-key arming ratchet — disarmed by default)", () => {
  it("an empty env refuses, naming every missing arm", async () => {
    const transport = resolveSendTransport(readEnv({}));
    expect(transport.name).toBe("disarmed");
    const err = await refusal(transport);
    const named = err.missing.join(" ");
    expect(named).toContain("RESEND_API_KEY");
    expect(named).toContain("OUTREACH_SEND_ARMED");
    expect(named).toContain("options.from");
  });

  it("the key alone must NOT arm — the founder GO is the flag", async () => {
    const transport = resolveSendTransport(readEnv({ RESEND_API_KEY: "re_x" }), { from: FROM });
    const err = await refusal(transport);
    expect(err.missing).toHaveLength(1);
    expect(err.missing[0]).toContain("OUTREACH_SEND_ARMED");
  });

  it("the flag alone must NOT arm — no credential, no driver", async () => {
    const transport = resolveSendTransport(readEnv({ OUTREACH_SEND_ARMED: "true" }), { from: FROM });
    const err = await refusal(transport);
    expect(err.missing).toEqual(["RESEND_API_KEY"]);
  });

  it('arming is EXACTLY the string "true" — case variants and truthy strings stay disarmed', async () => {
    for (const value of ["TRUE", "True", "1", "yes", "armed"]) {
      const transport = resolveSendTransport(
        readEnv({ RESEND_API_KEY: "re_x", OUTREACH_SEND_ARMED: value }),
        { from: FROM },
      );
      expect(transport.name, `OUTREACH_SEND_ARMED=${value}`).toBe("disarmed");
    }
  });

  it("both env arms WITHOUT a sender identity stay disarmed — never half-arm a live driver", async () => {
    const transport = resolveSendTransport(
      readEnv({ RESEND_API_KEY: "re_x", OUTREACH_SEND_ARMED: "true" }),
    );
    const err = await refusal(transport);
    expect(err.missing).toHaveLength(1);
    expect(err.missing[0]).toContain("options.from");
  });

  it("both keys + sender identity resolve the Resend driver", () => {
    const transport = resolveSendTransport(
      readEnv({ RESEND_API_KEY: "re_x", OUTREACH_SEND_ARMED: "true" }),
      { from: FROM },
    );
    expect(transport.name).toBe("resend");
    expect(transport.provider).toBe("resend");
  });
});

describe("createFakeSendTransport", () => {
  it("records every call and mints deterministic accepted-message ids", async () => {
    const transport = createFakeSendTransport();
    expect(await transport.sendEmail(INPUT)).toEqual({ providerMessageId: "fake-msg-1" });
    expect(await transport.sendEmail(INPUT)).toEqual({ providerMessageId: "fake-msg-2" });
    expect(transport.calls).toEqual([INPUT, INPUT]);
  });

  it("failWith throws AFTER recording the call — tests can see the door reached the transport", async () => {
    const transport = createFakeSendTransport({ failWith: new Error("provider down") });
    await expect(transport.sendEmail(INPUT)).rejects.toThrow("provider down");
    expect(transport.calls).toHaveLength(1);
  });
});

describe("createResendTransport (driver BUILT, never live — injected fetch only)", () => {
  function capture(response: () => Response) {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      seen.push({ url: String(url), init: init ?? {} });
      return response();
    };
    return { seen, fetchImpl };
  }

  it("shapes the request: endpoint, bearer auth, from/to/subject/text, List-Unsubscribe mailto", async () => {
    const { seen, fetchImpl } = capture(
      () => new Response(JSON.stringify({ id: "re_msg_1" }), { status: 200 }),
    );
    const transport = createResendTransport({ apiKey: "re_key", from: FROM, fetchImpl });
    expect(await transport.sendEmail(INPUT)).toEqual({ providerMessageId: "re_msg_1" });

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://api.resend.com/emails");
    expect(seen[0].init.method).toBe("POST");
    expect((seen[0].init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    const payload = JSON.parse(String(seen[0].init.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      from: FROM,
      to: [INPUT.to],
      subject: INPUT.subject,
      text: INPUT.text,
    });
    const headers = payload.headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toBe("<mailto:hello@thalon.example?subject=unsubscribe>");
    // RFC 8058 One-Click needs the future HTTPS unsubscribe endpoint — absent on purpose.
    expect(headers["List-Unsubscribe-Post"]).toBeUndefined();
  });

  it("a non-2xx surfaces as ResendApiError carrying the status and the provider's detail", async () => {
    const { fetchImpl } = capture(() => new Response("invalid from domain", { status: 422 }));
    const transport = createResendTransport({ apiKey: "re_key", from: FROM, fetchImpl });
    const rejection = await transport.sendEmail(INPUT).catch((err) => err);
    expect(rejection).toBeInstanceOf(ResendApiError);
    expect((rejection as ResendApiError).status).toBe(422);
    expect((rejection as Error).message).toContain("invalid from domain");
  });

  it("a 2xx without an accepted-message id is refused — a send is only a send with an id", async () => {
    const { fetchImpl } = capture(() => new Response(JSON.stringify({}), { status: 200 }));
    const transport = createResendTransport({ apiKey: "re_key", from: FROM, fetchImpl });
    await expect(transport.sendEmail(INPUT)).rejects.toBeInstanceOf(ResendApiError);
  });
});
