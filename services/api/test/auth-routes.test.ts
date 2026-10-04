import type { Claims } from "@open-game-system/ogs-protocol";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { hashCode } from "../src/lib/email-code";
import { issueToken, readClaims } from "../src/lib/identity";
import { openTestD1, type TestD1 } from "./support/d1";
import { type FakeIssuer, fakeIssuer } from "./support/issuer";

const SECRET = "auth-routes-secret";
const APPLE = "https://apple.test";
const GOOGLE = "https://accounts.google.com";
const RESEND = "https://resend.test";
const DEVICE = { deviceId: "new-ipad", kind: "tablet", name: "Juneau's iPad" };

let d1: TestD1;
let apple: FakeIssuer;
let google: FakeIssuer;
let resendStatus = 200;
let sent: { url: string; auth: string | null; body: unknown }[] = [];

beforeAll(async () => {
  d1 = await openTestD1();
  apple = await fakeIssuer(APPLE);
  google = await fakeIssuer(GOOGLE);
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('mom', 'mom', 'Mom', 'sun')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('dad', 'dad', 'Dad', 'moon')",
    ),
  ]);
  resendStatus = 200;
  sent = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const issued = apple.handles(url) ?? google.handles(url);
    if (issued) return issued;
    if (url.startsWith(RESEND)) {
      sent.push({
        url,
        auth: new Headers(init?.headers).get("Authorization"),
        body: JSON.parse(String(init?.body)),
      });
      return new Response("{}", { status: resendStatus });
    }
    return new Response("not found", { status: 404 });
  });
});
afterEach(() => vi.unstubAllGlobals());

const baseEnv = () => ({
  DB: d1.db,
  OGS_JWT_SECRET: SECRET,
  APPLE_ISSUER: APPLE,
  APPLE_CLIENT_IDS: "org.opengame.app, other.app",
  GOOGLE_CLIENT_IDS: "g-client",
  RESEND_BASE_URL: `${RESEND}/`,
  RESEND_API_KEY: "re_key",
});

const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });
const phoneOf = (sub: string) => tokenFor({ sub, did: `${sub}-phone`, kind: "phone" });

async function post(
  path: string,
  body: unknown,
  opts: { token?: string; env?: Record<string, unknown> } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await app.request(
    `/api/v1/auth${path}`,
    { method: "POST", headers, body: JSON.stringify(body) },
    opts.env ?? baseEnv(),
  );
  return { status: res.status, json: z.record(z.string(), z.unknown()).parse(await res.json()) };
}
const codeOf = (r: { json: Record<string, unknown> }) =>
  z.object({ error: z.object({ code: z.string() }) }).parse(r.json).error.code;

const appleToken = (sub: string, extra: Record<string, unknown> = {}) =>
  apple.idToken({
    sub,
    aud: "org.opengame.app",
    email: `${sub}@icloud.com`,
    email_verified: "true",
    ...extra,
  });

async function loginsOf(profileId: string) {
  const { results } = await d1.db
    .prepare(
      "SELECT provider, subject, email FROM profile_logins WHERE profile_id = ? ORDER BY rowid",
    )
    .bind(profileId)
    .all();
  return results;
}

describe("POST /auth/apple and /auth/google", () => {
  it("backs a profile up with an Apple login (link), once", async () => {
    const token = await phoneOf("mom");
    const first = await post("/apple", { idToken: await appleToken("apple-mom") }, { token });
    expect(first.status).toBe(200);
    expect(first.json).toEqual({
      profile: { id: "mom", handle: "mom", name: "Mom", sticker: "sun" },
      logins: [{ provider: "apple", email: "apple-mom@icloud.com" }],
    });
    const again = await post("/apple", { idToken: await appleToken("apple-mom") }, { token });
    expect(again.status).toBe(200);
    expect(await loginsOf("mom")).toEqual([
      { provider: "apple", subject: "apple-mom", email: "apple-mom@icloud.com" },
    ]);
  });

  it("signs a new device in to the backed-up profile with a year-long device token", async () => {
    await post(
      "/apple",
      { idToken: await appleToken("apple-mom") },
      { token: await phoneOf("mom") },
    );
    const r = await post("/apple", { idToken: await appleToken("apple-mom"), device: DEVICE });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ profile: { id: "mom" }, logins: [{ provider: "apple" }] });
    const claims = await readClaims(z.string().parse(r.json.token), SECRET, Date.now());
    expect(claims).toMatchObject({ sub: "mom", did: "new-ipad", kind: "tablet" });
    const device = await d1.db
      .prepare("SELECT profile_id, kind, name FROM profile_devices WHERE device_id = 'new-ipad'")
      .first();
    expect(device).toEqual({ profile_id: "mom", kind: "tablet", name: "Juneau's iPad" });
  });

  it("accepts Google's bare issuer alias and its default issuer", async () => {
    const idToken = await google.idToken({
      iss: "accounts.google.com",
      sub: "g-dad",
      aud: "g-client",
    });
    const r = await post("/google", { idToken }, { token: await phoneOf("dad") });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ logins: [{ provider: "google", email: null }] });
  });

  it("uses a configured Google issuer without the alias", async () => {
    const env = { ...baseEnv(), GOOGLE_ISSUER: APPLE, GOOGLE_CLIENT_IDS: "g-client" };
    const aliased = await apple.idToken({ iss: "accounts.google.com", sub: "g", aud: "g-client" });
    expect(
      (await post("/google", { idToken: aliased }, { token: await phoneOf("dad"), env })).status,
    ).toBe(401);
    const direct = await apple.idToken({ sub: "g", aud: "g-client" });
    expect(
      (await post("/google", { idToken: direct }, { token: await phoneOf("dad"), env })).status,
    ).toBe(200);
  });

  it("uses the real Apple issuer when none is configured", async () => {
    const env = { ...baseEnv(), APPLE_ISSUER: undefined, APPLE_CLIENT_IDS: undefined };
    const r = await post("/apple", { idToken: await appleToken("x"), device: DEVICE }, { env });
    expect(r.status).toBe(401);
  });

  it("refuses a login that already backs up another profile", async () => {
    await post(
      "/apple",
      { idToken: await appleToken("apple-mom") },
      { token: await phoneOf("mom") },
    );
    const r = await post(
      "/apple",
      { idToken: await appleToken("apple-mom") },
      { token: await phoneOf("dad") },
    );
    expect(r.status).toBe(409);
    expect(codeOf(r)).toBe("login_in_use");
  });

  it("answers profile_not_found when backing up a profile that no longer exists", async () => {
    const r = await post(
      "/apple",
      { idToken: await appleToken("ghost") },
      { token: await phoneOf("ghost") },
    );
    expect(r.status).toBe(404);
    expect(codeOf(r)).toBe("profile_not_found");
  });

  it.each<[string, () => Promise<{ body: unknown; token?: string }>, number, string]>([
    ["no idToken", async () => ({ body: {} }), 400, "invalid_body"],
    [
      "no device and no token",
      async () => ({ body: { idToken: await appleToken("a") } }),
      400,
      "invalid_body",
    ],
    [
      "an invalid ID token",
      async () => ({ body: { idToken: "x.y.z", device: DEVICE } }),
      401,
      "invalid_id_token",
    ],
    [
      "a login nobody backed up",
      async () => ({ body: { idToken: await appleToken("a"), device: DEVICE } }),
      404,
      "login_not_found",
    ],
    [
      "a launcher token",
      async () => ({
        body: { idToken: await appleToken("a") },
        token: await tokenFor({ sub: "mom", did: "tv", kind: "launcher", sid: "s1" }),
      }),
      403,
      "profile_token_required",
    ],
    [
      "a bad token",
      async () => ({ body: { idToken: await appleToken("a") }, token: "nope" }),
      401,
      "invalid_token",
    ],
  ])("refuses %s", async (_label, make, status, code) => {
    const { body, token } = await make();
    const r = await post("/apple", body, { token });
    expect(r.status).toBe(status);
    expect(codeOf(r)).toBe(code);
  });
});

describe("POST /auth/email/start", () => {
  it("stores a hashed code and emails it through Resend", async () => {
    const r = await post("/email/start", { email: " Mom@Example.com " });
    expect(r).toEqual({ status: 202, json: { sent: true } });
    expect(sent).toHaveLength(1);
    const mail = z
      .object({ from: z.string(), to: z.array(z.string()), text: z.string() })
      .parse(sent[0].body);
    expect(sent[0].url).toBe(`${RESEND}/emails`);
    expect(sent[0].auth).toBe("Bearer re_key");
    expect(mail.from).toBe("OGS <hello@opengame.org>");
    expect(mail.to).toEqual(["mom@example.com"]);
    const code = /\b(\d{6})\b/.exec(mail.text)?.[1] ?? "";
    const row = await d1.db
      .prepare("SELECT code_hash, attempts FROM email_codes WHERE email = 'mom@example.com'")
      .first();
    expect(row).toEqual({ code_hash: await hashCode("mom@example.com", code), attempts: 0 });
  });

  it("uses the configured sender and Resend's real base URL by default", async () => {
    const env = { ...baseEnv(), RESEND_BASE_URL: undefined, EMAIL_FROM: "Test <t@example.com>" };
    await post("/email/start", { email: "a@example.com" }, { env });
    expect(sent).toEqual([]); // went to api.resend.com, which the stub doesn't answer as Resend
  });

  it.each([
    ["an invalid email", { email: "nope" }, {}, 400, "invalid_body"],
    [
      "no Resend key",
      { email: "a@example.com" },
      { RESEND_API_KEY: undefined },
      503,
      "email_unavailable",
    ],
  ])("refuses %s", async (_label, body, envOver, status, code) => {
    const r = await post("/email/start", body, { env: { ...baseEnv(), ...envOver } });
    expect(r.status).toBe(status);
    expect(codeOf(r)).toBe(code);
  });

  it("answers email_failed when Resend refuses", async () => {
    resendStatus = 500;
    const r = await post("/email/start", { email: "a@example.com" });
    expect(r.status).toBe(502);
    expect(codeOf(r)).toBe("email_failed");
  });
});

describe("POST /auth/email/verify", () => {
  async function storeCode(
    email: string,
    code: string,
    over: { expiresAt?: number; attempts?: number } = {},
  ) {
    await d1.db
      .prepare(
        "INSERT INTO email_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, ?)",
      )
      .bind(
        email,
        await hashCode(email, code),
        over.expiresAt ?? Date.now() + 60_000,
        over.attempts ?? 0,
      )
      .run();
  }
  const codeRow = (email: string) =>
    d1.db.prepare("SELECT attempts FROM email_codes WHERE email = ?").bind(email).first();

  it("backs up with the right code, then signs a device in with the next one", async () => {
    await storeCode("mom@example.com", "123456");
    const linked = await post(
      "/email/verify",
      { email: "MOM@example.com", code: "123456" },
      { token: await phoneOf("mom") },
    );
    expect(linked.status).toBe(200);
    expect(linked.json).toMatchObject({
      logins: [{ provider: "email", email: "mom@example.com" }],
    });
    expect(await codeRow("mom@example.com")).toBeNull();

    await storeCode("mom@example.com", "654321");
    const signedIn = await post("/email/verify", {
      email: "mom@example.com",
      code: "654321",
      device: DEVICE,
    });
    expect(signedIn.status).toBe(200);
    expect(signedIn.json).toMatchObject({ profile: { id: "mom" }, token: expect.any(String) });
  });

  it("counts a wrong code as an attempt and keeps the code", async () => {
    await storeCode("mom@example.com", "123456");
    const r = await post("/email/verify", {
      email: "mom@example.com",
      code: "000000",
      device: DEVICE,
    });
    expect(r.status).toBe(401);
    expect(codeOf(r)).toBe("invalid_code");
    expect(await codeRow("mom@example.com")).toEqual({ attempts: 1 });
  });

  it.each([
    ["expired", { expiresAt: Date.now() - 1 }],
    ["burned", { attempts: 5 }],
  ])("refuses and deletes an %s code even when it is right", async (_label, over) => {
    await storeCode("mom@example.com", "123456", over);
    const r = await post("/email/verify", {
      email: "mom@example.com",
      code: "123456",
      device: DEVICE,
    });
    expect(r.status).toBe(401);
    expect(codeOf(r)).toBe("invalid_code");
    expect(await codeRow("mom@example.com")).toBeNull();
  });

  it.each([
    [
      "a malformed code",
      { email: "a@example.com", code: "12ab56", device: DEVICE },
      400,
      "invalid_body",
    ],
    ["no device and no token", { email: "a@example.com", code: "123456" }, 400, "invalid_body"],
    [
      "an email with no code sent",
      { email: "a@example.com", code: "123456", device: DEVICE },
      401,
      "invalid_code",
    ],
  ])("refuses %s", async (_label, body, status, code) => {
    const r = await post("/email/verify", body);
    expect(r.status).toBe(status);
    expect(codeOf(r)).toBe(code);
  });
});
