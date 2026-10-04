import type { Identity } from "../../../../services/identity";
import { profileView } from "../profile-view";

const identity = (people: Identity["people"]): Identity => ({
  householdId: "h1",
  deviceId: "d1",
  token: "t",
  householdName: "Our family",
  people,
});

describe("profileView (today's household as your profile)", () => {
  it("is empty before this phone has an identity", () => {
    expect(profileView(null)).toEqual({ me: null, kids: [] });
  });

  it("is the phone's own person (the first one, the device's person) with their sticker", () => {
    const view = profileView(
      identity([
        { personId: "p1", name: "Jonathan", band: "grownup", sticker: "bear" },
        { personId: "p2", name: "Mom", band: "grownup", sticker: "owl" },
      ]),
    );
    expect(view.me).toEqual({ personId: "p1", name: "Jonathan", sticker: "bear" });
  });

  it("lists kids and littles under you, never other grown-ups", () => {
    const view = profileView(
      identity([
        { personId: "p1", name: "Jonathan", band: "grownup", sticker: "bear" },
        { personId: "p2", name: "Mom", band: "grownup", sticker: "owl" },
        { personId: "p3", name: "Juneau", band: "kid", sticker: "dragon" },
        { personId: "p4", name: "Ava", band: "little", sticker: "dinosaur" },
      ]),
    );
    expect(view.kids).toEqual([
      { personId: "p3", name: "Juneau", sticker: "dragon", band: "kid", bandLabel: "Kid" },
      { personId: "p4", name: "Ava", sticker: "dinosaur", band: "little", bandLabel: "Little" },
    ]);
  });

  it("never lists you as your own kid", () => {
    const view = profileView(
      identity([{ personId: "p1", name: "Juneau", band: "kid", sticker: "dragon" }]),
    );
    expect(view.me?.name).toBe("Juneau");
    expect(view.kids).toEqual([]);
  });

  it("has no profile when the household has nobody in it", () => {
    expect(profileView(identity([]))).toEqual({ me: null, kids: [] });
  });
});
