import { createGameNotificationSettings } from "../game-notification-settings";

const handle = "ph_abcdefghijklmnop";

function fakeApi(granted: string[]) {
  const calls: string[] = [];
  return {
    calls,
    api: {
      grantedGames: async () => [...granted],
      revoke: async (appId: string) => {
        calls.push(`revoke:${appId}`);
      },
      optIn: async (appId: string) => {
        calls.push(`optIn:${appId}`);
        return { status: "granted" as const, handle };
      },
    },
  };
}
const names = (id: string) =>
  ({ codebreakers: "Codebreakers", "pocket-draft": "Pocket Draft" })[id] ?? id;

describe("Settings: notifications per game", () => {
  it("lists the games allowed, named, all on", async () => {
    const f = fakeApi(["pocket-draft", "codebreakers"]);
    const s = createGameNotificationSettings({ api: f.api, nameOf: names });
    await expect(s.load()).resolves.toEqual([
      { appId: "codebreakers", name: "Codebreakers", on: true },
      { appId: "pocket-draft", name: "Pocket Draft", on: true },
    ]);
  });

  it("turning one off revokes it and keeps it listed as off", async () => {
    const f = fakeApi(["codebreakers"]);
    const s = createGameNotificationSettings({ api: f.api, nameOf: names });
    await s.load();
    await expect(s.set("codebreakers", false)).resolves.toEqual([
      { appId: "codebreakers", name: "Codebreakers", on: false },
    ]);
    expect(f.calls).toEqual(["revoke:codebreakers"]);
  });

  it("turning it back on opts in again", async () => {
    const f = fakeApi(["codebreakers"]);
    const s = createGameNotificationSettings({ api: f.api, nameOf: names });
    await s.load();
    await s.set("codebreakers", false);
    await expect(s.set("codebreakers", true)).resolves.toEqual([
      { appId: "codebreakers", name: "Codebreakers", on: true },
    ]);
    expect(f.calls).toEqual(["revoke:codebreakers", "optIn:codebreakers"]);
  });

  it("a denied opt-in stays off", async () => {
    const f = fakeApi(["codebreakers"]);
    const s = createGameNotificationSettings({
      api: { ...f.api, optIn: async () => ({ status: "denied" as const }) },
      nameOf: names,
    });
    await s.load();
    await s.set("codebreakers", false);
    expect((await s.set("codebreakers", true))[0].on).toBe(false);
  });

  it("an unknown game changes nothing", async () => {
    const f = fakeApi([]);
    const s = createGameNotificationSettings({ api: f.api, nameOf: names });
    await s.load();
    await expect(s.set("ghost", false)).resolves.toEqual([]);
    expect(f.calls).toEqual([]);
  });
});
