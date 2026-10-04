// The TV: a cloud browser streaming to the Chromecast. It runs the OGS launcher and hosts each
// game's TV page inside the same stream, so a swap never recasts.
import { gameById, HOME, type DuelGame } from "../../world";
import { focused, personOf, PEOPLE, resumeLine, roleFor, rowsFor, type Item, type S } from "./state";
import { Art, DuelArt, Icon, Mark, Sticker, relTime } from "./ui";

export function TvSurface({ s }: { s: S }) {
  if (s.cast === "connecting") return <Boot />;
  if (s.cast !== "live") return <Idle />;
  const item = focused(s);
  if (s.tv === "game" && s.playing) return <GameView s={s} />;
  if (s.tv === "who" && item) return <Who s={s} item={item} />;
  if (s.tv === "detail" && item) return <Detail s={s} item={item} />;
  if (s.tv === "duel" && item?.duel) return <Handoff s={s} duel={item.duel} />;
  return <Launcher s={s} />;
}

/** Not ours: the Chromecast's own idle screen before anyone casts (and after a drop). */
function Idle() {
  return (
    <div className="tv-idle">
      <div className="t">7:10</div>
      <div className="s">Living room TV · ready to cast</div>
    </div>
  );
}

function Boot() {
  return (
    <div className="tv-boot">
      <div className="big">
        <Mark label={false} />
      </div>
      <p>Starting Open Game on the living room TV</p>
      <div className="tv-bar">
        <i />
      </div>
    </div>
  );
}

function HeroBg({ item }: { item: Item }) {
  if (!item.game.art.tv) {
    return (
      <div className="tv-hero-bg" style={{ background: "#14130f" }}>
        <div style={{ position: "absolute", right: 120, top: 120, transform: "rotate(-6deg)", opacity: 0.9 }}>
          <BoardSil size={620} />
        </div>
      </div>
    );
  }
  return (
    <div className="tv-hero-bg" key={item.id}>
      <Art game={item.game} />
    </div>
  );
}

function TopBar({ s }: { s: S }) {
  const here = PEOPLE.filter((p) => HOME.devices.some((d) => d.personId === p.id && d.online));
  return (
    <div className="tv-top">
      <Mark />
      <span className="tv-where">{s.fresh ? "Good evening, Mumms" : "Living room"}</span>
      <span className="sp" />
      <span className="tv-here">
        {here.map((p) => (
          <Sticker key={p.id} id={p.id} size={56} />
        ))}
      </span>
      <span className="tv-clock">7:10</span>
    </div>
  );
}

function eyebrow(s: S, item: Item): { text: string; amber: boolean } {
  if (item.kind === "duel") return { text: "Your turn", amber: true };
  if (item.kind === "night") return { text: "Game night · tonight 8 pm", amber: true };
  const i = item.instance;
  if (s.pausedTonight.includes(item.game.id)) return { text: "Paused just now", amber: false };
  if (item.kind === "couch" && i) {
    if (i.status === "active") return { text: `Continue · ${relTime(i.updatedAt)}`, amber: false };
    if (i.status === "suspended") return { text: `Continue · paused ${relTime(i.updatedAt)}`, amber: false };
    return { text: "New since this morning", amber: true };
  }
  return { text: `Couch game · ${item.game.minutes[0]}–${item.game.minutes[1]} min · ages ${item.game.ages}`, amber: false };
}

function HeroText({ s, item }: { s: S; item: Item }) {
  const eb = eyebrow(s, item);
  const line = item.kind === "title" ? item.game.tagline : resumeLine(s, item);
  const detail = item.kind === "duel" && item.duel ? `You ${item.duel.you} · ${item.duel.opponent} ${item.duel.them} · ${relTime(item.duel.updatedAt)}` : s.pausedTonight.includes(item.game.id) ? "Saved right where you left it" : item.kind === "title" ? (item.instance ? `Last time: ${item.instance.title}` : item.game.players) : item.instance?.detail;
  return (
    <>
      <div className="tv-eyebrow" style={{ color: eb.amber ? undefined : "var(--cr-paper-2)" }}>
        {eb.amber ? <span className="dot" /> : null}
        {eb.text}
      </div>
      <div className="tv-title disp">{item.game.name}</div>
      {line ? <div className="tv-resume">{line}</div> : null}
      {detail ? <div className="tv-detail">{detail}</div> : null}
      <Cast s={s} item={item} />
    </>
  );
}

/** Who's in it, as stickers: seats for couch saves, homes for a game night, the opponent for a duel. */
function Cast({ s, item }: { s: S; item: Item }) {
  if (item.kind === "duel" && item.duel)
    return (
      <div className="tv-cast">
        <span className="p">
          <Sticker src={item.duel.sticker} color={item.duel.color} size={64} />
          {item.duel.opponent} · {item.duel.opponentHome}
        </span>
      </div>
    );
  if (item.kind === "night" && item.instance)
    return (
      <div className="tv-cast">
        {item.instance.seats.map((seat) => (
          <span className="p" key={seat.householdId}>
            <Sticker id={seat.personIds[0]} size={64} />
            {seat.label.replace(/ \(.*\)/, "")} {seat.score}
          </span>
        ))}
      </div>
    );
  const ids = s.rosterSet ? s.tonight : item.instance?.seats.flatMap((x) => x.personIds) ?? [];
  if (ids.length === 0) return null;
  return (
    <div className="tv-cast">
      {ids.map((id) => (
        <span className="p" key={id}>
          <Sticker id={id} size={64} />
          {personOf(id).name}
        </span>
      ))}
    </div>
  );
}

function Launcher({ s }: { s: S }) {
  const rows = rowsFor(s);
  const item = focused(s);
  return (
    <div className="cr-tv-launcher">
      {item ? <HeroBg item={item} /> : null}
      <TopBar s={s} />
      {item ? (
        <div className="tv-hero" key={item.id}>
          <HeroText s={s} item={item} />
        </div>
      ) : null}
      <div className="tv-rows noscroll">
        {rows.slice(s.focus.row).map((r, k) => {
          const ri = s.focus.row + k;
          const off = ri === s.focus.row ? Math.max(0, s.focus.col - 2) : 0;
          return (
            <div className="tv-row" key={r.id}>
              <h3 className={r.id === "turns" ? "amber" : undefined}>
                {r.title}
                {r.id === "turns" ? <small>{r.items.length} games</small> : null}
              </h3>
              <div className="tv-track noscroll" key={`${r.id}-${s.focus.row}`}>
                {r.items.slice(off, off + 5).map((it, j) => (
                  <Card key={it.id} s={s} item={it} on={ri === s.focus.row && off + j === s.focus.col} peek={j === 4} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {s.fresh ? (
        <div className="tv-toast">
          <Sticker id={s.remoteHolder} size={72} />
          <div>
            <b>{personOf(s.remoteHolder).name}'s phone is the remote</b>
            <span>Pick a game on the phone, or swipe in Remote</span>
          </div>
        </div>
      ) : null}
      {s.remoteAsleep ? (
        <div className="tv-toast">
          <Sticker id={s.remoteHolder} size={72} dim />
          <div>
            <b>{personOf(s.remoteHolder).name}'s phone went to sleep</b>
            <span>Any grown-up phone can pick up the remote</span>
          </div>
        </div>
      ) : null}
      {!s.remoteAsleep && s.remoteHolder !== "dad" && s.tv === "launcher" ? (
        <div className="tv-toast">
          <Sticker id={s.remoteHolder} size={72} />
          <div>
            <b>{personOf(s.remoteHolder).name} has the remote</b>
            <span>Nothing changed on the TV</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function progressOf(s: S, item: Item): number | null {
  if (item.kind !== "couch") return null;
  const line = resumeLine(s, item) ?? "";
  const m = /(\d+) of (\d+)/.exec(line);
  if (m) return Number(m[1]) / Number(m[2]);
  const mission = /Mission (\d+)/.exec(line);
  if (mission) return Number(mission[1]) / 10;
  return null;
}

function Card({ s, item, on, peek }: { s: S; item: Item; on: boolean; peek?: boolean }) {
  if (peek)
    return (
      <div className="tv-card">
        <div className="art">{item.game.art.tv ? <Art game={item.game} /> : <span style={{ position: "absolute", inset: 0, background: item.kind === "duel" ? "#f4efe4" : item.game.palette.ground }} />}</div>
      </div>
    );
  const pr = progressOf(s, item);
  if (item.kind === "duel" && item.duel) return <DuelCard duel={item.duel} on={on} />;
  const sub = item.kind === "night" ? "Turn 14 · 3 homes" : item.kind === "couch" ? resumeLine(s, item)?.split(" · ")[0] : `${item.game.minutes[0]}–${item.game.minutes[1]} min`;
  return (
    <div className={`tv-card${on ? " on" : ""}`}>
      <div className="art">
        <Art game={item.game} tile={52} />
        {pr !== null ? (
          <div className="tv-prog">
            <i style={{ width: `${Math.round(pr * 100)}%` }} />
          </div>
        ) : null}
        {item.kind === "night" && item.instance ? (
          <div className="tv-crests">
            {item.instance.seats.map((seat) => (
              <Sticker key={seat.householdId} id={seat.personIds[0]} size={56} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="lbl">{item.game.name}</div>
      <div className="sub">{s.pausedTonight.includes(item.game.id) && item.kind === "couch" ? `Paused · ${sub}` : sub}</div>
    </div>
  );
}

function DuelCard({ duel, on }: { duel: DuelGame; on: boolean }) {
  return (
    <div className={`tv-card${on ? " on" : ""}`}>
      <div className="art">
        <div className="tv-duel">
          <div className="who">
            <Sticker src={duel.sticker} color={duel.color} size={64} />
            {duel.opponent}
          </div>
          <div className="tiles">
            {(duel.lastWord ?? "").split("").map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <div className="sc">
            You {duel.you} · {duel.opponent} {duel.them}
          </div>
        </div>
      </div>
      <div className="lbl">Word Duel</div>
      <div className="sub">{relTime(duel.updatedAt)}</div>
    </div>
  );
}

function Detail({ s, item }: { s: S; item: Item }) {
  const line = resumeLine(s, item);
  const short = line?.split(" · ")[0];
  const labels = item.kind === "night" ? ["Join the table", "See the island"] : item.kind === "couch" ? [`Continue ${short ?? ""}`.trim(), "New game"] : [item.instance ? "Play" : "Play", "How to play"];
  return (
    <div className="tv-detail-pg">
      <HeroBg item={item} />
      <TopBar s={s} />
      <div className="tv-hero" key={`d-${item.id}`}>
        <HeroText s={s} item={item} />
        <div className="tv-btns">
          {labels.map((l, i) => (
            <span key={l} className={`tv-btn${s.detailBtn === i ? " on" : ""}`}>
              {i === 0 ? <Icon name="play" size={30} /> : null}
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="tv-hint">
        <Icon name="back" size={28} />
        Back to all games
      </div>
    </div>
  );
}

function Who({ s, item }: { s: S; item: Item }) {
  const line = resumeLine(s, item)?.split(" · ")[0];
  return (
    <div>
      <div className="tv-hero-bg" style={{ filter: "blur(18px) brightness(0.45)" }}>
        <Art game={item.game} />
      </div>
      <div className="tv-who">
        <h2 className="disp">Who's playing?</h2>
        <div className="q">
          {item.game.name}
          {line ? ` · ${line}` : ""}
        </div>
        <div className="tv-who-list">
          {PEOPLE.map((p, i) => {
            const inn = s.tonight.includes(p.id);
            const role = roleFor(item.game, p.id);
            return (
              <div key={p.id} className={`tv-who-p${inn ? " in" : ""}${s.whoFocus === i ? " on" : ""}`}>
                <div className="ring" style={{ background: `radial-gradient(circle at 50% 40%, ${p.color}88, ${p.color}22 72%)` }}>
                  <Sticker id={p.id} size={190} />
                  {inn ? (
                    <span className="tv-check">
                      <Icon name="check" size={36} color="#09090b" stroke={3.4} />
                    </span>
                  ) : null}
                </div>
                <div className="nm">{p.name}</div>
                <div className={`role${inn ? "" : " off"}`}>{inn ? role?.label ?? "Playing" : "Sitting out"}</div>
              </div>
            );
          })}
        </div>
        <span className={`tv-btn go${s.whoFocus === PEOPLE.length ? " on" : ""}`}>
          <Icon name="play" size={30} />
          Start {line ?? item.game.name}
        </span>
      </div>
    </div>
  );
}

function GameView({ s }: { s: S }) {
  const p = s.playing;
  const game = p ? gameById(p.gameId) : undefined;
  const src = game?.art.tv;
  return (
    <div className="tv-game" key={p?.gameId}>
      {src ? <img src={src} alt="" /> : game ? <DuelArt game={game} tile={160} /> : null}
      {s.resumed && p ? (
        <div className="tv-chip">
          <Icon name="play" size={26} />
          Back to {p.title.split(" · ")[0]} · nothing lost
        </div>
      ) : null}
    </div>
  );
}

/** Where the duel board would be, with no letters: the room sees that it's your move, never your tiles. */
function BoardSil({ size, played }: { size: number; played?: boolean }) {
  const filled = new Set(["5-3", "5-4", "5-5", "5-6", "5-7", "1-6", "2-6", "3-6", "4-6", "8-1", "8-2", "8-3", "8-4", "8-5"]);
  if (played) ["6-7", "7-7", "8-7"].forEach((k) => filled.add(k));
  return (
    <div className="tv-board-sil" style={{ width: size, height: size }}>
      {Array.from({ length: 121 }, (_, i) => (
        <span key={i} className={filled.has(`${Math.floor(i / 11)}-${i % 11}`) ? "t" : undefined} />
      ))}
    </div>
  );
}

function Handoff({ s, duel }: { s: S; duel: DuelGame }) {
  const sent = s.duel?.sent ?? false;
  const owner = personOf(s.phoneOwner).name;
  return (
    <div className="tv-handoff">
      <div style={{ position: "relative" }}>
        <BoardSil size={440} played={sent} />
        <span className="tv-phone-ic">
          <Icon name={sent ? "check" : "phone"} size={56} color="#f6f2ea" />
        </span>
      </div>
      <div className="txt">
        <div className="tv-eyebrow">
          <span className="dot" />
          {sent ? `${duel.opponent}'s move next` : "Your turn"}
        </div>
        <h2 className="disp">{sent ? `Played TOWN for 16` : `Your move is on ${owner}'s phone`}</h2>
        <p>
          Word Duel with {duel.opponent} · You {sent ? duel.you + 16 : duel.you}, {duel.opponent} {duel.them}
        </p>
        <p>{sent ? "Back to the rows in a moment" : "Your tiles stay on your phone"}</p>
      </div>
    </div>
  );
}
