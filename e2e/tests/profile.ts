// Fresh profiles and a cast session on the local API per test, and Node WebSocket clients that stand
// in for the phones and iPads (the framework drives one surface per test; the others speak the real
// protocol). One profile per device.
import WebSocket from "ws";
import { z } from "zod";

export const API = process.env.OGS_API ?? "http://localhost:8788";
export const GAME = process.env.FIXTURE_GAME ?? "http://localhost:5190";

export const tvPage = (game: string, label: string) =>
  `${GAME}/tv?game=${encodeURIComponent(game)}&label=${encodeURIComponent(label)}`;

const Json = z.record(z.unknown());

export async function api(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, json: Json.parse(await res.json()) };
}

export const ProfileSchema = z.object({ id: z.string(), handle: z.string(), name: z.string(), sticker: z.string() });
export const ErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), status: z.number() }) });
export type Profile = z.infer<typeof ProfileSchema> & { token: string };

let seq = 0;
const tag = () => `${Date.now().toString(36)}${++seq}`;

/** Makes a profile on a new device. */
export async function profile(name: string, sticker: string, kind: "phone" | "tablet" = "phone"): Promise<Profile> {
  const handle = `${name.toLowerCase()}.${tag()}`.slice(0, 24);
  const res = await api("/api/v1/profiles", {
    body: { name, handle, sticker, device: { deviceId: `e2e-${kind}-${tag()}`, kind, name: `${name}'s ${kind}` } },
  });
  if (res.status !== 201) throw new Error(`profile: ${JSON.stringify(res)}`);
  const made = z.object({ profile: ProfileSchema, token: z.string() }).parse(res.json);
  return { ...made.profile, token: made.token };
}

export interface Cast {
  host: Profile;
  sessionId: string;
  code: string;
  launcherToken: string;
  launcherPath: string;
  /** Joins another profile with the TV code. */
  join: (who: Profile) => Promise<void>;
}

/** The host casts: a session with its TV code and launcher token. */
export async function cast(host: Profile, tvName = "Living room TV"): Promise<Cast> {
  const res = await api("/api/v1/sessions", { body: { tvName }, token: host.token });
  if (res.status !== 201) throw new Error(`cast: ${JSON.stringify(res)}`);
  const s = z.object({ sessionId: z.string(), code: z.string(), token: z.string() }).parse(res.json);
  return {
    host,
    sessionId: s.sessionId,
    code: s.code,
    launcherToken: s.token,
    launcherPath: `/?api=${encodeURIComponent(API)}&token=${encodeURIComponent(s.token)}`,
    async join(who) {
      const j = await api("/api/v1/sessions/join", { body: { code: s.code }, token: who.token });
      if (j.status !== 200) throw new Error(`join: ${JSON.stringify(j)}`);
    },
  };
}

const MemberSchema = z.object({ profileId: z.string(), name: z.string(), sticker: z.string() });
/** The parts of the session state these tests read (the launcher and API own the rest). */
const StateSchema = z
  .object({
    cast: z.boolean(),
    casts: z.number(),
    focus: z.string().nullable(),
    members: z.array(MemberSchema),
    current: z.object({ appId: z.string(), label: z.string() }).passthrough().nullable(),
  })
  .passthrough();
export type CouchState = z.infer<typeof StateSchema>;
const FrameSchema = z.object({ type: z.string() }).passthrough();
export type Frame = z.infer<typeof FrameSchema>;

export interface Couch {
  state: () => CouchState | null;
  msgs: Frame[];
  send: (m: unknown) => void;
  close: () => void;
  until: <T>(fn: () => T, what: string, ms?: number) => Promise<NonNullable<T>>;
}

/** A couch socket: a phone/tablet names the session; a launcher token carries its own. */
export async function couch(token: string, sessionId?: string): Promise<Couch> {
  const session = sessionId ? `&session=${encodeURIComponent(sessionId)}` : "";
  const ws = new WebSocket(`${API.replace(/^http/, "ws")}/api/v1/couch/ws?token=${encodeURIComponent(token)}${session}`);
  const msgs: Frame[] = [];
  let state: CouchState | null = null;
  ws.on("message", (raw) => {
    const m = FrameSchema.parse(JSON.parse(String(raw)));
    msgs.push(m);
    const s = z.object({ type: z.literal("state"), state: StateSchema }).safeParse(m);
    if (s.success) state = s.data.state;
  });
  await new Promise((r, j) => {
    ws.on("open", r);
    ws.on("error", j);
  });
  return {
    state: () => state,
    msgs,
    send: (m) => ws.send(JSON.stringify(m)),
    close: () => ws.close(),
    async until(fn, what, ms = 10_000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const v = fn();
        if (v) return v as NonNullable<typeof v>;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`timed out waiting for ${what}`);
    },
  };
}
