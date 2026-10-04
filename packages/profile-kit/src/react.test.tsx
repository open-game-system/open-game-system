import { createMockBridge } from "@open-game-system/app-bridge-testing";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProfileSource, type ProfileStores } from "./profile";
import { useOgsProfile, useOgsSession } from "./react";
import { createSessionSource, type FrameWindow } from "./session";

const juneau = {
  id: "p_juneau",
  handle: "juneau",
  name: "Juneau",
  avatar: "https://tv.opengame.org/art/story-nook/char-dragon.webp",
  token: "h.p.s",
};

function Gate({ source }: { source: ReturnType<typeof createProfileSource> }) {
  const me = useOgsProfile(source);
  if (me === undefined) return <p>Joining…</p>;
  if (me === null) return <h2>Who's playing here?</h2>;
  return <p>Joined as {me.name}</p>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useOgsProfile", () => {
  it("in the OGS app: Joining… then the profile's name, no form", () => {
    const bridge = createMockBridge<ProfileStores>({
      initialState: { profile: { status: "asking" } },
    });
    render(<Gate source={createProfileSource({ bridge })} />);
    expect(screen.getByText("Joining…")).toBeTruthy();
    act(() => bridge.setState("profile", { status: "ready", profile: juneau }));
    expect(screen.getByText("Joined as Juneau")).toBeTruthy();
    expect(screen.queryByText("Who's playing here?")).toBeNull();
  });

  it("in a plain browser: the form", () => {
    const bridge = createMockBridge<ProfileStores>({ isSupported: false });
    render(<Gate source={createProfileSource({ bridge })} />);
    expect(screen.getByText("Who's playing here?")).toBeTruthy();
  });

  it("an app that never answers: the form after 300 ms", () => {
    const bridge = createMockBridge<ProfileStores>();
    render(<Gate source={createProfileSource({ bridge })} />);
    expect(screen.getByText("Joining…")).toBeTruthy();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("Who's playing here?")).toBeTruthy();
  });

  it("the default source in jsdom (no OGS app) is null", () => {
    function Default() {
      const me = useOgsProfile();
      return <p>{me === null ? "browser" : "other"}</p>;
    }
    render(<Default />);
    expect(screen.getByText("browser")).toBeTruthy();
  });
});

describe("useOgsSession", () => {
  it("shows the players once the launcher starts the game", () => {
    const handlers = new Set<(ev: { data: unknown; source: unknown }) => void>();
    const parent = { postMessage: () => {} };
    const win: FrameWindow = {
      parent,
      postMessage: () => {},
      addEventListener: (_t, h) => handlers.add(h),
      removeEventListener: (_t, h) => handlers.delete(h),
    };
    const source = createSessionSource({ win });
    function Tv() {
      const s = useOgsSession(source);
      if (s === undefined) return <p>waiting</p>;
      if (s === null) return <p>not on OGS</p>;
      return <p>{s.players.map((p) => p.name).join(", ")}</p>;
    }
    render(<Tv />);
    expect(screen.getByText("waiting")).toBeTruthy();
    const { token: _t, ...player } = juneau;
    act(() => {
      for (const h of handlers)
        h({
          data: {
            type: "ogs:start",
            instanceId: "i",
            mode: "new",
            roster: [],
            token: "t",
            players: [player],
          },
          source: parent,
        });
    });
    expect(screen.getByText("Juneau")).toBeTruthy();
  });

  it("the default source in an unframed page is null", () => {
    function Default() {
      const s = useOgsSession();
      return <p>{s === null ? "not framed" : "framed"}</p>;
    }
    render(<Default />);
    expect(screen.getByText("not framed")).toBeTruthy();
  });
});
