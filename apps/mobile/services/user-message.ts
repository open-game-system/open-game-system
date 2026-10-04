import { OgsApiError } from "./ogs-api";

/**
 * What people read when something fails: one short line and at most one action. Status codes and
 * internal codes are logged, never shown.
 */

export type ErrorContext =
  | "cast"
  | "join"
  | "profile"
  | "edit"
  | "sign-in"
  | "back-up"
  | "load"
  | "friends";
export type ErrorAction = "retry" | "sign-in" | "update" | "make-profile" | "use-suggestion" | null;
export interface UserMessage {
  text: string;
  action: ErrorAction;
}

const OFFLINE: UserMessage = {
  text: "Can't reach OGS. Check your Wi-Fi and try again.",
  action: "retry",
};
const SIGNED_OUT: UserMessage = {
  text: "You've been signed out. Sign in again.",
  action: "sign-in",
};
const OUT_OF_DATE: UserMessage = {
  text: "This version of OGS is out of date. Update the app.",
  action: "update",
};
const TROUBLE: UserMessage = {
  text: "OGS is having trouble. Try again in a minute.",
  action: "retry",
};
const UNKNOWN: UserMessage = { text: "Something went wrong. Try again.", action: "retry" };

const BY_CODE: Record<string, UserMessage> = {
  OFFLINE,
  invalid_token: SIGNED_OUT,
  invalid_auth: SIGNED_OUT,
  missing_auth: SIGNED_OUT,
  profile_not_found: SIGNED_OUT,
  NO_PROFILE: SIGNED_OUT,
  BAD_RESPONSE: OUT_OF_DATE,
  handle_taken: { text: "That id is taken.", action: "use-suggestion" },
  invalid_code: { text: "That code didn't work. Check it or send a new one.", action: null },
  login_not_found: { text: "No OGS profile has that login yet.", action: "make-profile" },
  login_in_use: { text: "That account already backs up another profile.", action: null },
  session_not_found: { text: "No TV has that code.", action: null },
  invalid_id_token: { text: "That sign-in didn't go through. Try again.", action: "retry" },
  // Friends (slice 2)
  invite_not_found: {
    text: "That code didn't match anyone. Check it and try again.",
    action: null,
  },
  invite_used: { text: "That invite was already used. Ask for a new one.", action: null },
  invite_expired: { text: "That invite expired. Ask for a new one.", action: null },
  cannot_friend_self: { text: "That's you.", action: null },
  handle_not_found: { text: "Nobody has that @id.", action: null },
  already_friends: { text: "You're already friends.", action: null },
  request_not_found: { text: "That request is gone.", action: null },
  friend_not_found: { text: "You're not friends anymore.", action: null },
  not_a_friend: {
    text: "Only their friends can join from here. Use the code on the TV.",
    action: null,
  },
};

const isNetwork = (err: unknown) => err instanceof TypeError && /network|fetch/i.test(err.message);

export function userMessage(err: unknown, context: ErrorContext): UserMessage {
  if (!(err instanceof OgsApiError)) {
    console.warn(`[ogs] ${context} failed: ${String(err)}`);
    return isNetwork(err) ? OFFLINE : UNKNOWN;
  }
  console.warn(`[ogs] ${context} failed: ${err.code} (${err.status}) ${err.message}`);
  const known = BY_CODE[err.code];
  if (known) return known;
  if (err.status === 404) return OUT_OF_DATE;
  if (err.status >= 500) return TROUBLE;
  return UNKNOWN;
}
