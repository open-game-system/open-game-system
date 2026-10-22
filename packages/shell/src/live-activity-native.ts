import type { LiveActivityAttributes, LiveActivityContent } from "@open-game-system/ogs-protocol";
import { requireOptionalNativeModule } from "expo";
import { z } from "zod";

/**
 * The OgsLiveActivity Expo module (packages/shell/ios/OgsLiveActivityModule.swift) as the runtime sees
 * it: ActivityKit's start / update / end for `OgsGameActivityAttributes`, the user's Live Activities
 * setting, the key art copied into the app group for the widget, and the update and push-to-start
 * tokens. Everything the module hands back is parsed here. null when the build has no module
 * (Android, Expo Go, a build without the shell config's `liveActivities`).
 */
export type ActivityState = "active" | "ended" | "dismissed" | "stale" | "pending";

export interface LiveActivityNative {
  /** iOS 16.2+ and the user allows Live Activities for this app (Settings, or the lock screen). */
  isEnabled(): boolean;
  /** Starts an activity; resolves its id. Rejects when ActivityKit refuses. */
  start(
    attributes: LiveActivityAttributes,
    content: LiveActivityContent,
    staleAt: number,
  ): Promise<string>;
  update(id: string, content: LiveActivityContent, staleAt: number): Promise<void>;
  /** Ends it showing `content` until `dismissAt` (ms since epoch). */
  end(id: string, content: LiveActivityContent, dismissAt: number): Promise<void>;
  /** Downloads `url`, shrinks it and saves it in the app group as `name` (the widget's art). */
  prepareArt(url: string, name: string): Promise<string | null>;
  onPushToken(listener: (e: { activityId: string; token: string }) => void): () => void;
  onStateChange(listener: (e: { activityId: string; state: ActivityState }) => void): () => void;
  /** iOS 17.2+: the token APNs can start an activity with (push-to-start). */
  onPushToStartToken?(listener: (token: string) => void): () => void;
}

export const LIVE_ACTIVITY_MODULE = "OgsLiveActivity";

const PushTokenEvent = z.object({ activityId: z.string().min(1), token: z.string().min(1) });
const StateEvent = z.object({
  activityId: z.string().min(1),
  state: z.enum(["active", "ended", "dismissed", "stale", "pending"]),
});
const PushToStartEvent = z.object({ token: z.string().min(1) });
const ActivityId = z.string().min(1);
const ArtName = z.string().min(1).nullable();

type Fn = (...args: unknown[]) => unknown;

/** A method of the native module, or null when it has none by that name. */
function method(mod: object, name: string): Fn | null {
  const f: unknown = Reflect.get(mod, name);
  if (typeof f !== "function") return null;
  return (...args) => Reflect.apply(f, mod, args);
}

/** Subscribes to a module event; payloads that don't parse are dropped. */
function listen<T>(
  addListener: Fn,
  event: string,
  schema: z.ZodType<T>,
  listener: (e: T) => void,
): () => void {
  const sub: unknown = addListener(event, (payload: unknown) => {
    const parsed = schema.safeParse(payload);
    if (parsed.success) listener(parsed.data);
  });
  const remove = typeof sub === "object" && sub !== null ? method(sub, "remove") : null;
  return () => {
    remove?.();
  };
}

const REQUIRED = [
  "areActivitiesEnabled",
  "startActivity",
  "updateActivity",
  "endActivity",
  "prepareArt",
  "addListener",
] as const;

/** The module object as a LiveActivityNative, or null when it isn't one. */
export function liveActivityNativeFrom(mod: unknown): LiveActivityNative | null {
  if (typeof mod !== "object" || mod === null) return null;
  const fns = REQUIRED.map((name) => method(mod, name));
  const [enabled, start, update, end, art, addListener] = fns;
  if (!enabled || !start || !update || !end || !art || !addListener) return null;
  return {
    isEnabled: () => enabled() === true,
    async start(attributes, content, staleAt) {
      const id = await start(JSON.stringify(attributes), JSON.stringify(content), staleAt);
      return ActivityId.parse(id);
    },
    async update(id, content, staleAt) {
      await update(id, JSON.stringify(content), staleAt);
    },
    async end(id, content, dismissAt) {
      await end(id, JSON.stringify(content), dismissAt);
    },
    async prepareArt(url, name) {
      const saved = ArtName.safeParse(await art(url, name));
      return saved.success ? saved.data : null;
    },
    onPushToken: (l) => listen(addListener, "onPushToken", PushTokenEvent, l),
    onStateChange: (l) => listen(addListener, "onStateChange", StateEvent, l),
    onPushToStartToken: (l) =>
      listen(addListener, "onPushToStartToken", PushToStartEvent, (e) => l(e.token)),
  };
}

/** This build's module, or null (see above). */
export function loadLiveActivityNative(): LiveActivityNative | null {
  return liveActivityNativeFrom(requireOptionalNativeModule(LIVE_ACTIVITY_MODULE));
}
