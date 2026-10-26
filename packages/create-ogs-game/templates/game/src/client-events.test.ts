import { describe, expect, it } from "vitest";
import { logLines } from "./client-events";

const meta = { appId: "my-game", userAgent: "Mozilla/5.0 OgsShell/my-game" };

describe("logLines", () => {
  it("writes one wide event per client event", () => {
    const lines = logLines({ events: [{ name: "tv.boot", page: "tv", room: "ABCD" }] }, meta);
    expect(lines?.map((l) => JSON.parse(l))).toEqual([
      { kind: "client_event", app: "my-game", ua: meta.userAgent, name: "tv.boot", level: "info", page: "tv", room: "ABCD" },
    ]);
  });

  it("redacts rejoin tokens and JWTs", () => {
    const jwt = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln";
    const lines = logLines(
      { events: [{ name: "phone.error", page: "phone", level: "error", message: `at /join/ABCD?t=1234-abcd&x=1 ${jwt}` }] },
      meta,
    );
    expect(lines?.[0]).toContain("t=[redacted]&x=1");
    expect(lines?.[0]).not.toContain("1234-abcd");
    expect(lines?.[0]).not.toContain(jwt);
  });

  it("refuses a body that isn't a batch of events", () => {
    expect(logLines({ events: [] }, meta)).toBeNull();
    expect(logLines({ events: [{ name: "x", page: "laptop" }] }, meta)).toBeNull();
    expect(logLines("nope", meta)).toBeNull();
  });
});
