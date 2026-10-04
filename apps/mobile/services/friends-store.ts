import {
  type CastingFriend,
  type Friend,
  type FriendInvite,
  type FriendOutcome,
  type FriendRequest,
  inviteTokenFromUrl,
  isInviteCode,
  normaliseInviteCode,
} from "@open-game-system/ogs-protocol";
import type { Done, Failure } from "./app-state";
import type { FriendsApi } from "./friends-api";
import { type UserMessage, userMessage } from "./user-message";

/**
 * Friends (slice 2): the list with presence, requests in and out, and friends' live casts (the
 * Join cards on Playing). One small external store; the API and the app's session join are
 * injected. Nothing pushes yet, so screens refresh on focus and poll.
 */

export interface FriendsData {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  casting: CastingFriend[];
  status: "idle" | "loading" | "ready" | "error";
  error: UserMessage | null;
}

/** What an add did: friends now, or a request waits for them (with their name). */
export type Added = { ok: true; outcome: FriendOutcome["status"]; name: string };
export type JoinResult = Done | Failure<"session_not_found" | "not_a_friend">;

type Api = Pick<
  FriendsApi,
  | "friends"
  | "requests"
  | "casting"
  | "createInvite"
  | "redeem"
  | "addByHandle"
  | "accept"
  | "decline"
  | "remove"
>;

const EMPTY: FriendsData = {
  friends: [],
  incoming: [],
  outgoing: [],
  casting: [],
  status: "idle",
  error: null,
};

function refused<R extends string>(err: unknown): Failure<R> {
  const { text, action } = userMessage(err, "friends");
  return { ok: false, reason: "error", message: text, action };
}

const nameIn = (o: FriendOutcome) => (o.status === "friends" ? o.friend.name : o.request.to.name);

export function createFriendsStore(deps: {
  api: Api;
  /** The app's join (app-state): the device goes on that session's couch. */
  joinFriendSession: (sessionId: string) => Promise<JoinResult>;
}) {
  const { api } = deps;
  let data = EMPTY;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<FriendsData>) => {
    data = { ...data, ...patch };
    for (const l of listeners) l();
  };

  async function refresh() {
    set({ status: "loading" });
    try {
      const [friends, requests, casting] = await Promise.all([
        api.friends(),
        api.requests(),
        api.casting(),
      ]);
      set({ friends, ...requests, casting, status: "ready", error: null });
    } catch (err) {
      set({ status: "error", error: userMessage(err, "friends") });
    }
  }

  /** Runs an API call, then refreshes; a refusal comes back in words. */
  async function act(call: () => Promise<unknown>): Promise<Done | Failure<never>> {
    try {
      await call();
    } catch (err) {
      return refused(err);
    }
    await refresh();
    return { ok: true };
  }

  async function add(call: () => Promise<FriendOutcome>): Promise<Added | Failure<never>> {
    let outcome: FriendOutcome;
    try {
      outcome = await call();
    } catch (err) {
      return refused(err);
    }
    await refresh();
    return { ok: true, outcome: outcome.status, name: nameIn(outcome) };
  }

  /** Only the Join cards (Playing polls this); a failure keeps the last ones quietly. */
  async function refreshCasting() {
    try {
      set({ casting: await api.casting() });
    } catch (err) {
      console.warn(`[ogs] friends' casts failed: ${String(err)}`);
    }
  }

  return {
    getSnapshot: () => data,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    refreshCasting,
    /** Add a friend: a fresh invite (code, link, QR) for this screen. */
    async newInvite(): Promise<{ ok: true; invite: FriendInvite } | Failure<never>> {
      try {
        return { ok: true, invite: await api.createInvite() };
      } catch (err) {
        return refused(err);
      }
    },
    /** Their code, typed ("kite-42"). */
    async addByCode(typed: string): Promise<Added | Failure<"not_a_code">> {
      if (!isInviteCode(typed))
        return {
          ok: false,
          reason: "not_a_code",
          message: "Codes look like KITE-42.",
          action: null,
        };
      return add(() => api.redeem({ code: normaliseInviteCode(typed) }));
    },
    /** An invite link opened, or their QR scanned. */
    async addByLink(url: string): Promise<Added | Failure<"not_an_invite">> {
      const token = inviteTokenFromUrl(url);
      if (!token)
        return {
          ok: false,
          reason: "not_an_invite",
          message: "That isn't an OGS invite.",
          action: null,
        };
      return add(() => api.redeem({ token }));
    },
    /** Find by @id. */
    async addByHandle(typed: string): Promise<Added | Failure<"empty">> {
      if (typed.trim().replace(/^@/, "").trim() === "")
        return { ok: false, reason: "empty", message: "Type their @id.", action: null };
      return add(() => api.addByHandle(typed.trim()));
    },
    accept: (requestId: string) => act(() => api.accept(requestId)),
    decline: (requestId: string) => act(() => api.decline(requestId)),
    remove: (profileId: string) => act(() => api.remove(profileId)),
    /** Join a friend's cast from its card. */
    async joinCast(sessionId: string): Promise<JoinResult> {
      const result = await deps.joinFriendSession(sessionId);
      if (result.ok) await refreshCasting();
      return result;
    },
  };
}

export type FriendsStore = ReturnType<typeof createFriendsStore>;
