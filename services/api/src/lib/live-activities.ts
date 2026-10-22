import {
  type LiveActivityChange,
  type LiveActivityContent,
  type LiveActivityRegistration,
  liveActivityChange,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";
import type { Env } from "../types";
import { appOf } from "./native-apps";
import { apnsProviderToken } from "./native-push";
import { type ApnsCredential, apnsCredential } from "./push-credentials";
import { emit, errorFields } from "./wide-event";

/**
 * Remote Live Activity updates (docs/acceptance/2026-10-21-live-activities.feature): each phone that
 * runs a controller Live Activity registers its push token under the couch session; when the
 * session's game or label changes, or the cast ends, OGS sends every token of that session an APNs
 * `liveactivity` push, so the lock screen follows the TV while the phone is locked. Behind
 * LIVE_ACTIVITIES = "on". The OGS app sends with OGS's own APNs key (APNS_KEY_ID, APNS_TEAM_ID,
 * APNS_P8 secrets), a game's own app with its uploaded key (ADR 2026-10-18-multi-tenant-push).
 */

export const OGS_APP = "ogs";
/** The OGS app's bundle id (APNS_BUNDLE_ID overrides it for another build of the app). */
export const OGS_BUNDLE_ID = "org.opengame.app";
/** How long an ended activity stays on the lock screen (as the app does: LIVE_ACTIVITY_ENDED_SHOWN_MS). */
export const ENDED_SHOWN_MS = 2 * 60_000;

export const liveActivitiesOn = (env: Pick<Env, "LIVE_ACTIVITIES">) => env.LIVE_ACTIVITIES === "on";

const RowSchema = z.object({
  activity_id: z.string(),
  app: z.string(),
  push_token: z.string(),
  apns_environment: z.enum(["sandbox", "production"]),
});
type Row = z.infer<typeof RowSchema>;

export async function registerActivity(
  db: D1Database,
  sessionId: string,
  profileId: string,
  r: LiveActivityRegistration,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO live_activities
         (activity_id, session_id, profile_id, app, push_token, apns_environment, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(r.activityId, sessionId, profileId, r.app, r.pushToken.toLowerCase(), r.environment, now)
    .run();
}

/** Forgets one activity; only its own profile's (false: none such). */
export async function forgetActivity(
  db: D1Database,
  sessionId: string,
  profileId: string,
  activityId: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      "DELETE FROM live_activities WHERE activity_id = ? AND session_id = ? AND profile_id = ?",
    )
    .bind(activityId, sessionId, profileId)
    .run();
  return res.meta.changes > 0;
}

async function activitiesOf(db: D1Database, sessionId: string): Promise<Row[]> {
  const { results } = await db
    .prepare(
      "SELECT activity_id, app, push_token, apns_environment FROM live_activities WHERE session_id = ?",
    )
    .bind(sessionId)
    .all();
  return z.array(RowSchema).parse(results);
}

/** One APNs liveactivity send: where, and the payload. */
export interface LiveActivityPush {
  token: string;
  environment: "sandbox" | "production";
  /** `<bundle id>.push-type.liveactivity` */
  topic: string;
  priority: 5 | 10;
  payload: unknown;
}
export type PushOutcome = { ok: true } | { ok: false; gone: boolean; reason: string };

/** Sends liveactivity pushes for one app (an interface: tests use a fake, never APNs). */
export interface LiveActivitySender {
  send(push: LiveActivityPush): Promise<PushOutcome>;
}

/** The credentials and bundle id an app's activities are sent with, or null (none set up). */
export type SenderFor = (
  app: string,
) => Promise<{ sender: LiveActivitySender; bundleId: string } | null>;

/** The APNs `aps` for a change: update (the content) or end (Game over, gone after 2 min). */
export function liveActivityPayload(change: LiveActivityChange, now: number) {
  const seconds = Math.floor(now / 1000);
  if (change.kind === "end") {
    const content: LiveActivityContent = {
      phase: "ended",
      status: "Game over",
      yourTurn: false,
      updatedAt: now,
    };
    return {
      aps: {
        timestamp: seconds,
        event: "end",
        "content-state": content,
        "dismissal-date": Math.floor((now + ENDED_SHOWN_MS) / 1000),
      },
    };
  }
  const { appId: _appId, ...status } = change.content;
  const content: LiveActivityContent = { ...status, updatedAt: now };
  return { aps: { timestamp: seconds, event: "update", "content-state": content } };
}

/** APNs reasons that mean the activity's token is dead for good. */
const GONE = new Set(["BadDeviceToken", "Unregistered", "ExpiredToken"]);
const ReasonSchema = z.object({ reason: z.string() });

/** The real sender: APNs over HTTP/2 with an ES256 provider token (native-push.ts reuses it). */
export function apnsLiveActivitySender(
  cred: ApnsCredential,
  fetcher: typeof fetch,
  now: () => number,
): LiveActivitySender {
  return {
    async send(push) {
      const jwt = await apnsProviderToken(cred, now());
      if (!jwt) return { ok: false, gone: false, reason: "apns_key_unusable" };
      const host =
        push.environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
      const res = await fetcher(`https://${host}/3/device/${push.token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": push.topic,
          "apns-push-type": "liveactivity",
          "apns-priority": String(push.priority),
          "content-type": "application/json",
        },
        body: JSON.stringify(push.payload),
      });
      if (res.ok) return { ok: true };
      // Stryker disable next-line ArrowFunction: equivalent, safeParse fails the same for undefined as for {}
      const reason = ReasonSchema.safeParse(await res.json().catch(() => ({})));
      const why = reason.success ? reason.data.reason : `apns_${res.status}`;
      return { ok: false, gone: res.status === 410 || GONE.has(why), reason: why };
    },
  };
}

/** The OGS app's own APNs key, from secrets; null until Jon sets all three. */
export function ogsApnsCredential(
  env: Pick<Env, "APNS_KEY_ID" | "APNS_TEAM_ID" | "APNS_P8">,
): ApnsCredential | null {
  const { APNS_KEY_ID: keyId, APNS_TEAM_ID: teamId, APNS_P8: p8 } = env;
  return keyId && teamId && p8 ? { keyId, teamId, p8 } : null;
}

/** Credentials per app: OGS's secrets for the OGS app, a game's uploaded key for its own app. */
export function apnsSenderFor(
  env: Pick<
    Env,
    "DB" | "APNS_KEY_ID" | "APNS_TEAM_ID" | "APNS_P8" | "APNS_BUNDLE_ID" | "PUSH_KEY_SECRET"
  >,
  fetcher: typeof fetch,
  now: () => number,
): SenderFor {
  return async (app) => {
    if (app === OGS_APP) {
      const cred = ogsApnsCredential(env);
      if (!cred) return null;
      return {
        sender: apnsLiveActivitySender(cred, fetcher, now),
        bundleId: env.APNS_BUNDLE_ID || OGS_BUNDLE_ID,
      };
    }
    const secret = env.PUSH_KEY_SECRET;
    if (!secret) return null;
    const [registered, cred] = await Promise.all([
      appOf(env.DB, app, "ios"),
      apnsCredential(env.DB, app, secret).catch(() => null),
    ]);
    if (!cred || registered?.platform !== "ios") return null;
    return {
      sender: apnsLiveActivitySender(cred, fetcher, now),
      bundleId: registered.bundleId,
    };
  };
}

export interface NotifyResult {
  sent: number;
  gone: number;
  failed: number;
  /** Apps with registered activities but no APNs credentials (e.g. the .p8 isn't set yet). */
  unsendable: number;
}

/**
 * Sends a session's change to each registered activity. Dead tokens are deleted; an end deletes
 * the session's rows (the activities are over).
 */
export async function notifySession(
  db: D1Database,
  sessionId: string,
  change: LiveActivityChange,
  senderFor: SenderFor,
  now: number,
): Promise<NotifyResult> {
  const rows = await activitiesOf(db, sessionId);
  const result: NotifyResult = { sent: 0, gone: 0, failed: 0, unsendable: 0 };
  const payload = liveActivityPayload(change, now);
  const senders = new Map<string, Awaited<ReturnType<SenderFor>>>();
  const dead: string[] = [];
  for (const row of rows) {
    if (!senders.has(row.app)) senders.set(row.app, await senderFor(row.app));
    const target = senders.get(row.app);
    if (!target) {
      result.unsendable++;
      continue;
    }
    const outcome = await target.sender.send({
      token: row.push_token,
      environment: row.apns_environment,
      topic: `${target.bundleId}.push-type.liveactivity`,
      priority: change.kind === "end" ? 10 : 5,
      payload,
    });
    if (outcome.ok) result.sent++;
    else if (outcome.gone) {
      result.gone++;
      dead.push(row.activity_id);
    } else result.failed++;
  }
  const deletes =
    change.kind === "end"
      ? [db.prepare("DELETE FROM live_activities WHERE session_id = ?").bind(sessionId)]
      : dead.map((id) => db.prepare("DELETE FROM live_activities WHERE activity_id = ?").bind(id));
  if (deletes.length > 0) await db.batch(deletes);
  return result;
}

/**
 * The CouchSession's hook (after each action): when what the activity shows changed, notify the
 * session's activities, and write one `live_activity.push` wide event. Never throws: the couch
 * session carries on whatever APNs says.
 */
export async function publishLiveActivity(
  env: Pick<Env, "DB" | "LIVE_ACTIVITIES">,
  before: SessionState | null,
  after: SessionState,
  deps: { senderFor: SenderFor; now: () => number; version: string },
): Promise<NotifyResult | null> {
  if (!liveActivitiesOn(env)) return null;
  const change = liveActivityChange(before, after);
  if (!change) return null;
  const fields = { session_id: after.sessionId, change: change.kind };
  try {
    const result = await notifySession(env.DB, after.sessionId, change, deps.senderFor, deps.now());
    emit("live_activity.push", deps.version, { ...fields, ...result });
    return result;
  } catch (error) {
    emit("live_activity.push", deps.version, { ...fields, error: errorFields(error) });
    return null;
  }
}
