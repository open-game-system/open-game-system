// Integration-test stand-in for the Cloudflare Email Service `send_email` binding.
// vitest-pool-workers can't observe what the local binding sends (wrangler dev's Local Explorer is
// off in the pool), so vitest.integration.config.mts binds SEND_EMAIL to this entrypoint instead.
// It keeps the binding's contract (send(builder) -> { messageId }, allowed_sender_addresses) and lets
// tests read what was sent via the EMAIL_OUTBOX binding. The Worker's code is unchanged.
import { WorkerEntrypoint } from "cloudflare:workers";

const ALLOWED_SENDERS = ["sign-in@opengame.org"];
const sent = [];

export class Outbox extends WorkerEntrypoint {
  async send(message) {
    const from = typeof message.from === "string" ? message.from : message.from.email;
    if (!ALLOWED_SENDERS.includes(from)) throw new Error(`email from ${from} not allowed`);
    sent.push({ ...message, to: [message.to].flat(), sentAt: new Date().toISOString() });
    return { messageId: `<${sent.length}@outbox.test>` };
  }

  async sent() {
    return sent;
  }
}

export default {
  fetch() {
    return new Response("email outbox", { status: 404 });
  },
};
