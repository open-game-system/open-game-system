// Which developer page a scenario opens on. The session state (S) is the console's and has no dev
// field, so the page rides alongside the built state object, keyed by identity.
import { base, type S } from "../state";

export type DocsPage = "overview" | "manifest" | "identity" | "instances" | "casting" | "kids" | "library";
export type ConsolePage = "console-empty" | "console-error" | "console-preview" | "console-live";
export type DevPage = DocsPage | ConsolePage;

const pageOf = new WeakMap<S, DevPage>();

export function devState(page: DevPage): S {
  const s = base();
  pageOf.set(s, page);
  return s;
}

export const initialPage = (s: S): DevPage => pageOf.get(s) ?? "overview";

export const isConsole = (p: DevPage): p is ConsolePage => p.startsWith("console");

export interface NavItem {
  page: DevPage;
  label: string;
  tier?: 0 | 1 | 2;
}

export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Start", items: [{ page: "overview", label: "Overview" }] },
  {
    group: "Tiers",
    items: [
      { page: "manifest", label: "Plays on the TV", tier: 0 },
      { page: "identity", label: "Keeps your place", tier: 1 },
      { page: "instances", label: "Live on Home", tier: 2 },
    ],
  },
  {
    group: "Guides",
    items: [
      { page: "casting", label: "The TV page" },
      { page: "kids", label: "Kid devices" },
      { page: "library", label: "Tiers in the library" },
    ],
  },
];
