import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BASE, bearer, createHousehold, ErrorSchema, launcherToken, pairDevice } from "./helpers";

const ALL = ["rocket-crew", "bake-shop", "story-nook", "peekaboo-garden", "night-flight"];
const LibrarySchema = z.object({ appIds: z.array(z.string()) });

describe("GET /catalogue", () => {
  it("lists the five games as manifests, no token needed", async () => {
    const res = await SELF.fetch(`${BASE}/catalogue`);
    expect(res.status).toBe(200);
    const body = z
      .array(
        z.object({
          appId: z.string(),
          name: z.string(),
          shape: z.literal("couch"),
          tv: z.literal("required"),
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
  });
});

describe("/households/:hid/library", () => {
  it("defaults to every catalogue game", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
      headers: bearer(h.token),
    });
    expect(res.status).toBe(200);
    expect(LibrarySchema.parse(await res.json())).toEqual({ appIds: ALL });
  });

  it("keeps what a phone puts, in order, including an empty library", async () => {
    const h = await createHousehold();
    const put = (appIds: string[]) =>
      SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
        method: "PUT",
        headers: bearer(h.token),
        body: JSON.stringify({ appIds }),
      });
    const res = await put(["night-flight", "rocket-crew"]);
    expect(res.status).toBe(200);
    expect(LibrarySchema.parse(await res.json())).toEqual({
      appIds: ["night-flight", "rocket-crew"],
    });

    const tablet = await pairDevice(h, { kind: "tablet", personId: h.people[1].id, name: "iPad" });
    const read = await SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
      headers: bearer(tablet),
    });
    expect(LibrarySchema.parse(await read.json())).toEqual({
      appIds: ["night-flight", "rocket-crew"],
    });

    await put([]);
    const empty = await SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
      headers: bearer(h.token),
    });
    expect(LibrarySchema.parse(await empty.json())).toEqual({ appIds: [] });
  });

  it("drops duplicate ids", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
      method: "PUT",
      headers: bearer(h.token),
      body: JSON.stringify({ appIds: ["bake-shop", "bake-shop", "story-nook"] }),
    });
    expect(LibrarySchema.parse(await res.json())).toEqual({ appIds: ["bake-shop", "story-nook"] });
  });

  it("rejects a game that is not in the catalogue (400 unknown_app)", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
      method: "PUT",
      headers: bearer(h.token),
      body: JSON.stringify({ appIds: ["rocket-crew", "word-duel"] }),
    });
    expect(res.status).toBe(400);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("unknown_app");
  });

  it("rejects a malformed body (400 invalid_body)", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
      method: "PUT",
      headers: bearer(h.token),
      body: JSON.stringify({ apps: [] }),
    });
    expect(res.status).toBe(400);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("invalid_body");
  });

  it("only a phone changes the library (403 phone_required for the launcher)", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
      method: "PUT",
      headers: bearer(await launcherToken(h)),
      body: JSON.stringify({ appIds: [] }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects requests without a token or from another household", async () => {
    const h = await createHousehold();
    const other = await createHousehold("Other");
    const anon = await SELF.fetch(`${BASE}/households/${h.householdId}/library`);
    expect(anon.status).toBe(401);
    const foreign = await SELF.fetch(`${BASE}/households/${h.householdId}/library`, {
      headers: bearer(other.token),
    });
    expect(foreign.status).toBe(403);
  });
});
