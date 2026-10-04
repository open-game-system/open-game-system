/**
 * The one way the API sends email: a sign-in code message to one address.
 * Production sends through Cloudflare Email Service (the `send_email` binding SEND_EMAIL).
 */
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  send(to: string, email: EmailContent): Promise<void>;
}

/**
 * Sends with the Workers binding's structured form, `env.SEND_EMAIL.send({ from, to, subject, text,
 * html })`. `from` must be on a domain onboarded to Email Sending; a refused send throws (the error
 * carries a `code` such as E_SENDER_NOT_VERIFIED).
 */
export function cloudflareEmailSender(binding: SendEmail, from: string): EmailSender {
  return {
    async send(to, email) {
      await binding.send({ from: { email: from, name: "OGS" }, to, ...email });
    },
  };
}
