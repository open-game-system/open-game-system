// The Household tab: who we are and what each device is. Set once; every game reads it.
import { HOME } from "../../../world";
import type { Store } from "../../../harness/store";
import type { S } from "../state";
import { StatusBar, TabBar } from "../ui/Chrome";
import { Patch } from "../ui/Patch";
import { IconBattery, IconPhone, IconTablet, IconTv } from "../ui/Icons";
import { tabTo } from "./PeopleHome";

const BAND = { grownup: "Grown-up · gets your-move pings", kid: "Kid · no words on his iPad", little: "Little · no words, nothing to break" };

export function Household({ s, store }: { s: S; store: Store<S> }) {
  const mine = s.duels.filter((d) => d.status === "yourTurn").length;
  return (
    <div className="pf-phone">
      <StatusBar />
      <div className="pf-largetitle">
        <h1>The Mumms</h1>
      </div>
      <p className="pf-lede">Portland · other homes see only this name.</p>
      <div className="pf-scroll">
        <div className="pf-section">People</div>
        {HOME.people.map((p) => (
          <div key={p.id} className="pf-row">
            <Patch person={p} size={46} />
            <span className="pf-row-main">
              <span className="pf-name">{p.name}</span>
              <span className="pf-row-line">{BAND[p.band]}</span>
            </span>
          </div>
        ))}
        <div className="pf-section">Devices</div>
        {HOME.devices.map((d) => (
          <div key={d.id} className="pf-row">
            <span className="pf-round">{d.kind === "tv" ? <IconTv /> : d.kind === "ipad" ? <IconTablet /> : <IconPhone />}</span>
            <span className="pf-row-main">
              <span className="pf-name" style={{ fontSize: 17 }}>{d.name}</span>
              <span className="pf-row-line">
                {d.kind === "ipad" ? "Follows tonight's game by itself" : d.kind === "tv" ? (d.online ? "Ready to cast" : "Off") : "Grown-up phone"}
                {d.battery !== undefined && d.battery < 0.2 ? " · 9% battery" : ""}
              </span>
            </span>
            {d.battery !== undefined && <span style={{ color: d.battery < 0.2 ? "var(--move)" : "var(--ink-3)" }}><IconBattery level={d.battery} /></span>}
          </div>
        ))}
        <div style={{ height: 20 }} />
      </div>
      <TabBar current="household" badge={mine} onTab={(t) => tabTo(store, t)} />
    </div>
  );
}
