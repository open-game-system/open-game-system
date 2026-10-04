import { SELF } from "cloudflare:test";
import { type Claims, ClaimsSchema } from "@open-game-system/ogs-protocol";
import { z } from "zod";

export const BASE = "https://api.test/api/v1";

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  band: z.enum(["grownup", "kid", "little"]),
  sticker: z.string(),
});

export const CreatedHouseholdSchema = z.object({
  householdId: z.string(),
  people: z.array(PersonSchema),
  token: z.string(),
});
export type CreatedHousehold = z.infer<typeof CreatedHouseholdSchema>;

export const TokenResponseSchema = z.object({ token: z.string() });

export const ErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), status: z.number() }),
});

/** Reads a JWT's claims without verifying (the server verifies; tests inspect). */
export function claimsOf(token: string): Claims {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return ClaimsSchema.parse(JSON.parse(atob(payload)));
}

export const bearer = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

let seq = 0;
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`;

/** The Mumms: Jonathan (grown-up, on this phone), Juneau (kid), Ava (little). */
export async function createHousehold(name = "The Mumms"): Promise<CreatedHousehold> {
  const res = await SELF.fetch(`${BASE}/households`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      people: [
        { name: "Jonathan", band: "grownup", sticker: "rocket" },
        { name: "Juneau", band: "kid", sticker: "dino" },
        { name: "Ava", band: "little", sticker: "star" },
      ],
      device: {
        deviceId: unique("phone"),
        kind: "phone",
        name: "Jonathan's phone",
        personIndex: 0,
      },
    }),
  });
  if (res.status !== 201) throw new Error(`createHousehold: ${res.status} ${await res.text()}`);
  return CreatedHouseholdSchema.parse(await res.json());
}

/** Pairs another device to the household using a phone token. */
export async function pairDevice(
  household: CreatedHousehold,
  device: { kind: "phone" | "tablet"; personId?: string; name: string },
): Promise<string> {
  const res = await SELF.fetch(`${BASE}/households/${household.householdId}/devices`, {
    method: "POST",
    headers: bearer(household.token),
    body: JSON.stringify({ deviceId: unique(device.kind), ...device }),
  });
  if (res.status !== 201) throw new Error(`pairDevice: ${res.status} ${await res.text()}`);
  return TokenResponseSchema.parse(await res.json()).token;
}

export async function launcherToken(household: CreatedHousehold): Promise<string> {
  const res = await SELF.fetch(`${BASE}/households/${household.householdId}/launcher-token`, {
    method: "POST",
    headers: bearer(household.token),
  });
  if (res.status !== 201) throw new Error(`launcherToken: ${res.status} ${await res.text()}`);
  return TokenResponseSchema.parse(await res.json()).token;
}
