// The place card: Porchlight's one identity object. A folded name card at the table; kids'
// painted characters sit behind theirs. Seats, rosters and "who followed" are all place cards.
import type { CSSProperties, ReactNode } from "react";
import type { Person } from "../../../world";

export type PlaceSize = "s" | "m" | "tv";
export type PlaceState = "here" | "dim" | "arriving" | "asleep";

interface Props {
  person: Person;
  size?: PlaceSize;
  /** Second line: a role ("Fixer") or a device ("iPad · 82%"). */
  line?: ReactNode;
  state?: PlaceState;
  /** Hide the name (kid surfaces). */
  wordless?: boolean;
  delay?: number;
}

export function PlaceCard({ person, size = "m", line, state = "here", wordless, delay = 0 }: Props) {
  const style: CSSProperties & Record<"--pc" | "--pd", string> = { "--pc": person.color, "--pd": `${delay}ms` };
  return (
    <div className={`pl-place pl-place--${size} pl-place--${state}`} style={style}>
      {person.portrait ? <img className="pl-place-portrait" src={person.portrait} alt="" /> : <span className="pl-place-spacer" />}
      <div className="pl-place-card">
        <span className="pl-place-fold" />
        {!wordless && <span className="pl-place-name">{person.name}</span>}
        {line && <span className="pl-place-line">{line}</span>}
        <span className="pl-place-stripe" />
      </div>
    </div>
  );
}
