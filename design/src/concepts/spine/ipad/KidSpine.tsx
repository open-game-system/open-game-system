// The kid iPad's spine: same ink and stitching as the grown-up's, but only pictures. Nothing in it
// can be tapped, so a mashing toddler can't leave tonight's game.
import { game, personOf, TONIGHT } from "../session";
import { TvGlyph } from "../glyphs";
import type { S } from "../state";

export function KidSpine({ s, owner, dim }: { s: S; owner: string; dim?: boolean }) {
  const g = game(s.target ?? s.current);
  return (
    <div className="sp-stitch-top" aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: "var(--sp-ink)", display: "flex", alignItems: "center", gap: 28, padding: "10px 36px 0", opacity: dim ? 0.6 : 1, zIndex: 3 }}>
      <span style={{ position: "relative", color: "var(--sp-bone)" }}>
        <TvGlyph size={44} />
        {!dim && <span className="sp-bead" style={{ position: "absolute", top: 6, right: 2, width: 12, height: 12 }} />}
      </span>
      <span style={{ display: "inline-flex", flex: 1, justifyContent: "center", gap: 14 }}>
        {TONIGHT.map((id) => {
          const p = personOf(id);
          const me = id === owner;
          return (
            <span key={id} style={{ width: me ? 62 : 46, height: me ? 62 : 46, borderRadius: "50%", background: p.color, boxShadow: me ? `0 0 0 4px var(--sp-ink), 0 0 0 7px ${p.color}` : "0 0 0 3px var(--sp-ink)", overflow: "hidden", alignSelf: "center" }}>
              {p.portrait && <img src={p.portrait} alt="" style={{ width: "120%", height: "120%", objectFit: "cover", objectPosition: "50% 18%", margin: "-4% 0 0 -10%" }} />}
            </span>
          );
        })}
      </span>
      <span style={{ width: 52, height: 66, borderRadius: 4, transform: "rotate(-5deg)", background: g.art.tv ? `center/cover url(${g.art.tv})` : g.palette.ground, boxShadow: `0 0 0 3px ${g.palette.accent}` }} />
    </div>
  );
}
