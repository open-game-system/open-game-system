import {
  type CastingFriend,
  CastingFriendSchema,
  type Friend,
  type FriendInvite,
  FriendInviteSchema,
  type FriendOutcome,
  FriendOutcomeSchema,
  type FriendRequests,
  FriendRequestsSchema,
  FriendSchema,
} from "@open-game-system/ogs-protocol";
import { createApiRequest, OgsApiError, type OgsApiOptions } from "./ogs-api";

/** Any schema with zod's safeParse (the protocol's schemas are zod 3; this app's zod is 4). */
interface Parser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

function parsed<T>(schema: Parser<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new OgsApiError("BAD_RESPONSE", String(r.error), 0);
  return r.data;
}

const FriendsSchema = FriendSchema.array();
const CastsSchema = CastingFriendSchema.array();

/** The friends API (slice 2): every answer parsed with the ogs-protocol schemas, here at the edge. */
export function createFriendsApi(opts: OgsApiOptions) {
  const { request } = createApiRequest(opts);
  const authed = { authed: true } as const;
  const post = (path: string, body?: unknown) =>
    request(path, { method: "POST", body, authed: true });
  const id = encodeURIComponent;
  return {
    async friends(): Promise<Friend[]> {
      return parsed(FriendsSchema, await request("/api/v1/friends", authed));
    },
    async requests(): Promise<FriendRequests> {
      return parsed(FriendRequestsSchema, await request("/api/v1/friends/requests", authed));
    },
    /** Friends whose TV is live: the Join cards. */
    async casting(): Promise<CastingFriend[]> {
      return parsed(CastsSchema, await request("/api/v1/friends/casting", authed));
    },
    async createInvite(): Promise<FriendInvite> {
      return parsed(FriendInviteSchema, await post("/api/v1/friends/invites"));
    },
    /** A typed code, or the token from a link or a scanned QR. */
    async redeem(by: { code: string } | { token: string }): Promise<FriendOutcome> {
      return parsed(FriendOutcomeSchema, await post("/api/v1/friends/invites/redeem", by));
    },
    async addByHandle(handle: string): Promise<FriendOutcome> {
      return parsed(FriendOutcomeSchema, await post("/api/v1/friends/requests", { handle }));
    },
    async accept(requestId: string): Promise<FriendOutcome> {
      return parsed(
        FriendOutcomeSchema,
        await post(`/api/v1/friends/requests/${id(requestId)}/accept`),
      );
    },
    async decline(requestId: string): Promise<void> {
      await post(`/api/v1/friends/requests/${id(requestId)}/decline`);
    },
    async remove(profileId: string): Promise<void> {
      await request(`/api/v1/friends/${id(profileId)}`, { method: "DELETE", authed: true });
    },
  };
}

export type FriendsApi = ReturnType<typeof createFriendsApi>;
