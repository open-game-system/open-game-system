// The TV URL contract: what the cast stream is, and the five rules of a TV page.
import { gameById } from "../../../../world";
import { C, CodeCard } from "../Code";
import type { DevPage } from "../pages";
import { CAST_SNIPPET, STREAM_SNIPPET } from "../samples";

const RULES: [string, string][] = [
  ["1920 × 1080, streamed at 30 fps", "A cloud browser renders your tvUrl and streams it to the Chromecast. Design for exactly that frame."],
  ["Nobody can touch it", "No buttons, no hover, no “tap to start”. Players act on their phones and iPads."],
  [`?stream=1 means play sound now`, "Autoplay is allowed in the stream. Start music on mount."],
  ["A fresh browser every cast", "Nothing survives in the TV's localStorage. Keep progress in your room or in OGS saves."],
  ["Readable from the couch", "Text 24 px or larger. OGS never draws over your page."],
];

export function Casting({ go }: { go: (p: DevPage) => void }) {
  const g = gameById("peekaboo-garden");
  return (
    <div className="dv-split">
      <article className="dv-doc">
        <p className="dv-kicker">Guide · every tier</p>
        <h1 className="dv-h1">The TV page</h1>
        <p className="dv-lede">
          Your <C>tvUrl</C> is a page, not a video. OGS casts it as-is; you never write receiver code.
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
        <p className="dv-p">
          Need the room in the TV URL? Call <C>useCastViewUrl</C> from your host page. It replaces the manifest's <C>tvUrl</C> for that cast.
        </p>
        <button className="dv-link" data-bot="next-kids" onClick={() => go("kids")}>
          Next: kid devices →
        </button>
      </article>

      <aside className="dv-codecol">
        <figure className="dv-tvframe">
          <div className="dv-tvframe__screen">
            <img src={g.art.tv} alt="Peekaboo Garden's TV page, as the stream shows it" />
            <span className="dv-tvframe__dim dv-tvframe__dim--w">1920 px</span>
            <span className="dv-tvframe__dim dv-tvframe__dim--h">1080 px</span>
          </div>
          <figcaption>
            <C>{g.tvUrl}?stream=1</C>
          </figcaption>
        </figure>
        <CodeCard title="Start sound in the stream" code={STREAM_SNIPPET} lang="ts" />
        <CodeCard title="Optional: point the cast at a room" code={CAST_SNIPPET} lang="ts" />
      </aside>
    </div>
  );
}
