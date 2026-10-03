// The cut-over, inside the same cast session: the old game shrinks into a framed picture and is
// hung on the wall (saved), the next one opens, and tonight's place cards sit down in front of it.
import type { CSSProperties } from "react";
import type { S } from "../state";
import { gameById, resumePoint, seatsFor } from "../household";
import { PlaceCard } from "../ui/PlaceCard";
import { Check } from "../ui/Icons";

export function Cutover({ s }: { s: S }) {
  const t = s.tonight;
  if (t.kind !== "switching") return null;
  const from = gameById(t.from);
  const to = gameById(t.to);
  const glow: CSSProperties & Record<"--to", string> = { "--to": to.palette.accent };
  return (
    <div className={`pl-tv pl-tv--cut pl-cut--${t.step}`} style={glow}>
      <div className="pl-cut-from pl-frame">
        <img src={from.art.tv} alt="" />
      </div>
      <div className="pl-cut-to pl-frame">
        <img src={to.art.tv} alt="" />
      </div>
      {t.step === "saving" && <p className="pl-cut-cap pl-cut-cap--saving">Saving {resumePoint(from.id).toLowerCase()}</p>}
      {t.step !== "saving" && (
        <p className="pl-cut-saved">
          <Check size={30} /> {resumePoint(from.id)} saved
        </p>
      )}
      {t.step === "cutover" && (
        <p className="pl-cut-cap pl-cut-cap--to">
          {to.name} <span>· {resumePoint(to.id)}</span>
        </p>
      )}
      {t.step === "following" && (
        <div className="pl-cut-seats">
          {seatsFor(to).map((x, i) => (
            <PlaceCard
              key={x.person.id}
              person={x.person}
              size="tv"
              line={x.role}
              state={s.avaAsleep && x.person.id === "ava" ? "asleep" : "arriving"}
              delay={i * 220}
            />
          ))}
        </div>
      )}
    </div>
  );
}
