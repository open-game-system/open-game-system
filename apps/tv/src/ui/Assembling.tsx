import type { CouchSession } from "../session/data";
import { Couch } from "./Couch";
import { roomTitle } from "./copy";
import { JoinCode } from "./JoinCode";

/**
 * Connecting: the home assembling in place (the icon row and cards as shimmering outlines), never a
 * black card. Before the session state arrives only the host is known, so only the host sits down.
 */
export function Assembling({ session }: { session?: CouchSession }) {
  return (
    <div className="screen home assembling" data-testid="assembling">
      <header className="topbar">
        <h1 className="room-name">
          {session ? roomTitle(session.tvName, session.host.name) : "OGS"}
        </h1>
      </header>
      <div className="assembling-icons">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="ghost-icon" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      <div className="assembling-hero">
        <p className="eyebrow">Connecting</p>
        <p className="assembling-line">Setting up the living room</p>
      </div>
      <div className="assembling-cards">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ghost-card" style={{ animationDelay: `${300 + i * 120}ms` }} />
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
