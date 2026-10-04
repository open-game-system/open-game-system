import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { signJwt } from "../../src/lib/jwt";
import {
  BASE,
  bearer,
  CreatedHouseholdSchema,
  claimsOf,
  createHousehold,
  ErrorSchema,
  launcherToken,
  PersonSchema,
  pairDevice,
  TokenResponseSchema,
} from "./helpers";

const HouseholdSchema = z.object({
  id: z.string(),
  name: z.string(),
  people: z.array(PersonSchema),
  devices: z.array(
    z.object({
      deviceId: z.string(),
      kind: z.enum(["phone", "tablet", "launcher"]),
      personId: z.string().nullable(),
      name: z.string(),
    }),
  ),
});

async function errorCode(res: Response): Promise<string> {
  const body = ErrorSchema.parse(await res.json());
  expect(body.error.status).toBe(res.status);
  return body.error.code;
}

describe("POST /households", () => {
  it("creates the household, its people and a phone token for the creating device", async () => {
    const res = await SELF.fetch(`${BASE}/households`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "The Mumms",
        people: [
          { name: "Jonathan", band: "grownup", sticker: "rocket" },
          { name: "Juneau", band: "kid", sticker: "dino" },
        ],
        device: {
          deviceId: "phone-create-1",
          kind: "phone",
          name: "Jonathan's phone",
          personIndex: 0,
        },
      }),
    });
    expect(res.status).toBe(201);
    const body = CreatedHouseholdSchema.parse(await res.json());
    expect(body.people.map((p) => [p.name, p.band, p.sticker])).toEqual([
      ["Jonathan", "grownup", "rocket"],
      ["Juneau", "kid", "dino"],
    ]);
    expect(new Set(body.people.map((p) => p.id)).size).toBe(2);
    const claims = claimsOf(body.token);
    expect(claims).toMatchObject({
      hid: body.householdId,
      did: "phone-create-1",
      pid: body.people[0].id,
      kind: "phone",
    });
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000 + 300 * 24 * 3600);
  });

  it("omits pid when the device is not someone's", async () => {
    const res = await SELF.fetch(`${BASE}/households`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "No person",
        people: [{ name: "A", band: "grownup", sticker: "sun" }],
        device: { deviceId: "phone-create-2", kind: "phone", name: "Shared phone" },
      }),
    });
    expect(res.status).toBe(201);
    const { token } = CreatedHouseholdSchema.parse(await res.json());
    expect(claimsOf(token).pid).toBeUndefined();
  });

  it.each([
    ["not JSON", "nope"],
    [
      "no people",
      JSON.stringify({
        name: "X",
        people: [],
        device: { deviceId: "d", kind: "phone", name: "p" },
      }),
    ],
    [
      "a bad band",
      JSON.stringify({
        name: "X",
        people: [{ name: "A", band: "teen", sticker: "s" }],
        device: { deviceId: "d", kind: "phone", name: "p" },
      }),
    ],
    [
      "a tablet as the creating device",
      JSON.stringify({
        name: "X",
        people: [{ name: "A", band: "grownup", sticker: "s" }],
        device: { deviceId: "d", kind: "tablet", name: "p" },
      }),
    ],
  ])("rejects %s with 400 invalid_body", async (_label, body) => {
    const res = await SELF.fetch(`${BASE}/households`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_body");
  });

  it("rejects a personIndex that names nobody", async () => {
    const res = await SELF.fetch(`${BASE}/households`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "X",
        people: [{ name: "A", band: "grownup", sticker: "s" }],
        device: { deviceId: "d-x", kind: "phone", name: "p", personIndex: 3 },
      }),
    });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("unknown_person");
  });
});

describe("GET /households/:hid", () => {
  it("returns the household, people and devices to a token of that household", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}`, {
      headers: bearer(h.token),
    });
    expect(res.status).toBe(200);
    const body = HouseholdSchema.parse(await res.json());
    expect(body.id).toBe(h.householdId);
    expect(body.name).toBe("The Mumms");
    expect(body.people).toEqual(h.people);
    expect(body.devices).toEqual([
      {
        deviceId: claimsOf(h.token).did,
        kind: "phone",
        personId: h.people[0].id,
        name: "Jonathan's phone",
      },
    ]);
  });

  it("rejects a request without a token (401 missing_auth)", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}`);
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("missing_auth");
  });

  it("rejects a non-Bearer header (401 invalid_auth)", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}`, {
      headers: { Authorization: `Basic ${h.token}` },
    });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("invalid_auth");
  });

  it("rejects a token with a bad signature (401 invalid_token)", async () => {
    const h = await createHousehold();
    const forged = await signJwt({ ...claimsOf(h.token) }, "not-the-secret");
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}`, {
      headers: bearer(forged),
    });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("invalid_token");
  });

  it("rejects an expired token (401 invalid_token)", async () => {
    const h = await createHousehold();
    const expired = await signJwt(
      { ...claimsOf(h.token), exp: Math.floor(Date.now() / 1000) - 1 },
      "test-jwt-secret",
    );
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}`, {
      headers: bearer(expired),
    });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("invalid_token");
  });

  it("rejects a token of another household (403 forbidden_household)", async () => {
    const mine = await createHousehold();
    const theirs = await createHousehold("The Neighbours");
    const res = await SELF.fetch(`${BASE}/households/${mine.householdId}`, {
      headers: bearer(theirs.token),
    });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("forbidden_household");
  });

  it("answers 404 for a household that no longer exists even with a valid token", async () => {
    const forged = await signJwt(
      { hid: "ghost", did: "d", kind: "phone", exp: Math.floor(Date.now() / 1000) + 60 },
      "test-jwt-secret",
    );
    const res = await SELF.fetch(`${BASE}/households/ghost`, { headers: bearer(forged) });
    expect(res.status).toBe(404);
    expect(await errorCode(res)).toBe("household_not_found");
  });
});

describe("POST /households/:hid/devices (pairing)", () => {
  it("pairs a kid's iPad to the kid and lists it", async () => {
    const h = await createHousehold();
    const juneau = h.people[1];
    const token = await pairDevice(h, {
      kind: "tablet",
      personId: juneau.id,
      name: "Juneau's iPad",
    });
    const claims = claimsOf(token);
    expect(claims).toMatchObject({ hid: h.householdId, kind: "tablet", pid: juneau.id });

    const res = await SELF.fetch(`${BASE}/households/${h.householdId}`, { headers: bearer(token) });
    const body = HouseholdSchema.parse(await res.json());
    expect(body.devices).toContainEqual({
      deviceId: claims.did,
      kind: "tablet",
      personId: juneau.id,
      name: "Juneau's iPad",
    });
  });

  it("pairs another grown-up's phone without a person", async () => {
    const h = await createHousehold();
    const token = await pairDevice(h, { kind: "phone", name: "Mom's phone" });
    expect(claimsOf(token)).toMatchObject({ hid: h.householdId, kind: "phone" });
    expect(claimsOf(token).pid).toBeUndefined();
  });

  it("only a phone may pair (a tablet token gets 403 phone_required)", async () => {
    const h = await createHousehold();
    const tablet = await pairDevice(h, { kind: "tablet", personId: h.people[1].id, name: "iPad" });
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/devices`, {
      method: "POST",
      headers: bearer(tablet),
      body: JSON.stringify({ deviceId: "x", kind: "tablet", name: "another" }),
    });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("phone_required");
  });

  it("rejects a person from another household (400 unknown_person)", async () => {
    const h = await createHousehold();
    const other = await createHousehold("Other");
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/devices`, {
      method: "POST",
      headers: bearer(h.token),
      body: JSON.stringify({
        deviceId: "ipad-x",
        kind: "tablet",
        personId: other.people[1].id,
        name: "iPad",
      }),
    });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("unknown_person");
  });

  it("rejects a launcher kind (400 invalid_body)", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/devices`, {
      method: "POST",
      headers: bearer(h.token),
      body: JSON.stringify({ deviceId: "tv", kind: "launcher", name: "TV" }),
    });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("invalid_body");
  });

  it("rejects pairing into another household (403)", async () => {
    const h = await createHousehold();
    const other = await createHousehold("Other");
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/devices`, {
      method: "POST",
      headers: bearer(other.token),
      body: JSON.stringify({ deviceId: "sneaky", kind: "phone", name: "p" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /households/:hid/launcher-token", () => {
  it("issues a 12 h launcher token with a launcher-<random> device id", async () => {
    const h = await createHousehold();
    const before = Math.floor(Date.now() / 1000);
    const token = await launcherToken(h);
    const claims = claimsOf(token);
    expect(claims.kind).toBe("launcher");
    expect(claims.hid).toBe(h.householdId);
    expect(claims.did).toMatch(/^launcher-[a-z0-9-]{8,}$/);
    expect(claims.pid).toBeUndefined();
    expect(claims.exp - before).toBeGreaterThanOrEqual(12 * 3600 - 5);
    expect(claims.exp - before).toBeLessThanOrEqual(12 * 3600 + 5);
    const again = claimsOf(await launcherToken(h));
    expect(again.did).not.toBe(claims.did);
  });

  it("refuses a tablet (403 phone_required)", async () => {
    const h = await createHousehold();
    const tablet = await pairDevice(h, { kind: "tablet", personId: h.people[1].id, name: "iPad" });
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/launcher-token`, {
      method: "POST",
      headers: bearer(tablet),
    });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe("phone_required");
  });

  it("refuses a launcher token minting another (403 phone_required)", async () => {
    const h = await createHousehold();
    const launcher = await launcherToken(h);
    const res = await SELF.fetch(`${BASE}/households/${h.householdId}/launcher-token`, {
      method: "POST",
      headers: bearer(launcher),
    });
    expect(res.status).toBe(403);
    expect(TokenResponseSchema.safeParse(await res.json()).success).toBe(false);
  });
});
