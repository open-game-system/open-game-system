// Kid devices: roles with an audience decide who gets which screen; kid screens carry no words.
import { HOME, gameById } from "../../../../world";
import { seatPlan } from "../../state";
import { Portrait } from "../../ui/Brand";
import { C, L } from "../Code";
import type { DevPage } from "../pages";

const RULES: [string, string][] = [
  ["No words on kid and little screens", "Juneau reads a handful of words; Ava reads none. Use pictures, colour and sound. OGS checks every kid shot for letters."],
  ["Landscape, thumbs at the bottom", "1180 × 820, held in two hands. Big targets along the bottom edge."],
  ["Nothing to leave", "No links out, no back, no settings. OGS hides its own chrome on kid devices."],
  ["A little mashes", "Any tap on a little's screen is a good tap. Nothing a 2-year-old does can end the game."],
  ["Kids never get pushes", "Pushes go to grown-up phones only, even when a kid's turn is up."],
];

const AUDIENCE: Record<string, string> = { grownup: "Reads. Gets your full controller.", kid: "5 and up. No words.", little: "Under 4. Mash-proof." };

export function Kids({ go }: { go: (p: DevPage) => void }) {
  const g = gameById("peekaboo-garden");
  const plan = seatPlan(g, HOME.people.filter((p) => p.id !== "mom"));
  return (
    <div className="dv-split">
      <article className="dv-doc">
        <p className="dv-kicker">Guide · every tier</p>
        <h1 className="dv-h1">Kid devices</h1>
        <p className="dv-lede">
          <L>Every role names its <C>audience</C>.</L>
          <L>OGS seats each person by age band, so a kid's iPad opens your kid screen with no picker. Three audiences, five rules.</L>
        </p>
        <ol className="dv-rules">
          {RULES.map(([h, d], i) => (
            <li key={h}>
              <span className="dv-step">{i + 1}</span>
              <span>
                <b>{h}</b>
                <span>{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <button className="dv-link" data-bot="next-library" onClick={() => go("library")}>
          See every tier in the library →
        </button>
      </article>

      <aside className="dv-codecol dv-codecol--light">
        <p className="dv-colhead">Peekaboo Garden's roles, seated for the Mumms</p>
        <ul className="dv-seatmap">
          {plan.map((a) => (
            <li key={a.person.id}>
              <span className="dv-seatmap__who">
                <Portrait person={a.person} size={44} />
                <span>
                  <b>{a.person.name}</b>
                  <span>{a.device?.name ?? "Phone"}</span>
                </span>
              </span>
              <span className="dv-seatmap__arrow" aria-hidden>
                →
              </span>
              <span className="dv-seatmap__role">
                <C>{`{ "id": "${a.role.id}", "audience": "${a.role.audience}" }`}</C>
                <span>{AUDIENCE[a.role.audience]}</span>
              </span>
            </li>
          ))}
        </ul>
        <figure className="dv-ipad">
          <div className="dv-ipad__screen">
            <img src={g.art.extra?.frog ?? g.art.tv} alt="" />
            <span className="dv-ipad__pads" aria-hidden>
              <span style={{ background: g.palette.accent }} />
              <span style={{ background: g.palette.accent2 }} />
              <span style={{ background: g.palette.ink }} />
            </span>
          </div>
          <figcaption>Sketch: Juneau's iPad in landscape. Pictures, colour and big pads along the bottom; no words.</figcaption>
        </figure>
      </aside>
    </div>
  );
}
