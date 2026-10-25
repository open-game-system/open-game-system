import { describe, expect, it } from "vitest";
import { answersFrom, parseArgs, slugify } from "./options";

const ok = (argv: string[]) => {
  const parsed = parseArgs(argv);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.args;
};

describe("slugify", () => {
  it("makes an OGS app id from a game's name", () => {
    expect(slugify("Kite Count")).toBe("kite-count");
    expect(slugify("  Crak & Bam!! ")).toBe("crak-bam");
    expect(slugify("Été Fête 2")).toBe("ete-fete-2");
  });
});

describe("parseArgs", () => {
  it("reads the directory and every flag", () => {
    expect(
      ok([
        "kite",
        "--name",
        "Kite Count",
        "--app-id",
        "kites",
        "--bundle-id",
        "tv.kites.app",
        "--team-id",
        "34S957HD77",
        "--yes",
      ]),
    ).toEqual({
      dir: "kite",
      name: "Kite Count",
      appId: "kites",
      bundleId: "tv.kites.app",
      teamId: "34S957HD77",
      yes: true,
      help: false,
    });
  });

  it("refuses two directories and unknown flags", () => {
    expect(parseArgs(["a", "b"]).ok).toBe(false);
    expect(parseArgs(["--nope"]).ok).toBe(false);
  });

  it("knows --help", () => {
    expect(ok(["--help"]).help).toBe(true);
  });
});

describe("answersFrom", () => {
  it("derives the directory, app id and bundle id from the name", () => {
    const r = answersFrom({ name: "Kite Count", yes: true, help: false });
    expect(r).toEqual({
      ok: true,
      answers: {
        dir: "kite-count",
        name: "Kite Count",
        appId: "kite-count",
        bundleId: "tv.kitecount.app",
        teamId: "",
      },
    });
  });

  it("takes a directory name as the game's name when no name is given", () => {
    const r = answersFrom({ dir: "kite-count", yes: true, help: false });
    expect(r.ok && r.answers.name).toBe("Kite Count");
  });

  it("names each bad field", () => {
    const r = answersFrom({
      name: "X",
      appId: "Bad Id",
      bundleId: "nodots",
      teamId: "short",
      yes: true,
      help: false,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("appId");
    expect(r.error).toContain("bundleId");
    expect(r.error).toContain("teamId");
  });

  it("refuses a template-sounding name (App Store guideline 4.3: no reskinned templates)", () => {
    for (const name of ["My Game", "OGS Game", "Party Game", "game"]) {
      const r = answersFrom({ name, yes: true, help: false });
      expect(r.ok).toBe(false);
    }
  });

  it("needs a name or a directory", () => {
    expect(answersFrom({ yes: true, help: false }).ok).toBe(false);
  });

  it("caps the name at the App Store's 30 characters", () => {
    expect(answersFrom({ name: "A".repeat(31), yes: true, help: false }).ok).toBe(false);
  });
});
