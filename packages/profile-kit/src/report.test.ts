import { createMockBridge } from "@open-game-system/app-bridge-testing";
import { describe, expect, it } from "vitest";
import { type OgsStores, reportOgsInstance } from "./report";
import type { FrameWindow } from "./session";

const report = {
  instanceId: "rocket-crew:PQWS",
  appId: "rocket-crew",
  status: "active" as const,
  title: "Mission 6",
};
const parsed = { ...report, detail: "" };

const notFramed = (): FrameWindow => {
  const win: FrameWindow = {
    parent: null,
    postMessage: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  win.parent = win;
  return win;
};
const framed = () => {
  const posted: unknown[] = [];
  const win: FrameWindow = {
    parent: { postMessage: (m) => posted.push(m) },
    postMessage: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return { win, posted };
};

describe("reporting a sitting to OGS", () => {
  it("in the app's WebView: INSTANCE_REPORT on the ogs bridge store", () => {
    const bridge = createMockBridge<OgsStores>({ initialState: { ogs: { reported: [] } } });
    expect(reportOgsInstance(report, { bridge, win: notFramed() })).toBe("bridge");
    expect(bridge.getHistory("ogs")).toEqual([{ type: "INSTANCE_REPORT", report: parsed }]);
  });

  it("waits for the ogs store when the app hasn't sent it yet", () => {
    const bridge = createMockBridge<OgsStores>();
    expect(reportOgsInstance(report, { bridge, win: notFramed() })).toBe("bridge");
    expect(bridge.getHistory("ogs")).toEqual([]);
    bridge.setState("ogs", { reported: [] });
    bridge.setState("ogs", { reported: ["rocket-crew"] });
    expect(bridge.getHistory("ogs")).toEqual([{ type: "INSTANCE_REPORT", report: parsed }]);
  });

  it("on the TV, framed by the launcher: ogs:instance to the parent", () => {
    const f = framed();
    const bridge = createMockBridge<OgsStores>({ isSupported: false });
    expect(reportOgsInstance(report, { bridge, win: f.win })).toBe("launcher");
    expect(f.posted).toEqual([{ type: "ogs:instance", report: parsed }]);
  });

  it("in a plain browser nothing is sent", () => {
    const bridge = createMockBridge<OgsStores>({ isSupported: false });
    expect(reportOgsInstance(report, { bridge, win: notFramed() })).toBe("none");
  });

  it("an invalid report is refused before it leaves the page", () => {
    const bridge = createMockBridge<OgsStores>({ initialState: { ogs: { reported: [] } } });
    expect(() =>
      reportOgsInstance({ ...report, instanceId: "" }, { bridge, win: notFramed() }),
    ).toThrow();
    expect(bridge.getHistory("ogs")).toEqual([]);
  });
});
