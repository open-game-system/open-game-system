// "Us": the household's own thread. Every couch game we have going, newest first, with where it stands.
import { COUCH, gameById, HOME, type Instance } from "../../../world";
import type { Store } from "../../../harness/store";
import { go, type S } from "../state";
import { NavBar, StatusBar } from "../ui/Chrome";
import { Patch, Quilt } from "../ui/Patch";
import { IconTv } from "../ui/Icons";
import { when } from "../ui/time";

const PILL: Record<Instance["status"], { cls: string; text: (i: Instance) => string }> = {
  active: { cls: "live", text: () => "On the TV now" },
  suspended: { cls: "", text: (i) => `Paused ${when(i.updatedAt)} · picks up here` },
  completed: { cls: "ready", text: () => "New since you played" },
  waiting: { cls: "", text: () => "Waiting" },
  lobby: { cls: "", text: () => "Getting ready" },
  expired: { cls: "", text: () => "Closed" },
};

export function UsThread({ s, store }: { s: S; store: Store<S> }) {
  const items = [...COUCH].sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : b.updatedAt.localeCompare(a.updatedAt)));
  return (
    <div className="pf-phone">
      <StatusBar />
      <NavBar onBack={() => store.update(go({ kind: "people", filter: "all" }))} avatar={<Quilt people={HOME.people} size={40} />} title="Us" sub="The Mumms · 4 people · 2 iPads" />
      <div className="pf-scroll" style={{ paddingTop: 6 }}>
        {items.map((i) => {
          const g = gameById(i.gameId);
          const pill = PILL[i.status];
          const live = i.status === "active" && s.couch.gameId === i.gameId;
          const kid = i.gameId === "story-nook" ? HOME.people.find((p) => p.id === "juneau") : undefined;
          return (
            <button key={i.id} className="pf-gcard" data-bot={`us-${g.id}`} onClick={() => live && store.update(go({ kind: "couch" }))}>
              <div style={{ position: "relative" }}>
                <img className="pf-gcard-art" src={g.art.tv} alt="" />
                {kid && (
                  <span style={{ position: "absolute", right: 12, bottom: -22 }}>
                    <Patch person={kid} size={56} />
                  </span>
                )}
              </div>
              <div className="pf-gcard-body">
                <span className="pf-gcard-name">{g.name}</span>
                <span className="pf-gcard-title">{i.title}</span>
                <span className="pf-gcard-detail">{i.detail}</span>
                <span className={`pf-status-pill ${pill.cls}`}>
                  {live && <IconTv size={15} />}
                  {pill.text(i)}
                </span>
              </div>
            </button>
          );
        })}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
