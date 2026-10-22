import { fakeFetch } from "../__fixtures__/fake-fetch";
import { createShellRequest } from "../api-client";
import type { ShellIdentity } from "../shell-identity";
import { createSingleGameCastStore } from "../single-cast";

jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

const identity: ShellIdentity = {
  profile: { id: "p", handle: "player", name: "Player", sticker: "owl" },
  deviceId: "d",
  deviceToken: "device-token",
  login: "guest",
};

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error("timed out");
};

function setup(body: Record<string, unknown>, onSession?: (s: unknown) => void) {
  const net = fakeFetch({ "POST /api/v1/sessions": () => ({ status: 201, body }) });
  return createSingleGameCastStore({
    appId: "rocket-crew",
    apiBase: "https://api.test",
    tvBase: "https://tv.test",
    request: createShellRequest({ baseUrl: "https://api.test", fetch: net.fetch }),
    getIdentity: () => identity,
    showPicker: () => {},
    ...(onSession ? { onSession } : {}),
  });
}

describe("single-game cast: the couch session it made (Live Activity tokens belong to it)", () => {
  it("tells onSession the session id and TV code once the launcher is ready", async () => {
    const seen: unknown[] = [];
    const store = setup({ sessionId: "s-1", code: "KQTP42", token: "launcher-token" }, (s) =>
      seen.push(s),
    );
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await until(() => seen.length > 0);
    expect(seen).toEqual([{ sessionId: "s-1", code: "KQTP42" }]);
  });

  it("a session answer without a code still names the session", async () => {
    const seen: unknown[] = [];
    const store = setup({ sessionId: "s-2", token: "launcher-token" }, (s) => seen.push(s));
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await until(() => seen.length > 0);
    expect(seen).toEqual([{ sessionId: "s-2", code: null }]);
  });

  it("without onSession nothing changes", async () => {
    const store = setup({ sessionId: "s-3", token: "launcher-token" });
    store.dispatch({ type: "SHOW_CAST_PICKER" });
    await until(() => store.getSnapshot().viewUrl !== null);
    expect(store.getSnapshot().viewUrl).toContain("token=launcher-token");
  });
});
