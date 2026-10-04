import { type Manifest, readPlayItem, type SessionState } from "@open-game-system/ogs-protocol";
import type { CastDevice } from "../../../services/cast-store";

export type OnTv =
  | { kind: "home"; focus: string | null; paused: string | null }
  | { kind: "page"; name: string; game: Manifest | null }
  | { kind: "game"; name: string; game: Manifest | null; detail: string | null };

export type Holder =
  | { kind: "me"; sticker: string | null }
  | { kind: "person"; name: string; sticker: string }
  | { kind: "someone" }
  | { kind: "nobody" };

/** The remote's header: what the TV shows right now, and who holds the remote. */
export function remoteView(input: {
  state: SessionState | null;
  library: Manifest[];
  myDeviceId: string;
}): { onTv: OnTv; holder: Holder } {
  const { state, library, myDeviceId } = input;
  const find = (appId: string) => library.find((g) => g.appId === appId) ?? null;
  return { onTv: onTvOf(state, find), holder: holderOf(state, myDeviceId) };
}

function onTvOf(state: SessionState | null, find: (appId: string) => Manifest | null): OnTv {
  if (state?.screen === "game-page" && state.page) {
    const game = find(state.page);
    return { kind: "page", name: game?.name ?? state.page, game };
  }
  if (state?.screen === "game" && state.current) {
    const game = find(state.current.appId);
    return {
      kind: "game",
      name: game?.name ?? state.current.appId,
      game,
      detail: state.current.label || null,
    };
  }
  const nameOf = (appId: string) => find(appId)?.name ?? appId;
  const focus = state?.focus ?? null;
  // A game's icon, or a card that starts a game at once (a sitting, Surprise me's pick).
  const focused = focus?.startsWith("game:")
    ? focus.slice(5)
    : (readPlayItem(focus)?.appId ?? null);
  const last = state?.suspended.reduce<SessionState["suspended"][number] | null>(
    (a, b) => (a && a.at >= b.at ? a : b),
    null,
  );
  return {
    kind: "home",
    focus: focused ? nameOf(focused) : null,
    paused: last ? nameOf(last.appId) : null,
  };
}

/** Who holds the remote: the profile on that device, from the couch's members. */
function holderOf(state: SessionState | null, me: string): Holder {
  const remote = state?.remote;
  if (!remote) return { kind: "nobody" };
  const profileId = state.devices.find((d) => d.deviceId === remote)?.profileId;
  const person = state.members.find((m) => m.profileId === profileId);
  if (remote === me) return { kind: "me", sticker: person?.sticker ?? null };
  return person
    ? { kind: "person", name: person.name, sticker: person.sticker }
    : { kind: "someone" };
}

/** The TV picker's rows: the TV being cast to first (even if discovery hasn't re-found it), then the rest. */
export function pickerDevices(
  found: CastDevice[],
  current: { id: string; name: string } | null,
): CastDevice[] {
  if (!current) return found;
  const self = found.find((d) => d.id === current.id) ?? {
    id: current.id,
    name: current.name,
    type: "chromecast" as const,
  };
  return [self, ...found.filter((d) => d.id !== current.id)];
}

/** The line under the name of what's on the TV: what OK will do, or where you are. */
export function nowLine(onTv: OnTv): string {
  switch (onTv.kind) {
    case "home":
      if (onTv.focus && onTv.focus === onTv.paused) return `OK continues ${onTv.focus}`;
      if (onTv.focus) return `OK opens ${onTv.focus}`;
      if (onTv.paused) return `${onTv.paused} is paused`;
      return "Pick a game with the arrows";
    case "page":
      return "Press OK to play";
    case "game":
      return onTv.detail ?? "Playing now";
  }
}

export interface CastControls {
  role: "host" | "member";
  tvName: string;
  /** Only the caster moves the cast to another TV. */
  changeTv: boolean;
  /** The remote's end control and its confirm sheet. */
  end: { label: string; title: string; body: string; confirm: string; keep: string };
}

/**
 * The caster stops casting (with a confirm); a phone that joined someone else's cast (a friend's
 * Join, the TV's code) only leaves that couch: "Leave Mom's TV", and no Change TV.
 */
export function castControls(input: {
  session: { role: "host" | "member"; tvName: string; host: { name: string } } | null;
  castDeviceName: string | null;
  gameName: string | null;
}): CastControls {
  const { session, castDeviceName, gameName } = input;
  if (session?.role === "member") {
    const host = session.host.name;
    return {
      role: "member",
      tvName: session.tvName,
      changeTv: false,
      end: {
        label: `Leave ${host}'s TV`,
        title: `Leave ${host}'s TV?`,
        body: `The TV keeps playing for everyone on ${host}'s couch. To come back, type the code on the TV.`,
        confirm: "Leave",
        keep: "Stay",
      },
    };
  }
  const tvName = castDeviceName ?? session?.tvName ?? "the TV";
  return {
    role: "host",
    tvName,
    changeTv: true,
    end: {
      label: "Stop casting",
      title: "Stop casting?",
      body: `${tvName} goes back to its own screen. ${
        gameName
          ? `${gameName} keeps its place: cast again to pick it back up.`
          : "Cast again any time from this tab."
      }`,
      confirm: "Stop casting",
      keep: "Keep casting",
    },
  };
}
