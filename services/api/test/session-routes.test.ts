import type { Claims } from "@open-game-system/ogs-protocol";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { issueToken, readClaims } from "../src/lib/identity";
import { SESSION_TTL_MS } from "../src/lib/sessions";
import { openTestD1, type TestD1 } from "./support/d1";

/** POST /sessions, POST /sessions/join and GET /sessions/:sid against a real local D1. */
const SECRET = "session-routes-secret";
let d1: TestD1;

beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('mom', 'mom', 'Mom', 'sun')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('kid', 'kid', 'Kid', 'rocket')",
    ),
    d1.db
      .prepare(
        "INSERT INTO couch_sessions (id, host_profile_id, code, tv_name, created_at) VALUES ('s1', 'mom', 'AAAAAA', 'Living room', ?)",
      )
      .bind(Date.now()),
    d1.db
      .prepare(
        "INSERT INTO couch_sessions (id, host_profile_id, code, tv_name, created_at) VALUES ('old', 'mom', 'OLDOLD', 'Den', ?)",
      )
      .bind(Date.now() - SESSION_TTL_MS - 1),
  ]);
});
afterEach(() => vi.restoreAllMocks());

const env = () => ({ DB: d1.db, OGS_JWT_SECRET: SECRET });
const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });
const phone = (sub: string) => tokenFor({ sub, did: `${sub}-phone`, kind: "phone" });
const Body = z.record(z.string(), z.unknown());
const MOM = { id: "mom", handle: "mom", name: "Mom", sticker: "sun" };

async function call(method: string, path: string, token: string, body?: unknown) {
  const res = await app.request(
    `/api/v1/sessions${path}`,
    {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );
  return { status: res.status, body: Body.parse(await res.json()) };
}
const errorCode = (r: { body: Record<string, unknown> }) =>
  z.object({ error: z.object({ code: z.string() }) }).parse(r.body).error.code;

/** Makes newCode() spell each given 6-letter code in turn (index into its alphabet = byte). */
function nextCodes(...codes: string[]) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const queue = [...codes];
  const drawn = { count: 0 };
  const real = crypto.getRandomValues.bind(crypto);
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
    if (array instanceof Uint8Array && array.length === 6 && queue.length > 0) {
      drawn.count++;
      const code = queue.length > 1 ? queue.shift() : queue[0];
      array.set([...(code ?? "")].map((ch) => alphabet.indexOf(ch)));
      return array;
    }
    return real(array);
  });
  return drawn;
}

describe("POST /sessions", () => {
  it("starts a session with a TV code and a 12 h launcher token for it", async () => {
    nextCodes("KXTE42");
    const r = await call("POST", "", await phone("mom"), { tvName: " Kitchen " });
    expect(r.status).toBe(201);
    const body = z
      .object({
        sessionId: z.string(),
        code: z.string(),
        tvName: z.string(),
        host: z.unknown(),
        token: z.string(),
      })
      .parse(r.body);
    expect(body).toMatchObject({ code: "KXTE42", tvName: "Kitchen", host: MOM });
    const claims = await readClaims(body.token, SECRET, Date.now());
    expect(claims).toMatchObject({ sub: "mom", kind: "launcher", sid: body.sessionId });
    expect(claims?.did).toMatch(/^launcher-/);
    const exp = claims?.exp ?? 0;
    expect(exp * 1000 - Date.now()).toBeGreaterThan(SESSION_TTL_MS - 5_000);
  });

  it("draws another code when one is in use", async () => {
    nextCodes("AAAAAA", "BBBBBB");
    const r = await call("POST", "", await phone("mom"), { tvName: "Kitchen" });
    expect(r.body).toMatchObject({ code: "BBBBBB" });
  });

  it("gives up after five codes in use", async () => {
    const drawn = nextCodes("AAAAAA");
    const r = await app.request(
      "/api/v1/sessions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await phone("mom")}` },
        body: JSON.stringify({ tvName: "K" }),
      },
      env(),
    );
    expect(r.status).toBe(500);
    expect(drawn.count).toBe(5);
    const { results } = await d1.db.prepare("SELECT id FROM couch_sessions ORDER BY id").all();
    expect(results).toEqual([{ id: "old" }, { id: "s1" }]);
  });

  it.each([
    ["no TV name", () => phone("mom"), {}, 400, "invalid_body"],
    [
      "a launcher token",
      () => tokenFor({ sub: "mom", did: "tv", kind: "launcher", sid: "s1" }),
      { tvName: "K" },
      403,
      "profile_token_required",
    ],
  ])("refuses %s", async (_label, token, body, status, code) => {
    const r = await call("POST", "", await token(), body);
    expect(r.status).toBe(status);
    expect(errorCode(r)).toBe(code);
  });
});

describe("POST /sessions/join", () => {
  it("joins with the TV code as typed, once", async () => {
    const view = { sessionId: "s1", code: "AAAAAA", tvName: "Living room", host: MOM };
    expect(await call("POST", "/join", await phone("kid"), { code: "aaa-aaa " })).toEqual({
      status: 200,
      body: view,
    });
    expect((await call("POST", "/join", await phone("kid"), { code: "AAAAAA" })).body).toEqual(
      view,
    );
    const { results } = await d1.db.prepare("SELECT profile_id FROM session_members").all();
    expect(results).toEqual([{ profile_id: "kid" }]);
  });

  it.each([
    ["an unknown code", { code: "ZZZZZZ" }, 404, "session_not_found"],
    ["an expired session's code", { code: "OLDOLD" }, 404, "session_not_found"],
    ["a short code", { code: "ABC" }, 400, "invalid_body"],
  ])("refuses %s", async (_label, body, status, code) => {
    const r = await call("POST", "/join", await phone("kid"), body);
    expect(r.status).toBe(status);
    expect(errorCode(r)).toBe(code);
  });
});

describe("GET /sessions/:sid", () => {
  const view = { sessionId: "s1", code: "AAAAAA", tvName: "Living room", host: MOM };

  it("shows the session to its host, its launcher and its members", async () => {
    expect(await call("GET", "/s1", await phone("mom"))).toEqual({ status: 200, body: view });
    const launcher = await tokenFor({ sub: "mom", did: "tv", kind: "launcher", sid: "s1" });
    expect((await call("GET", "/s1", launcher)).body).toEqual(view);
    await call("POST", "/join", await phone("kid"), { code: "AAAAAA" });
    expect((await call("GET", "/s1", await phone("kid"))).body).toEqual(view);
  });

  it.each([
    ["an unknown session", "/nope", "kid", 404, "session_not_found"],
    ["a profile that never joined", "/s1", "kid", 403, "not_a_member"],
  ])("refuses %s", async (_label, path, who, status, code) => {
    const r = await call("GET", path, await phone(who));
    expect(r.status).toBe(status);
    expect(errorCode(r)).toBe(code);
  });
});
