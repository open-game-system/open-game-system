// "Invitation card": a game night is a physical invitation. The front carries the game's art, the
// date and the homes, each home's answer stamped beside its crest; a paused night wears a bookmark
// ribbon ("Turn 14 · back tonight 8:00"); the back is what every other home sees of us, printed.
import type { ReactNode } from "react";
import { HOME, gameById, type Household } from "../../../../world";
import { household, short, US, type Night, type NightHome } from "../../nights";
import { Crest } from "../../ui/Sticker";
import { GameArt } from "../../ui/GameArt";

/** "Tonight 8:00" → "Tonight · 8:00 pm"; "Next Fri 8:00" → "Next Friday · 8:00 pm". */
export function cardDate(when: string | null): string {
  const w = when ?? "Tonight 8:00";
  const m = /^(.*?)\s*(\d{1,2}:\d{2})$/.exec(w);
  const day = (m?.[1] ?? w).replace(/\bFri\b/, "Friday").replace(/\bSat\b/, "Saturday").replace(/\bSun\b/, "Sunday");
  return m?.[2] ? `${day} · ${m[2]} pm` : day;
}

/** A ribbon's words: "Turn 14 · back tonight 8:00". */
export const ribbonWords = (n: Night): string => `Turn ${n.turn} · back ${(n.when ?? "soon").replace(/^Tonight/, "tonight").replace(/^Next/, "next")}`;

export type StampKind = "yes" | "host" | "pencil" | "no" | "turn";

/** A rubber stamp (or a pencilled note, for "still deciding") beside a home on the card. */
export function Stamp({ kind, children }: { kind: StampKind; children: ReactNode }) {
  return (
    <span className={`iv-stamp iv-stamp--${kind}`}>
      <span>{children}</span>
    </span>
  );
}

/** What a home's spot on the card says, from its answer and whether it's back at the table. */
export function stampOf(h: NightHome, n: Night): { kind: StampKind; word: string } {
  if (h.reply === "declined") return { kind: "no", word: "Regrets" };
  if (h.reply === "invited") return { kind: "pencil", word: "deciding" };
  if (n.status === "live" && n.turnOf === h.householdId) return { kind: "turn", word: h.householdId === US ? "Our roll" : "Rolling" };
  if (n.status === "paused" && !h.back) return { kind: "pencil", word: "not back yet" };
  if (h.reply === "host") return { kind: "host", word: "Hosting" };
  return { kind: "yes", word: n.status === "paused" ? "Back" : n.status === "live" ? "Here" : "Coming" };
}

export interface CardHome {
  id: string;
  house: Household;
  stamp: { kind: StampKind; word: string } | null;
}

export const cardHomes = (n: Night): CardHome[] => n.homes.map((h) => ({ id: h.householdId, house: household(h.householdId), stamp: stampOf(h, n) }));

/** The front of the card. `to` addresses one home's copy ("For Nana & Pop"). */
export function InviteFront({
  gameId,
  when,
  homes,
  ribbon,
  to,
  compact = false,
  children,
}: {
  gameId: string;
  when: string | null;
  homes: CardHome[];
  ribbon?: string | null;
  to?: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  const g = gameById(gameId);
  return (
    <article className={`iv-card ${compact ? "iv-card--compact" : ""} ${ribbon ? "has-ribbon" : ""}`} aria-label={`${g.name} game night invitation`}>
      <div className="iv-card__plate">
        <GameArt gameId={gameId} />
      </div>
      {ribbon && <Ribbon words={ribbon} />}
      <div className="iv-card__words">
        <p className="iv-card__kicker">{to ? `For ${to} · from the Mumms` : "The Mumms invite you to"}</p>
        <h2 className="iv-card__title">{g.name}</h2>
        <p className="iv-card__sub">game night</p>
        <span className="iv-card__rule" aria-hidden />
        <p className="iv-card__when">{cardDate(when)}</p>
        <p className="iv-card__note">about an hour · {homes.length === 2 ? "two homes" : homes.length === 3 ? "three homes" : `${homes.length} homes`}, one board</p>
      </div>
      <ul className="iv-card__homes" style={{ gridTemplateColumns: `repeat(${Math.max(homes.length, 1)}, 1fr)` }}>
        {homes.map((h) => (
          <li key={h.id}>
            <Crest household={h.house} size={compact ? 38 : 46} shared dim={h.stamp?.kind === "no"} />
            <b>{short(h.house.name)}</b>
            {h.stamp && <Stamp kind={h.stamp.kind}>{h.stamp.word}</Stamp>}
          </li>
        ))}
      </ul>
      {children}
    </article>
  );
}

/** The bookmark ribbon: it comes out of the card's right edge, notched, with where the night stopped. */
export function Ribbon({ words }: { words: string }) {
  return (
    <div className="iv-ribbon">
      <span className="iv-ribbon__slit" aria-hidden />
      <span className="iv-ribbon__band">{words}</span>
    </div>
  );
}

/** The back of the card: what every other home sees of us, printed like a postcard's reverse. */
export function InviteBack({ to, kidNames, seat, children }: { to: string[]; kidNames: boolean; seat: string; children?: ReactNode }) {
  const kids = HOME.people.filter((p) => p.band !== "grownup").map((p) => p.name);
  return (
    <article className="iv-back" aria-label="The back of the card: what other homes see">
      <p className="iv-back__head">The back · what every home sees of us</p>
      <div className="iv-back__cols">
        <div className="iv-back__from">
          <Crest household={household(US)} size={56} shared />
          <b>The Mumms{kidNames ? " (Jonathan, Juneau)" : ""}</b>
          <span>{seat} place</span>
        </div>
        <div className="iv-back__to">
          {to.map((t) => (
            <span key={t} className="iv-back__line">
              {t}
            </span>
          ))}
        </div>
      </div>
      <p className="iv-back__fine">
        {kidNames ? `Juneau's name is printed; ${kids[1] ?? "Ava"}'s isn't.` : `${kids.join(" and ")}'s names stay home.`} Pictures never leave this home. Each home sees only its own hand. Only homes on this card can sit down.
      </p>
      {children}
    </article>
  );
}
