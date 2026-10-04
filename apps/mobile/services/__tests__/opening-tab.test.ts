import { initialSession, type SessionState } from "@open-game-system/ogs-protocol";
import { decideOpeningTab, openingTab } from "../opening-tab";

const live = (patch: Partial<NonNullable<SessionState["current"]>> = {}): SessionState => ({
  ...initialSession("s1", "pr1"),
  cast: true,
  screen: "game",
  current: {
    appId: "rocket-crew",
    instanceId: "rc-1",
    mode: "continue",
    roster: [],
    label: "",
    startedAt: 1,
    viewUrl: null,
    hostDeviceId: "phone-1",
    ...patch,
  },
});

describe("opening tab on a cold start", () => {
  it("opens Playing when this phone hosts the live game", () => {
    expect(openingTab(live(), "phone-1")).toBe("playing");
  });

  it("opens Playing when this phone is in the live game's roster", () => {
    const s = live({
      hostDeviceId: "phone-2",
      roster: [{ profileId: "p", roleId: "fixer", deviceId: "phone-1" }],
    });
    expect(openingTab(s, "phone-1")).toBe("playing");
  });

  it("opens Library when the live game belongs to another device", () => {
    expect(openingTab(live({ hostDeviceId: "phone-2" }), "phone-1")).toBe("library");
  });

  it("opens Library when nothing is live, or with no session at all", () => {
    expect(openingTab(initialSession("s1", "pr1"), "phone-1")).toBe("library");
    expect(openingTab(null, "phone-1")).toBe("library");
  });
});

describe("waiting briefly for the session before choosing", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function source(initial: SessionState | null) {
    let state = initial;
    const listeners = new Set<() => void>();
    return {
      getSnapshot: () => ({ state }),
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      push(next: SessionState) {
        state = next;
        for (const l of listeners) l();
      },
      listeners,
    };
  }

  it("decides at once when the state is already known", async () => {
    await expect(decideOpeningTab(source(live()), "phone-1", 1500)).resolves.toBe("playing");
  });

  it("decides when the first state arrives", async () => {
    const s = source(null);
    const p = decideOpeningTab(s, "phone-1", 1500);
    s.push(live());
    await expect(p).resolves.toBe("playing");
    expect(s.listeners.size).toBe(0);
  });

  it("falls back to Library when the session stays silent", async () => {
    const s = source(null);
    const p = decideOpeningTab(s, "phone-1", 1500);
    jest.advanceTimersByTime(1500);
    await expect(p).resolves.toBe("library");
    expect(s.listeners.size).toBe(0);
  });
});

describe("opening tab edges", () => {
  it("someone else's roster seat isn't this phone's", () => {
    const s = live({
      hostDeviceId: "phone-2",
      roster: [{ profileId: "p", roleId: "fixer", deviceId: "phone-3" }],
    });
    expect(openingTab(s, "phone-1")).toBe("library");
  });

  it("keeps waiting through a change that brings no state yet", async () => {
    jest.useFakeTimers();
    let state: SessionState | null = null;
    const listeners = new Set<() => void>();
    const src = {
      getSnapshot: () => ({ state }),
      subscribe: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    };
    const p = decideOpeningTab(src, "phone-1", 1500);
    for (const l of listeners) l();
    state = live();
    for (const l of listeners) l();
    await expect(p).resolves.toBe("playing");
    jest.useRealTimers();
  });
});
