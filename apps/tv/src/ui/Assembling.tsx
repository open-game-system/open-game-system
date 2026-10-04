import type { HomeModel } from "../launcher/home";
import type { CouchSession } from "../session/data";
import { safeStyle } from "./art";
import { Couch } from "./Couch";
import { roomTitle } from "./copy";
import { JoinCode } from "./JoinCode";

/**
 * Connecting: the living room warming up in place. The first game's room glows in behind, the
 * game icons arrive one by one where home will show them, and warm glass holds the cards' places;
 * never a black card or grey skeleton. Before the session state arrives only the host is known.
 */
export function Assembling({ session, home }: { session?: CouchSession; home?: HomeModel }) {
  const room = home?.icons[0]?.room;
  return (
    <div className="screen home assembling" data-testid="assembling">
      <div className="room assembling-room">
        {room && <img className="room-art" src={room.src} alt="" style={safeStyle(room.safe)} />}
        <div className="assembling-glow" />
        <div className="room-scrim" />
      </div>
      <header className="topbar">
        <h1 className="room-name">
          {session ? roomTitle(session.tvName, session.host.name) : "OGS"}
        </h1>
      </header>
      <div className="icon-row assembling-icons">
        {(home?.icons ?? []).map((icon, i) => (
          <div key={icon.appId} className="game-icon">
            <div
              className="game-icon-art arriving"
              style={{ animationDelay: `${200 + i * 140}ms` }}
            >
              <img src={icon.icon.src} alt="" style={safeStyle(icon.icon.safe)} />
            </div>
          </div>
        ))}
      </div>
      <div className="spotlight assembling-hero">
        <p className="eyebrow">
          <span className="pulse" />
          Connecting
        </p>
        <p className="assembling-line">Setting up the living room</p>
      </div>
      <div className="cards assembling-cards">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card">
            <div className="card-art glass" style={{ animationDelay: `${700 + i * 160}ms` }} />
          </div>
        ))}
      </div>
      {session && (
        <>
          <aside className="people">
            <Couch
              arriving
              members={[
                {
                  profileId: session.host.id,
                  name: session.host.name,
                  sticker: session.host.sticker,
                },
              ]}
            />
          </aside>
          <JoinCode code={session.code} />
        </>
      )}
    </div>
  );
}
