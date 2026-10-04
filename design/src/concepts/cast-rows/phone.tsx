// The grown-up phone: cast first, then it's the controller. Browse on the phone (the TV follows
// your finger) or a Roku-style remote one tap away. In a game it's that game's controller, with
// an always-there Home.
import { useRef, type PointerEvent as RPointerEvent } from "react";
import type { Store } from "../../harness/store";
import { gameById, HOME } from "../../world";
import { back, connect, confirmWho, DUEL_RACK, DUEL_WORD, goHome, leaveDuel, ok, placeTile, press, sendDuel, startItem, startNew, toggleWho, touchItem, type Dir } from "./actions";
import { focused, personOf, PEOPLE, resumeLine, roleFor, rowsFor, type Item, type S } from "./state";
import { Art, Icon, Sticker, relTime } from "./ui";

type P = { s: S; store: Store<S> };

export function PhoneSurface({ s, store }: P) {
  if (s.cast === "off" || s.cast === "picking" || s.cast === "none-found" || (s.cast === "connecting" && !s.recast)) return <Start s={s} store={store} />;
  if (s.phoneOwner !== s.remoteHolder && s.remoteAsleep) return <Pickup s={s} store={store} />;
  if (s.cast === "dropped" || s.cast === "connecting") return <Dropped s={s} store={store} />;
  if (s.tv === "game") return <Controller s={s} store={store} />;
  if (s.tv === "duel") return <DuelPhone s={s} store={store} />;
  return (
    <div className="ph">
      <Header s={s} store={store} />
      {s.mode === "remote" ? <Remote s={s} store={store} /> : s.tv === "who" ? <WhoPhone s={s} store={store} /> : <Browse s={s} store={store} />}
    </div>
  );
}

function CastChip({ s }: { s: S }) {
  const live = s.cast === "live";
  return (
    <div className="ph-cast">
      <span className="tvic" />
      <div>
        <b>Living room TV</b>
        <small className={live ? undefined : "warn"}>{live ? (s.remoteHolder === s.phoneOwner ? "You're the remote" : `${personOf(s.remoteHolder).name} has the remote`) : s.cast === "connecting" ? "Casting again…" : "Cast dropped"}</small>
      </div>
      <span className="sp" />
      <Sticker id={s.phoneOwner} size={44} />
    </div>
  );
}

function Header({ s, store }: P) {
  return (
    <div className="ph-top">
      <CastChip s={s} />
      <div className="seg" role="tablist">
        <button data-bot="mode-browse" className={s.mode === "browse" ? "on" : undefined} onClick={() => store.update((x) => ({ ...x, mode: "browse", keyboard: false }))}>
          <Icon name="browse" size={18} />
          Browse
        </button>
        <button data-bot="mode-remote" className={s.mode === "remote" ? "on" : undefined} onClick={() => store.update((x) => ({ ...x, mode: "remote" }))}>
          <Icon name="remote" size={18} />
          Remote
        </button>
      </div>
    </div>
  );
}

/* ---------------- Cast first ---------------- */

function Start({ s, store }: P) {
  const turns = rowsFor(s).find((r) => r.id === "turns");
  return (
    <div className="ph">
      <div className="ph-body noscroll" style={{ padding: 0 }}>
        <div className="ph-start">
          <img src={gameById("rocket-crew").art.tv} alt="" />
          <div style={{ position: "absolute", top: 58, left: 16, right: 16, zIndex: 2, display: "flex", alignItems: "center", gap: 10 }}>
            <span className="tv-mark" style={{ fontSize: 18 }}>
              <i style={{ width: 22, height: 22, borderWidth: 2.5 }} />
              Open Game
            </span>
            <span style={{ flex: 1 }} />
            <Sticker id={s.phoneOwner} size={44} />
          </div>
          <div className="in">
            <h1 className="disp">Put the games on the TV</h1>
            <p>Cast once. Every game opens on the TV from here, and switching games never recasts.</p>
            <button className="ph-btn" data-bot="cast" onClick={() => store.update((x) => ({ ...x, cast: "picking" }))}>
              <Icon name="tv" size={22} />
              Cast to a TV
            </button>
          </div>
        </div>
        {turns ? (
          <div style={{ padding: "0 16px 30px" }}>
            <div className="ph-sec">
              <h3 className="amber">
                Your turn <small>no TV needed</small>
              </h3>
              {turns.items.map((it) => (
                <TurnRow key={it.id} item={it} on={false} onTap={() => undefined} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {s.cast === "picking" || s.cast === "none-found" || s.cast === "connecting" ? <Picker s={s} store={store} /> : null}
    </div>
  );
}

function Picker({ s, store }: P) {
  const tvs = HOME.devices.filter((d) => d.kind === "tv");
  return (
    <>
      <div className="ph-scrim" onClick={() => store.update((x) => ({ ...x, cast: "off" }))} />
      <div className="ph-sheet">
        <div className="grab" />
        {s.cast === "none-found" ? (
          <>
            <h2>No TVs found</h2>
            <p className="sub">This phone is on "Mumm Home" Wi-Fi. We looked for a Chromecast there for 10 seconds.</p>
            <ol className="ph-steps">
              <li>Turn the TV on, so the Chromecast wakes up</li>
              <li>Check the TV is on "Mumm Home" Wi-Fi too</li>
              <li>Still nothing? Unplug the Chromecast for 10 seconds</li>
            </ol>
            <button className="ph-btn" data-bot="search-again" onClick={() => store.update((x) => ({ ...x, cast: "picking" }))}>
              <Icon name="refresh" size={20} />
              Look again
            </button>
          </>
        ) : (
          <>
            <h2>Cast to</h2>
            <p className="sub">The TV becomes the game shelf. This phone becomes its remote.</p>
            {tvs.map((tv) =>
              tv.online ? (
                <button key={tv.id} className="ph-tvrow" data-bot="pick-living" onClick={() => connect(store)}>
                  <span className="ic">
                    <Icon name="tv" />
                  </span>
                  <div style={{ flex: 1 }}>
                    <b>{tv.name}</b>
                    <span>{s.cast === "connecting" ? "Starting Open Game on the TV…" : "Chromecast · on Mumm Home"}</span>
                  </div>
                  {s.cast === "connecting" ? <span className="spin" /> : <Icon name="right" />}
                </button>
              ) : (
                <div key={tv.id} className="ph-tvrow off">
                  <span className="ic">
                    <Icon name="tv" color="#9a958d" />
                  </span>
                  <div>
                    <b>{tv.name}</b>
                    <span>Off or out of reach</span>
                  </div>
                </div>
              ),
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ---------------- Browse on the phone ---------------- */

function actionsFor(s: S, item: Item): { label: string; bot: string; run: (x: S) => S; icon?: "play" | "phone" }[] {
  const short = resumeLine(s, item)?.split(" · ")[0];
  if (item.kind === "duel") return [{ label: "Play on this phone", bot: `play-${item.id}`, run: (x) => startItem(x, item), icon: "phone" }];
  if (item.kind === "night") return [{ label: "Join the table", bot: `play-${item.id}`, run: (x) => startItem(x, item), icon: "play" }];
  if (item.kind === "couch")
    return [
      { label: `Continue ${short ?? ""}`.trim(), bot: `play-${item.id}`, run: (x) => startItem(x, item), icon: "play" },
      { label: "New", bot: `new-${item.id}`, run: (x) => startNew(x, item) },
    ];
  return [{ label: "Play", bot: `play-${item.id}`, run: (x) => startItem(x, item), icon: "play" }];
}

function Actions({ s, store, item }: P & { item: Item }) {
  return (
    <div className="ph-act">
      {actionsFor(s, item).map((a, i) => (
        <button key={a.bot} data-bot={a.bot} className={i === 0 ? "ph-play" : "ph-sec2"} onClick={(e) => { e.stopPropagation(); store.update(a.run); }}>
          {a.icon ? <Icon name={a.icon} size={18} /> : null}
          {a.label}
        </button>
      ))}
    </div>
  );
}

function Browse({ s, store }: P) {
  const rows = rowsFor(s);
  const cur = focused(s);
  const sel = (it: Item) => cur?.id === it.id && !s.fresh;
  const tap = (it: Item) => store.update((x) => touchItem(x, it));
  return (
    <div className="ph-body noscroll">
      {s.fresh ? (
        <div className="ph-note">
          <Icon name="tv" size={26} />
          <span>
            <b>You're the remote.</b> Touch a game to show it on the TV; touch it again to play.
          </span>
        </div>
      ) : null}
      {rows.map((r) => (
        <div className="ph-sec" key={r.id}>
          <h3 className={r.id === "turns" ? "amber" : undefined}>
            {r.title}
            {r.id === "turns" ? <small>played on this phone</small> : null}
          </h3>
          {r.id === "couch" ? (
            <div className="ph-grid">
              {r.items.map((it) => (
                <div key={it.id} className={`ph-item ph-tile${sel(it) ? " on" : ""}`}>
                  <button data-bot={`item-${it.id}`} onClick={() => tap(it)} style={{ display: "block", width: "100%", textAlign: "left" }}>
                    <div className="th" style={{ position: "relative" }}>
                      <Art game={it.game} tile={22} />
                    </div>
                    <b>{it.game.name}</b>
                  </button>
                  {sel(it) ? <Actions s={s} store={store} item={it} /> : null}
                </div>
              ))}
            </div>
          ) : r.id === "turns" ? (
            r.items.map((it) => (
              <div key={it.id} className={`ph-item${sel(it) ? " on" : ""}`}>
                <TurnRow item={it} on={sel(it)} onTap={() => tap(it)} />
                {sel(it) ? <Actions s={s} store={store} item={it} /> : null}
              </div>
            ))
          ) : (
            r.items.map((it) => (
              <div key={it.id} className={`ph-item${sel(it) ? " on" : ""}`}>
                <button className="ph-wide" data-bot={`item-${it.id}`} onClick={() => tap(it)} style={{ width: "100%", textAlign: "left" }}>
                  <span className="th">
                    <Art game={it.game} tile={18} />
                  </span>
                  <span className="tx">
                    {sel(it) ? <span className="ph-ontv">On the TV</span> : null}
                    <b>{it.game.name}</b>
                    <span>{lineFor(s, it)}</span>
                  </span>
                </button>
                {sel(it) ? <Actions s={s} store={store} item={it} /> : null}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function lineFor(s: S, it: Item): string {
  if (it.kind === "night" && it.instance) return `Turn 14 · ${it.instance.turn} to roll · tonight 8 pm`;
  if (it.kind === "couch") {
    const l = resumeLine(s, it) ?? "";
    return s.pausedTonight.includes(it.game.id) ? `Paused just now · ${l}` : l;
  }
  const shape = it.game.shape === "async" ? "Over days, on phones" : it.game.shape === "live" ? "Game night · 2–4 homes" : `Couch · ${it.game.minutes[0]}–${it.game.minutes[1]} min`;
  return shape;
}

function TurnRow({ item, on, onTap }: { item: Item; on: boolean; onTap: () => void }) {
  const d = item.duel;
  if (!d) return null;
  return (
    <button className="ph-wide" data-bot={`item-${item.id}`} onClick={onTap} style={{ width: "100%", textAlign: "left", background: "var(--cr-1)", borderRadius: 16 }}>
      <Sticker src={d.sticker} color={d.color} size={52} />
      <span className="tx">
        {on ? <span className="ph-ontv">On the TV</span> : null}
        <b>
          Word Duel · {d.opponent}
        </b>
        <span>
          {d.lastMove} · {relTime(d.updatedAt)}
        </span>
      </span>
    </button>
  );
}

/* ---------------- Who's playing (browse mode) ---------------- */

function WhoPhone({ s, store }: P) {
  const item = focused(s);
  if (!item) return null;
  return (
    <div className="ph-who">
      <h2 className="disp">Who's playing?</h2>
      <p>
        {item.game.name} · asked once tonight. Each iPad lights up when it's picked.
      </p>
      <div className="ph-who-g">
        {PEOPLE.map((p) => {
          const inn = s.tonight.includes(p.id);
          return (
            <button key={p.id} data-bot={`who-${p.id}`} className={inn ? "in" : undefined} onClick={() => store.update((x) => toggleWho(x, p.id))}>
              <Sticker id={p.id} size={88} dim={!inn} />
              <b>{p.name}</b>
              <span>{inn ? roleFor(item.game, p.id)?.label ?? "Playing" : "Sitting out"}</span>
            </button>
          );
        })}
      </div>
      <span style={{ flex: 1 }} />
      <button className="ph-btn" data-bot="who-start" onClick={() => store.update(confirmWho)} style={{ marginTop: 20 }}>
        <Icon name="play" size={20} />
        Start with {s.tonight.length} {s.tonight.length === 1 ? "player" : "players"}
      </button>
    </div>
  );
}

/* ---------------- Roku-style remote ---------------- */

function Remote({ s, store }: P) {
  const item = focused(s);
  const start = useRef<{ x: number; y: number } | null>(null);
  const go = (d: Dir) => store.update((x) => press(x, d));
  const down = (e: RPointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const up = (e: RPointerEvent) => {
    const st = start.current;
    start.current = null;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 36) return;
    e.preventDefault();
    if (Math.abs(dx) > Math.abs(dy)) go(dx > 0 ? "right" : "left");
    else go(dy > 0 ? "down" : "up");
  };
  const screen = s.tv === "who" ? "Who's playing" : s.tv === "detail" ? "Game page" : "Game shelf";
  return (
    <div className="rm">
      <div inert={s.keyboard} style={{ display: "contents" }}>
      <div className="rm-now">
        <span className="th">{item ? <Art game={item.game} tile={14} /> : null}</span>
        <div>
          <span>{screen} · on the TV</span>
          <b>{item ? `${item.game.name}${resumeLine(s, item) ? ` · ${resumeLine(s, item)?.split(" · ")[0]}` : ""}` : "Nothing focused"}</b>
        </div>
      </div>
      <div className="pad" onPointerDown={down} onPointerUp={up}>
        {(["up", "down", "left", "right"] as const).map((d) => (
          <button key={d} className={`edge ${d}`} data-bot={`pad-${d}`} aria-label={`Move ${d}`} onClick={() => go(d)}>
            <Icon name={d} size={26} />
          </button>
        ))}
        <button className="ok" data-bot="pad-ok" onClick={() => store.update(ok)}>
          OK
        </button>
        <span className="swipe-hint">Swipe to move · tap to choose</span>
      </div>
      <div className="rm-keys">
        <button className="rm-key" data-bot="rm-back" onClick={() => store.update(back)}>
          <Icon name="back" size={24} />
          Back
        </button>
        <button className="rm-key" data-bot="rm-home" onClick={() => store.update(goHome)}>
          <Icon name="home" size={24} />
          Home
        </button>
        <button className="rm-key" data-bot="rm-kbd" onClick={() => store.update((x) => ({ ...x, keyboard: !x.keyboard }))}>
          <Icon name="keyboard" size={24} />
          Keyboard
        </button>
      </div>
      </div>
      {s.keyboard ? <Keyboard store={store} /> : null}
    </div>
  );
}

function Keyboard({ store }: { store: Store<S> }) {
  return (
    <>
      <div className="ph-scrim" onClick={() => store.update((x) => ({ ...x, keyboard: false }))} />
      <div className="ph-sheet">
        <div className="grab" />
        <h2>Type on the TV</h2>
        <p className="sub">Letters go to the search box on the TV.</p>
        <label style={{ display: "flex", alignItems: "center", gap: 10, height: 52, borderRadius: 14, background: "var(--cr-2)", padding: "0 14px", font: "500 17px var(--cr-text)" }}>
          <Icon name="search" size={20} />
          <input aria-label="Search games" placeholder="Search games" style={{ flex: 1, background: "none", border: 0, color: "var(--cr-paper)", font: "inherit", outline: "none", height: 44 }} />
        </label>
        <button className="ph-btn ghost" style={{ marginTop: 12 }} onClick={() => store.update((x) => ({ ...x, keyboard: false }))}>
          Done
        </button>
      </div>
    </>
  );
}

/* ---------------- In a game: the game's own controller under OGS's Home ---------------- */

function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#141210" : "#ffffff";
}

function Controller({ s, store }: P) {
  const p = s.playing;
  if (!p) return null;
  const game = gameById(p.gameId);
  const role = roleFor(game, s.phoneOwner);
  const pal = game.palette;
  return (
    <div className="ph">
      <div className="ctl-bar">
        <button className="ctl-home" data-bot="home" onClick={() => store.update(goHome)}>
          <Icon name="home" size={20} />
          Home
        </button>
        <div className="ttl">
          <b>{game.name} on the TV</b>
          <span>Home saves it at {p.title.split(" · ")[0]}</span>
        </div>
      </div>
      <div className="ctl-game">
        <Art game={game} className="bg" alt />
        <div className="shade" style={{ background: `linear-gradient(180deg, ${pal.ground}cc 0%, ${pal.ground}f2 45%, ${pal.ground} 100%)` }} />
        <div className="gin" style={{ color: pal.ink }}>
          <span className="ctl-tag">{game.name}'s own controls</span>
          <div className="ctl-role">{role?.label ?? "Player"}</div>
          <div className="ctl-sub">{p.title}</div>
          <div className="ctl-pad">
            <button style={{ background: pal.accent2, color: onColor(pal.accent2) }}>Hint</button>
            <button style={{ background: pal.ink, color: pal.ground }}>Read aloud</button>
            <button className="wide" style={{ background: pal.accent, color: onColor(pal.accent) }}>
              Ready
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Word Duel on the phone ---------------- */

const BOARD: Record<string, string> = { "5-3": "Q", "5-4": "U", "5-5": "I", "5-6": "L", "5-7": "T", "1-6": "P", "2-6": "E", "3-6": "A", "4-6": "R", "8-1": "H", "8-2": "O", "8-3": "N", "8-4": "E", "8-5": "Y" };
const SLOTS = ["6-7", "7-7", "8-7"];

function DuelPhone({ s, store }: P) {
  const item = focused(s);
  const d = item?.duel;
  if (!d || !s.duel) return null;
  const placed = s.duel.placed;
  const ready = placed.length === SLOTS.length;
  return (
    <div className="ph">
      <div className="du">
        <div className="du-top">
          <button className="du-back" data-bot="duel-back" onClick={() => store.update(leaveDuel)}>
            <Icon name="tv" size={18} />
            Back to TV
          </button>
          <div className="du-vs">
            <div>
              <b>
                {d.opponent} {d.them}
              </b>
              <span>You {s.duel.sent ? d.you + 16 : d.you}</span>
            </div>
            <Sticker src={d.sticker} color={d.color} size={44} />
          </div>
        </div>
        {s.duel.sent ? (
          <div className="du-done">
            <h2 className="disp">TOWN for 16</h2>
            <p>
              Sent to {d.opponent}. You lead by {d.you + 16 - d.them}. We'll buzz this phone when it's your move again.
            </p>
            {rowsFor(s).find((r) => r.id === "turns") ? (
              <button className="du-send" style={{ width: "100%" }} data-bot="duel-next" onClick={() => store.update((x) => {
                const next = rowsFor(x).find((r) => r.id === "turns")?.items[0];
                return next ? startItem(x, next) : leaveDuel(x);
              })}>
                Next: your move with {rowsFor(s).find((r) => r.id === "turns")?.items[0]?.duel?.opponent}
              </button>
            ) : null}
            <button className="du-back" style={{ height: 52, padding: "0 20px" }} data-bot="duel-done" onClick={() => store.update(leaveDuel)}>
              Back to the TV
            </button>
          </div>
        ) : (
          <>
            <div className="du-last">{d.lastMove} · your move</div>
            <div className="du-board">
              {Array.from({ length: 121 }, (_, i) => {
                const k = `${Math.floor(i / 11)}-${i % 11}`;
                const slot = SLOTS.indexOf(k);
                const letter = BOARD[k] ?? (slot >= 0 ? placed[slot] : undefined);
                const cls = BOARD[k] ? "t" : letter ? "new" : i === 60 ? "c" : undefined;
                return (
                  <span key={i} className={cls}>
                    {letter ?? ""}
                  </span>
                );
              })}
            </div>
            <span style={{ flex: 1 }} />
            <div className="du-rack">
              {DUEL_RACK.map((l) => (
                <button key={l} data-bot={`tile-${l}`} className={placed.includes(l) ? "used" : undefined} onClick={() => store.update((x) => placeTile(x, l))}>
                  {l}
                </button>
              ))}
            </div>
            <button className="du-send" data-bot="duel-send" disabled={!ready} onClick={() => store.update(sendDuel)}>
              {ready ? `Play ${DUEL_WORD} for 16` : "Tap tiles to place them"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Edges ---------------- */

function Pickup({ s, store }: P) {
  const holder = personOf(s.remoteHolder).name;
  const inGame = s.tv === "game" && s.playing;
  return (
    <div className="ph">
      <div className="ph-top">
        <CastChip s={s} />
      </div>
      <div className="ph-banner calm" style={{ display: "flex", gap: 12, flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Sticker id={s.remoteHolder} size={56} dim />
          <div>
            <b>{holder}'s phone went to sleep</b>
            <span style={{ margin: "2px 0 0" }}>{inGame && s.playing ? `${gameById(s.playing.gameId).name} is waiting for its ${roleFor(gameById(s.playing.gameId), s.remoteHolder)?.label ?? "grown-up"}` : "The TV is waiting on the game shelf"}</span>
          </div>
        </div>
        <button className="ph-btn" data-bot="take-remote" onClick={() => store.update((x) => ({ ...x, remoteHolder: x.phoneOwner, remoteAsleep: false }))}>
          <Icon name={inGame ? "play" : "remote"} size={20} />
          {inGame ? `Take the ${roleFor(gameById(s.playing?.gameId ?? "rocket-crew"), s.remoteHolder)?.label ?? "grown-up"}'s controls` : "Take the remote"}
        </button>
        <span style={{ font: "500 14px var(--cr-text)", color: "var(--cr-paper-2)", margin: 0 }}>{holder} gets it back by opening Open Game.</span>
      </div>
    </div>
  );
}

function Dropped({ s, store }: P) {
  const p = s.playing;
  const game = p ? gameById(p.gameId) : undefined;
  return (
    <div className="ph">
      <div className="ph-top">
        <CastChip s={s} />
      </div>
      <div className="ph-banner">
        <b>{s.cast === "connecting" ? "Casting to the living room TV again…" : "The TV lost the cast"}</b>
        <span>
          {game && p ? `${game.name} is paused at ${p.title.split(" · ")[0]}. Nothing is lost; the iPads are waiting.` : "The game shelf is saved where you were. Nothing is lost."}
        </span>
        {s.cast === "connecting" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", font: "600 16px var(--cr-text)" }}>
            <span className="spin" />
            Starting Open Game on the TV
          </div>
        ) : (
          <button className="ph-btn" data-bot="recast" onClick={() => connect(store, true)}>
            <Icon name="tv" size={20} />
            Cast again
          </button>
        )}
      </div>
      {game ? (
        <div style={{ margin: "14px 16px", borderRadius: 16, overflow: "hidden", position: "relative", height: 200, opacity: 0.6 }}>
          <Art game={game} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : null}
      <div className="ph-note" style={{ margin: "0 16px" }}>
        <Icon name="pause" size={20} />
        <span>
          If someone switched the TV off, turn it on first. Casting again picks up exactly here.
        </span>
      </div>
    </div>
  );
}
