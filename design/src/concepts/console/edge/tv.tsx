// The TV during a failure. Never an alarm: while the game is still running, OGS only adds a small
// chip in a corner (never over the focal area). When the picture itself is gone, the TV shows one
// calm card with the resume point, because that is all the room needs to know.
import type { ReactNode } from "react";
import { HOME, person } from "../../../world";
import { gameName, pointIn, type S } from "../state";
import { Mark, Portrait } from "../ui/Brand";
import { TvArt } from "../tv/TvArt";
import type { Fault } from "./fault";

function Chip({ side = "right", children, tone = "info" }: { side?: "left" | "right"; children: ReactNode; tone?: "info" | "ok" }) {
  return <div className={`eg-tvchip eg-tvchip--${side} eg-tvchip--${tone}`}>{children}</div>;
}

/** The game, still running, with an edge chip; the TV's own "now playing" chip steps aside when ours takes its corner. */
function WithChip({ children, chip, replaceOwn = false, home = false }: { children: ReactNode; chip: ReactNode; replaceOwn?: boolean; home?: boolean }) {
  return (
    <div className={`eg-tvwrap ${replaceOwn ? "eg-tvwrap--own" : ""} ${home ? "eg-tvwrap--home" : ""}`}>
      {children}
      {chip}
    </div>
  );
}

/** The picture is gone and coming back: one card over the game's own art, softly. */
function ComingBack({ s, gameId, kicker }: { s: S; gameId: string; kicker: string }) {
  return (
    <div className="eg-tvback">
      <div className="eg-tvback__art" aria-hidden>
        <TvArt gameId={gameId} />
      </div>
      <div className="eg-tvback__card">
        <span className="eg-tvback__mark">
          <Mark size={88} />
        </span>
        <span className="eg-tvback__kicker">{kicker}</span>
        <h1>{gameName(gameId)}</h1>
        <p>{pointIn(s, gameId)} · right where you were</p>
      </div>
    </div>
  );
}

export function EdgeTv({ s, f, children }: { s: S; f: Fault; children: ReactNode }): ReactNode {
  const gameId = s.onTv ?? "rocket-crew";
  const point = pointIn(s, gameId);
  switch (f.kind) {
    case "cast-lost":
      // The receiver dropped: nothing from OGS can reach this screen, so it shows only the TV's own idle.
      if (f.phase === "now") return <div className="eg-tvgone" aria-label="Cast dropped: the TV shows its own idle screen" />;
      if (f.phase === "recovering") return <ComingBack s={s} gameId={gameId} kicker="Back to" />;
      return backChip(children, point);
    case "stream-stall":
      if (f.phase === "now") {
        return (
          <div className="eg-tvfrozen">
            <div className="eg-tvfrozen__frame">{children}</div>
            <Chip side="left">
              <Mark size={34} />
              <b>Picture froze</b>
              <span>Restarting at {point}</span>
            </Chip>
          </div>
        );
      }
      if (f.phase === "recovering") return <ComingBack s={s} gameId={gameId} kicker="Picking up" />;
      return backChip(children, point);
    case "remote-dies":
      return (
        <WithChip
          chip={
            f.phase === "recovered" ? (
              <Chip tone="ok">
                <Portrait person={person("mom")} size={40} />
                <b>Mom's phone is the remote</b>
              </Chip>
            ) : (
              <Chip>
                <Mark size={34} />
                <b>Remote went quiet</b>
                <span>Any grown-up phone can pick it up</span>
              </Chip>
            )
          }
        >
          {children}
        </WithChip>
      );
    case "ipad-offline": {
      const dev = HOME.devices.find((d) => d.id === f.subject);
      const kid = person(dev?.personId ?? "juneau");
      return (
        <WithChip
          chip={
            <Chip tone={f.phase === "recovered" ? "ok" : "info"}>
              <Portrait person={kid} size={40} dim={f.phase !== "recovered"} />
              <b>{f.phase === "recovered" ? `${kid.name}'s back` : `${kid.name}'s iPad`}</b>
              {f.phase !== "recovered" && <span>{f.phase === "recovering" ? "Rejoining" : "Seat kept"}</span>}
            </Chip>
          }
        >
          {children}
        </WithChip>
      );
    }
    case "home-drops": {
      const n = s.nights.list.find((x) => x.gameId === "hearthisle");
      return (
        <WithChip
          chip={
            <Chip tone={f.phase === "recovered" ? "ok" : "info"}>
              <i className="eg-tvchip__seat" style={{ background: "#c8412f" }} />
              <b>Okafors</b>
              <span>
                {f.phase === "recovered"
                  ? f.night === "play-on"
                    ? "rejoin on their next turn"
                    : "back · nothing missed"
                  : f.phase === "recovering"
                    ? `reconnecting · board held`
                    : `offline · turn ${n?.turn ?? 15} held`}
              </span>
            </Chip>
          }
        >
          {children}
        </WithChip>
      );
    }
    case "game-down":
      if (f.phase === "now") {
        const down = f.subject ?? "bake-shop";
        return (
          <WithChip
            home
            chip={
              <Chip>
                <Mark size={34} />
                <b>{gameName(down)} isn't answering</b>
                <span>{pointIn(s, down)} is safe</span>
              </Chip>
            }
          >
            {children}
          </WithChip>
        );
      }
      return children;
    case "save-conflict":
    case "invite-expired":
    case "no-tv":
      return children;
  }
}

function backChip(children: ReactNode, point: string) {
  return (
    <WithChip
      replaceOwn
      chip={
        <Chip side="left" tone="ok">
          <Mark size={34} />
          <b>Back at {point}</b>
          <span>Nothing lost</span>
        </Chip>
      }
    >
      {children}
    </WithChip>
  );
}
