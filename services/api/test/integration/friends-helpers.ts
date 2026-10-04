import { SELF } from "cloudflare:test";
import {
  FriendInviteSchema,
  FriendOutcomeSchema,
  FriendRequestsSchema,
  FriendSchema,
} from "@open-game-system/ogs-protocol";
import { BASE, bearer, type CreatedProfile, createProfile, ErrorSchema } from "./helpers";

export const errorOf = async (res: Response) => ErrorSchema.parse(await res.json()).error.code;

const post = (who: CreatedProfile, path: string, body?: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: "POST",
    headers: bearer(who.token),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const get = (who: CreatedProfile, path: string) =>
  SELF.fetch(`${BASE}${path}`, { headers: bearer(who.token) });

export const api = {
  post,
  get,
  del: (who: CreatedProfile, path: string) =>
    SELF.fetch(`${BASE}${path}`, { method: "DELETE", headers: bearer(who.token) }),
};

/** POST /friends/invites, parsed. */
export async function invite(who: CreatedProfile) {
  const res = await post(who, "/friends/invites");
  if (res.status !== 201) throw new Error(`invite: ${res.status} ${await res.text()}`);
  return FriendInviteSchema.parse(await res.json());
}

export const redeem = (who: CreatedProfile, body: unknown) =>
  post(who, "/friends/invites/redeem", body);

export const outcome = async (res: Response) => FriendOutcomeSchema.parse(await res.json());

/** The token at the end of an invite's link or QR url. */
export const tokenOf = (url: string) => url.slice(url.lastIndexOf("/") + 1);

export async function friendsOf(who: CreatedProfile) {
  const res = await get(who, "/friends");
  if (res.status !== 200) throw new Error(`friends: ${res.status} ${await res.text()}`);
  return FriendSchema.array().parse(await res.json());
}

export async function requestsOf(who: CreatedProfile) {
  const res = await get(who, "/friends/requests");
  if (res.status !== 200) throw new Error(`requests: ${res.status} ${await res.text()}`);
  return FriendRequestsSchema.parse(await res.json());
}

/** Makes `a` and `b` friends the in-person way: b scans a's QR. */
export async function befriend(a: CreatedProfile, b: CreatedProfile) {
  const inv = await invite(a);
  const res = await redeem(b, { token: tokenOf(inv.qr) });
  if (res.status !== 200) throw new Error(`befriend: ${res.status} ${await res.text()}`);
}

export const person = (name: string, kind: "phone" | "tablet" = "phone") =>
  createProfile({ name, sticker: name === "Mom" ? "owl" : "bear", kind });
