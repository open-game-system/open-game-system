// Phone chrome shared by every phone screen: status bar, tab bar, a thread's nav bar.
import type { ReactNode } from "react";
import { IconBack, IconGames, IconHome, IconPeople } from "./Icons";

export function StatusBar({ dark }: { dark?: boolean }) {
  return (
    <div className="pf-status" style={dark ? { color: "#fff" } : undefined} aria-hidden="true">
      <span>7:10</span>
      <span className="pf-status-dots">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.45" /><rect x="2.5" y="2.5" width="15" height="7" rx="1.5" fill="currentColor" /><rect x="24" y="4" width="1.6" height="4" rx="0.8" fill="currentColor" opacity="0.45" /></svg>
      </span>
    </div>
  );
}

export type Tab = "people" | "games" | "household";

export function TabBar({ current, badge, onTab }: { current: Tab; badge?: number; onTab?: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "people", label: "People", icon: <IconPeople /> },
    { id: "games", label: "Games", icon: <IconGames /> },
    { id: "household", label: "Household", icon: <IconHome /> },
  ];
  return (
    <nav className="pf-tabs">
      {tabs.map((t) => (
        <button key={t.id} className="pf-tab" data-bot={`tab-${t.id}`} aria-current={t.id === current ? "page" : undefined} onClick={() => onTab?.(t.id)}>
          {t.icon}
          {t.label}
          {t.id === "people" && badge ? <span className="pf-tab-badge"><span>{badge}</span></span> : null}
        </button>
      ))}
    </nav>
  );
}

export function NavBar({ onBack, avatar, title, sub, right }: { onBack: () => void; avatar?: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="pf-nav">
      <button className="pf-iconbtn" data-bot="back" aria-label="Back" onClick={onBack}>
        <IconBack />
      </button>
      <div className="pf-nav-title">
        {avatar}
        <div style={{ minWidth: 0 }}>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
