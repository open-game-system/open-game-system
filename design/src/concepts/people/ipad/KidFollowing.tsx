// Following, told without words: the old game's window slides away, the kid's own patch hops
// along a stitched path into the next game's window.
import { gameById, type Person } from "../../../world";
import { Patch } from "../ui/Patch";

export function KidFollowing({ kid, from, to, stage }: { kid: Person; from?: string; to: string; stage: "leaving" | "going" }) {
  const old = from ? gameById(from) : undefined;
  const next = gameById(to);
  return (
    <div className="pf-kidbg" style={{ background: stage === "going" ? next.palette.ground : undefined, transition: "background 0.8s" }}>
      {old && (
        <div className={`pf-kid-window old${stage === "going" ? " gone" : ""}`}>
          <img src={old.art.tv} alt="" />
        </div>
      )}
      {stage === "going" && (
        <div className="pf-kid-window new">
          <img src={next.art.tv} alt="" />
        </div>
      )}
      <svg className="pf-kid-sky" viewBox="0 0 820 1180" aria-hidden="true">
        <path d="M150 980 C 260 760, 560 760, 410 900" fill="none" stroke={kid.color} strokeWidth="10" strokeDasharray="16 16" strokeLinecap="round" className="pf-kid-path" />
      </svg>
      <div className={`pf-kid-hopper${stage === "going" ? " go" : ""}`}>
        <Patch person={kid} size={260} />
      </div>
      <div className="pf-kid-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
