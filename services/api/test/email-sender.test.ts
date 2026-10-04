import { describe, expect, it } from "vitest";
import { z } from "zod";
import { codeEmail } from "../src/lib/email-code";
import { cloudflareEmailSender } from "../src/lib/email-sender";

const SentSchema = z.object({
  from: z.object({ email: z.string(), name: z.string() }),
  to: z.string(),
  subject: z.string(),
  text: z.string(),
  html: z.string(),
});

/** A stand-in for the `send_email` binding that records what it was asked to send. */
function recordingBinding(fail?: Error) {
  const sent: unknown[] = [];
  const binding: SendEmail = {
    async send(message: unknown) {
      sent.push(message);
      if (fail) throw fail;
      return { messageId: "<m1@opengame.org>" };
    },
  };
  return { binding, sent };
}

describe("cloudflareEmailSender (Cloudflare Email Service send_email binding)", () => {
  it("sends the message from OGS at the configured address with the structured builder", async () => {
    const { binding, sent } = recordingBinding();
    await cloudflareEmailSender(binding, "sign-in@opengame.org").send(
      "mom@example.com",
      codeEmail("042133"),
    );
    expect(sent).toHaveLength(1);
    expect(SentSchema.strict().parse(sent[0])).toEqual({
      from: { email: "sign-in@opengame.org", name: "OGS" },
      to: "mom@example.com",
      ...codeEmail("042133"),
    });
  });

  it("lets a refused send fail (e.g. E_SENDER_NOT_VERIFIED)", async () => {
    const { binding } = recordingBinding(new Error("sender not verified"));
    await expect(
      cloudflareEmailSender(binding, "sign-in@opengame.org").send("a@example.com", codeEmail("1")),
    ).rejects.toThrow("sender not verified");
  });
});
