import { describe, expect, it } from "vitest";
import { trustJoin } from "./ogs-join";

const valid = async (token: string) => (token === "good" ? { sub: "prof-1", name: "Ana" } : null);

describe("trustJoin", () => {
  it("turns a JOIN with a valid OGS token into OGS_JOIN named by the token", async () => {
    const msg = JSON.stringify({ type: "JOIN", name: "Typed", ogsToken: "good" });
    expect(await trustJoin(msg, valid)).toEqual({ type: "OGS_JOIN", profile: { id: "prof-1", name: "Ana" } });
  });

  it("drops a bad token and keeps the typed name", async () => {
    const msg = JSON.stringify({ type: "JOIN", name: "Typed", ogsToken: "forged" });
    expect(await trustJoin(msg, valid)).toEqual({ type: "JOIN", name: "Typed" });
    const bare = JSON.stringify({ type: "JOIN", ogsToken: "forged" });
    expect(await trustJoin(bare, valid)).toEqual({ type: "JOIN" });
  });

  it("treats a verifier that throws (key set down) as a bad token", async () => {
    const msg = JSON.stringify({ type: "JOIN", ogsToken: "good" });
    expect(await trustJoin(msg, () => Promise.reject(new Error("down")))).toEqual({ type: "JOIN" });
  });

  it("leaves every other message to actor-kit", async () => {
    expect(await trustJoin(JSON.stringify({ type: "JOIN", name: "A" }), valid)).toBeNull();
    expect(await trustJoin(JSON.stringify({ type: "START" }), valid)).toBeNull();
    expect(await trustJoin("not json", valid)).toBeNull();
    const bytes = new TextEncoder().encode('{"type":"TICK"}');
    const buffer = new ArrayBuffer(bytes.length);
    new Uint8Array(buffer).set(bytes);
    expect(await trustJoin(buffer, valid)).toBeNull();
  });
});
