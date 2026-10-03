// Ava's iPad ran out (9%) and slept through the cut. What she'd see on waking: plug in. No words.
export function Asleep() {
  return (
    <div className="ch-ipad ch-asleep">
      <svg className="ch-asleep-batt" viewBox="0 0 220 110" aria-hidden="true">
        <rect x="6" y="6" width="190" height="98" rx="20" fill="none" stroke="#5b5b60" strokeWidth="8" />
        <rect x="202" y="38" width="12" height="34" rx="5" fill="#5b5b60" />
        <rect x="18" y="18" width="18" height="74" rx="8" fill="#ff3b30" />
      </svg>
      <svg className="ch-asleep-plug" viewBox="0 0 60 90" aria-hidden="true">
        <path d="M22 4v20M38 4v20M12 24h36v18c0 10-8 18-18 18s-18-8-18-18zM30 60v26" fill="none" stroke="#5b5b60" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
