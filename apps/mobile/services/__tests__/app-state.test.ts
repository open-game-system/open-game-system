import type { Instance, Manifest } from "@open-game-system/ogs-protocol";
import { createAppState } from "../app-state";
import { OgsApiError } from "../ogs-api";

const manifest = (appId: string): Manifest => ({
  appId,
  name: appId,
  tagline: "",
  shape: "couch",
  tv: "optional",
  startUrl: `https://${appId}.example/`,
  tvUrl: `https://${appId}.example/tv`,
  roles: [],
  art: { tile: "/t.jpg" },
  shop: {},
  instanceTtlMs: 1000,
});

const instance = (instanceId: string, patch: Partial<Instance> = {}): Instance => ({
  instanceId,
  appId: "rocket-crew",
  householdId: "h1",
  status: "suspended",
  title: "",
  detail: "",
  updatedAt: 1,
  source: "bridge",
  ...patch,
});

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k: string) => data.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void data.set(k, v),
    deleteItemAsync: async (k: string) => void data.delete(k),
  };
}

function fakeApi() {
  return {
    createHousehold: jest.fn(async () => ({
      householdId: "h1",
      deviceId: "d1",
      token: "jwt",
      people: [{ personId: "p1", name: "Me", band: "grownup" as const, sticker: "bear" }],
    })),
    catalogue: jest.fn(async () => [manifest("rocket-crew"), manifest("night-flight")]),
    library: jest.fn(async () => ["rocket-crew"]),
    setLibrary: jest.fn(async (ids: string[]) => ids),
    fetchManifest: jest.fn(async (_url: string) => manifest("night-flight")),
    instances: jest.fn(async () => [instance("i1")]),
    reportInstance: jest.fn(async () => instance("i2", { title: "Day 4" })),
  };
}

const family = [{ name: "Me", band: "grownup" as const, sticker: "bear" }];

function setup() {
  const api = fakeApi();
  const storage = memory();
  const app = createAppState({ api, storage, deviceName: "iPhone", newDeviceId: () => "d1" });
  return { api, storage, app };
}

describe("app state: household", () => {
  it("creates the household once, stores it, and uses it", async () => {
    const { app, api, storage } = setup();
    await app.ensureHousehold("The Mumms", family);
    await app.ensureHousehold("The Mumms", family);
    expect(api.createHousehold).toHaveBeenCalledTimes(1);
    expect(app.getSnapshot().identity).toMatchObject({ householdId: "h1", deviceId: "d1" });
    expect(storage.data.get("ogs.identity")).toContain("h1");
  });

  it("keeps the family as a draft when OGS can't be reached, and retries it later", async () => {
    const { app, api } = setup();
    api.createHousehold.mockRejectedValueOnce(new OgsApiError("OFFLINE", "no", 0));
    await app.ensureHousehold("The Mumms", family);
    expect(app.getSnapshot().identity).toBeNull();
    expect(app.getSnapshot().error).toMatch(/reach OGS/);
    await app.init();
    expect(api.createHousehold).toHaveBeenCalledTimes(2);
    expect(app.getSnapshot().identity).not.toBeNull();
  });

  it("init loads a stored identity without creating anything", async () => {
    const first = setup();
    await first.app.ensureHousehold("The Mumms", family);
    const api = fakeApi();
    const app = createAppState({
      api,
      storage: first.storage,
      deviceName: "x",
      newDeviceId: () => "d2",
    });
    await app.init();
    expect(app.getSnapshot().identity?.householdId).toBe("h1");
    expect(api.createHousehold).not.toHaveBeenCalled();
  });
});

describe("app state: library, catalogue, instances", () => {
  it("refresh loads all three once there's a household", async () => {
    const { app } = setup();
    await app.ensureHousehold("H", family);
    await app.refresh();
    const s = app.getSnapshot();
    expect(s.library.map((g) => g.appId)).toEqual(["rocket-crew"]);
    expect(s.catalogue).toHaveLength(2);
    expect(s.instances).toHaveLength(1);
    expect(s.status).toBe("ready");
  });

  it("without a household only the catalogue loads", async () => {
    const { app, api } = setup();
    await app.refresh();
    expect(api.library).not.toHaveBeenCalled();
    expect(app.getSnapshot().catalogue).toHaveLength(2);
  });

  it("offline keeps what it had and says so", async () => {
    const { app, api } = setup();
    await app.ensureHousehold("H", family);
    await app.refresh();
    api.library.mockRejectedValueOnce(new OgsApiError("OFFLINE", "no", 0));
    await app.refresh();
    expect(app.getSnapshot().status).toBe("offline");
    expect(app.getSnapshot().library).toHaveLength(1);
  });

  it("adding a game appends it to the household's library", async () => {
    const { app, api } = setup();
    await app.ensureHousehold("H", family);
    await app.refresh();
    await app.addGame("night-flight");
    expect(api.setLibrary).toHaveBeenCalledWith(["rocket-crew", "night-flight"]);
    expect(app.getSnapshot().library.map((g) => g.appId)).toEqual(["rocket-crew", "night-flight"]);
  });

  it("Add by link adds a catalogue game from its manifest URL", async () => {
    const { app, api } = setup();
    await app.ensureHousehold("H", family);
    await app.refresh();
    await app.addByLink("https://nf.example/ogs.json");
    expect(api.fetchManifest).toHaveBeenCalledWith("https://nf.example/ogs.json");
    expect(app.getSnapshot().library.map((g) => g.appId)).toContain("night-flight");
  });

  it("Add by link refuses a game OGS doesn't know yet", async () => {
    const { app, api } = setup();
    await app.ensureHousehold("H", family);
    await app.refresh();
    api.fetchManifest.mockResolvedValueOnce(manifest("my-own-game"));
    await expect(app.addByLink("https://me.example/ogs.json")).rejects.toMatchObject({
      code: "NOT_IN_CATALOGUE",
    });
  });

  it("sends this phone's minted device id when creating the household", async () => {
    const { app, api } = setup();
    await app.ensureHousehold("H", family);
    expect(api.createHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ device: expect.objectContaining({ deviceId: "d1" }) }),
    );
  });

  it("a report replaces the instance with the same id", async () => {
    const { app } = setup();
    await app.ensureHousehold("H", family);
    await app.refresh();
    await app.report(
      { instanceId: "i2", appId: "rocket-crew", status: "suspended", title: "Day 4", detail: "" },
      "visit",
    );
    await app.report(
      { instanceId: "i2", appId: "rocket-crew", status: "suspended", title: "Day 4", detail: "" },
      "visit",
    );
    expect(app.getSnapshot().instances.map((i) => i.instanceId)).toEqual(["i2", "i1"]);
  });

  it("the return pill can be set and cleared", () => {
    const { app } = setup();
    app.setPill({ appId: "rocket-crew", name: "Rocket Crew", url: "https://rc/", at: 1 });
    expect(app.getSnapshot().pill?.name).toBe("Rocket Crew");
    app.setPill(null);
    expect(app.getSnapshot().pill).toBeNull();
  });

  it("notifies subscribers", async () => {
    const { app } = setup();
    const l = jest.fn();
    const off = app.subscribe(l);
    app.setPill(null);
    expect(l).toHaveBeenCalled();
    off();
  });
});
