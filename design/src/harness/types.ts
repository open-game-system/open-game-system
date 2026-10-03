import { createElement, type ComponentType } from "react";
import { createStore, type Store } from "./store";

export type Device = "phone" | "ipad" | "tv";
export const DEVICES: Device[] = ["phone", "ipad", "tv"];
export const DEVICE_SIZE: Record<Device, { w: number; h: number; label: string }> = {
  phone: { w: 390, h: 844, label: "Grown-up phone" },
  ipad: { w: 820, h: 1180, label: "Kid iPad" },
  tv: { w: 1920, h: 1080, label: "TV (cast stream)" },
};

/** The coverage matrix's flows (brief §4). */
export type FlowId =
  | "first-run"
  | "tonight"
  | "swap"
  | "continue"
  | "game-night"
  | "word-duel"
  | "world-clock"
  | "add-game"
  | "failure"
  | "home";

export type StateKind = "default" | "empty" | "loading" | "partial" | "success" | "error" | "interrupted" | "undone";

export interface Scenario<S> {
  /** Stable id, "<flow>.<NN>-<slug>", e.g. "swap.03-tv-cutover". Becomes the shot name. */
  id: string;
  label: string;
  flow: FlowId;
  state: StateKind;
  /** Devices that take part in this moment (each is shot). */
  devices: Device[];
  build: () => S;
}

/** One bot step: a tap on an element carrying data-bot="<bot>" inside the device. */
export interface FlowStep {
  device: Device;
  bot: string;
  /** Caption shown in the recording and written to marks.json. */
  mark?: string;
  /** Wait after the tap (ms, default 1400) so the transition is visible. */
  wait?: number;
}

export interface Flow {
  id: string;
  flow: FlowId;
  label: string;
  /** Scenario the stage starts from. */
  start: string;
  steps: FlowStep[];
}

export interface SurfaceProps<S> {
  device: Device;
  store: Store<S>;
  /** True in shot mode: freeze motion, fixed clock. */
  shot: boolean;
}

export interface Concept<S> {
  id: string;
  name: string;
  brief: string;
  scenarios: Scenario<S>[];
  flows: Flow[];
  Surface: ComponentType<SurfaceProps<S>>;
  /** Optional global CSS (fonts, tokens) the concept injects once. */
  css?: string;
}

export type ScenarioMeta = Omit<Scenario<unknown>, "build">;

/** A concept with its state type closed over, so the registry can hold every concept. */
export interface RegisteredConcept {
  id: string;
  name: string;
  brief: string;
  css?: string;
  scenarios: ScenarioMeta[];
  flows: Flow[];
  /** A fresh session (one store shared by every device) starting at a scenario. */
  session(scenarioId: string): ComponentType<{ device: Device; shot: boolean }> | undefined;
}

export function defineConcept<S>(c: Concept<S>): RegisteredConcept {
  const { Surface } = c;
  return {
    id: c.id,
    name: c.name,
    brief: c.brief,
    css: c.css,
    scenarios: c.scenarios.map(({ build: _build, ...meta }) => meta),
    flows: c.flows,
    session(scenarioId) {
      const sc = c.scenarios.find((x) => x.id === scenarioId);
      if (!sc) return undefined;
      const store = createStore(sc.build());
      return function Bound({ device, shot }: { device: Device; shot: boolean }) {
        return createElement(Surface, { device, store, shot });
      };
    },
  };
}
