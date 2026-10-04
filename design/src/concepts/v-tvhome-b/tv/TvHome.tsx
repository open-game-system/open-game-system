// The TV when no game is running, as a cinema lobby ("Poster wall"). One full-bleed poster for the
// game in focus: its art, the resume point as the tagline, the family's stickers as the starring
// credit. The rest of the library hangs as small one-sheets along the bottom, game night with its
// showtime. Nobody touches it: the phone moves the focus, and the poster slides aside for the next.
import { useRef } from "react";
import { HOME, gameById } from "../../../world";
import { couchShelf, type Activity } from "../activities";
import { hereTonight, resumeDetail, type S } from "../state";
import { PhoneIcon } from "../ui/Icons";
import { headlineNight } from "./GameNight";
import { Billing, Bulbs, LobbyWall, Marquee, placardFor, titleSize, type WallItem } from "./poster/parts";
import { frameFor } from "./frame";
import { TvArt } from "./TvArt";

/** The poster's tagline: where the game picks up, said like a film's line. */
export function taglineOf(a: Activity): { line: string; sub: string } {
  if (a.status.kind === "paused") return { line: `Picks up at ${a.title.toLowerCase().replace(/^./, (c) => c.toUpperCase())}`, sub: [resumeDetail(a.gameId), a.detail].filter(Boolean).join(" · ") };
  if (a.status.kind === "new") return { line: a.title, sub: "New since this morning" };
  return { line: a.title, sub: gameById(a.gameId).tagline };
}

export function TvHome({ s }: { s: S }) {
  const all = couchShelf(s);
  const couch = all.filter((a) => gameById(a.gameId).shape === "couch" && gameById(a.gameId).art.tv);
  const focus = all.find((a) => a.gameId === s.tvFocus && gameById(a.gameId).art.tv) ?? couch[0];
  // The poster that was up before the phone moved focus: it slides aside as the new one drops in.
  const last = useRef<string | null>(null);
  const prev = useRef<string | null>(null);
  if (focus && last.current !== focus.gameId) {
    prev.current = last.current;
    last.current = focus.gameId;
  }
  if (!focus) return null;
  const night = headlineNight(s);
  const wall: WallItem[] = couch.slice(0, 5).map((a) => ({ gameId: a.gameId, line: placardFor(a.gameId, s.onTv, s.savedTonight), lit: a === focus }));
  if (night) wall.push({ gameId: night.gameId, line: night.when ?? "Game night" });
  // The manifest's HUD-safe crop says where the art leans: anchored left (its subject sits left), the
  // poster's type takes the right side, so it never lands on the game's focal character.
  const flip = (frameFor(focus.gameId)?.ox ?? 50) < 40;
  return (
    <div className={`pw-home ${flip ? "pw-home--flip" : ""}`}>
      {prev.current && prev.current !== focus.gameId && (
        <div className="pw-home__art is-out" key={`out-${prev.current}`} aria-hidden>
          <TvArt gameId={prev.current} />
        </div>
      )}
      <div className="pw-home__art is-in" key={`in-${focus.gameId}`}>
        <TvArt gameId={focus.gameId} />
      </div>
      <div className="pw-home__shade" />
      <Marquee>
        Now showing <em>· {HOME.name}' living room</em>
      </Marquee>
      <Poster focus={focus} s={s} />
      <LobbyWall items={wall} className="pw-home__wall" />
      <aside className="pw-home__hint">
        <Bulbs n={9} className="pw-home__trail" />
        <span>
          <PhoneIcon size={32} />
          Choose on Jonathan's phone
        </span>
      </aside>
    </div>
  );
}

function Poster({ focus, s }: { focus: Activity; s: S }) {
  const g = gameById(focus.gameId);
  const t = taglineOf(focus);
  return (
    <section className="pw-poster" key={focus.gameId}>
      <p className="pw-poster__tagline">{t.line}</p>
      <h1 className="pw-poster__title" style={{ fontSize: titleSize(g.name, 196, 1240) }}>
        {g.name}
      </h1>
      {t.sub && <p className="pw-poster__sub">{t.sub}</p>}
      <Billing people={hereTonight(s)} size={76} />
    </section>
  );
}
