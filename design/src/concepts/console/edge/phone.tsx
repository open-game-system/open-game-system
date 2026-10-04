// The grown-up phone during a failure: one calm line, one recovery action, the resume point shown,
// and (where it helps) the one sentence of the session model that makes the promise true.
import type { ReactNode } from "react";
import type { Store } from "../../../harness/store";
import { HOME, NANA, OKAFORS, gameById, person } from "../../../world";
import { castAndPlay, gameName, hereTonight, resumePoint, seatPlan, type S } from "../state";
import { GameArt } from "../ui/GameArt";
import { TabletIcon } from "../ui/Icons";
import type { Fault, FaultPhase } from "./fault";
import { Banner, Btn, HomeDot, Lock, Page, PersonIcon, Quiet, TvGlyph, type Row } from "./parts";

const set = (store: Store<S>, patch: Partial<Fault>) => store.update((x) => (x.fault ? { ...x, fault: { ...x.fault, ...patch } } : x));
const to = (store: Store<S>, phase: FaultPhase) => set(store, { phase });

/** Who on the couch is waiting in their seat, from tonight's seat plan (kids' iPads only). */
function kidRows(s: S, gameId: string, note: (name: string, him: boolean) => string, state: Row["state"]): Row[] {
  return seatPlan(gameById(gameId), hereTonight(s))
    .filter((x) => x.device?.kind === "ipad")
    .map((x) => ({ key: x.person.id, icon: <PersonIcon p={x.person} />, name: x.device?.name ?? x.person.name, note: note(x.person.name, x.person.id === "juneau"), state }));
}

export function EdgePhone({ s, store, f, children }: { s: S; store: Store<S>; f: Fault; children: ReactNode }): ReactNode {
  switch (f.kind) {
    case "cast-lost":
    case "stream-stall":
      return <TvTrouble s={s} store={store} f={f}>{children}</TvTrouble>;
    case "remote-dies":
      return <RemoteHandoff s={s} store={store} f={f}>{children}</RemoteHandoff>;
    case "ipad-offline":
      return <KidOffline s={s} f={f}>{children}</KidOffline>;
    case "save-conflict":
      return <SaveConflict s={s} store={store} f={f}>{children}</SaveConflict>;
    case "home-drops":
      return <HomeDrops s={s} store={store} f={f}>{children}</HomeDrops>;
    case "invite-expired":
      return <InviteExpired store={store} f={f} />;
    case "game-down":
      return <GameDown s={s} store={store} f={f}>{children}</GameDown>;
    case "no-tv":
      return <NoTv s={s} store={store} f={f}>{children}</NoTv>;
  }
}

// ---- 1 & 2: the TV lost the cast / the picture froze ----

function TvTrouble({ s, store, f, children }: { s: S; store: Store<S>; f: Fault; children: ReactNode }) {
  const gameId = s.onTv ?? "rocket-crew";
  const point = resumePoint(gameId);
  const name = gameName(gameId);
  const lost = f.kind === "cast-lost";
  if (f.phase === "recovered") {
    return (
      <Banner tone="ok" line={`Back on the TV at ${point}`} sub="Nothing lost. Juneau and Ava are back in their seats.">
        {children}
      </Banner>
    );
  }
  const recovering = f.phase === "recovering";
  const tvRow: Row = {
    key: "tv",
    icon: <TvGlyph />,
    name: "Living room TV",
    note: recovering ? `Starting a fresh picture at ${point}` : lost ? "Not connected" : "Picture froze",
    state: recovering ? "busy" : "off",
  };
  const rows = [tvRow, ...kidRows(s, gameId, (n, him) => (recovering ? `${n} drops back in by ${him ? "himself" : "herself"}` : `Waiting in ${him ? "his" : "her"} seat`), recovering ? "busy" : "wait")];
  return (
    <Page
      title={name}
      where="Living room TV"
      gameId={gameId}
      pointLabel={`Paused at ${point}`}
      line={recovering ? (lost ? "Casting to the Living room TV" : "Starting a fresh TV picture") : lost ? "The TV dropped the cast." : "The TV picture froze."}
      sub={
        recovering
          ? `${name} picks up at ${point}. Nobody has to do anything.`
          : lost
            ? `${name} paused itself at ${point}. Nothing's lost.`
            : `${name} is safe at ${point}. OGS restarts the picture by itself in a few seconds.`
      }
      model="Tonight lives in OGS, not on the TV. A new picture picks up right here."
      rows={rows}
      action={
        lost ? (
          <Btn bot="edge-recast" busy={recovering} onClick={() => to(store, "recovering")}>
            {recovering ? "Connecting" : "Cast to Living room TV"}
          </Btn>
        ) : (
          <Btn bot="edge-restart" busy={recovering} onClick={() => to(store, "recovering")}>
            {recovering ? "Restarting" : "Restart the picture now"}
          </Btn>
        )
      }
    />
  );
}

// ---- 3: the remote phone dies; Mom's phone picks it up ----

function RemoteHandoff({ s, store, f, children }: { s: S; store: Store<S>; f: Fault; children: ReactNode }) {
  const gameId = s.onTv ?? "rocket-crew";
  const point = resumePoint(gameId);
  const name = gameName(gameId);
  if (f.phase === "now") {
    return (
      <Lock
        who="Mom's iPhone"
        title="Jonathan's phone went dark"
        body={`${name} is still going at ${point}. Tap to pick up the remote.`}
        bot="edge-push-remote"
        onOpen={() => to(store, "recovering")}
        hint="Pushes go to grown-up phones in the family only."
      />
    );
  }
  if (f.phase === "recovering") {
    const dad = person("dad");
    return (
      <Page
        title={name}
        where={`Living room TV · ${point}`}
        gameId={gameId}
        pointLabel={`Still playing · ${point}`}
        glyph="live"
        line="Pick up the remote?"
        sub="This phone becomes the remote and Jonathan's captain seat. Nothing restarts."
        model="Any grown-up phone in the family can hold the remote. Tonight lives in OGS, not on a phone."
        rows={[
          { key: "dad", icon: <PersonIcon p={dad} />, name: "Jonathan's iPhone", note: "Battery empty · last seen 7:20", state: "off" },
          { key: "tv", icon: <TvGlyph />, name: "Living room TV", note: `${name} still on · kids still playing`, state: "ok" },
        ]}
        action={
          <Btn bot="edge-take-remote" onClick={() => to(store, "recovered")}>
            Take the remote
          </Btn>
        }
      />
    );
  }
  return (
    <Banner tone="ok" line="Mom's phone is the remote now" sub={`Still ${point}. When Jonathan's phone is back, it joins as a player.`}>
      {children}
    </Banner>
  );
}

// ---- 4: a kid iPad goes offline; its seat is kept and it rejoins by itself ----

function KidOffline({ s, f, children }: { s: S; f: Fault; children: ReactNode }) {
  const dev = HOME.devices.find((d) => d.id === f.subject);
  const kid = person(dev?.personId ?? "juneau");
  const his = kid.id === "ava" ? "her" : "his";
  const point = resumePoint(s.onTv ?? "rocket-crew");
  if (f.phase === "recovered") {
    return (
      <Banner tone="ok" line={`${kid.name} is back in ${his} seat`} sub={`${dev?.name ?? "The iPad"} rejoined at ${point} by itself.`}>
        {children}
      </Banner>
    );
  }
  return (
    <Banner
      tone="info"
      line={f.phase === "recovering" ? `${dev?.name ?? "The iPad"} is back on Wi-Fi` : `${dev?.name ?? "The iPad"} lost Wi-Fi`}
      sub={f.phase === "recovering" ? `Rejoining ${his} seat at ${point}.` : `${kid.name}'s seat is kept. It rejoins by itself; nothing to do.`}
    >
      {children}
    </Banner>
  );
}

// ---- 5: save conflict (the game's save PUT came back 409) ----

const VERSIONS = {
  tonight: { when: "Living room · 7:12 pm", by: "Played on the TV just now", what: ["4 of 5 orders baked", "Rainbow sprinkles unlocked", "Mrs. Bear served"] },
  tuesday: { when: "Mom's iPhone · 6:40 pm", by: "Played earlier tonight, offline", what: ["3 of 5 orders baked", "Strawberry tart on the shelf", "Mrs. Bear still waiting"] },
} as const;

function SaveConflict({ s, store, f, children }: { s: S; store: Store<S>; f: Fault; children: ReactNode }) {
  const pick = f.save ?? "tonight";
  if (f.phase === "recovered" || f.phase === "undone") {
    const kept = f.phase === "undone" ? "tuesday" : pick;
    const other = kept === "tonight" ? "tuesday" : "tonight";
    return (
      <Banner
        tone="ok"
        line={kept === "tonight" ? "The living room's day 4 is loaded" : "Mom's day 4 is loaded"}
        sub={`${kept === "tonight" ? "Mom's" : "The living room's"} day 4 is kept in Saves for 30 days.`}
        action={
          f.phase === "recovered" ? (
            <button className="eg-banner__act" data-bot="edge-save-swap" onClick={() => set(store, { phase: "undone", save: other })}>
              Use {other === "tonight" ? "the TV's" : "Mom's"}
            </button>
          ) : undefined
        }
      >
        {children}
      </Banner>
    );
  }
  void s;
  const recovering = f.phase === "recovering";
  return (
    <Page
      title="Bake Shop"
      where="Day 4 · two saves"
      line="Two phones saved day 4 differently."
      sub="Pick the one to keep playing. The other one is kept in Saves, so nothing's lost."
      model="Saves live in OGS for the whole family, not on one phone."
      action={
        <Btn bot="edge-save-keep" busy={recovering} onClick={() => to(store, "recovering")}>
          {recovering ? "Loading day 4" : `Keep ${pick === "tonight" ? "the living room's" : "Mom's"} day 4`}
        </Btn>
      }
    >
      <div className="eg-versions" role="radiogroup" aria-label="Which day 4">
        {(["tonight", "tuesday"] as const).map((k) => {
          const v = VERSIONS[k];
          return (
            <button key={k} role="radio" aria-checked={pick === k} className={`eg-version ${pick === k ? "is-on" : ""}`} data-bot={`edge-save-${k}`} onClick={() => set(store, { save: k })}>
              <span className="eg-version__art">
                <img src={k === "tonight" ? "/art/bake-shop/tv.jpg" : "/art/bake-shop/alt.jpg"} alt="" />
              </span>
              <span className="eg-version__text">
                <b>{v.when}</b>
                <span className="eg-version__by">{v.by}</span>
                <span className="eg-version__what">
                  {v.what.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </span>
              </span>
              <span className="eg-version__radio" aria-hidden />
            </button>
          );
        })}
      </div>
    </Page>
  );
}

// ---- 6: a home drops mid game night ----

function HomeDrops({ s, store, f, children }: { s: S; store: Store<S>; f: Fault; children: ReactNode }) {
  const turn = s.nights.list.find((n) => n.gameId === "hearthisle")?.turn ?? 15;
  const okafors = OKAFORS;
  const viewer = f.viewer ?? "dad";
  if (viewer === "tunde") return <OkaforPhone store={store} f={f} turn={turn} />;
  if (viewer === "nana") return <NanaWaiting f={f} turn={turn} />;
  if (f.phase === "recovered") {
    return (
      <Banner
        tone="ok"
        line={f.night === "play-on" ? "Playing on without the Okafors" : "The Okafors are back"}
        sub={f.night === "play-on" ? `Their seat keeps its score; they rejoin on their next turn.` : "They picked up their roll at turn 15. Nobody lost a move."}
      >
        {children}
      </Banner>
    );
  }
  const recovering = f.phase === "recovering";
  const homes: Row[] = [
    { key: "ok", icon: <HomeDot color="#c8412f" />, name: okafors.name, note: recovering ? "Reconnecting · board held for them" : "Offline since 8:21 · seat held", state: recovering ? "busy" : "off" },
    { key: "nana", icon: <HomeDot color="#e08a1e" />, name: NANA.name, note: "Waiting · they see the board is held", state: "wait" },
    { key: "us", icon: <HomeDot color="#2f6fc8" />, name: `${HOME.name} · hosting`, note: "You decide for the table", state: "ok" },
  ];
  return (
    <Page
      title="Hearthisle"
      where={`Game night · turn ${turn}`}
      gameId="hearthisle"
      pointLabel={`Held at turn ${turn}`}
      line={recovering ? "Holding the board for the Okafors" : "The Okafors dropped off."}
      sub={recovering ? "Everyone sees the board waiting. If they're not back in 10 minutes, you can pause the night for everyone." : `It was their roll at turn ${turn}. Their seat is held; you're hosting, so you decide.`}
      model="The night lives on the game's server. A home that drops keeps its seat."
      rows={homes}
      action={
        recovering ? undefined : (
          <Btn bot="edge-night-wait" onClick={() => set(store, { phase: "recovering", night: "wait" })}>
            Hold the board for them
          </Btn>
        )
      }
      quiet={
        recovering ? undefined : (
          <Quiet bot="edge-night-play-on" onClick={() => store.update((x) => nightResumes(x, "play-on"))}>
            Play on and skip their turns
          </Quiet>
        )
      }
    />
  );
}

function OkaforPhone({ store, f, turn }: { store: Store<S>; f: Fault; turn: number }) {
  const back = f.phase === "recovered";
  const recovering = f.phase === "recovering";
  return (
    <Page
      title="Hearthisle"
      where={`Tunde's phone · ${OKAFORS.name}`}
      gameId="hearthisle"
      pointLabel={`Your seat · turn ${turn}`}
      glyph={back ? "live" : "pause"}
      line={back ? "You're back. Your roll." : "You're offline."}
      sub={back ? `Turn ${turn}. The Mumms held the board for you.` : `Your seat is held at turn ${turn}. The Mumms are hosting and holding the board.`}
      action={
        back ? (
          <Btn bot="edge-okafor-roll">Roll</Btn>
        ) : (
          <Btn bot="edge-okafor-retry" busy={recovering} onClick={() => to(store, "recovering")}>
            {recovering ? "Reconnecting" : "Reconnect"}
          </Btn>
        )
      }
    />
  );
}

function NanaWaiting({ f, turn }: { f: Fault; turn: number }) {
  const back = f.phase === "recovered";
  return (
    <Page
      title="Hearthisle"
      where={`Nana's phone · ${NANA.name}`}
      gameId="hearthisle"
      pointLabel={back ? `Turn ${turn} · Okafors to roll` : `Held at turn ${turn}`}
      glyph={back ? "live" : "pause"}
      line={back ? "The Okafors are back." : "Waiting on the Okafors."}
      sub={back ? "Their roll, then yours." : "They lost their connection. The Mumms are hosting and holding the board; nothing for you to do."}
      model="Nobody loses a move while a home reconnects."
    />
  );
}

// ---- 7: an expired game-night invite ----

function InviteExpired({ store, f }: { store: Store<S>; f: Fault }) {
  const viewer = f.viewer ?? "nana";
  if (viewer === "dad") {
    if (f.phase === "recovered") {
      return (
        <Lock who="Jonathan's iPhone" title="New link sent to Nana" body="It's good for 3 days, and it opens straight into the night's seats." bot="edge-push-sent" onOpen={() => undefined} hint="Nana & Pop keep their seat colour: amber." />
      );
    }
    return (
      <Lock
        who="Jonathan's iPhone"
        title="Nana asked for a new game-night link"
        body="Her Hearthisle invite from Tuesday expired. Tap to send a fresh one."
        bot="edge-push-resend"
        onOpen={() => to(store, "recovered")}
        hint="One tap sends it; nothing else changes."
      />
    );
  }
  const asked = f.phase === "recovered";
  const recovering = f.phase === "recovering";
  return (
    <Page
      light
      title="Hearthisle game night"
      where="From Jonathan · The Mumms"
      gameId="hearthisle"
      pointLabel="Invite from Tuesday"
      glyph="none"
      line={asked ? "Asked Jonathan for a new link." : "This invite has expired."}
      sub={asked ? "It'll come to this phone. Your seat is held for you." : "Game-night links last 3 days, and this one is from Tuesday. The night is still on, and your seat is held."}
      rows={[
        { key: "us", icon: <HomeDot color="#2f6fc8" />, name: `${HOME.name} · hosting`, note: "Tonight 8:00 · their TV", state: "ok" },
        { key: "ok", icon: <HomeDot color="#c8412f" />, name: OKAFORS.name, note: "In · their TV", state: "ok" },
        { key: "nana", icon: <HomeDot color="#e08a1e" />, name: `${NANA.name} · you`, note: asked ? "Seat held · new link on its way" : "Seat held · amber", state: asked ? "busy" : "wait" },
      ]}
      action={
        asked ? undefined : (
          <Btn bot="edge-ask-link" busy={recovering} onClick={() => to(store, "recovering")}>
            {recovering ? "Asking" : "Ask Jonathan for a new link"}
          </Btn>
        )
      }
    />
  );
}

// ---- 8: a game's server is down ----

function GameDown({ s, store, f, children }: { s: S; store: Store<S>; f: Fault; children: ReactNode }) {
  const down = f.subject ?? "bake-shop";
  const back = "rocket-crew";
  if (f.phase === "recovered") {
    return (
      <Banner tone="ok" line={`${gameName(back)} at ${resumePoint(back)}`} sub={`We'll tell you when ${gameName(down)} is back. Day 4 is safe.`}>
        {children}
      </Banner>
    );
  }
  void s;
  const recovering = f.phase === "recovering";
  return (
    <Page
      title={gameName(down)}
      where="Living room TV · console home"
      gameId={down}
      pointLabel={`Saved · ${resumePoint(down)}`}
      line={`${gameName(down)} isn't answering.`}
      sub={`Its server is down, not your save: ${resumePoint(down).toLowerCase()} is safe in OGS. The TV stays on the console.`}
      rows={[
        { key: "srv", icon: <TvGlyph />, name: `${gameName(down)}'s server`, note: "Tried 3 times · checking every minute", state: "off" },
        { key: "rc", icon: <span className="eg-thumb"><GameArt gameId={back} /></span>, name: gameName(back), note: `Ready · ${resumePoint(back)}`, state: "ok" },
      ]}
      action={
        <Btn
          bot="edge-play-other"
          busy={recovering}
          onClick={() => store.update((x) => ({ ...x, onTv: back, tvFocus: back, phone: "controller", fault: x.fault ? { ...x.fault, phase: "recovering" } : null }))}
        >
          {recovering ? `Starting ${gameName(back)}` : `Play ${gameName(back)} · ${resumePoint(back)}`}
        </Btn>
      }
    />
  );
}

// ---- 9: no TV found when starting tonight ----

function NoTv({ s, store, f, children }: { s: S; store: Store<S>; f: Fault; children: ReactNode }) {
  const gameId = s.tvFocus;
  if (f.phase === "recovered") {
    return (
      <Banner tone="ok" line="Found the Living room TV" sub={`${gameName(gameId)} is coming up at ${resumePoint(gameId)}.`}>
        {children}
      </Banner>
    );
  }
  const recovering = f.phase === "recovering";
  const bedroom = HOME.devices.find((d) => d.id === "dev-bedroom-tv");
  return (
    <Page
      title="Tonight"
      where={`${gameName(gameId)} · ${resumePoint(gameId)}`}
      gameId={gameId}
      pointLabel={`Ready · ${resumePoint(gameId)}`}
      glyph="none"
      line={recovering ? "Looking for the Living room TV" : "Can't find the Living room TV."}
      sub={recovering ? "Still looking. It shows up here as soon as it's on." : "It may be off, or on another Wi-Fi. Turn it on and it shows up here by itself."}
      rows={[
        { key: "tv", icon: <TvGlyph />, name: "Living room TV", note: recovering ? "Looking on this Wi-Fi" : "Not found on this Wi-Fi", state: recovering ? "busy" : "off" },
        { key: "bed", icon: <TvGlyph />, name: bedroom?.name ?? "Bedroom TV", note: "Off", state: "off" },
        { key: "j", icon: <TabletIcon size={26} />, name: "Juneau's iPad", note: "Ready for his seat", state: "ok" },
      ]}
      action={
        <Btn bot="edge-look-again" busy={recovering} onClick={() => to(store, "recovering")}>
          {recovering ? "Looking" : "I turned it on · look again"}
        </Btn>
      }
    />
  );
}

/** What "found it" does to the session: cast and play, exactly as if it had been there. */
export const foundTv = (s: S): S => castAndPlay(s, s.tvFocus);

/**
 * The night page comes back once the table moves again (while a home is away the phone shows the
 * failure page, so the board's turns don't advance under it). Waiting: the Okafors are back.
 */
export function nightResumes(s: S, choice: "wait" | "play-on"): S {
  const list = s.nights.list.map((n) =>
    n.gameId === "hearthisle" && choice === "wait" ? { ...n, homes: n.homes.map((h) => (h.householdId === "hh-okafor" ? { ...h, back: true } : h)) } : n,
  );
  return { ...s, phone: "night", nights: { ...s.nights, list }, fault: s.fault ? { ...s.fault, phase: "recovered", night: choice } : null };
}
