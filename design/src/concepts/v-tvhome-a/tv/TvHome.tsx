// The TV when no game is running: the living-room diorama. The focused couch game is down off the
// shelf, open and lit; who's here sits on the couch; tonight's game night glows in the window.
// Nobody touches it: the phone moves the focus, and the boxes swap on the shelf.
import { gameById } from "../../../world";
import { couchShelf } from "../activities";
import { hereTonight, type S } from "../state";
import { PhoneIcon } from "../ui/Icons";
import { headlineNight } from "./GameNight";
import { Room, shelfGames } from "./Room";

export function TvHome({ s }: { s: S }) {
  const shelf = shelfGames();
  const acts = couchShelf(s);
  const focusId = shelf.includes(s.tvFocus) ? s.tvFocus : shelf[0];
  if (!focusId) return null;
  const focus = acts.find((a) => a.gameId === focusId);
  const seats = hereTonight(s).map((person) => ({ person, badge: "none" as const }));
  return (
    <Room mode="home" focusId={focusId} tag={focus?.title} seats={seats} night={headlineNight(s)}>
      <div key={focusId}>
        <span className="rm-kicker">{focus?.badge || "Jump back in"}</span>
        <h1>{gameById(focusId).name}</h1>
        {focus?.detail && <p className="rm-line">{focus.detail}</p>}
        <span className="rm-hint">
          <PhoneIcon size={32} />
          Choose on Jonathan's phone
        </span>
      </div>
    </Room>
  );
}
