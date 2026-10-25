import { describe, expect, it } from "vitest";
import { receiverView } from "./view-url";

const RX = "https://feat-cast-local-render.ogs-tv.pages.dev";
const LAUNCHER = "https://ogs-tv.pages.dev/?api=https%3A%2F%2Fapi.example&token=abc.def.ghi";

describe("what the receiver frames for a LOAD_VIEW", () => {
  it("an OGS launcher URL is served from the receiver's own site, with the TV's tier", () => {
    const v = receiverView(LAUNCHER, RX, "lite");
    expect(v).toEqual({
      url: `${RX}/?api=https%3A%2F%2Fapi.example&token=abc.def.ghi&tier=lite`,
      launcher: true,
      host: "ogs-tv.pages.dev",
      api: "https://api.example",
    });
  });

  it("the launcher at /index.html is the launcher too", () => {
    expect(
      receiverView("https://ogs-tv.pages.dev/index.html?api=https://a.b&token=t", RX, "lite")
        ?.launcher,
    ).toBe(true);
  });

  it("keeps a white-label cast's chrome=none and app", () => {
    const v = receiverView(`${LAUNCHER}&chrome=none&app=crak-and-bam`, RX, "full");
    expect(new URL(v?.url ?? "").searchParams.get("chrome")).toBe("none");
    expect(new URL(v?.url ?? "").searchParams.get("app")).toBe("crak-and-bam");
    expect(new URL(v?.url ?? "").searchParams.get("tier")).toBe("full");
  });

  it("replaces a tier the sender put in the URL with the one this TV measured", () => {
    const v = receiverView(`${LAUNCHER}&tier=full`, RX, "minimal");
    expect(new URL(v?.url ?? "").searchParams.getAll("tier")).toEqual(["minimal"]);
  });

  it("a dev phone's launcher (localhost) is served from the receiver too: the TV can't reach the laptop", () => {
    const v = receiverView(
      "http://localhost:5180/?api=http%3A%2F%2F192.168.1.4%3A8787&token=t",
      RX,
      "lite",
    );
    expect(v?.url.startsWith(`${RX}/?`)).toBe(true);
    expect(v?.api).toBe("http://192.168.1.4:8787");
  });

  it("any other page (a game's own TV URL) is framed as it is, never rewritten", () => {
    const game = "https://rocket-crew.example/tv?room=KITE&token=x";
    expect(receiverView(game, RX, "lite")).toEqual({
      url: game,
      launcher: false,
      host: "rocket-crew.example",
      api: null,
    });
  });

  it("the launcher's fake couch (fake=1, design and tests) is the launcher too, with no API", () => {
    expect(receiverView("https://ogs-tv.pages.dev/?fake=1&hold=1", RX, "lite")).toEqual({
      url: `${RX}/?fake=1&hold=1&tier=lite`,
      launcher: true,
      host: "ogs-tv.pages.dev",
      api: null,
    });
  });

  it("a page at / without both api and token isn't the launcher", () => {
    expect(receiverView("https://ogs-tv.pages.dev/?token=t", RX, "lite")?.launcher).toBe(false);
    expect(receiverView("https://ogs-tv.pages.dev/game?fake=1", RX, "lite")?.launcher).toBe(false);
    expect(receiverView("https://ogs-tv.pages.dev/?api=https://a.b", RX, "lite")?.launcher).toBe(
      false,
    );
  });

  it("refuses what isn't an http(s) URL", () => {
    expect(receiverView("javascript:alert(1)", RX, "full")).toBeNull();
    expect(receiverView("not a url", RX, "full")).toBeNull();
    expect(receiverView("", RX, "full")).toBeNull();
  });

  it("an api that isn't a URL leaves the log's api unknown", () => {
    expect(receiverView("https://ogs-tv.pages.dev/?api=nope&token=t", RX, "full")?.api).toBeNull();
  });
});
