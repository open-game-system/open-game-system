import { z } from "zod";
import type { InstanceReport } from "./instance";
import type { SessionState } from "./session";

/**
 * iOS Live Activities for the controller phone (docs/acceptance/2026-10-21-live-activities.feature):
 * while a phone is the controller for a game on the TV, the lock screen and the Dynamic Island show
 * the game, a short status and the room code, and a tap goes back to the controller. The shapes are
 * shared by the app (local start / update / end) and the API (remote `liveactivity` pushes), and they
 * mirror the widget's Swift `OgsGameActivityAttributes` (packages/shell/ios).
 */

/** The longest status line the lock screen shows (one line on the smallest phone). */
export const LIVE_ACTIVITY_STATUS_MAX = 48;

export const LiveActivityPhaseSchema = z.enum(["lobby", "waiting", "playing", "ended"]);
export type LiveActivityPhase = z.infer<typeof LiveActivityPhaseSchema>;

/** What changes while the activity runs (ActivityKit's ContentState). */
export const LiveActivityContentSchema = z.object({
  phase: LiveActivityPhaseSchema,
  status: z.string().max(LIVE_ACTIVITY_STATUS_MAX),
  yourTurn: z.boolean(),
  /** ms since epoch, so a late remote update never undoes a newer local one. */
  updatedAt: z.number(),
});
export type LiveActivityContent = z.infer<typeof LiveActivityContentSchema>;

const AppIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

/** What is fixed for the activity's life (ActivityKit's attributes). */
export const LiveActivityAttributesSchema = z.object({
  appId: AppIdSchema,
  gameName: z.string().min(1).max(40),
  /** The code people type to join (the TV code), when there is one. */
  roomCode: z.string().min(1).max(16).optional(),
  /** Where a tap goes: liveActivityDeepLink(scheme, appId). */
  deepLink: z.string().min(1),
  /** The key art's file name in the app group container (written by the app), never a path. */
  art: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}\.(png|jpg)$/)
    .optional(),
});
export type LiveActivityAttributes = z.infer<typeof LiveActivityAttributesSchema>;

/**
 * A phone's push token for one running activity: POST /api/v1/sessions/:sid/live-activities. `app`
 * is "ogs" for the OGS app, else the white-label app's appId (its own APNs key sends).
 */
export const LiveActivityRegistrationSchema = z.object({
  activityId: z.string().min(1).max(128),
  pushToken: z.string().regex(/^[0-9a-f]{16,512}$/i),
  app: z.union([z.literal("ogs"), AppIdSchema]),
  environment: z.enum(["sandbox", "production"]),
});
export type LiveActivityRegistration = z.infer<typeof LiveActivityRegistrationSchema>;

export type LiveActivityStatus = Pick<LiveActivityContent, "phase" | "status" | "yourTurn">;

const clip = (text: string) =>
  text.length <= LIVE_ACTIVITY_STATUS_MAX
    ? text
    : `${text.slice(0, LIVE_ACTIVITY_STATUS_MAX - 1)}…`;
const join = (...parts: string[]) =>
  clip(
    parts
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .join(" · "),
  );

const BY_STATUS: Record<
  InstanceReport["status"],
  { phase: LiveActivityPhase; text: string } | null
> = {
  lobby: { phase: "lobby", text: "In lobby" },
  waiting: { phase: "waiting", text: "Waiting for players" },
  active: null,
  suspended: { phase: "playing", text: "Paused" },
  completed: { phase: "ended", text: "Game over" },
  expired: { phase: "ended", text: "Game over" },
};

/**
 * The status line for a game's own report (INSTANCE_REPORT over the bridge): "Round 3 · Your turn",
 * "In lobby", "Waiting for players", "Mission 6 · Fixing the engine", "Game over".
 */
export function statusOfReport(report: InstanceReport): LiveActivityStatus {
  const fixed = BY_STATUS[report.status];
  if (fixed?.phase === "ended") return { phase: "ended", status: fixed.text, yourTurn: false };
  const phase = fixed?.phase ?? "playing";
  if (report.yourTurn) return { phase, status: join(report.title, "Your turn"), yourTurn: true };
  if (fixed) return { phase, status: join(report.title, fixed.text), yourTurn: false };
  return { phase, status: join(report.title, report.detail) || "Playing", yourTurn: false };
}

export type SessionContent = LiveActivityStatus & { appId: string };

/**
 * What the couch session says about the game on the TV (the API's remote updates): the game and its
 * resume label while cast, or null when nothing plays.
 */
export function sessionContent(state: SessionState): SessionContent | null {
  if (!state.cast || !state.current) return null;
  return {
    appId: state.current.appId,
    phase: "playing",
    status: join(state.current.label) || "Playing on the TV",
    yourTurn: false,
  };
}

export type LiveActivityChange = { kind: "update"; content: SessionContent } | { kind: "end" };

const sameContent = (a: SessionContent, b: SessionContent) =>
  a.appId === b.appId && a.phase === b.phase && a.status === b.status && a.yourTurn === b.yourTurn;

/** What a couch state change does to the session's activities: update, end, or nothing. */
export function liveActivityChange(
  before: SessionState | null,
  after: SessionState,
): LiveActivityChange | null {
  const was = before ? sessionContent(before) : null;
  const now = sessionContent(after);
  if (!now) return was ? { kind: "end" } : null;
  if (was && sameContent(was, now)) return null;
  return { kind: "update", content: now };
}

const LINK_HOST = "live-activity";

/** The activity's tap target: `<scheme>://live-activity/<appId>`. */
export const liveActivityDeepLink = (scheme: string, appId: string) =>
  `${scheme}://${LINK_HOST}/${appId}`;

/** The appId of a Live Activity tap (`<any scheme>://live-activity/<appId>`), or null. */
export function readLiveActivityLink(url: string): { appId: string } | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/live-activity\/([^/?#]*)/i.exec(url);
  if (!m || /^https?$/i.test(m[1] ?? "")) return null;
  const appId = AppIdSchema.safeParse(m[2]);
  return appId.success ? { appId: appId.data } : null;
}
