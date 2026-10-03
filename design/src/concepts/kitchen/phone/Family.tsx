// The household: people, the devices paired to them, and what other homes ever see.
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import { PlaceCard } from "../ui/PlaceCard";
import { StatusBar } from "../ui/Bits";
import { Battery, Chevron, PhoneGlyph, Shield, TabletGlyph, TvGlyph } from "../ui/Icons";
import { THIS_PHONE, people } from "../household";
import type { S } from "../state";

export function Family({ s, store }: { s: S; store: Store<S> }) {
  return (
    <div className="pl pl-phone">
      <StatusBar time={s.clock} />
      <div className="pl-navbar">
        <button className="pl-back" data-bot="back-home" onClick={() => store.update((x) => ({ ...x, phone: "home" }))}>
          <span>
            {" "}
            <Chevron dir="left" size={18} /> Tonight
          </span>
        </button>
      </div>
      <div className="pl-scroll pl-scroll--nav">
        <h1 className="pl-h1 pl-duel-h1">The Mumms</h1>
        <p className="pl-sub pl-pad">Portland · 4 people · 6 devices</p>
        <div className="pl-couch">
          {people.map((p) => (
            <PlaceCard key={p.id} person={p} line={p.band === "grownup" ? "Grown-up" : `Age ${p.age ?? ""}`} />
          ))}
        </div>
        <section className="pl-section">
          <h2 className="pl-h2">Devices</h2>
          <ul className="pl-devices">
            {HOME.devices.map((d) => {
              const owner = people.find((p) => p.id === d.personId);
              const Glyph = d.kind === "tv" ? TvGlyph : d.kind === "ipad" ? TabletGlyph : PhoneGlyph;
              const low = d.battery !== undefined && d.battery < 0.2;
              return (
                <li key={d.id} className={d.online ? "" : "pl-off"}>
                  <Glyph size={22} />
                  <span className="pl-dev-text">
                    <b>{d.id === THIS_PHONE ? `${d.name} (this phone)` : d.name}</b>
                    <span>
                      {d.kind === "ipad" && owner
                        ? `Paired to ${owner.name} · follows the TV`
                        : d.kind === "tv"
                        ? d.online
                          ? "Casting tonight"
                          : "Off"
                        : "Grown-up · can cast and switch games"}
                    </span>
                  </span>
                  {d.battery !== undefined && (
                    <span className={`pl-dev-bat${low ? " pl-dev-bat--low" : ""}`}>
                      <Battery level={d.battery} size={22} /> {Math.round(d.battery * 100)}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="pl-trust">
          <Shield size={24} />
          <div>
            <b>What other homes see</b>
            <p>First names and painted characters. Never photos, never your address, never the kids' iPads. Only grown-ups' phones get notifications.</p>
          </div>
        </section>
        <div className="pl-firstrun-cta">
          <button className="pl-btn pl-btn--primary pl-wide" data-bot="pair-device">
            <span>Pair a device</span>
          </button>
        </div>
      </div>
    </div>
  );
}
