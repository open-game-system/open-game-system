// The family's own screen while the TV is cast but between games: who's home, what's pinned
// on the noticeboard, what's next. Readable from the couch; nothing to press.
import { COUCH, HEARTHISLE, gameById } from "../../../world";
import { people } from "../household";
import { PlaceCard } from "../ui/PlaceCard";
import { Wordmark } from "../ui/Bits";
import { Pin } from "../ui/Icons";

export function Ambient({ clock }: { clock: string }) {
  const rc = gameById("rocket-crew");
  const hi = gameById(HEARTHISLE.gameId);
  const ready = COUCH.find((i) => i.status === "completed" && i.title.includes("ready"));
  const juneau = people.find((p) => p.id === "juneau");
  return (
    <div className="pl-tv pl-tv--ambient">
      <div className="pl-amb-glow" />
      <header className="pl-amb-head">
        <Wordmark size="tv" />
        <span className="pl-amb-clock">{clock} pm</span>
      </header>
      <h1 className="pl-amb-title">Friday night at the Mumms'</h1>
      <div className="pl-amb-couch">
        {people.map((p, i) => (
          <PlaceCard key={p.id} person={p} size="tv" line={p.band === "grownup" ? "Phone" : "iPad"} delay={i * 120} />
        ))}
      </div>
      {ready && juneau?.portrait && (
        <div className="pl-amb-note">
          <Pin className="pl-amb-pin" size={34} />
          <img src={juneau.portrait} alt="" />
          <div>
            <span className="pl-amb-note-game">{gameById(ready.gameId).name}</span>
            <b>Ember is ready</b>
            <span>Juneau's dragon finished painting</span>
          </div>
        </div>
      )}
      <div className="pl-amb-next">
        <div className="pl-amb-frame">
          <img src={rc.art.tv} alt="" />
          <div>
            <b>{rc.name}</b>
            <span>Mission 6 is waiting</span>
          </div>
        </div>
        <div className="pl-amb-frame">
          <img src={hi.art.tv} alt="" />
          <div>
            <b>{hi.name} at 8</b>
            <span>With the Okafors and Nana & Pop</span>
          </div>
        </div>
      </div>
    </div>
  );
}
