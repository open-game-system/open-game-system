import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMULATED, TEST_CLIENTS } from "./emulators";
import {
  BASE,
  bearer,
  type CreatedProfile,
  claimsOf,
  createProfile,
  device,
  ErrorSchema,
  json,
  MeSchema,
  SignedInSchema,
  unique,
} from "./helpers";

const errorOf = async (res: Response) => ErrorSchema.parse(await res.json()).error.code;

type Provider = "apple" | "google";
const FLOW = {
  apple: { callback: "/auth/authorize/callback", token: "/auth/token" },
  google: { callback: "/o/oauth2/v2/auth/callback", token: "/oauth2/token" },
};

/** Signs a seeded user in at the emulator (user picker + code exchange) and returns the ID token. */
async function idToken(provider: Provider, email: string, clientId = TEST_CLIENTS[provider]) {
  const base = EMULATED[provider];
  const redirect = "https://opengame.org/auth/callback";
  const picked = await fetch(`${base}${FLOW[provider].callback}`, {
    method: "POST",
    redirect: "manual",
    body: new URLSearchParams({
      email,
      redirect_uri: redirect,
      client_id: clientId,
      scope: "openid email",
    }),
  });
  const code = new URL(picked.headers.get("location") ?? "").searchParams.get("code") ?? "";
  const res = await fetch(`${base}${FLOW[provider].token}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirect,
    }),
  });
  return z.object({ id_token: z.string() }).parse(await res.json()).id_token;
}

const OutboxSchema = z.array(
  z.object({
    from: z.object({ email: z.string(), name: z.string() }),
    to: z.array(z.string()),
    subject: z.string(),
    text: z.string(),
    html: z.string(),
  }),
);

/** The newest message SEND_EMAIL (Cloudflare Email Service binding) was given for `to`. */
async function lastEmail(to: string) {
  const mine = OutboxSchema.parse(await env.EMAIL_OUTBOX.sent()).filter((e) => e.to.includes(to));
  return mine.at(-1);
}
async function emailedCode(to: string) {
  const text = (await lastEmail(to))?.text ?? "";
  return /\b(\d{6})\b/.exec(text)?.[1] ?? "";
}

const post = (path: string, body: unknown, token?: string) =>
  SELF.fetch(`${BASE}${path}`, {
    method: "POST",
    headers: token ? bearer(token) : json,
    body: JSON.stringify(body),
  });

/** A unique address per call; seeded emulator users aren't needed for email. */
const address = () => `${unique("e")}@example.com`.toLowerCase();

describe.each([
  ["apple", "jonathan@example.com", "mom@example.com", "juneau@example.com"],
  ["google", "nana@example.com", "max@example.com", "kim@example.com"],
] as const)("Sign in with %s (emulated OIDC)", (provider, first, second, third) => {
  it("backs up the profile: the login is linked and /me lists it", async () => {
    const p = await createProfile();
    const res = await post(
      `/auth/${provider}`,
      { idToken: await idToken(provider, first) },
      p.token,
    );
    expect(res.status).toBe(200);
    const me = MeSchema.parse(await res.json());
    expect(me).toEqual({ profile: p.profile, logins: [{ provider, email: first }] });
    const again = await post(
      `/auth/${provider}`,
      { idToken: await idToken(provider, first) },
      p.token,
    );
    expect(again.status).toBe(200);
    expect(MeSchema.parse(await again.json()).logins).toHaveLength(1);
  });

  it("signs in on a new device: same profile, a new device token", async () => {
    const p = await createProfile({ name: "Mom", sticker: "owl" });
    await post(`/auth/${provider}`, { idToken: await idToken(provider, second) }, p.token);
    const newPhone = device("phone", "Mom's new phone");
    const res = await post(`/auth/${provider}`, {
      idToken: await idToken(provider, second),
      device: newPhone,
    });
    expect(res.status).toBe(200);
    const signedIn = SignedInSchema.parse(await res.json());
    expect(signedIn.profile).toEqual(p.profile);
    expect(claimsOf(signedIn.token)).toMatchObject({
      sub: p.profile.id,
      did: newPhone.deviceId,
      kind: "phone",
    });
    const me = await SELF.fetch(`${BASE}/me`, { headers: bearer(signedIn.token) });
    expect(MeSchema.parse(await me.json()).profile.handle).toBe(p.profile.handle);
  });

  it("a login belongs to one profile (409 login_in_use)", async () => {
    const [a, b] = [await createProfile(), await createProfile({ name: "B" })];
    await post(`/auth/${provider}`, { idToken: await idToken(provider, third) }, a.token);
    const res = await post(
      `/auth/${provider}`,
      { idToken: await idToken(provider, third) },
      b.token,
    );
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe("login_in_use");
  });

  it("signing in with a login no profile has is 404 login_not_found", async () => {
    const res = await post(`/auth/${provider}`, {
      idToken: await idToken(provider, "lee@example.com"),
      device: device(),
    });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe("login_not_found");
  });

  it("signing in needs the device to issue a token for (400 invalid_body)", async () => {
    const res = await post(`/auth/${provider}`, { idToken: await idToken(provider, first) });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("invalid_body");
  });

  it("refuses an ID token for another app, a tampered one, or junk (401 invalid_id_token)", async () => {
    const p = await createProfile();
    const good = await idToken(provider, "sam@example.com");
    const [h, payload, sig] = good.split(".");
    const tampered = `${h}.${payload.slice(0, -2)}${payload.endsWith("A") ? "B" : "A"}x.${sig}`;
    for (const token of [
      await idToken(provider, "sam@example.com", "someone-elses-app"),
      tampered,
      "not-a-jwt",
    ]) {
      const res = await post(`/auth/${provider}`, { idToken: token }, p.token);
      expect(res.status).toBe(401);
      expect(await errorOf(res)).toBe("invalid_id_token");
    }
  });

  it("refuses an ID token from the other provider (401 invalid_id_token)", async () => {
    const p = await createProfile();
    const other = provider === "apple" ? "google" : "apple";
    const res = await post(
      `/auth/${provider}`,
      { idToken: await idToken(other, "sam@example.com", TEST_CLIENTS[provider]) },
      p.token,
    );
    expect(res.status).toBe(401);
  });
});

describe("Sign in with email (Cloudflare Email Service binding)", () => {
  async function backUp(p: CreatedProfile, email: string) {
    expect((await post("/auth/email/start", { email })).status).toBe(202);
    return post("/auth/email/verify", { email, code: await emailedCode(email) }, p.token);
  }

  it("emails a 6-digit code and a sign-in link", async () => {
    const email = address();
    const res = await post("/auth/email/start", { email: `  ${email.toUpperCase()} ` });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ sent: true });
    const mail = await lastEmail(email);
    expect(mail?.from).toEqual({ email: "sign-in@opengame.org", name: "OGS" });
    expect(mail?.subject).toMatch(/OGS/);
    expect(mail?.text).toMatch(/\b\d{6}\b/);
    expect(mail?.html).toContain(await emailedCode(email));
    expect(mail?.text).toContain("https://opengame.org/signin?code=");
  });

  it("backs up the profile with the code", async () => {
    const p = await createProfile();
    const email = address();
    const res = await backUp(p, email);
    expect(res.status).toBe(200);
    expect(MeSchema.parse(await res.json()).logins).toEqual([{ provider: "email", email }]);
  });

  it("make profile → back up → wipe → sign in with email → same @id", async () => {
    const p = await createProfile({ name: "Jonathan", sticker: "bear" });
    const email = address();
    await backUp(p, email);
    await post("/auth/email/start", { email });
    const res = await post("/auth/email/verify", {
      email,
      code: await emailedCode(email),
      device: device("phone", "New phone"),
    });
    expect(res.status).toBe(200);
    const signedIn = SignedInSchema.parse(await res.json());
    expect(signedIn.profile.handle).toBe(p.profile.handle);
    expect(signedIn.logins).toEqual([{ provider: "email", email }]);
    expect(claimsOf(signedIn.token).sub).toBe(p.profile.id);
  });

  it("a code works once", async () => {
    const p = await createProfile();
    const email = address();
    await post("/auth/email/start", { email });
    const code = await emailedCode(email);
    expect((await post("/auth/email/verify", { email, code }, p.token)).status).toBe(200);
    const again = await post("/auth/email/verify", { email, code }, p.token);
    expect(again.status).toBe(401);
    expect(await errorOf(again)).toBe("invalid_code");
  });

  it("a wrong code is refused, and five wrong codes burn the code", async () => {
    const p = await createProfile();
    const email = address();
    await post("/auth/email/start", { email });
    const code = await emailedCode(email);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      const res = await post("/auth/email/verify", { email, code: wrong }, p.token);
      expect(res.status).toBe(401);
      expect(await errorOf(res)).toBe("invalid_code");
    }
    expect((await post("/auth/email/verify", { email, code }, p.token)).status).toBe(401);
  });

  it("a new start replaces the old code", async () => {
    const p = await createProfile();
    const email = address();
    await post("/auth/email/start", { email });
    const first = await emailedCode(email);
    await post("/auth/email/start", { email });
    const second = await emailedCode(email);
    if (first !== second)
      expect((await post("/auth/email/verify", { email, code: first }, p.token)).status).toBe(401);
    expect((await post("/auth/email/verify", { email, code: second }, p.token)).status).toBe(200);
  });

  it("an email no profile backed up with is 404 login_not_found", async () => {
    const email = address();
    await post("/auth/email/start", { email });
    const res = await post("/auth/email/verify", {
      email,
      code: await emailedCode(email),
      device: device(),
    });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe("login_not_found");
  });

  it.each([
    ["no email", "/auth/email/start", {}],
    ["a bad email", "/auth/email/start", { email: "not an email" }],
    ["a verify without a code", "/auth/email/verify", { email: "a@example.com" }],
    ["a 5-digit code", "/auth/email/verify", { email: "a@example.com", code: "12345" }],
  ])("rejects %s (400 invalid_body)", async (_name, path, body) => {
    const res = await post(path, body);
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("invalid_body");
  });
});
