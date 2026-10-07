/**
 * The reference pages must match the code: a profile-kit export added, renamed or removed, or a
 * protocol field without a description, fails this suite (and so CI) until the docs catch up.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PROFILE_KIT_ENTRIES, profileKitExports } from "../src/api";
import { CONTENT_DIR } from "../src/paths";
import { allSchemaRows } from "../src/schemas";

/** `## \`entry\`` sections of the reference, each with the names of its `### \`name\`` headings. */
function documentedNames(markdown: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let entry: string | null = null;
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const section = /^## `([^`]+)`\s*$/.exec(line);
    if (section?.[1]) {
      entry = section[1];
      out.set(entry, []);
      continue;
    }
    if (/^## /.test(line)) entry = null;
    const name = /^#{3,4} `([A-Za-z_$][\w$]*)`/.exec(line);
    if (name?.[1] && entry) out.get(entry)?.push(name[1]);
  }
  return out;
}

const reference = readFileSync(resolve(CONTENT_DIR, "profile-kit.md"), "utf8");
const documented = documentedNames(reference);
const actual = profileKitExports();

describe("profile-kit reference", () => {
  it("has a section per entry point", () => {
    expect([...documented.keys()]).toEqual(PROFILE_KIT_ENTRIES.map((e) => e.entry));
  });

  it.each(
    PROFILE_KIT_ENTRIES.map((e) => [e.entry]),
  )("%s: every documented name is exported", (entry) => {
    const exported = new Set((actual.get(entry) ?? []).map((x) => x.name));
    const missing = (documented.get(entry) ?? []).filter((n) => !exported.has(n));
    expect(missing).toEqual([]);
  });

  it.each(PROFILE_KIT_ENTRIES.map((e) => [e.entry]))("%s: every export is documented", (entry) => {
    const names = new Set(documented.get(entry) ?? []);
    const undocumented = (actual.get(entry) ?? []).map((x) => x.name).filter((n) => !names.has(n));
    expect(undocumented).toEqual([]);
  });

  it("documents each name once per entry point", () => {
    for (const [entry, names] of documented) expect(names.length, entry).toBe(new Set(names).size);
  });

  it("reads exports from the source (a known value and a known type)", () => {
    const main = actual.get("@open-game-system/profile-kit") ?? [];
    expect(main).toContainEqual({ name: "onOgsPause", kind: "value" });
    expect(main).toContainEqual({ name: "OgsSession", kind: "type" });
  });
});

describe("generated protocol tables", () => {
  it("describe every field and message", () => {
    const rows = allSchemaRows();
    expect(rows.length).toBeGreaterThan(30);
    const blank = rows.filter((r) => !r.description).map((r) => r.field);
    expect(blank).toEqual([]);
  });
});
