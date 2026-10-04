// Variant "Instant + receipt": while the phone's quick-switch sheet is open, the TV doesn't become a
// menu. The game holds in place, dimmed a touch, with one small pill in the corner: paused, and
// where it will be saved. The choosing happens on the phone; the TV just waits a beat.
import { gameById } from "../../../world";
import { pointIn, type S } from "../state";
import { PhoneIcon } from "../ui/Icons";

export function TvPaused({ s, gameId }: { s: S; gameId: string }) {
  const g = gameById(gameId);
  return (
    <div className="ct-hold" role="status">
      <span className="ct-hold__glyph" aria-hidden>
        <PauseGlyph />
      </span>
      <span className="ct-hold__text">
        <b>Paused</b>
        <span>
          {g.name} · {pointIn(s, gameId)}
        </span>
      </span>
      <span className="ct-hold__sep" aria-hidden />
      <span className="ct-hold__phone">
        <PhoneIcon size={28} /> Jonathan's choosing
      </span>
    </div>
  );
}

function PauseGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
      <rect x="14" y="4" width="5" height="16" rx="1.6" fill="currentColor" />
    </svg>
  );
}
