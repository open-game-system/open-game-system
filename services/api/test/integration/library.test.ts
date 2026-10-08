import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BASE, bearer, createProfile, createSession, ErrorSchema } from "./helpers";

const ALL = [
  "rocket-crew",
  "bake-shop",
  "story-nook",
  "peekaboo-garden",
  "night-flight",
  "trivia-jam",
  "codebreakers",
  "little-vigilante",
  "pocket-draft",
];
const LibrarySchema = z.object({ appIds: z.array(z.string()) });

describe("GET /catalogue", () => {
  it("lists every game as a manifest, no token needed", async () => {
    const res = await SELF.fetch(`${BASE}/catalogue`);
    expect(res.status).toBe(200);
    const body = z
      .array(
        z.object({
          appId: z.string(),
          name: z.string(),
          shape: z.enum(["couch", "live", "async"]),
          tv: z.enum(["none", "optional", "required"]),
          startUrl: z.string().url(),
          roles: z.array(z.object({ id: z.string(), label: z.string(), audience: z.string() })),
          art: z.object({ tile: z.string() }),
          instanceTtlMs: z.number(),
        }),
      )
      .parse(await res.json());
    expect(body.map((m) => m.appId)).toEqual(ALL);
    expect(body[0]).toMatchObject({
      name: "Rocket Crew",
      startUrl: "https://rocket-crew.jonathanrmumm.workers.dev/",
      art: { tile: "/art/rocket-crew/tv.jpg" },
    });
    // Not every game is a couch game that needs the TV: Pocket Draft is played over days on phones.
    expect(body.find((m) => m.appId === "pocket-draft")).toMatchObject({
      shape: "async",
      tv: "optional",
    });
  });
});

describe("/me/library — the games you have", () => {
  it("defaults to every catalogue game", async () => {
    const h = await createProfile();
    const res = await SELF.fetch(`${BASE}/me/library`, {
      headers: bearer(h.token),
    });
    expect(res.status).toBe(200);
    expect(LibrarySchema.parse(await res.json())).toEqual({ appIds: ALL });
  });

  it("keeps what a phone puts, in order, including an empty library", async () => {
    const h = await createProfile();
    const put = (appIds: string[]) =>
      SELF.fetch(`${BASE}/me/library`, {
        method: "PUT",
        headers: bearer(h.token),
        body: JSON.stringify({ appIds }),
      });
    const res = await put(["night-flight", "rocket-crew"]);
    expect(res.status).toBe(200);
    expect(LibrarySchema.parse(await res.json())).toEqual({
      appIds: ["night-flight", "rocket-crew"],
    });

    // The TV launcher of a session this profile hosts shows the host's library.
    const launcher = (await createSession(h)).token;
    const read = await SELF.fetch(`${BASE}/me/library`, {
      headers: bearer(launcher),
    });
    expect(LibrarySchema.parse(await read.json())).toEqual({
      appIds: ["night-flight", "rocket-crew"],
    });

    await put([]);
    const empty = await SELF.fetch(`${BASE}/me/library`, {
      headers: bearer(h.token),
    });
    expect(LibrarySchema.parse(await empty.json())).toEqual({ appIds: [] });
  });

  it("drops duplicate ids", async () => {
    const h = await createProfile();
    const res = await SELF.fetch(`${BASE}/me/library`, {
      method: "PUT",
      headers: bearer(h.token),
      body: JSON.stringify({ appIds: ["bake-shop", "bake-shop", "story-nook"] }),
    });
    expect(LibrarySchema.parse(await res.json())).toEqual({ appIds: ["bake-shop", "story-nook"] });
  });

  it("rejects a game that is not in the catalogue (400 unknown_app)", async () => {
    const h = await createProfile();
    const res = await SELF.fetch(`${BASE}/me/library`, {
      method: "PUT",
      headers: bearer(h.token),
      body: JSON.stringify({ appIds: ["rocket-crew", "word-duel"] }),
    });
    expect(res.status).toBe(400);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("unknown_app");
  });

  it("rejects a malformed body (400 invalid_body)", async () => {
    const h = await createProfile();
    const res = await SELF.fetch(`${BASE}/me/library`, {
      method: "PUT",
      headers: bearer(h.token),
      body: JSON.stringify({ apps: [] }),
    });
    expect(res.status).toBe(400);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("invalid_body");
  });

  it("only the profile's own device changes it (403 profile_token_required for the launcher)", async () => {
    const h = await createProfile();
    const res = await SELF.fetch(`${BASE}/me/library`, {
      method: "PUT",
      headers: bearer((await createSession(h)).token),
      body: JSON.stringify({ appIds: [] }),
    });
    expect(res.status).toBe(403);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("profile_token_required");
  });

  it("rejects requests without a token, and keeps profiles apart", async () => {
    const h = await createProfile();
    const other = await createProfile();
    const anon = await SELF.fetch(`${BASE}/me/library`);
    expect(anon.status).toBe(401);
    await SELF.fetch(`${BASE}/me/library`, {
      method: "PUT",
      headers: bearer(h.token),
      body: JSON.stringify({ appIds: ["bake-shop"] }),
    });
    const theirs = await SELF.fetch(`${BASE}/me/library`, { headers: bearer(other.token) });
    expect(LibrarySchema.parse(await theirs.json()).appIds).toEqual(ALL);
  });
});
