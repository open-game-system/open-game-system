// The other things the TV shows inside the one cast: a box opened (detail + who's playing), game
// night's table, a Word Duel note taken down, a running game, and the moments around the cast.
import { DUELS, HEARTHISLE, HOUSEHOLDS, gameById, person } from "../../../world";
import { people, personOf, roleFor, type S } from "../state";
import { gameVars } from "../ui";
import { Couch } from "./room";

export function Detail({ s, gameId }: { s: S; gameId: string }) {
  const g = gameById(gameId);
  const saved = s.saves[gameId];
  const isNew = !saved || saved.at === "New game";
  return (
    <div className="cr-detail" style={gameVars(g)}>
      <img className="cr-detail-art" src={g.art.tv} alt="" />
      <div className="cr-detail-scrim" />
      <div className="cr-lid">
        <div className="cr-lid-eyebrow">From the shelf</div>
        <div className="cr-lid-title">{g.name}</div>
        <div className="cr-lid-at">{saved ? saved.at : g.tagline}</div>
        <div className="cr-lid-when">
          {saved?.when ?? ""} · {g.minutes[0]}–{g.minutes[1]} min
        </div>
        <div className="cr-lid-actions">
          <div className={`cr-tvbtn is-primary ${s.focus === "continue" ? "is-focus" : ""}`}>{isNew ? "Start" : `Continue ${saved.at}`}</div>
          <div className={`cr-tvbtn ${s.focus === "new" ? "is-focus" : ""}`}>New game</div>
        </div>
      </div>
      <div className="cr-who">
        <div className="cr-who-label">Who's playing</div>
        <div className="cr-who-row">
          {people.map((p) => {
            const on = s.pick.includes(p.id);
            return (
              <div key={p.id} className={`cr-who-p ${on ? "is-on" : ""} ${s.focus === `p:${p.id}` ? "is-focus" : ""}`}>
                <div className="cr-who-cushion">
                  <img src={p.sticker} alt="" />
                </div>
                <div className="cr-who-name">{p.name}</div>
                <div className="cr-who-role">{on ? roleFor(g, p) : "Watching"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Night({ s }: { s: S }) {
  const g = gameById("hearthisle");
  return (
    <div className="cr-detail" style={gameVars(g)}>
      <img className="cr-detail-art" src={g.art.extra?.night ?? g.art.tv} alt="" />
      <div className="cr-detail-scrim" />
      <div className="cr-lid">
        <div className="cr-lid-eyebrow">Through the window</div>
        <div className="cr-lid-title">Game night</div>
        <div className="cr-lid-at">Hearthisle · {HEARTHISLE.title.split(" · ")[1]}</div>
        <div className="cr-lid-when">Paused last Friday · Nana &amp; Pop to roll</div>
        <div className="cr-lid-actions">
          <div className={`cr-tvbtn is-primary ${s.focus === "join" ? "is-focus" : ""}`}>Join the table</div>
        </div>
      </div>
      <div className="cr-homes">
        {HEARTHISLE.seats.map((seat) => {
          const h = HOUSEHOLDS.find((x) => x.id === seat.householdId);
          return (
            <div key={seat.householdId} className="cr-home" style={{ borderColor: seat.color }}>
              <div className="cr-home-stickers">
                {seat.personIds.map((id) => (
                  <img key={id} src={person(id).sticker} alt="" />
                ))}
              </div>
              <div className="cr-home-name">{h?.name ?? seat.label}</div>
              <div className="cr-home-state">
                {seat.score} pts · {seat.online ? "In tonight" : "Not in yet"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DuelOnPhone({ s, duelId }: { s: S; duelId: string }) {
  const d = DUELS.find((x) => x.id === duelId);
  if (!d) return null;
  return (
    <div className="cr-duel-tv">
      <div className="cr-wall" />
      <div className="cr-lamp-glow" />
      <Couch here={people.map((p) => p.id)} />
      <div className="cr-duel-veil" />
      <div className="cr-duel-note">
        <span className="cr-pin" />
        <img src={d.sticker} alt="" />
        <div className="cr-duel-who">Your move against {d.opponent}</div>
        <div className="cr-duel-line">
          {d.lastMove} · {d.you}–{d.them}
        </div>
        <div className="cr-duel-private">
          <span className="cr-phone-glyph" />
          Playing on {personOf(s.holder).name}'s phone. Tiles stay private
        </div>
      </div>
    </div>
  );
}

export function Playing({ gameId }: { gameId: string }) {
  const g = gameById(gameId);
  return (
    <div className="cr-playing">
      <img src={g.art.tv} alt="" />
    </div>
  );
}

export function Connecting({ s }: { s: S }) {
  return (
    <div className="cr-connecting">
      <div className="cr-wall" />
      <div className="cr-lamp-glow" />
      <Couch here={people.map((p) => p.id)} />
      <div className="cr-lights-off" />
      <div className="cr-connecting-text">
        <div className="cr-connecting-title">Turning on the living room</div>
        <div className="cr-connecting-line">{s.resumeView?.kind === "game" ? `${gameById(s.resumeView.gameId).name} comes back where it was` : "From Jonathan's phone"}</div>
      </div>
    </div>
  );
}

/** What the Chromecast itself shows with no cast: nothing of ours, just its own idle screen. */
export function Idle() {
  return (
    <div className="cr-idle">
      <div className="cr-idle-name">Living room TV</div>
      <div className="cr-idle-line">Ready to cast</div>
    </div>
  );
}
