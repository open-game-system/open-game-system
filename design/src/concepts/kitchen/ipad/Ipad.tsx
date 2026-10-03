// A kid's iPad, paired once ("this iPad is Juneau's"), follows tonight. No words, anywhere.
import type { S } from "../state";
import { personOf } from "../household";
import { kidController } from "../games/registry";
import { Idle } from "./Idle";
import { Follow } from "./Follow";
import { Asleep } from "./Asleep";

export function Ipad({ s }: { s: S }) {
  const kid = personOf(s.ipadOf);
  const t = s.tonight;
  if (kid.id === "ava" && s.avaAsleep && !s.avaCaughtUp) return <Asleep kid={kid} />;
  if (t.kind === "idle") return <Idle kid={kid} />;
  if (t.kind === "switching") return <Follow kid={kid} from={t.from} to={t.to} step={t.step} />;
  const Page = kidController(t.gameId, kid);
  return (
    <div className="kt kt-page" key={t.gameId}>
      <Page kid={kid} />
    </div>
  );
}
