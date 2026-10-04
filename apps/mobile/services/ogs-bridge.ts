import { createStore } from "@open-game-system/app-bridge-native";
import type { State, Store } from "@open-game-system/app-bridge-types";
import { type InstanceReport, OgsBridgeEventSchema } from "@open-game-system/ogs-protocol";
import type { InstanceSource } from "./ogs-api";

/** What the page sees: which games on this screen have reported themselves. */
export interface OgsBridgeState extends State {
  reported: string[];
}

/** Events arrive as whatever JSON the page sent; they're parsed here (OgsBridgeEventSchema). */
export type UntrustedEvent = { type: string } & Record<string, unknown>;

export type OgsStores = {
  ogs: { state: OgsBridgeState; events: UntrustedEvent };
};

type Internal = { type: "REPORTED"; appId: string };

/**
 * The `ogs` app-bridge store: a game page in the app's WebView calls INSTANCE_REPORT
 * (ogs.instance({ id, status, title, detail })) and the app posts it to OGS with source "bridge".
 */
export function createOgsBridgeStore(
  post: (report: InstanceReport, source: InstanceSource) => Promise<unknown>,
): Store<OgsBridgeState, UntrustedEvent> {
  const inner = createStore<OgsBridgeState, Internal>({
    initialState: { reported: [] },
    producer: (draft, event) => {
      if (!draft.reported.includes(event.appId)) draft.reported.push(event.appId);
    },
  });
  return {
    getSnapshot: () => inner.getSnapshot(),
    subscribe: (listener) => inner.subscribe(listener),
    reset: () => inner.reset(),
    on: () => () => {},
    dispatch(event) {
      const parsed = OgsBridgeEventSchema.safeParse(event);
      if (!parsed.success) return;
      const { report } = parsed.data;
      inner.dispatch({ type: "REPORTED", appId: report.appId });
      post(report, "bridge").catch((err: unknown) => {
        console.warn("[ogs] could not post the game's instance report:", err);
      });
    },
  };
}
