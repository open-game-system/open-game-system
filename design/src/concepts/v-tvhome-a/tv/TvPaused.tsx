// The TV while the console menu is open on the phone: the same living room, the lamp turned low.
// The paused game is the open box with a ribbon in it (its resume point on the tag); the other
// boxes stand on the shelf as what's next. The phone chooses; the TV only shows.
import { gameById } from "../../../world";
import { detailIn, hereTonight, pointIn, type S } from "../state";
import { PhoneIcon } from "../ui/Icons";
import { headlineNight } from "./GameNight";
import { Room } from "./Room";

export function TvPaused({ s, gameId }: { s: S; gameId: string }) {
  const g = gameById(gameId);
  const point = pointIn(s, gameId);
  const seats = hereTonight(s).map((person) => ({ person, badge: "none" as const }));
  return (
    <div className="rm-over">
      <Room mode="paused" focusId={gameId} tag={point} seats={seats} night={headlineNight(s)}>
        <span className="rm-kicker">Paused · {point}</span>
        <h1>{g.name}</h1>
        {detailIn(s, gameId) && <p className="rm-line">{detailIn(s, gameId)}</p>}
        <p className="rm-note">Switching saves it. Back to it any time tonight.</p>
        <span className="rm-hint">
          <PhoneIcon size={32} />
          Choose on Jonathan's phone
        </span>
      </Room>
    </div>
  );
}
