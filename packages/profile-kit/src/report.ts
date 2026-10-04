import { type InstanceReport, InstanceReportSchema } from "@open-game-system/ogs-protocol";
import type { FrameWindow } from "./session";

export type { InstanceReport };

/** The app's `ogs` bridge store: the page reports its sitting, the app posts it to OGS. */
export type OgsStores = {
  ogs: {
    state: { reported: string[] };
    events: { type: "INSTANCE_REPORT"; report: InstanceReport };
  };
};

/** What reporting needs of an app bridge. */
export interface OgsBridge {
  isSupported(): boolean;
  getStore(
    key: "ogs",
  ): { dispatch(event: { type: "INSTANCE_REPORT"; report: InstanceReport }): void } | undefined;
  subscribe(listener: () => void): () => void;
}

/** What a game passes: an InstanceReport (title and detail may be left out). */
export type InstanceReportInput = (typeof InstanceReportSchema)["_input"];

/**
 * Tells OGS about this sitting (its label is `title`, e.g. "Mission 6" or "Room KQTP"), so two
 * sittings of the same game look different in the app. In the OGS app's WebView it goes through the
 * `ogs` bridge store; on the TV, framed by the launcher, as ogs:instance; elsewhere nowhere.
 */
export function reportOgsInstance(
  input: InstanceReportInput,
  deps: { bridge: OgsBridge; win: FrameWindow },
): "bridge" | "launcher" | "none" {
  const report = InstanceReportSchema.parse(input);
  const { bridge, win } = deps;
  if (bridge.isSupported()) {
    const event = { type: "INSTANCE_REPORT" as const, report };
    const store = bridge.getStore("ogs");
    if (store) store.dispatch(event);
    else {
      const off = bridge.subscribe(() => {
        const ready = bridge.getStore("ogs");
        if (!ready) return;
        off();
        ready.dispatch(event);
      });
    }
    return "bridge";
  }
  if (win.parent && win.parent !== win) {
    win.parent.postMessage({ type: "ogs:instance", report }, "*");
    return "launcher";
  }
  return "none";
}
