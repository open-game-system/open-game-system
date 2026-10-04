import { DEFAULT_FAMILY, loadIdentity, STICKERS, saveIdentity } from "../identity";

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
  householdId: "h1",
  deviceId: "d1",
  token: "jwt",
  householdName: "The Mumms",
  people: [{ personId: "p1", name: "Jonathan", band: "grownup" as const, sticker: "bear" }],
};

describe("household identity on this phone", () => {
  it("is null before onboarding created a household", async () => {
    expect(await loadIdentity(memory())).toBeNull();
  });

  it("round-trips through secure storage", async () => {
    const store = memory();
    await saveIdentity(store, identity);
    expect(await loadIdentity(store)).toEqual(identity);
  });

  it("treats a corrupt stored value as no identity", async () => {
    const store = memory();
    store.data.set("ogs.identity", "{not json");
    expect(await loadIdentity(store)).toBeNull();
    store.data.set("ogs.identity", JSON.stringify({ householdId: "h1" }));
    expect(await loadIdentity(store)).toBeNull();
  });
});

describe("the family step's defaults", () => {
  it("offers a grown-up, a kid and a little one, each with a Story Nook sticker", () => {
    expect(DEFAULT_FAMILY.map((p) => p.band)).toEqual(["grownup", "kid", "little"]);
    for (const p of DEFAULT_FAMILY) expect(STICKERS.map((s) => s.id)).toContain(p.sticker);
  });
});
