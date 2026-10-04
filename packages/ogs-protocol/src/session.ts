import { z } from "zod";

/** Who is connected to the couch session. */
export const ClientKindSchema = z.enum(["phone", "tablet", "launcher"]);
export type ClientKind = z.infer<typeof ClientKindSchema>;

export const RosterEntrySchema = z.object({
  personId: z.string(),
  roleId: z.string(),
  deviceId: z.string().optional(),
});
export type RosterEntry = z.infer<typeof RosterEntrySchema>;

export const DirectionSchema = z.enum(["up", "down", "left", "right"]);

/** Messages any client sends to the household's couch session. */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    deviceId: z.string(),
    kind: ClientKindSchema,
    personId: z.string().optional(),
  }),
  z.object({ type: z.literal("bye"), deviceId: z.string() }),
  z.object({ type: z.literal("focus.set"), itemId: z.string() }),
  z.object({ type: z.literal("focus.move"), dir: DirectionSchema }),
  z.object({ type: z.literal("select"), deviceId: z.string() }),
  z.object({ type: z.literal("back") }),
  z.object({ type: z.literal("home") }),
  z.object({
    type: z.literal("game.start"),
    appId: z.string(),
    mode: z.enum(["continue", "new"]),
    roster: z.array(RosterEntrySchema).optional(),
    instanceId: z.string().optional(),
    /** The phone that runs the game's start page (defaults to the remote holder). */
    hostDeviceId: z.string().optional(),
  }),
  z.object({ type: z.literal("game.resume-point"), appId: z.string(), label: z.string() }),
  /** The game's phone page asked for its TV view (cast-kit SET_VIEW_URL); the launcher frames it. */
  z.object({ type: z.literal("game.view"), appId: z.string(), url: z.string().url() }),
  z.object({ type: z.literal("remote.take"), deviceId: z.string() }),
  z.object({ type: z.literal("end") }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export interface SuspendedGame {
  appId: string;
  instanceId: string;
  label: string;
  at: number;
}

export interface CurrentGame {
  appId: string;
  instanceId: string;
  mode: "continue" | "new";
  roster: RosterEntry[];
  label: string;
  startedAt: number;
  /** The TV page the game asked for, framed by the launcher. Null until the game sends it. */
  viewUrl: string | null;
  /** The phone hosting the game (runs its start page as the controller). */
  hostDeviceId: string | null;
}

export interface SessionDevice {
  deviceId: string;
  kind: ClientKind;
  personId?: string;
  online: boolean;
}

export type Screen = "home" | "game-page" | "game";

/** Parses the session state a client receives (the reducer's output). */
export const SessionStateSchema = z.object({
  householdId: z.string(),
  cast: z.boolean(),
  screen: z.enum(["home", "game-page", "game"]),
  focus: z.string().nullable(),
  page: z.string().nullable(),
  current: z
    .object({
      appId: z.string(),
      instanceId: z.string(),
      mode: z.enum(["continue", "new"]),
      roster: z.array(RosterEntrySchema),
      label: z.string(),
      startedAt: z.number(),
      viewUrl: z.string().nullable(),
      hostDeviceId: z.string().nullable(),
    })
    .nullable(),
  suspended: z.array(
    z.object({ appId: z.string(), instanceId: z.string(), label: z.string(), at: z.number() }),
  ),
  remote: z.string().nullable(),
  devices: z.array(
    z.object({
      deviceId: z.string(),
      kind: ClientKindSchema,
      personId: z.string().optional(),
      online: z.boolean(),
    }),
  ),
  rosters: z.record(z.string(), z.array(RosterEntrySchema)),
  casts: z.number(),
});

export interface SessionState {
  householdId: string;
  /** True while a launcher (the TV) is connected. */
  cast: boolean;
  screen: Screen;
  /** Focused item on the TV launcher, e.g. "game:rocket-crew". */
  focus: string | null;
  /** The game whose page is open on the TV. */
  page: string | null;
  current: CurrentGame | null;
  suspended: SuspendedGame[];
  /** Device holding the remote. */
  remote: string | null;
  devices: SessionDevice[];
  /** Last roster used per game, so Continue skips "who's playing". */
  rosters: Record<string, RosterEntry[]>;
  /** Count of LOAD_VIEW sends (recasts). A game swap must never change it. */
  casts: number;
}

/** Where a device should be: the launcher's resting screen, or a game in a role. */
export type FollowTarget =
  | { kind: "launcher" }
  | { kind: "game"; appId: string; instanceId: string; roleId: string };

export type Outbound =
  | { to: "all"; msg: { type: "state"; state: SessionState } }
  | { to: "launcher"; msg: { type: "focus.move"; dir: z.infer<typeof DirectionSchema> } }
  | { to: { deviceId: string }; msg: { type: "follow"; target: FollowTarget } }
  | { to: { deviceId: string }; msg: { type: "remote.offer"; from: string } };

export function initialSession(householdId: string): SessionState {
  return {
    householdId,
    cast: false,
    screen: "home",
    focus: null,
    page: null,
    current: null,
    suspended: [],
    remote: null,
    devices: [],
    rosters: {},
    casts: 0,
  };
}

const gameOf = (itemId: string | null): string | null =>
  itemId?.startsWith("game:") ? itemId.slice(5) : null;
const newId = (appId: string, now: number) => `${appId}-${now.toString(36)}`;

function suspendCurrent(s: SessionState, now: number): SessionState {
  if (!s.current) return s;
  const { appId, instanceId, label } = s.current;
  const suspended = [
    { appId, instanceId, label, at: now },
    ...s.suspended.filter((g) => g.appId !== appId),
  ];
  return { ...s, current: null, suspended };
}

function followAll(s: SessionState, before: SessionState): Outbound[] {
  const out: Outbound[] = [];
  const host = s.current?.hostDeviceId;
  if (s.current && host && before.current?.instanceId !== s.current.instanceId) {
    out.push({
      to: { deviceId: host },
      msg: {
        type: "follow",
        target: {
          kind: "game",
          appId: s.current.appId,
          instanceId: s.current.instanceId,
          roleId: "host",
        },
      },
    });
  }
  for (const d of s.devices) {
    if (d.kind !== "tablet" || !d.online) continue;
    const entry = s.current?.roster.find((r) => r.personId === d.personId);
    const target: FollowTarget =
      s.current && entry
        ? {
            kind: "game",
            appId: s.current.appId,
            instanceId: s.current.instanceId,
            roleId: entry.roleId,
          }
        : { kind: "launcher" };
    const was = before.current?.roster.find((r) => r.personId === d.personId);
    const changed =
      before.current?.instanceId !== s.current?.instanceId ||
      was?.roleId !== entry?.roleId ||
      before.devices.find((x) => x.deviceId === d.deviceId)?.online !== true;
    if (changed) out.push({ to: { deviceId: d.deviceId }, msg: { type: "follow", target } });
  }
  return out;
}

/**
 * The couch session's rules, as a pure function. One stream all evening: nothing here ever
 * increments `casts` except a launcher connecting; swaps, Home and Continue only move state.
 */
export function reduceSession(
  state: SessionState,
  msg: ClientMessage,
  now: number,
): { state: SessionState; out: Outbound[] } {
  let s = state;
  const extra: Outbound[] = [];
  switch (msg.type) {
    case "hello": {
      // A launcher socket reconnecting is the same cast; only a new launcher (a new LOAD_VIEW) is a recast.
      const knownLauncher = s.devices.some(
        (d) => d.deviceId === msg.deviceId && d.kind === "launcher",
      );
      const devices = [
        ...s.devices.filter((d) => d.deviceId !== msg.deviceId),
        { deviceId: msg.deviceId, kind: msg.kind, personId: msg.personId, online: true },
      ];
      s = { ...s, devices };
      if (msg.kind === "launcher")
        s = { ...s, cast: true, casts: knownLauncher ? s.casts : s.casts + 1 };
      if (msg.kind === "phone" && !s.remote) s = { ...s, remote: msg.deviceId };
      break;
    }
    case "bye": {
      const gone = s.devices.find((d) => d.deviceId === msg.deviceId);
      s = {
        ...s,
        devices: s.devices.map((d) => (d.deviceId === msg.deviceId ? { ...d, online: false } : d)),
      };
      if (gone?.kind === "launcher" && !s.devices.some((d) => d.kind === "launcher" && d.online))
        s = { ...s, cast: false };
      if (s.remote === msg.deviceId) {
        s = { ...s, remote: null };
        for (const d of s.devices)
          if (d.kind === "phone" && d.online)
            extra.push({
              to: { deviceId: d.deviceId },
              msg: { type: "remote.offer", from: msg.deviceId },
            });
      }
      break;
    }
    case "remote.take":
      s = { ...s, remote: msg.deviceId };
      break;
    case "focus.set":
      s = { ...s, focus: msg.itemId };
      break;
    case "focus.move":
      extra.push({ to: "launcher", msg: { type: "focus.move", dir: msg.dir } });
      break;
    case "select": {
      const appId = gameOf(s.focus);
      if (s.screen === "home" && appId) s = { ...s, screen: "game-page", page: appId };
      else if (s.screen === "game-page" && s.page)
        return reduceSession(
          s,
          {
            type: "game.start",
            appId: s.page,
            mode: s.focus === "action:new" ? "new" : "continue",
            hostDeviceId: msg.deviceId,
          },
          now,
        );
      break;
    }
    case "back":
      if (s.screen === "game-page") s = { ...s, screen: "home", page: null };
      break;
    case "home":
      if (s.current) {
        const appId = s.current.appId;
        s = { ...suspendCurrent(s, now), screen: "home", page: null, focus: `game:${appId}` };
      }
      break;
    case "game.start": {
      const resuming =
        msg.mode === "continue" ? s.suspended.find((g) => g.appId === msg.appId) : undefined;
      if (s.current && s.current.appId === msg.appId) break;
      s = suspendCurrent(s, now);
      const roster = msg.roster ?? s.rosters[msg.appId] ?? [];
      const instanceId = msg.instanceId ?? resuming?.instanceId ?? newId(msg.appId, now);
      s = {
        ...s,
        screen: "game",
        page: null,
        focus: `game:${msg.appId}`,
        current: {
          appId: msg.appId,
          instanceId,
          mode: msg.mode,
          roster,
          label: resuming?.label ?? "",
          startedAt: now,
          viewUrl: null,
          hostDeviceId: msg.hostDeviceId ?? s.remote,
        },
        suspended: s.suspended.filter((g) => g.appId !== msg.appId),
        rosters: { ...s.rosters, [msg.appId]: roster },
      };
      break;
    }
    case "game.view":
      if (s.current?.appId === msg.appId) s = { ...s, current: { ...s.current, viewUrl: msg.url } };
      break;
    case "game.resume-point":
      // Games often report on suspend, after home already moved them to suspended.
      if (s.current?.appId === msg.appId) s = { ...s, current: { ...s.current, label: msg.label } };
      else
        s = {
          ...s,
          suspended: s.suspended.map((g) =>
            g.appId === msg.appId ? { ...g, label: msg.label } : g,
          ),
        };
      break;
    case "end":
      s = { ...suspendCurrent(s, now), screen: "home", page: null, cast: false };
      break;
  }
  return {
    state: s,
    out: [{ to: "all", msg: { type: "state", state: s } }, ...extra, ...followAll(s, state)],
  };
}
