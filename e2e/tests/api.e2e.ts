// Identity and session rules at the API boundary (no screen, no model).
// Acceptance: docs/acceptance/2026-10-04-ogs-profiles.feature.
import { describe, expect, test } from "e2e";
import { z } from "zod";
import { API, api, cast, couch, ErrorSchema, ProfileSchema, profile } from "./profile";

const codeOf = (json: unknown) => ErrorSchema.parse(json).error.code;
const Me = z.object({ profile: ProfileSchema });
const SignedIn = Me.extend({ token: z.string() });
const Sent = z.object({
  result: z.array(z.object({ to: z.array(z.string()), subject: z.string(), sentAt: z.string() })),
});

/**
 * Sign-in codes: `wrangler dev` captures what the Cloudflare Email Service binding (SEND_EMAIL)
 * sends and lists it in its Local Explorer. That API exists only in local dev and only answers a
 * localhost Host, so it is read on localhost at the API's port.
 */
const sentEmails = () => {
  const url = new URL("/cdn-cgi/local/explorer/api/local/email/sending?per_page=100", API);
  url.hostname = "localhost";
  return url;
};

/** The 6-digit code in the newest email the local API sent to `to`. */
async function emailedCode(to: string): Promise<string> {
  const res = await fetch(sentEmails());
  const mine = Sent.parse(await res.json()).result.filter((e) => e.to.includes(to));
  const newest = mine.sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
  return /\b(\d{6})\b/.exec(newest?.subject ?? "")?.[1] ?? "";
}

describe("API identity", { tags: ["api"], requires: ["browser"] }, () => {
  test("a launcher token can read the host's library but cannot change it", async () => {
    const host = await profile("Jonathan", "bear");
    const tv = await cast(host);
    const read = await api("/api/v1/me/library", { token: tv.launcherToken });
    expect(read.status).toBe(200);
    const write = await api("/api/v1/me/library", {
      method: "PUT",
      body: { appIds: ["rocket-crew"] },
      token: tv.launcherToken,
    });
    expect(write.status).toBe(403);
    expect(codeOf(write.json)).toBe("profile_token_required");
  });

  test("nobody joins automatically: a profile without the TV code is refused, with it is in", async () => {
    const host = await profile("Jonathan", "bear");
    const mom = await profile("Mom", "owl");
    const tv = await cast(host);
    const res = await api(`/api/v1/sessions/${tv.sessionId}`, { token: mom.token });
    expect(res.status).toBe(403);
    expect(codeOf(res.json)).toBe("not_a_member");
    await tv.join(mom);
    const sock = await couch(mom.token, tv.sessionId);
    const s = await sock.until(() => sock.state(), "state");
    expect(s.members.map((m) => m.name)).toEqual(["Mom"]);
    sock.close();
  });

  test("no token is refused with the error contract", async () => {
    const res = await api("/api/v1/me/instances");
    expect(res.status).toBe(401);
    expect(res.json.error).toMatchObject({ code: "missing_auth", status: 401 });
  });

  test("make profile → back up with email (code from local Email Service capture) → wipe → sign in with email → same @id", async () => {
    const me = await profile("Jonathan", "bear");
    const email = `e2e-${Date.now().toString(36)}@example.com`;
    expect((await api("/api/v1/auth/email/start", { body: { email } })).status).toBe(202);
    const backedUp = await api("/api/v1/auth/email/verify", {
      body: { email, code: await emailedCode(email) },
      token: me.token,
    });
    expect(backedUp.status).toBe(200);
    // A wiped app has no token: it signs in with the email and gets a new device token.
    await api("/api/v1/auth/email/start", { body: { email } });
    const signedIn = await api("/api/v1/auth/email/verify", {
      body: {
        email,
        code: await emailedCode(email),
        device: { deviceId: `e2e-new-${Date.now()}`, kind: "phone", name: "New phone" },
      },
    });
    expect(signedIn.status).toBe(200);
    const back = SignedIn.parse(signedIn.json);
    expect(back.profile.handle).toBe(me.handle);
    const again = await api("/api/v1/me", { token: back.token });
    expect(Me.parse(again.json).profile.id).toBe(me.id);
  });
});
