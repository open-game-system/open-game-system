// The "later" layer: things that don't happen on the couch right now, filed by when they happen.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { hearthisle } from "../programme";
import { go, type S } from "../state";
import { DuelArt } from "../duel/Art";

interface LaterItem {
  id: string;
  when: string;
  whenTone?: "turn" | "ready";
  gameId: string;
  title: string;
  detail: string;
  onTap: (store: Store<S>) => void;
}

const ITEMS: LaterItem[] = [
  {
    id: "story-nook",
    when: "Bedtime",
    whenTone: "ready",
    gameId: "story-nook",
    title: "Story Nook",
    detail: "Juneau's character is ready: Ember the dragon",
    onTap: (st) => st.update((x) => ({ ...x, next: "story-nook", phone: "director" })),
  },
  {
    id: "hearthisle",
    when: "8:00",
    gameId: "hearthisle",
    title: "Hearthisle game night",
    detail: `${hearthisle.title.replace("Game night · ", "Resumes at ")} with the Okafors and Nana & Pop`,
    onTap: (st) => go(st, "schedule"),
  },
  {
    id: "word-duel",
    when: "Your move",
    whenTone: "turn",
    gameId: "word-duel",
    title: "Word Duel · 2 games",
    detail: "Nana played QUILT · Mom played FERN",
    onTap: (st) => go(st, "duel-list"),
  },
];

export function LaterList({ store, compact = false }: { store: Store<S>; compact?: boolean }) {
  return (
    <section className="ch-block ch-block-rule">
      <h2 className="ch-kicker ch-kicker-plain">{compact ? "Later" : "Tonight, later"}</h2>
      <ul className="ch-later">
        {ITEMS.map((it) => {
          const g = gameById(it.gameId);
          return (
            <li key={it.id}>
              <button className="ch-row" data-bot={`later-${it.id}`} onClick={() => it.onTap(store)}>
                <span className={`ch-row-time${it.whenTone ? ` is-${it.whenTone}` : ""}`}>{it.when}</span>
                {g.art.tv ? <img className="ch-row-art" src={g.art.tv} alt="" /> : <DuelArt className="ch-row-art" />}
                <span className="ch-row-body">
                  <b>{it.title}</b>
                  <small>{it.detail}</small>
                </span>
                <i className="ch-chev" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
