import type { Instance, InstanceReport, Manifest } from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { type Identity, loadIdentity, type SecureStorage, saveIdentity } from "./identity";
import type { ReturnPill } from "./leave-game";
import {
  type Credential,
  type DeviceInfo,
  type InstanceSource,
  type Login,
  type Me,
  type OgsApi,
  OgsApiError,
  type ProfilePatch,
  SessionInfoSchema,
} from "./ogs-api";

/**
 * The app's shared data: this device's profile, its games and instances, the couch session it is
 * on, and the return pill. One small external store (useSyncExternalStore in screens); the API is
 * injected.
 */

/** The couch session this device is on: one it hosts (cast from here) or one it joined by code. */
export const CouchSessionInfoSchema = SessionInfoSchema.extend({
  role: z.enum(["host", "member"]),
  /** The launcher's token (host only): a TV switch re-casts the same session with it. */
  launcherToken: z.string().min(1).optional(),
});
export type CouchSessionInfo = z.infer<typeof CouchSessionInfoSchema>;

export interface AppData {
  identity: Identity | null;
  /** How this profile is backed up (empty = not backed up). */
  logins: Login[];
  session: CouchSessionInfo | null;
  catalogue: Manifest[];
  library: Manifest[];
  instances: Instance[];
  status: "idle" | "loading" | "ready" | "offline";
  error: string | null;
  pill: ReturnPill | null;
}

type Api = Pick<
  OgsApi,
  | "checkHandle"
  | "createProfile"
  | "me"
  | "updateMe"
  | "createSession"
  | "joinSession"
  | "startEmail"
  | "backUp"
  | "signIn"
  | "catalogue"
  | "library"
  | "setLibrary"
  | "instances"
  | "reportInstance"
  | "fetchManifest"
>;

export type Failure<R extends string> = { ok: false; reason: R | "error"; message: string };
export type Done = { ok: true };
export type HandleResult =
  | Done
  | { ok: false; reason: "handle_taken"; suggestion: string }
  | Failure<never>;

const SESSION_KEY = "ogs.session";

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** An API error with one of the codes the caller handles, else a plain error to show. */
function failure<R extends string>(err: unknown, codes: readonly R[]): Failure<R> {
  const message = messageOf(err);
  const code = err instanceof OgsApiError ? codes.find((c) => c === err.code) : undefined;
  return code ? { ok: false, reason: code, message } : { ok: false, reason: "error", message };
}

const isTaken = (err: unknown) => err instanceof OgsApiError && err.code === "handle_taken";

export function createAppState(opts: {
  api: Api;
  storage: SecureStorage;
  /** This device as the API registers it (minus its id, minted per profile token). */
  device: Omit<DeviceInfo, "deviceId">;
  newDeviceId: () => string;
}) {
  let appIds: string[] = [];
  const libraryOf = (catalogue: Manifest[]) =>
    appIds.flatMap((id) => catalogue.filter((g) => g.appId === id));
  let data: AppData = {
    identity: null,
    logins: [],
    session: null,
    catalogue: [],
    library: [],
    instances: [],
    status: "idle",
    error: null,
    pill: null,
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<AppData>) => {
    data = { ...data, ...patch };
    for (const l of listeners) l();
  };

  const deviceInfo = (): DeviceInfo => ({ deviceId: opts.newDeviceId(), ...opts.device });

  async function keepIdentity(identity: Identity, logins: Login[]) {
    await saveIdentity(opts.storage, identity);
    set({ identity, logins, error: null });
  }

  async function keepMe(me: Me) {
    const id = data.identity;
    if (id) await keepIdentity({ ...id, profile: me.profile }, me.logins);
  }

  async function keepSession(session: CouchSessionInfo | null) {
    if (session) await opts.storage.setItemAsync(SESSION_KEY, JSON.stringify(session));
    else await opts.storage.deleteItemAsync(SESSION_KEY);
    set({ session });
  }

  async function readSession(): Promise<CouchSessionInfo | null> {
    const raw = await opts.storage.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = CouchSessionInfoSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /** A taken @id: ask OGS for a free one to offer instead. */
  async function takenAnswer(handle: string, err: unknown): Promise<HandleResult> {
    try {
      const { suggestion } = await opts.api.checkHandle({ handle });
      return { ok: false, reason: "handle_taken", suggestion };
    } catch {
      return failure(err, []);
    }
  }

  return {
    getSnapshot: (): AppData => data,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Load this device's stored profile and the session it was on. */
    async init() {
      const [identity, session] = await Promise.all([loadIdentity(opts.storage), readSession()]);
      set({ identity, session: identity ? session : null });
    },
    /** Onboarding: make this device's profile (one per device). */
    async createProfile(input: {
      name: string;
      handle?: string;
      sticker: string;
    }): Promise<HandleResult> {
      if (data.identity) return { ok: true };
      const device = deviceInfo();
      try {
        const { profile, token } = await opts.api.createProfile({ ...input, device });
        await keepIdentity({ profile, deviceId: device.deviceId, deviceToken: token }, []);
        return { ok: true };
      } catch (err) {
        if (isTaken(err) && input.handle) return takenAnswer(input.handle, err);
        return failure(err, []);
      }
    },
    async updateProfile(patch: ProfilePatch): Promise<HandleResult> {
      try {
        await keepMe(await opts.api.updateMe(patch));
        return { ok: true };
      } catch (err) {
        if (isTaken(err) && patch.handle) return takenAnswer(patch.handle, err);
        return failure(err, []);
      }
    },
    async startEmail(email: string): Promise<Done | Failure<never>> {
      try {
        await opts.api.startEmail(email);
        return { ok: true };
      } catch (err) {
        return failure(err, []);
      }
    },
    /** Back up: link a login to this device's profile. */
    async backUp(credential: Credential): Promise<Done | Failure<"login_in_use" | "invalid_code">> {
      try {
        await keepMe(await opts.api.backUp(credential));
        return { ok: true };
      } catch (err) {
        return failure(err, ["login_in_use", "invalid_code"] as const);
      }
    },
    /** Sign in: this device takes the profile that has this login, with its own new token. */
    async signIn(
      credential: Credential,
    ): Promise<Done | Failure<"login_not_found" | "invalid_code">> {
      const device = deviceInfo();
      try {
        const { me, token } = await opts.api.signIn(credential, device);
        await keepIdentity(
          { profile: me.profile, deviceId: device.deviceId, deviceToken: token },
          me.logins,
        );
        return { ok: true };
      } catch (err) {
        return failure(err, ["login_not_found", "invalid_code"] as const);
      }
    },
    /** Cast: a new couch session hosted by this profile. Returns the launcher's token. */
    async startSession(tvName: string): Promise<string> {
      const { token, ...info } = await opts.api.createSession(tvName);
      await keepSession({ ...info, launcherToken: token, role: "host" });
      return token;
    },
    /** Join the cast whose TV shows `code`. */
    async joinSession(code: string): Promise<Done | Failure<"session_not_found">> {
      try {
        const info = await opts.api.joinSession(code.trim().toUpperCase());
        await keepSession({ ...info, role: "member" });
        return { ok: true };
      } catch (err) {
        return failure(err, ["session_not_found"] as const);
      }
    },
    async leaveSession() {
      await keepSession(null);
    },
    /** Library = the profile's appIds, as catalogue manifests, in its order. */
    async refresh() {
      set({ status: data.status === "ready" ? "ready" : "loading" });
      const signedIn = !!data.identity;
      try {
        const [catalogue, ids, instances, me] = await Promise.all([
          opts.api.catalogue(),
          signedIn ? opts.api.library() : Promise.resolve(appIds),
          signedIn ? opts.api.instances() : Promise.resolve(data.instances),
          signedIn ? opts.api.me() : Promise.resolve(null),
        ]);
        appIds = ids;
        if (me) await keepMe(me);
        set({ catalogue, library: libraryOf(catalogue), instances, status: "ready", error: null });
      } catch (err) {
        set({ status: "offline", error: messageOf(err) });
      }
    },
    async addGame(appId: string) {
      if (appIds.includes(appId)) return;
      appIds = await opts.api.setLibrary([...appIds, appId]);
      set({ library: libraryOf(data.catalogue) });
    },
    /** Add by link: the manifest must parse; OGS only takes catalogue games for now. */
    async addByLink(url: string): Promise<Manifest> {
      const manifest = await opts.api.fetchManifest(url);
      if (!data.catalogue.some((g) => g.appId === manifest.appId))
        throw new OgsApiError(
          "NOT_IN_CATALOGUE",
          `${manifest.name} isn't in the OGS catalogue yet, so it can't be added by link.`,
          0,
        );
      await this.addGame(manifest.appId);
      return manifest;
    },
    async report(report: InstanceReport, source: InstanceSource) {
      const saved = await opts.api.reportInstance(report, source);
      set({
        instances: [saved, ...data.instances.filter((i) => i.instanceId !== saved.instanceId)],
      });
    },
    setPill(pill: ReturnPill | null) {
      set({ pill });
    },
  };
}

export type AppState = ReturnType<typeof createAppState>;
