// Ava's iPad, opened at 9%: her character asleep, a battery wanting its cable. When the grown-up
// asks it to chime, soft rings pulse so someone can find it. Opening it is all she has to do.
import type { Person } from "../../../world";

export function KidAsleep({ kid, ringing }: { kid: Person; ringing: boolean }) {
  return (
    <div className="pf-kidbg asleep">
      {ringing && (
        <div className="pf-kid-rings" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
      <div className="pf-kid-sleeper" style={{ background: kid.color }}>
        <img src="/art/story-nook/char-dinosaur-sleep.webp" alt="" />
      </div>
      <svg className="pf-kid-battery" viewBox="0 0 300 140" aria-hidden="true">
        <rect x="8" y="20" width="230" height="100" rx="26" fill="none" stroke="#f6eddc" strokeWidth="10" />
        <rect x="246" y="52" width="22" height="36" rx="8" fill="#f6eddc" />
        <rect x="26" y="38" width="26" height="64" rx="10" fill="#ff6b4a" />
        <path d="M150 34 L118 76 H146 L136 108 L176 62 H148 L160 34 Z" fill="#ffd23f" />
      </svg>
    </div>
  );
}
