// Identity and session rules at the API boundary (no screen, no model).
// Acceptance: docs/acceptance/2026-10-04-ogs-profiles.feature.
import { describe, expect, test } from "e2e";
import { z } from "zod";
import { api, cast, couch, ErrorSchema, profile, ProfileSchema } from "./profile";

const codeOf = (json: unknown) => ErrorSchema.parse(json).error.code;
const Me = z.object({ profile: ProfileSchema });
const SignedIn = Me.extend({ token: z.string() });
const Emails = z.object({ data: z.array(z.object({ to: z.array(z.string()), text: z.string() })) });

const RESEND = process.env.OGS_RESEND ?? "http://localhost:4108";

/** The newest 6-digit code the emulated Resend inbox holds for `to`. */
async function emailedCode(to: string): Promise<string> {
  const res = await fetch(`${RESEND}/emails`, { headers: { authorization: "Bearer e2e" } });
  const { data } = Emails.parse(await res.json());
  const mine = data.filter((e) => e.to.includes(to));
  return /\b(\d{6})\b/.exec(mine.at(-1)?.text ?? "")?.[1] ?? "";
}

describe("API identity", { tags: ["api"], requires: ["browser"] }, () => {
  test("a launcher token can read the host's library but cannot change it", async () => {
    const host = await profile("Jonathan", "bear");
    const tv = await cast(host);
    const read = await api("/api/v1/me/library", { token: tv.launcherToken });
    expect(read.status).toBe(200);
    const write = await api("/api/v1/me/library", { method: "PUT", body: { appIds: ["rocket-crew"] }, token: tv.launcherToken });
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

  test("make profile → back up with email (emulated inbox) → wipe → sign in with email → same @id", async () => {
    const me = await profile("Jonathan", "bear");
    const email = `e2e-${Date.now().toString(36)}@example.com`;
    expect((await api("/api/v1/auth/email/start", { body: { email } })).status).toBe(202);
    const backedUp = await api("/api/v1/auth/email/verify", { body: { email, code: await emailedCode(email) }, token: me.token });
    expect(backedUp.status).toBe(200);
    // A wiped app has no token: it signs in with the email and gets a new device token.
    await api("/api/v1/auth/email/start", { body: { email } });
    const signedIn = await api("/api/v1/auth/email/verify", {
      body: { email, code: await emailedCode(email), device: { deviceId: `e2e-new-${Date.now()}`, kind: "phone", name: "New phone" } },
    });
    expect(signedIn.status).toBe(200);
    const back = SignedIn.parse(signedIn.json);
    expect(back.profile.handle).toBe(me.handle);
    const again = await api("/api/v1/me", { token: back.token });
    expect(Me.parse(again.json).profile.id).toBe(me.id);
  });
});

