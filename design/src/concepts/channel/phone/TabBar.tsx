import type { Store } from "../../../harness/store";
import { go, type PhoneScreen, type S } from "../state";

const TABS: { id: PhoneScreen; label: string; icon: string }[] = [
  { id: "home", label: "Tonight", icon: "tonight" },
  { id: "schedule", label: "Later", icon: "later" },
  { id: "duel-list", label: "Your turn", icon: "turn" },
];

export function TabBar({ store, active, turns }: { store: Store<S>; active: PhoneScreen; turns: number }) {
  return (
    <nav className="ch-tabs">
      {TABS.map((t) => (
        <button key={t.id} data-bot={`tab-${t.id}`} className={active === t.id ? "is-on" : ""} onClick={() => go(store, t.id)}>
          <i className={`ch-ico ch-ico-${t.icon}`} aria-hidden="true" />
          <span>{t.label}</span>
          {t.id === "duel-list" && turns > 0 && <b className="ch-badge"><span>{turns}</span></b>}
        </button>
      ))}
    </nav>
  );
}
