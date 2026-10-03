// Paired and following tonight: the kid's own patch, breathing, tethered to the TV by a stitch.
// Tapping it only makes it bounce. There is nothing else to tap.
import { HOME, type Person } from "../../../world";
import { Patch } from "../ui/Patch";

export function KidIdle({ kid, pokes, onPoke }: { kid: Person; pokes: number; onPoke: () => void }) {
  const others = HOME.people.filter((p) => p.id !== kid.id);
  return (
    <div className="pf-kidbg">
      <svg className="pf-kid-sky" viewBox="0 0 820 1180" aria-hidden="true">
        {Array.from({ length: 34 }, (_, i) => (
          <circle key={i} cx={(i * 211) % 820} cy={(i * 347) % 1180} r={(i % 3) + 1.5} fill="#f6eddc" opacity={0.18 + (i % 4) * 0.1} />
        ))}
        {/* the TV, and the stitched thread from it to this iPad */}
        <g transform="translate(410 170)">
          <rect x="-110" y="-62" width="220" height="132" rx="22" fill="none" stroke="#f6eddc" strokeWidth="8" />
          <path d="M-46 96 h92" stroke="#f6eddc" strokeWidth="8" strokeLinecap="round" />
          <circle r="16" fill={kid.color} />
        </g>
        <path className="pf-kid-thread" d="M410 280 C 410 360, 410 380, 410 430" fill="none" stroke={kid.color} strokeWidth="8" strokeDasharray="14 14" strokeLinecap="round" />
      </svg>
      <button className="pf-kid-me" data-bot="kid-me" aria-label="" onClick={onPoke} key={pokes}>
        <Patch person={kid} size={380} />
      </button>
      <div className="pf-kid-others">
        {others.map((p) => (
          <Patch key={p.id} person={p} size={110} />
        ))}
      </div>
    </div>
  );
}
