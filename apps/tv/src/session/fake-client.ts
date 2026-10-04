import {
  type ClientMessage,
  initialSession,
  reduceSession,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import type { Dir } from "../launcher/focus-grid";
import { Emitter, type SessionClient, type SessionSnapshot } from "./client";
import { FIXTURE_MEMBERS, FIXTURE_SESSION } from "./fixture";

export interface FakeClient extends SessionClient {
  connect(): void;
  drop(): void;
  restore(): void;
}

const DAY = 24 * 60 * 60 * 1000;

const [JONATHAN, MOM, JUNEAU] = FIXTURE_MEMBERS;

/**
 * The evening so far: Jonathan cast, Mom's phone and Juneau's iPad joined, Bake Shop paused at Day 4
 * (a fresh evening skips the Bake Shop sitting).
 */
function seed(now: number, fresh: boolean): SessionState {
  const played: [ClientMessage, number][] = [
    [{ type: "game.start", appId: "bake-shop", mode: "new" }, now - 3 * DAY],
    [{ type: "game.resume-point", appId: "bake-shop", label: "Day 4" }, now - 3 * DAY],
    [{ type: "home" }, now - 3 * DAY + 40 * 60 * 1000],
  ];
  const steps: [ClientMessage, number][] = [
    [
      { type: "hello", deviceId: "jonathan-phone", kind: "phone", profile: JONATHAN },
      now - 3 * DAY,
    ],
    ...(fresh ? [] : played),
    [{ type: "hello", deviceId: "mom-phone", kind: "phone", profile: MOM }, now],
    [{ type: "hello", deviceId: "juneau-ipad", kind: "tablet", profile: JUNEAU }, now],
    [{ type: "hello", deviceId: "living-room-tv", kind: "launcher" }, now],
  ];
  let s = initialSession(FIXTURE_SESSION.sessionId, FIXTURE_SESSION.host.id);
  for (const [msg, at] of steps) s = reduceSession(s, msg, at).state;
  return { ...s, focus: null, rosters: {} };
}

/**
 * An in-memory couch session running the protocol's own reducer, so tests and the design page
 * drive the launcher exactly as the Durable Object would.
 */
export function createFakeClient(
  opts: { now?: () => number; hold?: boolean; fresh?: boolean } = {},
): FakeClient {
  const now = opts.now ?? Date.now;
  const changes = new Emitter<void>();
  const moves = new Emitter<Dir>();
  let snapshot: SessionSnapshot = { state: null, connection: "connecting" };
  const publish = (next: Partial<SessionSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    changes.emit();
  };
  const client: FakeClient = {
    subscribe: (fn) => changes.on(fn),
    getSnapshot: () => snapshot,
    onFocusMove: (fn) => moves.on(fn),
    send(msg) {
      if (!snapshot.state || snapshot.connection !== "open") return;
      const { state, out } = reduceSession(snapshot.state, msg, now());
      for (const o of out) {
        if (o.to === "launcher") {
          const dir = o.msg.dir;
          queueMicrotask(() => moves.emit(dir));
        }
      }
      publish({ state });
    },
    connect: () =>
      publish({ state: snapshot.state ?? seed(now(), opts.fresh === true), connection: "open" }),
    drop: () => publish({ connection: "reconnecting" }),
    restore: () => publish({ connection: "open" }),
    close: () => {},
  };
  if (!opts.hold) client.connect();
  return client;
}
