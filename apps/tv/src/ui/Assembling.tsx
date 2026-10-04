import type { Household } from "../session/data";
import { stickerUrl } from "../session/data";

/** Connecting: the living room assembling (furniture first, then the boxes), never a black card. */
export function Assembling({ household }: { household?: Household }) {
  return (
    <div className="screen home assembling" data-testid="assembling">
      <header className="topbar">
        <h1 className="room-name">{household ? `${household.name}' living room` : "OGS"}</h1>
      </header>
      <div className="assembling-hero">
        <p className="eyebrow">Connecting</p>
        <p className="assembling-line">Setting up the living room</p>
      </div>
      <div className="assembling-shelf">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="ghost-box" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <div className="couch">
        <div className="couch-back" />
        <div className="couch-seat">
          {household?.people.map((p, i) => (
            <figure
              key={p.id}
              className="sitter arriving"
              style={{ animationDelay: `${300 + i * 140}ms` }}
            >
              <img src={stickerUrl(p.sticker)} alt="" />
              <figcaption>{p.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
