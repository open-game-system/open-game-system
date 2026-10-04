import type { Member } from "@open-game-system/ogs-protocol";
import { stickerUrl } from "../session/data";

/** Who's here: the painted stickers of everyone who joined this cast, on the couch. */
export function Couch({ members, arriving }: { members: Member[]; arriving?: boolean }) {
  return (
    <div className="couch" data-testid="couch">
      <div className="couch-back" />
      <div className="couch-seat">
        {members.map((m, i) => (
          <figure
            key={m.profileId}
            className={`sitter${arriving ? " arriving" : ""}`}
            style={arriving ? { animationDelay: `${300 + i * 140}ms` } : undefined}
            data-profile={m.profileId}
          >
            <img src={stickerUrl(m.sticker)} alt="" />
            <figcaption>{m.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
