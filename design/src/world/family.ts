// Households, people and devices. "Household" is forever; it's the one thing every game shares.

export type AgeBand = "grownup" | "kid" | "little";

export interface Person {
  id: string;
  name: string;
  band: AgeBand;
  age?: number;
  /** A colour the person is known by across every game (never the only signal). */
  color: string;
  /** Painted portrait or character art if one exists (Story Nook made Juneau's). */
  portrait?: string;
}

export type DeviceKind = "phone" | "ipad" | "tv" | "laptop";

export interface OwnedDevice {
  id: string;
  kind: DeviceKind;
  name: string;
  /** Paired to a person ("this iPad is Juneau's"); TVs belong to the household. */
  personId?: string;
  battery?: number;
  online: boolean;
}

export interface Household {
  id: string;
  name: string;
  city: string;
  people: Person[];
  devices: OwnedDevice[];
}

export const HOME: Household = {
  id: "hh-mumm",
  name: "The Mumms",
  city: "Portland",
  people: [
    { id: "dad", name: "Jonathan", band: "grownup", color: "#2f6fc8" },
    { id: "mom", name: "Mom", band: "grownup", color: "#c8412f" },
    { id: "juneau", name: "Juneau", band: "kid", age: 5, color: "#e08a1e", portrait: "/art/story-nook/char-dragon.webp" },
    // Fake-data name (Story Nook's test fixture); the real name is the family's to give.
    { id: "ava", name: "Ava", band: "little", age: 2, color: "#9b5fc0", portrait: "/art/story-nook/char-dinosaur.webp" },
  ],
  devices: [
    { id: "dev-dad-phone", kind: "phone", name: "Jonathan's iPhone", personId: "dad", online: true, battery: 0.71 },
    { id: "dev-mom-phone", kind: "phone", name: "Mom's iPhone", personId: "mom", online: true, battery: 0.44 },
    { id: "dev-juneau-ipad", kind: "ipad", name: "Juneau's iPad", personId: "juneau", online: true, battery: 0.82 },
    { id: "dev-ava-ipad", kind: "ipad", name: "Ava's iPad", personId: "ava", online: true, battery: 0.09 },
    { id: "dev-living-tv", kind: "tv", name: "Living room TV", online: true },
    { id: "dev-bedroom-tv", kind: "tv", name: "Bedroom TV", online: false },
  ],
};

/** The other homes in Hearthisle game night. */
export const OKAFORS: Household = {
  id: "hh-okafor",
  name: "The Okafors",
  city: "Seattle",
  people: [
    { id: "tunde", name: "Tunde", band: "grownup", color: "#1f8a5b" },
    { id: "ada", name: "Ada", band: "grownup", color: "#d14d72" },
    { id: "kemi", name: "Kemi", band: "kid", age: 8, color: "#7b6ad6" },
  ],
  devices: [
    { id: "ok-tv", kind: "tv", name: "Family room TV", online: true },
    { id: "ok-tunde", kind: "phone", name: "Tunde's phone", personId: "tunde", online: true },
    { id: "ok-kemi", kind: "ipad", name: "Kemi's iPad", personId: "kemi", online: true },
  ],
};

export const NANA: Household = {
  id: "hh-nana",
  name: "Nana & Pop",
  city: "Boise",
  people: [
    { id: "nana", name: "Nana", band: "grownup", color: "#b5623c" },
    { id: "pop", name: "Pop", band: "grownup", color: "#5a6b7d" },
  ],
  // No TV paired: Nana & Pop play on their phones.
  devices: [
    { id: "nana-phone", kind: "phone", name: "Nana's phone", personId: "nana", online: true },
    { id: "pop-phone", kind: "phone", name: "Pop's iPad", personId: "pop", online: true },
  ],
};

export const HOUSEHOLDS = [HOME, OKAFORS, NANA];

export const person = (id: string): Person => {
  for (const h of HOUSEHOLDS) {
    const p = h.people.find((x) => x.id === id);
    if (p) return p;
  }
  throw new Error(`unknown person ${id}`);
};

/** Fixed clock for shots: Friday 3 Oct 2026, 7:10 pm Pacific. */
export const NOW = new Date("2026-10-03T19:10:00-07:00");
