import { describe, expect, it } from "vitest";
import { householdOf, parseParams, wsUrl } from "./params";

const b64url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${b64url(JSON.stringify(payload))}.sig`;

describe("launcher URL", () => {
  it("parses a live launcher URL", () => {
    expect(parseParams("?api=https://api.opengame.org&token=abc")).toEqual({
      ok: true,
      params: { mode: "live", api: "https://api.opengame.org", token: "abc" },
    });
  });

  it("runs fake mode without api or token", () => {
    expect(parseParams("?fake=1")).toEqual({ ok: true, params: { mode: "fake" } });
  });

  it("rejects a missing token or a bad api", () => {
    expect(parseParams("?api=https://x.org").ok).toBe(false);
    expect(parseParams("?api=not a url&token=t").ok).toBe(false);
    expect(parseParams("").ok).toBe(false);
  });

  it("strips a trailing slash from the api base", () => {
    const r = parseParams("?api=http://localhost:8787/&token=t");
    expect(r.ok && r.params.mode === "live" && r.params.api).toBe("http://localhost:8787");
  });

  it("builds the couch socket URL from the api base", () => {
    expect(wsUrl("https://api.opengame.org", "a b")).toBe(
      "wss://api.opengame.org/api/v1/couch/ws?token=a%20b",
    );
    expect(wsUrl("http://localhost:8787", "t")).toBe("ws://localhost:8787/api/v1/couch/ws?token=t");
  });
});

describe("household from the launcher token", () => {
  it("reads the hid claim without verifying", () => {
    expect(householdOf(jwt({ hid: "h1", did: "tv", kind: "launcher", exp: 9 }))).toBe("h1");
  });

  it("handles base64url payloads", () => {
    expect(householdOf(jwt({ hid: "ü?>>", did: "d", kind: "launcher", exp: 1 }))).toBe("ü?>>");
  });

  it("returns null for garbage", () => {
    expect(householdOf("nope")).toBeNull();
    expect(householdOf("a.b.c")).toBeNull();
    expect(householdOf(jwt({ did: "x" }))).toBeNull();
  });
});
