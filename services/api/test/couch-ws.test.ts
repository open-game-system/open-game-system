import type { Claims } from "@open-game-system/ogs-protocol";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PEER_HEADER } from "../src/couch-session";
import app from "../src/index";
import { issueToken } from "../src/lib/identity";
import { openTestD1, type TestD1 } from "./support/d1";

const SECRET = "couch-ws-secret";
let d1: TestD1;

beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('host', 'mom', 'Mom', 'sun')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('kid', 'juneau', 'Juneau', 'rocket')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('other', 'x', 'X', 'moon')",
    ),
    d1.db.prepare(
      "INSERT INTO couch_sessions (id, host_profile_id, code, tv_name, created_at) VALUES ('s1', 'host', 'KITE42', 'Living room', 0)",
    ),
    d1.db.prepare(
      "INSERT INTO session_members (session_id, profile_id, joined_at) VALUES ('s1', 'kid', 0)",
    ),
  ]);
});

/** COUCH_SESSION namespace that records which object was asked and the request it got. */
function couchNamespace() {
  const calls: { name: string; peer: unknown; upgrade: string | null }[] = [];
  return {
    calls,
    idFromName: (name: string) => ({ name }),
    get: (id: { name: string }) => ({
      fetch: async (req: Request) => {
        calls.push({
          name: id.name,
          peer: JSON.parse(req.headers.get(PEER_HEADER) ?? "null"),
          upgrade: req.headers.get("Upgrade"),
        });
        return new Response("upgraded", { status: 200 });
      },
    }),
  };
}

const token = (claims: Omit<Claims, "exp">, ttlSeconds = 60) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds });
const phone = (sub: string) => token({ sub, did: `${sub}-phone`, kind: "phone" });

async function connect(query: Record<string, string>, upgrade: string | null = "websocket") {
  const ns = couchNamespace();
  const headers: Record<string, string> = upgrade ? { Upgrade: upgrade } : {};
  const res = await app.request(
    `/api/v1/couch/ws?${new URLSearchParams(query)}`,
    { headers },
    { DB: d1.db, OGS_JWT_SECRET: SECRET, COUCH_SESSION: ns },
  );
  const body = res.status === 200 ? null : await res.json();
  return { status: res.status, body, calls: ns.calls };
}

/** Profiles whose phone or tablet has been marked seen. */
async function seen() {
  const { results } = await d1.db.prepare("SELECT profile_id FROM profile_seen").all();
  return results.map((r) => r.profile_id);
}

describe("GET /api/v1/couch/ws", () => {
  it("hands the host's phone to the session's object with its profile as the peer", async () => {
    const r = await connect({ token: await phone("host"), session: "s1" }, "WebSocket");
    expect(r.status).toBe(200);
    expect(r.calls).toEqual([
      {
        name: "s1",
        upgrade: "WebSocket",
        peer: {
          sessionId: "s1",
          hostProfileId: "host",
          deviceId: "host-phone",
          kind: "phone",
          profile: { profileId: "host", name: "Mom", sticker: "sun" },
        },
      },
    ]);
  });

  it("lets a member in", async () => {
    const r = await connect({ token: await phone("kid"), session: "s1" });
    expect(r.status).toBe(200);
    expect(r.calls[0].peer).toMatchObject({ deviceId: "kid-phone", profile: { profileId: "kid" } });
    expect(await seen()).toEqual(["kid"]);
  });

  it("lets a launcher into its own session (named by its token) with no profile", async () => {
    const launcher = await token({ sub: "host", did: "tv-1", kind: "launcher", sid: "s1" });
    const r = await connect({ token: launcher });
    expect(r.status).toBe(200);
    expect(r.calls[0].peer).toEqual({
      sessionId: "s1",
      hostProfileId: "host",
      deviceId: "tv-1",
      kind: "launcher",
    });
    expect(await seen()).toEqual([]);
  });

  it.each([
    ["no token", async () => ({ session: "s1" }), 401, "missing_auth"],
    ["a bad token", async () => ({ token: "nope", session: "s1" }), 401, "invalid_token"],
    [
      "an expired token",
      async () => ({
        token: await token({ sub: "host", did: "d", kind: "phone" }, -1),
        session: "s1",
      }),
      401,
      "invalid_token",
    ],
    [
      "a phone token and no session",
      async () => ({ token: await phone("host") }),
      400,
      "missing_session",
    ],
    [
      "an unknown session",
      async () => ({ token: await phone("host"), session: "nope" }),
      404,
      "session_not_found",
    ],
    [
      "a profile that never joined",
      async () => ({ token: await phone("other"), session: "s1" }),
      403,
      "not_a_member",
    ],
    [
      "another session's launcher",
      async () => ({
        token: await token({ sub: "host", did: "tv", kind: "launcher", sid: "s9" }),
        session: "s1",
      }),
      403,
      "not_a_member",
    ],
  ])("refuses %s", async (_label, query, status, code) => {
    const r = await connect(await query());
    expect(r.status).toBe(status);
    expect(r.body).toMatchObject({ error: { code, status } });
    expect(r.calls).toEqual([]);
  });

  it.each([null, "h2c"])("asks for a WebSocket upgrade when Upgrade is %s", async (upgrade) => {
    const r = await connect({ token: await phone("host"), session: "s1" }, upgrade);
    expect(r.status).toBe(426);
    expect(r.body).toMatchObject({ error: { code: "upgrade_required" } });
  });
});
