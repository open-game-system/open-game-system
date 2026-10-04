import { type Claims, GameTokenSchema } from "@open-game-system/ogs-protocol";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { issueToken } from "../src/lib/identity";
import { openTestD1, type TestD1 } from "./support/d1";
import { generateSigningKey } from "./support/signing-key";

/** Game tokens (slice 3): JWKS, POST /games/:appId/token, POST /sessions/:sid/game-token. */
const SECRET = "game-routes-secret";
let d1: TestD1;
let signingKey: string;

beforeAll(async () => {
  d1 = await openTestD1();
  signingKey = await generateSigningKey("k-unit");
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('jon', 'jonathan.m', 'Jonathan', 'bear')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('juneau', 'juneau', 'Juneau', 'dragon')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('max', 'max.k', 'Max', 'owl')",
    ),
    d1.db
      .prepare(
        "INSERT INTO couch_sessions (id, host_profile_id, code, tv_name, created_at) VALUES ('s1', 'jon', 'AAAAAA', 'Living room', ?)",
      )
      .bind(Date.now()),
    d1.db
      .prepare(
        "INSERT INTO session_members (session_id, profile_id, joined_at) VALUES ('s1', 'juneau', ?)",
      )
      .bind(Date.now()),
  ]);
});

const env = (over: Record<string, unknown> = {}) => ({
  DB: d1.db,
  OGS_JWT_SECRET: SECRET,
  OGS_GAME_SIGNING_KEY: signingKey,
  AVATAR_BASE_URL: "https://tv.test",
  ...over,
});
const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });
const phone = (sub: string) => tokenFor({ sub, did: `${sub}-phone`, kind: "phone" });
const launcher = (sid = "s1") => tokenFor({ sub: "jon", did: "launcher-1", kind: "launcher", sid });
const Body = z.record(z.string(), z.unknown());
const claimsOf = (token: unknown) =>
  JSON.parse(atob(z.string().parse(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

async function call(path: string, token: string | null, body?: unknown, over = {}) {
  const res = await app.request(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(over),
  );
  return { status: res.status, body: Body.parse(await res.json()) };
}
const errorCode = (r: { body: Record<string, unknown> }) =>
  z.object({ error: z.object({ code: z.string() }) }).parse(r.body).error.code;

describe("GET /.well-known/jwks.json", () => {
  it("publishes the public signing key", async () => {
    const res = await app.request("/.well-known/jwks.json", {}, env());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    const body = z
      .object({ keys: z.array(z.record(z.string(), z.unknown())) })
      .parse(await res.json());
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]).toMatchObject({ kty: "EC", crv: "P-256", kid: "k-unit", alg: "ES256" });
    expect(body.keys[0].d).toBeUndefined();
  });

  it("answers 503 when no signing key is configured", async () => {
    const res = await app.request("/.well-known/jwks.json", {}, env({ OGS_GAME_SIGNING_KEY: "" }));
    expect(res.status).toBe(503);
  });
});

describe("POST /games/:appId/token — a phone's token for one game", () => {
  it("gives the game the profile id, @id, name, avatar and a 1 h token for it", async () => {
    const r = await call("/api/v1/games/rocket-crew/token", await phone("juneau"));
    expect(r.status).toBe(200);
    const avatar = "https://tv.test/art/story-nook/char-dragon.webp";
    expect(r.body.profile).toEqual({ id: "juneau", handle: "juneau", name: "Juneau", avatar });
    const claims = GameTokenSchema.parse(claimsOf(r.body.token));
    expect(claims.aud).toBe("rocket-crew");
    expect(claims.iss).toBe("http://localhost");
    expect(claims.exp - claims.iat).toBe(3600);
    expect(r.body.expiresAt).toBe(claims.exp * 1000);
  });

  it("the token carries exactly the allowed claims (no friends, age, device ids)", async () => {
    await d1.db
      .prepare(
        "INSERT INTO friendships (profile_a, profile_b, created_at) VALUES ('jon', 'juneau', ?)",
      )
      .bind(Date.now())
      .run();
    const r = await call("/api/v1/games/rocket-crew/token", await phone("juneau"));
    expect(Object.keys(claimsOf(r.body.token)).sort()).toEqual(
      ["aud", "avatar", "exp", "handle", "iat", "iss", "name", "sub"].sort(),
    );
    expect(JSON.stringify(r.body)).not.toContain("juneau-phone");
    expect(JSON.stringify(r.body)).not.toContain("jon");
  });

  it("an unknown game gets no token (404 game_not_found)", async () => {
    const r = await call("/api/v1/games/not-a-game/token", await phone("juneau"));
    expect(r.status).toBe(404);
    expect(errorCode(r)).toBe("game_not_found");
  });

  it("a TV launcher token can't get a phone game token (403)", async () => {
    const r = await call("/api/v1/games/rocket-crew/token", await launcher());
    expect(r.status).toBe(403);
    expect(errorCode(r)).toBe("profile_token_required");
  });

  it("needs a profile token (401)", async () => {
    const r = await call("/api/v1/games/rocket-crew/token", null);
    expect(r.status).toBe(401);
  });

  it("503 game_tokens_unavailable without a signing key", async () => {
    const r = await call("/api/v1/games/rocket-crew/token", await phone("juneau"), undefined, {
      OGS_GAME_SIGNING_KEY: undefined,
    });
    expect(r.status).toBe(503);
    expect(errorCode(r)).toBe("game_tokens_unavailable");
  });
});

describe("POST /sessions/:sid/game-token — the TV page's token", () => {
  it("names the session and everyone on the couch (host first)", async () => {
    const r = await call("/api/v1/sessions/s1/game-token", await launcher(), {
      appId: "story-nook",
    });
    expect(r.status).toBe(200);
    const players = [
      {
        id: "jon",
        handle: "jonathan.m",
        name: "Jonathan",
        avatar: "https://tv.test/art/story-nook/char-bear.webp",
      },
      {
        id: "juneau",
        handle: "juneau",
        name: "Juneau",
        avatar: "https://tv.test/art/story-nook/char-dragon.webp",
      },
    ];
    expect(r.body.players).toEqual(players);
    const claims = GameTokenSchema.parse(claimsOf(r.body.token));
    expect(claims).toMatchObject({ aud: "story-nook", sub: "jon", sid: "s1", players });
    expect(r.body.expiresAt).toBe(claims.exp * 1000);
  });

  it("the host's phone may ask too", async () => {
    const r = await call("/api/v1/sessions/s1/game-token", await phone("jon"), {
      appId: "story-nook",
    });
    expect(r.status).toBe(200);
  });

  it("another session's launcher is refused (403 not_a_member)", async () => {
    const r = await call("/api/v1/sessions/s1/game-token", await launcher("s2"), {
      appId: "story-nook",
    });
    expect(r.status).toBe(403);
    expect(errorCode(r)).toBe("not_a_member");
  });

  it("a stranger is refused (403 not_a_member)", async () => {
    const r = await call("/api/v1/sessions/s1/game-token", await phone("max"), {
      appId: "story-nook",
    });
    expect(r.status).toBe(403);
  });

  it("unknown game 404, unknown session 404, no appId 400", async () => {
    const tok = await launcher();
    expect(errorCode(await call("/api/v1/sessions/s1/game-token", tok, { appId: "nope" }))).toBe(
      "game_not_found",
    );
    const unknown = await call("/api/v1/sessions/zz/game-token", await phone("jon"), {
      appId: "story-nook",
    });
    expect(unknown.status).toBe(404);
    expect(errorCode(unknown)).toBe("session_not_found");
    expect((await call("/api/v1/sessions/s1/game-token", tok, {})).status).toBe(400);
  });

  it("503 without a signing key", async () => {
    const r = await call(
      "/api/v1/sessions/s1/game-token",
      await launcher(),
      { appId: "story-nook" },
      {
        OGS_GAME_SIGNING_KEY: "nope",
      },
    );
    expect(r.status).toBe(503);
  });
});
