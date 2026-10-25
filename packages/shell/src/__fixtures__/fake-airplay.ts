import type { AirplayDisplay, DisplayInfo } from "../airplay-display";

/** The OgsAirplayDisplay module as tests drive it: connect / disconnect a display, routes, sound-only AirPlay. */
type Listener<T> = (value: T) => void;

export function fakeAirplayDisplay(
  opts: { available?: boolean; display?: DisplayInfo | null; routes?: boolean } = {},
) {
  const on = {
    connect: new Set<Listener<DisplayInfo>>(),
    disconnect: new Set<Listener<void>>(),
    audioOnly: new Set<Listener<string>>(),
    routes: new Set<Listener<boolean>>(),
  };
  const sub = <T>(set: Set<Listener<T>>, l: Listener<T>) => {
    set.add(l);
    return { remove: () => void set.delete(l) };
  };
  const calls: string[] = [];
  let current = opts.display ?? null;
  const display: AirplayDisplay = {
    available: opts.available ?? true,
    start: jest.fn(async (url: string) => void calls.push(`start ${url}`)),
    stop: jest.fn(async () => void calls.push("stop")),
    setAppName: jest.fn(async (_name: string) => {}),
    setIdleCard: jest.fn(async () => {}),
    setLogContext: jest.fn(async () => {}),
    syncPhonePages: jest.fn(async () => {}),
    currentDisplay: jest.fn(async () => current),
    detectRoutes: jest.fn(async () => opts.routes ?? false),
    onConnect: (l) => sub(on.connect, l),
    onDisconnect: (l) => sub(on.disconnect, () => l()),
    onAudioOnlyAirPlay: (l) => sub(on.audioOnly, l),
    onRoutes: (l) => sub(on.routes, l),
  };
  return {
    display,
    calls,
    connect(info: DisplayInfo = { name: "Kitchen", width: 1920, height: 1080 }) {
      current = info;
      for (const l of on.connect) l(info);
    },
    disconnect() {
      current = null;
      for (const l of on.disconnect) l();
    },
    audioOnly(name = "Kitchen") {
      for (const l of on.audioOnly) l(name);
    },
    routes(available: boolean) {
      for (const l of on.routes) l(available);
    },
    listeners: () => on.connect.size + on.disconnect.size + on.audioOnly.size + on.routes.size,
  };
}
