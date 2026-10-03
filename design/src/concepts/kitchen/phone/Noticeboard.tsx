// The noticeboard: what happened, or waits, between sittings. Every note is a game's own report
// (Tier 2 instance changes, world-clock events) pinned up in the household's voice.
import type { CSSProperties } from "react";
import type { Store } from "../../../harness/store";
import { DUELS, gameById, type Instance, type WorldEvent } from "../../../world";
import { people } from "../household";
import { Pin } from "../ui/Icons";
import type { S } from "../state";

interface Note {
  id: string;
  gameId: string;
  head: string;
  detail: string;
  img?: string;
  portrait?: string;
  tilt: number;
  urgent?: boolean;
  onTap?: () => void;
}

const split = (text: string): [string, string] => {
  const m = text.split(/: | · /);
  return [m[0] ?? text, m.slice(1).join(" · ")];
};

export function Noticeboard({ store, events, hearthisle }: { store: Store<S>; events: WorldEvent[]; hearthisle: Instance }) {
  const turns = DUELS.filter((d) => d.status === "yourTurn");
  const notes: Note[] = [];
  if (turns.length > 0) {
    notes.push({
      id: "turns",
      gameId: "word-duel",
      head: `Your move in ${turns.length} games`,
      detail: turns.map((d) => d.lastMove.replace(/ for \d+$/, "")).join(" · "),
      tilt: -1.2,
      urgent: true,
      onTap: () => store.update((x) => ({ ...x, phone: "duels" })),
    });
  }
  for (const e of events) {
    if (e.kind === "your-turn") continue;
    const [head, detail] = split(e.text);
    const g = gameById(e.gameId);
    const who = people.find((p) => p.portrait && e.text.startsWith(p.name));
    notes.push({
      id: e.id,
      gameId: e.gameId,
      head: e.kind === "reminder" ? `Tonight at 8` : head,
      detail: e.kind === "reminder" ? `Game night picks up at ${hearthisle.title.split(" · ")[1] ?? ""} · ${detail}` : detail,
      img: who ? undefined : g.art.alt ?? g.art.tv,
      portrait: who?.portrait,
      tilt: notes.length % 2 === 0 ? -0.8 : 1,
    });
  }
  return (
    <section className="pl-board">
      <h2 className="pl-h2 pl-board-title">Noticeboard</h2>
      <div className="pl-notes">
        {notes.map((n) => (
          <NoteCard key={n.id} n={n} />
        ))}
      </div>
    </section>
  );
}

function NoteCard({ n }: { n: Note }) {
  const g = gameById(n.gameId);
  const style: CSSProperties & Record<"--tilt" | "--gc", string> = { "--tilt": `${n.tilt}deg`, "--gc": g.palette.accent };
  return (
    <button className={`pl-note${n.urgent ? " pl-note--urgent" : ""}`} style={style} data-bot={`note-${n.gameId}`} onClick={n.onTap}>
      <Pin className="pl-note-pin" size={18} />
      {n.portrait && <img className="pl-note-portrait" src={n.portrait} alt="" />}
      {n.img && (
        <span className="pl-note-img">
          <img src={n.img} alt="" />
        </span>
      )}
      {n.gameId === "word-duel" && <TileWord word="QUILT" />}
      <span className="pl-note-game">{g.name}</span>
      <span className="pl-note-head">{n.head}</span>
      <span className="pl-note-detail">{n.detail}</span>
    </button>
  );
}

export function TileWord({ word, size = "s" }: { word: string; size?: "s" | "m" }) {
  return (
    <span className={`pl-tiles pl-tiles--${size}`} aria-label={word}>
      {word.split("").map((c, i) => (
        <span key={i} className="pl-tile">
          {c}
        </span>
      ))}
    </span>
  );
}
