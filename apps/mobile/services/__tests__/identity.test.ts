import { clearIdentity, loadIdentity, STICKERS, saveIdentity } from "../identity";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k: string) => data.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void data.set(k, v),
    deleteItemAsync: async (k: string) => void data.delete(k),
  };
}

const identity = {
  profile: { id: "pr1", handle: "jonathan.m", name: "Jonathan", sticker: "bear" },
  deviceId: "d1",
  deviceToken: "jwt",
};

describe("this device's profile identity", () => {
  it("is null before this device has a profile", async () => {
    expect(await loadIdentity(memory())).toBeNull();
  });

  it("round-trips through secure storage", async () => {
    const store = memory();
    await saveIdentity(store, identity);
    expect(await loadIdentity(store)).toEqual(identity);
  });

  it("can be cleared", async () => {
    const store = memory();
    await saveIdentity(store, identity);
    await clearIdentity(store);
    expect(await loadIdentity(store)).toBeNull();
  });

  it("treats a corrupt or household-era stored value as no identity", async () => {
    const store = memory();
    store.data.set("ogs.identity", "{not json");
    expect(await loadIdentity(store)).toBeNull();
    store.data.set(
      "ogs.identity",
      JSON.stringify({ householdId: "h1", deviceId: "d1", token: "t", people: [] }),
    );
    expect(await loadIdentity(store)).toBeNull();
  });
});

describe("stickers", () => {
  it("offers the Story Nook characters, bear first (the pre-picked one)", () => {
    expect(STICKERS[0]?.id).toBe("bear");
    expect(STICKERS.map((s) => s.id)).toEqual(
      expect.arrayContaining(["bear", "owl", "dragon", "dinosaur", "whale", "firefly"]),
    );
  });
});
