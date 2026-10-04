// The TV: a console home running in the cloud browser that streams to the Chromecast. Games run inside it.
import type { Store } from "../../harness/store";
import { useStore } from "../../harness/store";
import { DUELS, HEARTHISLE, HOUSEHOLDS } from "../../world";
import { PEOPLE, SYSTEM, SYSTEM_LABEL, detailButtons, game, personOf, resumeOf, rolesFor, yourTurnDuels, type S, type SystemItem } from "./state";
import { GameArt, Icon, Sticker, StickerImg } from "./ui";

const SYS_ICON: Record<SystemItem, "turns" | "night" | "family" | "ipad" | "stop"> = { turns: "turns", night: "night", family: "family", devices: "ipad", stop: "stop" };
const STRIDE = 368;

export function TvSurface({ store }: { store: Store<S> }) {
  const s = useStore(store);
  if (s.cast === "off" || s.cast === "picking" || s.cast === "none-found" || s.cast === "dropped") return <Ambient dropped={s.cast === "dropped"} />;
  if (s.cast === "connecting") return <Splash />;
  if (s.cast === "recasting") return <Recasting s={s} />;
  const v = s.view;
  if (v.kind === "game") return <GameView s={s} gameId={v.gameId} phase={v.phase} />;
  return (
    <div className="sw-tv">
      {v.kind === "home" && <Home s={s} />}
      {v.kind === "detail" && <Detail s={s} gameId={v.gameId} focus={v.focus} />}
      {v.kind === "who" && <Who s={s} gameId={v.gameId} focus={v.focus} mode={v.mode} />}
      {v.kind === "turns" && <Turns s={s} focus={v.focus} />}
      {v.kind === "devices" && <Devices s={s} />}
    </div>
  );
}

function Ambient({ dropped }: { dropped: boolean }) {
  return (
    <div className="sw-ambient">
      <div className="sw-ambient__clock">7:{dropped ? "24" : "10"}</div>
      <div className="sw-ambient__name">Living room TV</div>
      <div className="sw-ambient__hint">{dropped ? "Cast ended" : "Ready to cast"}</div>
    </div>
  );
}

function Splash() {
  return (
    <div className="sw-tv sw-splash">
      <Logo size={150} />
      <div className="sw-splash__hi">Hello, Mumms</div>
      <div className="sw-splash__sub">Opening your games on the living room TV</div>
      <div className="sw-splash__row">
        {["rocket-crew", "bake-shop", "story-nook", "peekaboo-garden", "night-flight"].map((id, i) => (
          <span key={id} className="sw-splash__tile" style={{ animationDelay: `${0.15 * i}s` }}>
            <GameArt g={game(id)} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function Logo({ size }: { size: number }) {
  return (
    <span className="sw-logo" style={{ width: size, height: size * 0.62 }} aria-hidden="true">
      <svg viewBox="0 0 160 100" width="100%" height="100%">
        <rect x="4" y="4" width="70" height="92" rx="26" fill="#ff5a1f" />
        <rect x="86" y="4" width="70" height="92" rx="26" fill="#1b1b20" />
        <circle cx="39" cy="34" r="11" fill="#1b1b20" />
        <circle cx="121" cy="62" r="11" fill="#fffaf0" />
      </svg>
    </span>
  );
}

function TopBar({ s }: { s: S }) {
  const f = s.focus;
  const usersFocused = s.view.kind === "home" && f.zone === "users";
  const holder = personOf(s.remoteHolder);
  return (
    <div className="sw-top">
      <div className="sw-users">
        {PEOPLE.map((p, i) => {
          const here = s.tonight.includes(p.id);
          const focused = usersFocused && f.users === i;
          return (
            <div key={p.id} className={`sw-user ${focused ? "is-focus" : ""} ${here ? "is-here" : ""}`}>
              <Sticker pid={p.id} size={92} ring={here} />
              <span className="sw-user__name">{p.name}</span>
              {here && <span className="sw-user__dot" aria-hidden="true" />}
            </div>
          );
        })}
        {s.tonight.length === 0 && <div className="sw-users__ask">Who's here tonight?</div>}
      </div>
      <div className="sw-status">
        <span className="sw-status__remote">
          <Sticker pid={holder.id} size={52} />
          <span>{s.dadAsleep && s.remoteHolder === "dad" ? "Remote asleep" : `${holder.name}'s remote`}</span>
        </span>
        <span className="sw-status__cast"><Icon name="cast" size={30} /> Living room</span>
        <span className="sw-status__time">7:10</span>
      </div>
    </div>
  );
}

function Home({ s }: { s: S }) {
  const f = s.focus;
  const onHome = s.view.kind === "home";
  const shift = Math.max(0, Math.min(f.games - 3, s.order.length - 5)) * STRIDE;
  const focusId = s.order[f.games] ?? s.order[0] ?? "rocket-crew";
  const fg = game(focusId);
  const r = resumeOf(focusId, s);
  const gamesFocused = onHome && f.zone === "games";
  const left = 96 + f.games * STRIDE - shift;
  const turnsLeft = yourTurnDuels(s.duelsDone).length;
  return (
    <div className={`sw-home ${onHome ? "" : "is-behind"}`}>
      <TopBar s={s} />
      {s.duel && onHome && <DuelBusy s={s} />}
      <div className="sw-flag" style={{ left }}>
        {s.suspended === focusId ? (
          <span className="sw-flag__chip is-susp"><Icon name="pause" size={26} /> Suspended · press A to go back in</span>
        ) : (
          <span className="sw-flag__chip">{fg.shape === "async" ? "Played on your phone" : fg.shape === "live" ? "Game night · three homes" : f.games === 0 ? "Last played" : fg.tagline}</span>
        )}
      </div>
      <div className="sw-rowwrap">
      <div className="sw-row" style={{ transform: `translateX(${-shift}px)` }}>
        {s.order.map((id, i) => {
          const g = game(id);
          const focused = gamesFocused && f.games === i;
          return (
            <div key={id} className={`sw-tile ${focused ? "is-focus" : ""} ${f.games === i && !gamesFocused ? "is-soft" : ""}`} style={{ left: 96 + i * STRIDE, animationDelay: `${0.06 * i}s` }}>
              <GameArt g={g} />
              <span className="sw-tile__name">{g.name}</span>
              {s.suspended === id && <span className="sw-tile__badge"><Icon name="pause" size={28} color="#fffaf0" /></span>}
              {g.shape === "async" && turnsLeft > 0 && <span className="sw-tile__badge is-count">{turnsLeft}</span>}
            </div>
          );
        })}
      </div>
      </div>
      {r && (
        <div className="sw-resume" style={{ left: Math.min(left, 1920 - 96 - 900) }} key={focusId}>
          <div className="sw-resume__lead">{r.lead}</div>
          <div className="sw-resume__title">{r.title}</div>
          <div className="sw-resume__detail">{r.detail}</div>
          {r.players.length > 0 && (
            <div className="sw-resume__who">
              {r.players.map((p) => <Sticker key={p} pid={p} size={50} />)}
              <span>{r.players.map((p) => personOf(p).name).join(", ")} · {r.when}</span>
            </div>
          )}
        </div>
      )}
      <div className="sw-sys">
        {SYSTEM.map((it, i) => {
          const focused = onHome && f.zone === "system" && f.system === i;
          return (
            <div key={it} className={`sw-sysbtn ${focused ? "is-focus" : ""}`}>
              <span className="sw-sysbtn__disc">
                <Icon name={SYS_ICON[it]} size={52} />
                {it === "turns" && turnsLeft > 0 && <span className="sw-sysbtn__badge">{turnsLeft}</span>}
              </span>
              <span className="sw-sysbtn__label">{SYSTEM_LABEL[it]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DuelBusy({ s }: { s: S }) {
  const d = DUELS.find((x) => x.id === s.duel);
  if (!d) return null;
  return (
    <div className="sw-toast">
      <Icon name="phone" size={34} />
      <span>{personOf(s.remoteHolder).name} is taking a turn vs {d.opponent} on the phone</span>
    </div>
  );
}

function Detail({ s, gameId, focus }: { s: S; gameId: string; focus: number }) {
  const g = game(gameId);
  const r = resumeOf(gameId, s);
  const roster = s.tonight.length ? s.tonight : r?.players ?? [];
  const roles = g.shape === "couch" ? rolesFor(gameId, roster) : [];
  return (
    <div className="sw-detail" style={{ "--ga": g.palette.accent, "--gg": g.palette.ground }}>
      <div className="sw-detail__art">
        <GameArt g={g} />
      </div>
      <div className="sw-detail__panel">
        <div className="sw-detail__name">{g.name}</div>
        <div className="sw-detail__tag">{g.tagline}</div>
        {r && (
          <div className="sw-detail__resume">
            <div className="sw-detail__lead">{r.lead}</div>
            <div className="sw-detail__title">{r.title}</div>
            <div className="sw-detail__det">{r.detail}</div>
          </div>
        )}
        {roles.length > 0 && (
          <div className="sw-detail__players">
            <div className="sw-detail__lead">{s.tonight.length ? "Playing tonight" : "Last played by"}</div>
            <div className="sw-detail__plist">
              {roles.map((x) => (
                <div key={x.pid} className="sw-detail__p">
                  <Sticker pid={x.pid} size={76} ring />
                  <span className="sw-detail__pname">{personOf(x.pid).name}</span>
                  <span className="sw-detail__prole">{x.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {g.shape === "live" && <NightSeats />}
        <div className="sw-detail__btns">
          {detailButtons(gameId).map((b, i) => (
            <div key={b.id} className={`sw-tvbtn ${i === 0 ? "is-primary" : ""} ${focus === i ? "is-focus" : ""}`}>{b.label}</div>
          ))}
        </div>
        <Hints items={[["A", "Choose"], ["B", "Back"]]} />
      </div>
    </div>
  );
}

function NightSeats() {
  return (
    <div className="sw-detail__players">
      <div className="sw-detail__lead">Three homes · resumes tonight at 8</div>
      <div className="sw-night">
        {HEARTHISLE.seats.map((seat) => (
          <div key={seat.householdId} className="sw-night__seat" style={{ "--pc": seat.color }}>
            <span className="sw-night__stickers">
              {seat.personIds.slice(0, 3).map((pid) => {
                const p = HOUSEHOLDS.flatMap((h) => h.people).find((x) => x.id === pid);
                return p ? <StickerImg key={pid} src={p.sticker} size={56} color={p.color} /> : null;
              })}
            </span>
            <span className="sw-night__name">{seat.label.split(" (")[0]}</span>
            <span className="sw-night__score">{seat.score ?? 0} pts{seat.online ? "" : " · offline"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hints({ items }: { items: [string, string][] }) {
  return (
    <div className="sw-hints">
      {items.map(([k, t]) => (
        <span key={k} className="sw-hint"><b>{k}</b>{t}</span>
      ))}
    </div>
  );
}

function Who({ s, gameId, focus, mode }: { s: S; gameId: string | null; focus: number; mode: "continue" | "new" }) {
  const g = gameId ? game(gameId) : null;
  const roles = gameId ? rolesFor(gameId, s.picking) : [];
  const r = gameId ? resumeOf(gameId, s) : null;
  return (
    <div className="sw-who">
      <div className="sw-who__head">
        {g && (
          <span className="sw-who__game">
            <span className="sw-who__thumb"><GameArt g={g} /></span>
            <span>
              <span className="sw-who__gname">{g.name}</span>
              <span className="sw-who__gsub">{mode === "new" ? "New game · mission save kept for a day" : r ? `Continue · ${r.title}` : "Play"}</span>
            </span>
          </span>
        )}
        <div className="sw-who__title">{g ? "Who's playing?" : "Who's here tonight?"}</div>
      </div>
      <div className="sw-who__row">
        {PEOPLE.map((p, i) => {
          const picked = s.picking.includes(p.id);
          const role = roles.find((x) => x.pid === p.id);
          const device = p.band === "grownup" ? (p.id === s.remoteHolder ? "This remote" : `${p.name}'s phone`) : `${p.name}'s iPad`;
          return (
            <div key={p.id} className={`sw-pick ${picked ? "is-picked" : ""} ${focus === i ? "is-focus" : ""}`}>
              <span className="sw-pick__disc">
                <Sticker pid={p.id} size={250} dim={!picked} />
                {picked && <span className="sw-pick__check"><Icon name="check" size={44} color="#fffaf0" /></span>}
              </span>
              <span className="sw-pick__name">{p.name}</span>
              <span className={`sw-pick__role ${picked && role ? "" : "is-empty"}`}>{picked && role ? role.label : picked ? "Here" : "Not playing"}</span>
              <span className="sw-pick__dev">
                <Icon name={p.band === "grownup" ? "phone" : "ipad"} size={26} />
                {device}
              </span>
            </div>
          );
        })}
      </div>
      <div className={`sw-tvbtn is-primary sw-who__start ${focus >= PEOPLE.length ? "is-focus" : ""}`}>{g ? `Start ${g.name}` : "Done"}</div>
      <Hints items={[["A", "Add or remove"], ["B", "Back"]]} />
    </div>
  );
}

function Turns({ s, focus }: { s: S; focus: number }) {
  const list = yourTurnDuels(s.duelsDone);
  const g = game("word-duel");
  return (
    <div className="sw-sheet">
      <div className="sw-sheet__card">
        <div className="sw-sheet__head">
          <span className="sw-sheet__icon"><GameArt g={g} /></span>
          <span>
            <span className="sw-sheet__title">Your turn · Word Duel</span>
            <span className="sw-sheet__sub">Pick one. You play it on your phone; your letters never show on the TV.</span>
          </span>
        </div>
        <div className="sw-turns">
          {list.length === 0 && <div className="sw-turns__none">All caught up. Every game is waiting on the other player.</div>}
          {list.map((d, i) => {
            const busy = s.duel === d.id;
            return (
              <div key={d.id} className={`sw-turn ${focus === i ? "is-focus" : ""} ${busy ? "is-busy" : ""}`}>
                <StickerImg src={d.sticker} size={160} color={d.color} />
                <span className="sw-turn__body">
                  <span className="sw-turn__who">{d.opponent} · {d.opponentHome}</span>
                  <span className="sw-turn__last">{d.lastMove}</span>
                  <span className="sw-turn__score">You {d.you} · {d.opponent} {d.them}</span>
                  {busy && <span className="sw-turn__busy"><Icon name="phone" size={28} /> On {personOf(s.remoteHolder).name}'s phone now</span>}
                </span>
              </div>
            );
          })}
        </div>
        <Hints items={[["A", "Play on phone"], ["B", "Back"]]} />
      </div>
    </div>
  );
}

function Devices({ s }: { s: S }) {
  const rows: [string, "phone" | "ipad", string, string][] = [
    ["dad", "phone", "Jonathan's iPhone", s.remoteHolder === "dad" ? (s.dadAsleep ? "Remote · asleep" : "Remote") : "Grown-up phone"],
    ["mom", "phone", "Mom's iPhone", s.remoteHolder === "mom" ? "Remote" : "Can take the remote"],
    ["juneau", "ipad", "Juneau's iPad", "Follows the TV · 82%"],
    ["ava", "ipad", "Ava's iPad", "Follows the TV · battery 9%, plug in soon"],
  ];
  return (
    <div className="sw-sheet">
      <div className="sw-sheet__card">
        <div className="sw-sheet__title">Phones & iPads on this TV</div>
        <div className="sw-devs">
          {rows.map(([pid, kind, name, note]) => (
            <div key={pid} className="sw-dev">
              <Sticker pid={pid} size={84} />
              <Icon name={kind} size={40} />
              <span className="sw-dev__name">{name}</span>
              <span className="sw-dev__note">{note}</span>
            </div>
          ))}
        </div>
        <div className="sw-sheet__sub">Only these devices see this TV. Kids' iPads can't change the game.</div>
        <Hints items={[["B", "Back"]]} />
      </div>
    </div>
  );
}

function GameView({ s, gameId, phase }: { s: S; gameId: string; phase: "starting" | "playing" }) {
  const g = game(gameId);
  const r = resumeOf(gameId, s);
  const roles = rolesFor(gameId, s.tonight);
  return (
    <div className="sw-game">
      <img className="sw-game__frame" src={g.art.tv} alt="" />
      {phase === "starting" && (
        <>
          {s.savedNote && (
            <div className="sw-saved"><Icon name="check" size={30} /> {s.savedNote}</div>
          )}
          <div className="sw-lower">
            <span className="sw-lower__tile"><GameArt g={g} /></span>
            <span className="sw-lower__body">
              <span className="sw-lower__name">{g.name}</span>
              <span className="sw-lower__sub">{r ? r.title : g.tagline}</span>
              <span className="sw-lower__roles">
                {roles.map((x) => (
                  <span key={x.pid} className="sw-lower__role"><Sticker pid={x.pid} size={48} /> {x.label}</span>
                ))}
              </span>
            </span>
          </div>
        </>
      )}
      {s.dadAsleep && s.remoteHolder === "dad" && (
        <div className="sw-corner"><Icon name="sleep" size={28} /> Jonathan's phone is asleep · any grown-up phone can be the remote</div>
      )}
    </div>
  );
}

function Recasting({ s }: { s: S }) {
  const v = s.view;
  const gid = v.kind === "game" ? v.gameId : null;
  const g = gid ? game(gid) : null;
  const r = gid ? resumeOf(gid, s) : null;
  return (
    <div className="sw-tv sw-splash">
      {g ? (
        <>
          <span className="sw-recast__tile"><GameArt g={g} /></span>
          <div className="sw-splash__hi">Picking up {g.name}</div>
          <div className="sw-splash__sub">{r ? `${r.title} · right where you were` : "Right where you were"}</div>
        </>
      ) : (
        <>
          <Logo size={150} />
          <div className="sw-splash__hi">Back on the TV</div>
          <div className="sw-splash__sub">Your home, as you left it</div>
        </>
      )}
      <div className="sw-progress"><span /></div>
    </div>
  );
}
