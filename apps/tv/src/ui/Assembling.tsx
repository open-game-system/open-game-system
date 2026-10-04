import type { CouchSession } from "../session/data";
import { Couch } from "./Couch";
import { roomTitle } from "./copy";
import { JoinCode } from "./JoinCode";

/**
 * Connecting: the living room assembling (furniture first, then the boxes), never a black card.
 * Before the session state arrives only the host is known, so only the host sits down.
 */
export function Assembling({ session }: { session?: CouchSession }) {
  return (
    <div className="screen home assembling" data-testid="assembling">
      <header className="topbar">
        <h1 className="room-name">
          {session ? roomTitle(session.tvName, session.host.name) : "OGS"}
        </h1>
      </header>
      <div className="assembling-hero">
        <p className="eyebrow">Connecting</p>
        <p className="assembling-line">Setting up the living room</p>
      </div>
      <div className="assembling-shelf">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="ghost-box" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      {session ? (
        <>
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
          <JoinCode code={session.code} />
        </>
      ) : (
        <Couch members={[]} />
      )}
    </div>
  );
}
