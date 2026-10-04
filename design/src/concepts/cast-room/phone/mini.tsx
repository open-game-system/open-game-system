// The room in your hand: a tappable miniature of exactly what the TV shows. Tap an object and the
// TV's spotlight moves there and opens it. It mirrors the spotlight when the remote moves it.
import type { ReactNode } from "react";
import { DUELS, HEARTHISLE, gameById } from "../../../world";
import { COUCH_GAMES, OPEN_DUELS, people, type S } from "../state";

interface Props {
  s: S;
  dark?: boolean;
  onOpen?: (id: string) => void;
}

function Obj({ id, s, onOpen, className, label, children }: { id: string; s: S; onOpen?: (id: string) => void; className: string; label: string; children: ReactNode }) {
  const focused = s.view.kind === "room" && s.focus === id && !!onOpen;
  if (!onOpen)
    return (
      <div className={`${className} ${focused ? "is-focus" : ""}`} aria-hidden>
        {children}
      </div>
    );
  return (
    <button type="button" className={`${className} ${focused ? "is-focus" : ""}`} aria-label={label} data-bot={`mini-${id.replace(/^[gd]:/, "")}`} onClick={() => onOpen(id)}>
      {children}
    </button>
  );
}

export function MiniRoom({ s, dark, onOpen }: Props) {
  return (
    <div className={`cr-mini ${dark ? "is-dark" : ""}`}>
      <div className="cr-mini-cork">
        {OPEN_DUELS.map((d) => {
          const done = s.duelsDone.includes(d.id);
          const duel = DUELS.find((x) => x.id === d.id);
          return (
            <Obj key={d.id} id={`d:${d.id}`} s={s} onOpen={done ? undefined : onOpen} className={`cr-mini-note ${done ? "is-done" : ""}`} label={`Word Duel with ${d.opponent}, your turn`}>
              <span className="cr-mini-pin" />
              {duel ? <img src={duel.sticker} alt="" /> : null}
            </Obj>
          );
        })}
      </div>
      <Obj id="night" s={s} onOpen={onOpen} className="cr-mini-window" label={`Game night, ${HEARTHISLE.title}`}>
        <img src={gameById("hearthisle").art.extra?.night ?? ""} alt="" />
        <span className="cr-mini-mullion" />
      </Obj>
      <div className="cr-mini-shelf">
        {COUCH_GAMES.map((g) => (
          <Obj key={g.id} id={`g:${g.id}`} s={s} onOpen={onOpen} className="cr-mini-box" label={`${g.name}, ${s.saves[g.id]?.at ?? "new"}`}>
            <img src={g.art.tv} alt="" />
            <span className="cr-mini-band" style={{ background: g.palette.ground }} />
          </Obj>
        ))}
      </div>
      <div className="cr-mini-couch">
        {people.map((p) => (
          <img key={p.id} src={p.sticker} alt="" />
        ))}
      </div>
    </div>
  );
}
