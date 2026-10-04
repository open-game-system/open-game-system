import { describe, expect, it } from "vitest";
import { cardChip, cardResume, SPOT_TAGLINE_FITS, spotLine } from "./facts";

const bake = { tag: "Paused just now", resume: "Day 4", tagline: "Bake what the bears order" };
const long = "Animal customers, picture orders, a sprinkle of chaos.";

describe("spotLine: the spotlight says the focused game's status, resume point and tagline once", () => {
  it("a sitting: status chip, resume point, then the tagline when it fits", () => {
    expect(spotLine(bake, "icons")).toEqual(bake);
  });

  it("drops a tagline too long for one line beside the logo, never truncating it", () => {
    expect(long.length).toBeGreaterThan(SPOT_TAGLINE_FITS);
    expect(spotLine({ ...bake, tagline: long }, "icons")).toEqual({ ...bake, tagline: "" });
    const fits = "x".repeat(SPOT_TAGLINE_FITS);
    expect(spotLine({ ...bake, tagline: fits }, "icons").tagline).toBe(fits);
    expect(spotLine({ ...bake, tagline: `${fits}x` }, "icons").tagline).toBe("");
  });

  it("in the cards the grown card needs the room: no tagline there", () => {
    expect(spotLine(bake, "cards")).toEqual({ ...bake, tagline: "" });
  });

  it("never repeats a word: a resume point saying the status's word again is dropped", () => {
    const s = {
      tag: "Played yesterday",
      resume: "Started yesterday",
      tagline: "Settle the island",
    };
    expect(spotLine(s, "icons")).toEqual({ ...s, resume: "" });
    expect(spotLine({ ...s, resume: "Started YESTERDAY" }, "icons").resume).toBe("");
  });

  it("nor a tagline saying the resume point or the status again", () => {
    expect(spotLine({ ...bake, tagline: "Day 4" }, "icons").tagline).toBe("");
    expect(
      spotLine({ ...bake, resume: "Bake day", tagline: "Bake what the bears order" }, "icons"),
    ).toEqual({ ...bake, resume: "Bake day", tagline: "" });
    expect(spotLine({ ...bake, tagline: "Paused bears" }, "icons").tagline).toBe("");
  });

  it("short words (the, a, of) don't count as repeats", () => {
    const s = {
      tag: "Paused at 7:02",
      resume: "Room of the bears",
      tagline: "Fly the rocket at night",
    };
    expect(spotLine(s, "icons")).toEqual(s);
  });

  it("a game not started yet: its tagline is its whole line, however long", () => {
    expect(spotLine({ tag: "", resume: "Find who is hiding", tagline: long }, "icons")).toEqual({
      tag: "",
      resume: "",
      tagline: long,
    });
  });
});

describe("cardChip: a sitting card's chip only when it adds something", () => {
  const card = { appId: "bake-shop", chip: "Just now" };
  it("the spotlit game's card leaves its status to the spotlight", () => {
    expect(cardChip(card, "bake-shop")).toBe("");
  });
  it("every other card shows when, short", () => {
    expect(cardChip(card, "rocket-crew")).toBe("Just now");
    expect(cardChip(card, null)).toBe("Just now");
  });
});

describe("cardResume: a sitting card's name, unless the spotlight just said it", () => {
  const card = { appId: "bake-shop", resume: "Day 4" };
  it("the spotlit game's card leaves its resume point to the spotlight", () => {
    expect(cardResume(card, "bake-shop", "Day 4")).toBe("");
  });
  it("keeps it when the spotlight didn't say it (dropped as a repeat of the status)", () => {
    expect(cardResume(card, "bake-shop", "")).toBe("Day 4");
  });
  it("every other card keeps its sitting name", () => {
    expect(cardResume(card, "rocket-crew", "Mission 6")).toBe("Day 4");
    expect(cardResume(card, null, "")).toBe("Day 4");
    expect(cardResume(card, "rocket-crew", "Day 4")).toBe("Day 4");
  });
});
