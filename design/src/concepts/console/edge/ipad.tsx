// A kid iPad during a failure: no words, nothing scary, nothing to press wrong. The child's own
// character sits at the bottom centre and waits with them, looking toward what's missing (the TV,
// or the Wi-Fi). While it comes back, lights travel the path; when it's back, the iPad drops
// straight into the seat it kept, with the same confetti as a late join.
import { useRef, type ReactNode } from "react";
import { HOME, person, type Person } from "../../../world";
import { KidArrive } from "../ipad/KidArrive";
import { KidChar } from "../ipad/KidChar";
import { Bursts, useBursts } from "../ipad/juice";
import type { S } from "../state";
import type { Fault } from "./fault";

const PATH = "M640 470 C 720 330, 780 230, 880 190";

function KidWait({ who, what, coming }: { who: Person; what: "tv" | "wifi"; coming: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  return (
    <div
      ref={host}
      className={`eg-kid ${coming ? "is-coming" : ""}`}
      style={{ color: who.color }}
      data-edge-kid={what}
      onPointerDown={(e) => fire(e, host.current, "spark", ["#fff6e0", who.color])}
    >
      <div className="eg-kid__hill" aria-hidden />
      <svg className="eg-kid__path" viewBox="0 0 1180 820" aria-hidden>
        <path d={PATH} className="eg-kid__ghost" />
        {coming && <path d={PATH} className="eg-kid__march" />}
      </svg>
      <div className="eg-kid__thing" aria-hidden>
        {what === "tv" ? <WaitTv coming={coming} /> : <WaitWifi coming={coming} />}
      </div>
      <KidChar
        who={who}
        size={420}
        className="eg-kid__me"
        onPoke={(e) => {
          e.stopPropagation();
          fire(e, host.current, "heart", [who.color, "#fff6e0", "#ff8fb1"], true);
        }}
      />
      <Bursts bursts={bursts} />
    </div>
  );
}

/** The TV, resting: a dim screen with three slow dots; warming up as it comes back. */
function WaitTv({ coming }: { coming: boolean }) {
  return (
    <svg width="270" height="210" viewBox="0 0 250 190">
      <rect x="8" y="8" width="234" height="144" rx="20" fill="#1d2030" stroke="#f4f2ee" strokeOpacity=".9" strokeWidth="8" />
      <rect x="26" y="26" width="198" height="108" rx="9" className={`eg-kid__screen ${coming ? "is-warm" : ""}`} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={95 + i * 30} cy="80" r="10" fill="#fff6e0" className="eg-kid__dot" style={{ animationDelay: `${i * 0.35}s` }} />
      ))}
      <path d="M95 178h60" stroke="#f4f2ee" strokeOpacity=".9" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

/** Three arcs: dim while away, filling one by one as the iPad finds its way back. */
function WaitWifi({ coming }: { coming: boolean }) {
  return (
    <svg width="260" height="210" viewBox="0 0 260 210">
      {[0, 1, 2].map((i) => {
        const r = 50 + i * 46;
        return (
          <path
            key={i}
            d={`M${130 - r * 0.8} ${180 - r * 0.6} A ${r} ${r} 0 0 1 ${130 + r * 0.8} ${180 - r * 0.6}`}
            fill="none"
            stroke="#fff6e0"
            strokeWidth="18"
            strokeLinecap="round"
            className={`eg-kid__arc ${coming ? "is-on" : ""}`}
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        );
      })}
      <circle cx="130" cy="180" r="16" fill="#fff6e0" />
    </svg>
  );
}

export function EdgeKid({ s, f, seat, children }: { s: S; f: Fault; seat?: string; children: ReactNode }): ReactNode {
  const who = person(seat ?? s.ipad);
  const mine = HOME.devices.find((d) => d.personId === who.id && d.kind === "ipad");
  const tvGone = f.kind === "cast-lost" || f.kind === "stream-stall";
  const offline = f.kind === "ipad-offline" && mine?.id === f.subject;
  if (!tvGone && !offline) return children;
  if (f.phase === "recovered") {
    return (
      <div className="eg-kidback">
        {children}
        <KidArrive who={who} />
      </div>
    );
  }
  return <KidWait who={who} what={offline ? "wifi" : "tv"} coming={f.phase === "recovering"} />;
}
