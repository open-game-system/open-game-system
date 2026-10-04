import type { Store } from "../../../harness/store";
import type { S } from "../state";
import { Mark } from "../ui/Brand";
import { HOME } from "../../../world";
import { Library } from "../ui/Icons";
import { Crest } from "../ui/Sticker";

export function TabBar({ s, store }: { s: S; store: Store<S> }) {
  const go = (tab: S["tab"]) => store.update((x) => ({ ...x, tab, phone: "home" }));
  const on = (t: S["tab"]) => (s.phone === "home" || s.phone === "inbox") && s.tab === t;
  return (
    <nav className="cx-tabs">
      <button className={on("home") ? "is-on" : ""} data-bot="tab-home" onClick={() => go("home")}>
        <Mark size={24} />
        Home
      </button>
      <button className={on("library") ? "is-on" : ""} data-bot="tab-library" onClick={() => go("library")}>
        <Library size={24} />
        Library
      </button>
      <button data-bot="tab-household">
        <Crest household={HOME} size={30} />
        Household
      </button>
    </nav>
  );
}
