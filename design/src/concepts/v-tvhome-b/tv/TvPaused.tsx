// The TV while the console menu is open on the phone: intermission. The running game itself shrinks
// into a one-sheet in a lit case (a portrait clip of the live stream, see poster.css), where it
// picks up written beside it, and the lobby wall comes up with what's showing next. The phone chooses; the TV only shows.
import { GAMES, gameById } from "../../../world";
import { detailIn, pointIn, seatPlan, type S } from "../state";
import { PhoneIcon } from "../ui/Icons";
import { Billing, LobbyWall, Marquee, placardFor, titleSize } from "./poster/parts";

export function TvPaused({ s, gameId }: { s: S; gameId: string }) {
  const g = gameById(gameId);
  const next = GAMES.filter((x) => x.shape === "couch" && x.id !== gameId && x.art.tv);
  const point = pointIn(s, gameId);
  const fresh = point === "New game";
  const detail = detailIn(s, gameId);
  return (
    <div className="pw-paused">
      <Marquee>
        Intermission <em>· living room</em>
      </Marquee>
      <div className="pw-paused__case">
        <span className="pw-paused__glyph" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24">
            <rect x="5" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
            <rect x="14" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
          </svg>
        </span>
      </div>
      <section className="pw-paused__info">
        <p className="pw-poster__tagline">{fresh ? "A brand-new game, paused" : `Paused at ${point}`}</p>
        <h2 className="pw-poster__title" style={{ fontSize: titleSize(g.name, 132, 1080) }}>
          {g.name}
        </h2>
        <p className="pw-poster__sub">{[detail, "Switching saves it. Back any time tonight"].filter(Boolean).join(" · ")}</p>
        <Billing people={seatPlan(g).map((x) => x.person)} size={60} />
      </section>
      <section className="pw-paused__next">
        <span className="pw-label">Up next</span>
        <LobbyWall items={next.map((x) => ({ gameId: x.id, line: placardFor(x.id, s.onTv, s.savedTonight) }))} className="pw-paused__wall" />
      </section>
      <aside className="pw-paused__hint">
        <PhoneIcon size={32} />
        Choose on Jonathan's phone
      </aside>
    </div>
  );
}
