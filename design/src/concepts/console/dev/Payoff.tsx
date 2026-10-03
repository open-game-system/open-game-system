// What each tier buys, drawn the way the family's phone draws it (concept tokens, the game's own art).
import { HOME, gameById, person } from "../../../world";
import { Mark, Portrait } from "../ui/Brand";
import { DuelArt, GameArt } from "../ui/GameArt";
import { Chevron, TvIcon } from "../ui/Icons";

export const KEEPS: Record<0 | 1 | 2, string> = { 0: "Plays on the TV", 1: "Keeps your place", 2: "Live on Home" };

/** A library tile, as on the phone's Library tab. */
export function Tile({ gameId, tier, note }: { gameId: string; tier: 0 | 1 | 2; note?: string }) {
  const g = gameById(gameId);
  return (
    <article className="dv-tile">
      <div className="dv-tile__art">
        <GameArt gameId={gameId} alt />
      </div>
      <div className="dv-tile__plate">
        <b>{g.name}</b>
        <span>{note ?? `${g.ages} · ${g.minutes[0]}–${g.minutes[1]} min`}</span>
        <span className={`dv-keeps dv-keeps--${tier}`}>{KEEPS[tier]}</span>
      </div>
    </article>
  );
}

/** Tier 0: no state. The phone can only offer a fresh start and a cast. */
export function FreshRow({ gameId }: { gameId: string }) {
  const g = gameById(gameId);
  return (
    <div className="dv-row">
      <span className="dv-row__art">
        <GameArt gameId={gameId} />
      </span>
      <span className="dv-row__text">
        <b>{g.name}</b>
        <span>Starts fresh each time</span>
      </span>
      <span className="dv-row__go">
        <TvIcon size={18} /> Play
      </span>
    </div>
  );
}

/** Tier 1: a resume point from the save, and kids who join by name. */
export function ResumeRow({ gameId, point, when }: { gameId: string; point: string; when: string }) {
  const g = gameById(gameId);
  return (
    <div className="dv-row">
      <span className="dv-row__art">
        <GameArt gameId={gameId} />
      </span>
      <span className="dv-row__text">
        <b>{point}</b>
        <span>
          {g.name} · {when}
        </span>
      </span>
      <span className="dv-row__go">
        Resume <Chevron size={16} />
      </span>
    </div>
  );
}

export function JoinByName({ gameId }: { gameId: string }) {
  const g = gameById(gameId);
  const kids = HOME.people.filter((p) => p.band !== "grownup");
  return (
    <ul className="dv-join">
      {kids.map((p) => {
        const role = g.roles.find((r) => r.audience === p.band) ?? g.roles.find((r) => r.audience === "kid");
        const dev = HOME.devices.find((d) => d.personId === p.id && d.kind === "ipad");
        return (
          <li key={p.id}>
            <Portrait person={p} size={34} />
            <span>
              <b>{p.name}</b>
              <span>
                {dev ? "iPad" : "Phone"} · {role?.label ?? "Player"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Tier 2: the instance the game reported, as a live card on Home. */
export function LiveCard({ gameId, badge, title, detail, seats, live = false, compact = false }: { gameId: string; badge: string; title: string; detail: string; seats: string[]; live?: boolean; compact?: boolean }) {
  const g = gameById(gameId);
  return (
    <article className={`dv-live ${compact ? "dv-live--compact" : ""}`}>
      <div className="dv-live__art">
        <GameArt gameId={gameId} alt />
        <span className={`dv-live__badge ${live ? "is-live" : ""}`}>
          {live && <span className="dv-dot" aria-hidden />}
          {badge}
        </span>
      </div>
      <div className="dv-live__plate">
        <span className="dv-live__game">{g.name}</span>
        <b>{title}</b>
        <span>{detail}</span>
        <span className="dv-live__seats">
          {seats.map((id) => (
            <Portrait key={id} person={person(id)} size={22} ring={false} />
          ))}
        </span>
      </div>
    </article>
  );
}

export function YourTurnRow() {
  return (
    <div className="dv-row dv-row--turn">
      <span className="dv-row__art">
        <DuelArt />
      </span>
      <span className="dv-row__text">
        <b>Nana played QUILT for 34</b>
        <span>Word Duel · 23 min ago</span>
      </span>
      <span className="dv-row__go dv-row__go--signal">
        Play <Chevron size={16} />
      </span>
    </div>
  );
}

/** A push to a grown-up's phone (never a kid's iPad). */
export function Push({ title, body, when = "now" }: { title: string; body: string; when?: string }) {
  return (
    <div className="dv-push">
      <span className="dv-push__icon">
        <Mark size={20} color="#fff" />
      </span>
      <span className="dv-push__text">
        <span className="dv-push__app">
          OGS <span>{when}</span>
        </span>
        <b>{title}</b>
        <span>{body}</span>
      </span>
    </div>
  );
}
