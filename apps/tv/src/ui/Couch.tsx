import type { Household } from "../session/data";
import { stickerUrl } from "../session/data";

/** Who's here: the household's painted stickers sitting on the couch. */
export function Couch({ household, highlight }: { household: Household; highlight?: string[] }) {
  return (
    <div className="couch" data-testid="couch">
      <div className="couch-back" />
      <div className="couch-seat">
        {household.people.map((p) => (
          <figure
            key={p.id}
            className={`sitter${highlight?.includes(p.id) ? " playing" : ""}`}
            data-person={p.id}
          >
            <img src={stickerUrl(p.sticker)} alt="" />
            <figcaption>{p.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
