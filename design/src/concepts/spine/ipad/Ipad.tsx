// A kid's iPad: paired once ("this iPad is Juneau's"), it follows tonight's game by itself.
// It shows the game's own kid controller, or (between games) the following story in pictures.
import type { ComponentType } from "react";
import { game, personOf } from "../session";
import type { S } from "../state";
import { Asleep, Follow, Waiting } from "./Follow";
import { KidSpine } from "./KidSpine";
import { BakerPad, FixerPad, GenericPad, HelperPad } from "./pads";

/** The games' own kid views, by age band. Anything else gets a generic pad from its manifest. */
const KID: Record<string, { kid: ComponentType; little: ComponentType }> = {
  "rocket-crew": { kid: () => <FixerPad />, little: () => <FixerPad little /> },
  "bake-shop": { kid: () => <BakerPad />, little: () => <HelperPad /> },
};

export function Ipad({ s }: { s: S }) {
  const owner = s.ipadOwner;
  const asleep = owner === "ava" && s.avaAsleep;
  return (
    <div className="sp-root" style={{ background: "#0b0a14" }}>
      <Content s={s} owner={owner} />
      {!asleep && <KidSpine s={s} owner={owner} />}
    </div>
  );
}

function Content({ s, owner }: { s: S; owner: string }) {
  if (owner === "ava" && s.avaAsleep) return <Asleep owner={owner} />;
  if (s.swap === "saving" || s.swap === "cutover" || s.swap === "following") return <Follow s={s} owner={owner} />;
  if (s.tvHeld) return <Waiting s={s} owner={owner} />;
  if (owner === "juneau" && s.avaOnJuneau) return <Split />;
  const views = KID[s.current];
  const View = views ? (owner === "ava" ? views.little : views.kid) : undefined;
  return View ? <View /> : <GenericPad g={game(s.current)} />;
}

/** Ava's seat on Juneau's iPad: two kids across the iPad, her half turned to face her. */
function Split() {
  return (
    <div style={{ position: "absolute", inset: "0 0 96px 0" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "38%", overflow: "hidden", transform: "rotate(180deg)" }}>
        <HelperPad compact />
        <Badge id="ava" />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: "38%", height: 8, background: "var(--sp-ink)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: "calc(38% + 8px)", overflow: "hidden" }}>
        <BakerPad compact />
        <Badge id="juneau" />
      </div>
    </div>
  );
}

/** Whose half this is, in pictures. */
function Badge({ id }: { id: string }) {
  const p = personOf(id);
  return (
    <span aria-hidden style={{ position: "absolute", left: 28, top: 28, width: 92, height: 92, borderRadius: "50%", overflow: "hidden", background: p.color, boxShadow: `0 0 0 6px #fffaf0, 0 0 0 11px ${p.color}` }}>
      {p.portrait && <img src={p.portrait} alt="" style={{ width: "120%", height: "120%", objectFit: "cover", objectPosition: "50% 18%", margin: "-4% 0 0 -10%" }} />}
    </span>
  );
}
