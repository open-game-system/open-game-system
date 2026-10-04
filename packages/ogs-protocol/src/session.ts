import { z } from "zod";

/** Who is connected to the couch session. */
export const ClientKindSchema = z.enum(["phone", "tablet", "launcher"]);
export type ClientKind = z.infer<typeof ClientKindSchema>;

export const RosterEntrySchema = z.object({
  profileId: z.string(),
  roleId: z.string(),
  deviceId: z.string().optional(),
});
export type RosterEntry = z.infer<typeof RosterEntrySchema>;

/** A profile on the couch: whoever joined this cast (the TV shows them). */
export const MemberSchema = z.object({
  profileId: z.string(),
  name: z.string(),
  sticker: z.string(),
});
export type Member = z.infer<typeof MemberSchema>;

export const DirectionSchema = z.enum(["up", "down", "left", "right"]);

/** Messages any client sends to the couch session. */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    deviceId: z.string(),
    kind: ClientKindSchema,
    /** The profile on this phone or tablet (none for the launcher). */
    profile: MemberSchema.optional(),
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
  profileId?: string;
  online: boolean;
}

export type Screen = "home" | "game-page" | "game";

/** Parses the session state a client receives (the reducer's output). */
export const SessionStateSchema = z.object({
  sessionId: z.string(),
  hostProfileId: z.string(),
  members: z.array(MemberSchema),
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
      profileId: z.string().optional(),
      online: z.boolean(),
    }),
  ),
  rosters: z.record(z.string(), z.array(RosterEntrySchema)),
  casts: z.number(),
});

export interface SessionState {
  sessionId: string;
  /** The caster: the session shows their library. */
  hostProfileId: string;
  /** Everyone who joined this cast, in join order. */
  members: Member[];
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

export function initialSession(sessionId: string, hostProfileId: string): SessionState {
  return {
    sessionId,
    hostProfileId,
    members: [],
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

/**
 * A launcher card that starts a game at once instead of opening its page: a paused sitting
 * (`play:<appId>:<instanceId>`) or a game picked for the player (`play:<appId>`, e.g. Surprise me).
 * `select` on one is a `game.start` from the selecting phone.
 */
export type PlayItem = { appId: string; instanceId?: string };

export const playItem = (appId: string, instanceId?: string): string =>
  instanceId ? `play:${appId}:${instanceId}` : `play:${appId}`;

export function readPlayItem(itemId: string | null): PlayItem | null {
  const m = itemId ? /^play:([^:]+)(?::(.+))?$/.exec(itemId) : null;
  if (!m?.[1]) return null;
  return m[2] ? { appId: m[1], instanceId: m[2] } : { appId: m[1] };
}

function suspendCurrent(s: SessionState, now: number): SessionState {
  if (!s.current) return s;
  const { appId, instanceId, label } = s.current;
  const suspended = [
    { appId, instanceId, label, at: now },
    ...s.suspended.filter((g) => g.appId !== appId),
  ];
  return { ...s, current: null, suspended };
}

type Device = SessionState["devices"][number];

const sameSitting = (a: SessionState, b: SessionState) =>
  a.current?.instanceId === b.current?.instanceId;
const rosterEntry = (s: SessionState, profileId: string | undefined) =>
  s.current?.roster.find((r) => r.profileId === profileId);

/** The phone that started a new sitting follows it as its host. */
function hostFollow(s: SessionState, before: SessionState): Outbound[] {
  const current = s.current;
  if (!current?.hostDeviceId || sameSitting(s, before)) return [];
  return [
    {
      to: { deviceId: current.hostDeviceId },
      msg: {
        type: "follow",
        target: {
          kind: "game",
          appId: current.appId,
          instanceId: current.instanceId,
          roleId: "host",
        },
      },
    },
  ];
}

/** Where a tablet belongs: its seat in the current game, else the launcher. */
function followTarget(s: SessionState, d: Device): FollowTarget {
  const entry = rosterEntry(s, d.profileId);
  return s.current && entry
    ? {
        kind: "game",
        appId: s.current.appId,
        instanceId: s.current.instanceId,
        roleId: entry.roleId,
      }
    : { kind: "launcher" };
}

/** A tablet is told again when the sitting, its seat, or its being online changed. */
function followChanged(s: SessionState, before: SessionState, d: Device): boolean {
  return (
    !sameSitting(s, before) ||
    rosterEntry(before, d.profileId)?.roleId !== rosterEntry(s, d.profileId)?.roleId ||
    before.devices.find((x) => x.deviceId === d.deviceId)?.online !== true
  );
}

function tabletFollow(s: SessionState, before: SessionState, d: Device): Outbound[] {
  if (d.kind !== "tablet" || !d.online || !followChanged(s, before, d)) return [];
  return [{ to: { deviceId: d.deviceId }, msg: { type: "follow", target: followTarget(s, d) } }];
}

function followAll(s: SessionState, before: SessionState): Outbound[] {
  return [...hostFollow(s, before), ...s.devices.flatMap((d) => tabletFollow(s, before, d))];
}

// ---------- One handler per message ----------

/** What one message did: the next state, and anything to send besides state and follows. */
interface Step {
  s: SessionState;
  extra?: Outbound[];
}
type MessageOf<K extends ClientMessage["type"]> = Extract<ClientMessage, { type: K }>;
type Handlers = {
  [K in ClientMessage["type"]]: (s: SessionState, msg: MessageOf<K>, now: number) => Step;
};

function withMember(members: SessionState["members"], joined: MessageOf<"hello">["profile"]) {
  if (!joined) return members;
  return members.some((m) => m.profileId === joined.profileId)
    ? members.map((m) => (m.profileId === joined.profileId ? joined : m))
    : [...members, joined];
}

function onHello(s: SessionState, msg: MessageOf<"hello">): Step {
  // A launcher socket reconnecting is the same cast; only a new launcher (a new LOAD_VIEW) is a recast.
  const knownLauncher = s.devices.some((d) => d.deviceId === msg.deviceId && d.kind === "launcher");
  const devices = [
    ...s.devices.filter((d) => d.deviceId !== msg.deviceId),
    { deviceId: msg.deviceId, kind: msg.kind, profileId: msg.profile?.profileId, online: true },
  ];
  let next: SessionState = { ...s, devices, members: withMember(s.members, msg.profile) };
  if (msg.kind === "launcher")
    next = { ...next, cast: true, casts: knownLauncher ? next.casts : next.casts + 1 };
  if (msg.kind === "phone" && !next.remote) next = { ...next, remote: msg.deviceId };
  return { s: next };
}

function onBye(s: SessionState, msg: MessageOf<"bye">): Step {
  const gone = s.devices.find((d) => d.deviceId === msg.deviceId);
  const devices = s.devices.map((d) => (d.deviceId === msg.deviceId ? { ...d, online: false } : d));
  const lastLauncherLeft =
    gone?.kind === "launcher" && !devices.some((d) => d.kind === "launcher" && d.online);
  const next = { ...s, devices, cast: lastLauncherLeft ? false : s.cast };
  if (next.remote !== msg.deviceId) return { s: next };
  // The remote's phone left: offer the remote to every phone still here.
  const offers = devices
    .filter((d) => d.kind === "phone" && d.online)
    .map(
      (d): Outbound => ({
        to: { deviceId: d.deviceId },
        msg: { type: "remote.offer", from: msg.deviceId },
      }),
    );
  return { s: { ...next, remote: null }, extra: offers };
}

/** A play item continues its sitting (or the game's paused one), else starts the game new. */
function playStart(s: SessionState, play: PlayItem, hostDeviceId: string): MessageOf<"game.start"> {
  const paused = play.instanceId !== undefined || s.suspended.some((g) => g.appId === play.appId);
  return { type: "game.start", ...play, mode: paused ? "continue" : "new", hostDeviceId };
}

function onSelect(s: SessionState, msg: MessageOf<"select">, now: number): Step {
  const appId = gameOf(s.focus);
  if (s.screen === "home" && appId) return { s: { ...s, screen: "game-page", page: appId } };
  const play = readPlayItem(s.focus);
  if (s.screen === "home" && play) return onGameStart(s, playStart(s, play, msg.deviceId), now);
  if (s.screen !== "game-page" || !s.page) return { s };
  const mode = s.focus === "action:new" ? "new" : "continue";
  return onGameStart(
    s,
    { type: "game.start", appId: s.page, mode, hostDeviceId: msg.deviceId },
    now,
  );
}

function onHome(s: SessionState, _msg: MessageOf<"home">, now: number): Step {
  if (!s.current) return { s };
  const focus = `game:${s.current.appId}`;
  return { s: { ...suspendCurrent(s, now), screen: "home", page: null, focus } };
}

/** Starting the game already on (and not naming another of its sittings) changes nothing. */
function alreadyOn(s: SessionState, msg: MessageOf<"game.start">): boolean {
  const otherSitting = msg.instanceId !== undefined && msg.instanceId !== s.current?.instanceId;
  return s.current?.appId === msg.appId && !otherSitting;
}

/** A named sitting (Rejoin from a game's page) resumes that one; else the game's paused one. */
function resumable(s: SessionState, msg: MessageOf<"game.start">) {
  if (msg.mode !== "continue") return undefined;
  return msg.instanceId
    ? s.suspended.find((g) => g.instanceId === msg.instanceId)
    : s.suspended.find((g) => g.appId === msg.appId);
}

/** The sitting to open: the named one, the resumed one, or a new one. */
function sittingOf(s: SessionState, msg: MessageOf<"game.start">, now: number) {
  const resuming = resumable(s, msg);
  return {
    instanceId: msg.instanceId ?? resuming?.instanceId ?? newId(msg.appId, now),
    label: resuming?.label ?? "",
  };
}

function onGameStart(s: SessionState, msg: MessageOf<"game.start">, now: number): Step {
  if (alreadyOn(s, msg)) return { s };
  const sitting = sittingOf(s, msg, now);
  const next = suspendCurrent(s, now);
  const roster = msg.roster ?? next.rosters[msg.appId] ?? [];
  const current = {
    appId: msg.appId,
    instanceId: sitting.instanceId,
    mode: msg.mode,
    roster,
    label: sitting.label,
    startedAt: now,
    viewUrl: null,
    hostDeviceId: msg.hostDeviceId ?? next.remote,
  };
  return {
    s: {
      ...next,
      screen: "game",
      page: null,
      focus: `game:${msg.appId}`,
      current,
      suspended: next.suspended.filter((g) => g.appId !== msg.appId),
      rosters: { ...next.rosters, [msg.appId]: roster },
    },
  };
}

function onGameView(s: SessionState, msg: MessageOf<"game.view">): Step {
  if (s.current?.appId !== msg.appId) return { s };
  return { s: { ...s, current: { ...s.current, viewUrl: msg.url } } };
}

/** Games often report on suspend, after home already moved them to suspended. */
function onResumePoint(s: SessionState, msg: MessageOf<"game.resume-point">): Step {
  if (s.current?.appId === msg.appId)
    return { s: { ...s, current: { ...s.current, label: msg.label } } };
  const suspended = s.suspended.map((g) =>
    g.appId === msg.appId ? { ...g, label: msg.label } : g,
  );
  return { s: { ...s, suspended } };
}

const HANDLERS: Handlers = {
  hello: onHello,
  bye: onBye,
  "remote.take": (s, msg) => ({ s: { ...s, remote: msg.deviceId } }),
  "focus.set": (s, msg) => ({ s: { ...s, focus: msg.itemId } }),
  "focus.move": (s, msg) => ({
    s,
    extra: [{ to: "launcher", msg: { type: "focus.move", dir: msg.dir } }],
  }),
  select: onSelect,
  back: (s) => ({ s: s.screen === "game-page" ? { ...s, screen: "home", page: null } : s }),
  home: onHome,
  "game.start": onGameStart,
  "game.view": onGameView,
  "game.resume-point": onResumePoint,
  end: (s, _msg, now) => ({
    s: { ...suspendCurrent(s, now), screen: "home", page: null, cast: false },
  }),
};

function step<K extends ClientMessage["type"]>(
  type: K,
  msg: MessageOf<K>,
  s: SessionState,
  now: number,
): Step {
  const handler: Handlers[K] = HANDLERS[type];
  return handler(s, msg, now);
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
  const { s, extra = [] } = step(msg.type, msg, state, now);
  return {
    state: s,
    out: [{ to: "all", msg: { type: "state", state: s } }, ...extra, ...followAll(s, state)],
  };
}
