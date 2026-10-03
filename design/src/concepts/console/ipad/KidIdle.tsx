// Paired and waiting: "this iPad is Juneau's, and it's listening to the TV". No words: his own
// portrait (the one Story Nook painted), a TV above it, and a pulse running between them.
import { useState } from "react";
import type { Person } from "../../../world";

export function KidIdle({ who }: { who: Person }) {
  const [boop, setBoop] = useState(0);
  return (
    <div className="kid-idle" style={{ color: who.color }}>
      <div className="kid-idle__sky" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 41) % 100}%`, top: `${(i * 67) % 100}%`, animationDelay: `${(i % 7) * 0.4}s` }} />
        ))}
      </div>
      <div className="kid-idle__tv" aria-hidden>
        <svg width="190" height="140" viewBox="0 0 190 140">
          <rect x="8" y="8" width="174" height="104" rx="14" fill="#1d2030" stroke="#f4f2ee" strokeOpacity=".85" strokeWidth="6" />
          <rect x="22" y="22" width="146" height="76" rx="6" fill="#2a2f48" />
          <circle cx="95" cy="60" r="16" fill="none" stroke="#f4f2ee" strokeWidth="5" strokeDasharray="70 30" />
          <circle cx="95" cy="60" r="6" fill="#f4f2ee" />
          <path d="M70 132h50" stroke="#f4f2ee" strokeOpacity=".85" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
      <div className="kid-idle__link" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </div>
      <button className={`kid-idle__me ${boop % 2 ? "is-boop" : ""}`} aria-label="me" onClick={() => setBoop((b) => b + 1)}>
        {who.portrait && <img src={who.portrait} alt="" />}
      </button>
    </div>
  );
}
