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

/** A game's own room code (multiCouch games, spec §7): opaque to OGS, safe in a URL. */
export const RoomIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** A TV's name as people see it ("Living room TV"): what Cast calls the device. */
export const TvNameSchema = z.string().trim().min(1).max(60);

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
    /** Join this room of the game (another couch's) instead of making one. */
    room: RoomIdSchema.optional(),
  }),
  /** The game's TV page said which room it shows (ogs:room). */
  z.object({ type: z.literal("game.room"), appId: z.string(), room: RoomIdSchema }),
  z.object({ type: z.literal("game.resume-point"), appId: z.string(), label: z.string() }),
  /**
   * The game's phone page asked for its TV view (cast-kit SET_VIEW_URL); the launcher frames it.
   * `deviceId` is the sender (the couch session stamps it): only the host's page counts.
   */
  z.object({
    type: z.literal("game.view"),
    appId: z.string(),
    url: z.string().url(),
    deviceId: z.string().optional(),
  }),
  z.object({ type: z.literal("remote.take"), deviceId: z.string() }),
  z.object({ type: z.literal("end") }),
  /** The caster moved the cast to another TV: the session is on that TV now, by its name. */
  z.object({ type: z.literal("tv.rename"), name: TvNameSchema }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export interface SuspendedGame {
  appId: string;
  instanceId: string;
  label: string;
  at: number;
  /** The game's room this sitting is in (multiCouch games). */
  room?: string;
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
  /** The game's room this sitting is in: joined with game.start, or reported with game.room. */
  room?: string;
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
      room: z.string().optional(),
    })
    .nullable(),
  suspended: z.array(
    z.object({
      appId: z.string(),
      instanceId: z.string(),
      label: z.string(),
      at: z.number(),
      room: z.string().optional(),
    }),
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
  tvName: z.string().optional(),
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
  /**
   * The TV the cast is on, once it moved there (tv.rename). Until then clients show the name the
   * session was created with.
   */
  tvName?: string;
}

/** Where a device should be: the launcher's resting screen, or a game in a role. */
export type FollowTarget =
  | { kind: "launcher" }
  | { kind: "game"; appId: string; instanceId: string; roleId: string; room?: string };

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

/** A couch keeps one paused sitting per game, and per room for games that name rooms. */
const sameSlot = (g: SuspendedGame, appId: string, room: string | undefined) =>
  g.appId === appId && g.room === room;

/** `{ room }` when there is one, else nothing (so sittings without a room keep their shape). */
const roomOf = (room: string | undefined): { room?: string } => (room ? { room } : {});

function suspendCurrent(s: SessionState, now: number): SessionState {
  if (!s.current) return s;
  const { appId, instanceId, label, room } = s.current;
  const suspended = [
    { appId, instanceId, label, at: now, ...roomOf(room) },
    ...s.suspended.filter((g) => !sameSlot(g, appId, room)),
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
          ...roomOf(current.room),
        },
      },
    },
  ];
}

const sameRoom = (a: SessionState, b: SessionState) => a.current?.room === b.current?.room;
const cameOnline = (before: SessionState, d: Device) =>
  before.devices.find((x) => x.deviceId === d.deviceId)?.online !== true;
const follow = (d: Device, target: FollowTarget): Outbound => ({
  to: { deviceId: d.deviceId },
  msg: { type: "follow", target },
});

/** The current game in `roleId`, in its room when it has one. */
function inGame(s: SessionState, roleId: string): FollowTarget {
  if (!s.current) return { kind: "launcher" };
  const { appId, instanceId, room } = s.current;
  return { kind: "game", appId, instanceId, roleId, ...roomOf(room) };
}

/** Where a couch phone or iPad belongs: the current game in its roster seat, else as "player". */
const followTarget = (s: SessionState, d: Device): FollowTarget =>
  inGame(s, rosterEntry(s, d.profileId)?.roleId ?? "player");

/** A tablet is told again when the sitting, its room, its seat, or its being online changed. */
function followChanged(s: SessionState, before: SessionState, d: Device): boolean {
  return (
    !sameSitting(s, before) ||
    !sameRoom(s, before) ||
    rosterEntry(before, d.profileId)?.roleId !== rosterEntry(s, d.profileId)?.roleId ||
    cameOnline(before, d)
  );
}

/**
 * When a couch device is told where to be. A phone: when the sitting or its room changes, or when
 * it comes online during a game. A kid's iPad also when its seat changes, and when it connects with
 * no game on (it is sent to the launcher).
 */
function toldAgain(s: SessionState, before: SessionState, d: Device): boolean {
  if (d.kind === "tablet") return followChanged(s, before, d);
  const moved = !sameSitting(s, before) || !sameRoom(s, before);
  return moved || (s.current !== null && cameOnline(before, d));
}

/**
 * Every couch phone and kid's iPad follows the TV (spec §3, §8): into the current game (its roster
 * seat, else "player", in the game's room once the TV names it), and back to the launcher on Home
 * and end. Never on other updates, so a device that stepped out to the remote stays there. The
 * host has its own follow.
 */
function couchFollow(s: SessionState, before: SessionState, d: Device): Outbound[] {
  if (d.kind === "launcher" || !d.online || d.deviceId === s.current?.hostDeviceId) return [];
  return toldAgain(s, before, d) ? [follow(d, followTarget(s, d))] : [];
}

function followAll(s: SessionState, before: SessionState): Outbound[] {
  return [...hostFollow(s, before), ...s.devices.flatMap((d) => couchFollow(s, before, d))];
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

/** Starting the game already on (and not naming another of its sittings or rooms) changes nothing. */
function alreadyOn(s: SessionState, msg: MessageOf<"game.start">): boolean {
  const otherSitting = msg.instanceId !== undefined && msg.instanceId !== s.current?.instanceId;
  const otherRoom = msg.room !== undefined && msg.room !== s.current?.room;
  return s.current?.appId === msg.appId && !otherSitting && !otherRoom;
}

/**
 * A room names its sitting (a couch keeps one per room); a named sitting (Rejoin from a game's
 * page) resumes that one; else Continue resumes the game's paused one.
 */
function resumable(s: SessionState, msg: MessageOf<"game.start">) {
  if (msg.room !== undefined)
    return s.suspended.find((g) => g.appId === msg.appId && g.room === msg.room);
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
    room: msg.room ?? resuming?.room,
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
    ...roomOf(sitting.room),
  };
  return {
    s: {
      ...next,
      screen: "game",
      page: null,
      focus: `game:${msg.appId}`,
      current,
      suspended: next.suspended.filter(
        (g) => g.instanceId !== sitting.instanceId && !sameSlot(g, msg.appId, sitting.room),
      ),
      rosters: { ...next.rosters, [msg.appId]: roster },
    },
  };
}

/** A follower's page asks for its own TV view too: only the host's (the room's) page counts. */
const fromFollower = (current: CurrentGame, deviceId: string | undefined) =>
  current.hostDeviceId !== null && deviceId !== undefined && deviceId !== current.hostDeviceId;

function onGameView(s: SessionState, msg: MessageOf<"game.view">): Step {
  if (s.current?.appId !== msg.appId || fromFollower(s.current, msg.deviceId)) return { s };
  return { s: { ...s, current: { ...s.current, viewUrl: msg.url } } };
}

/** The TV page named its room: the current sitting of that game is in it from now on. */
function onGameRoom(s: SessionState, msg: MessageOf<"game.room">): Step {
  if (s.current?.appId !== msg.appId || s.current.room === msg.room) return { s };
  return { s: { ...s, current: { ...s.current, room: msg.room } } };
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
  "game.room": onGameRoom,
  "game.resume-point": onResumePoint,
  "tv.rename": (s, msg) => ({ s: { ...s, tvName: msg.name } }),
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
