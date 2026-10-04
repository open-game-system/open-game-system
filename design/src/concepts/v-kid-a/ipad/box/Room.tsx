// The child's corner of the playroom, behind the toy box: a warm painted wall washed in their
// colour, a wooden floor, and a round rug whose stitched edge is the console's dotted follow path.
export function Room({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`tb-room ${dim ? "is-dim" : ""}`} aria-hidden>
      <span className="tb-room__wall" />
      <span className="tb-room__floor" />
      <svg className="tb-room__rug" viewBox="0 0 1100 300" preserveAspectRatio="none">
        <ellipse cx="550" cy="150" rx="540" ry="140" className="tb-room__rugfill" />
        <ellipse cx="550" cy="150" rx="500" ry="118" fill="none" stroke="#fff6e0" strokeOpacity=".55" strokeWidth="9" strokeDasharray="0.1 30" strokeLinecap="round" />
      </svg>
    </div>
  );
}
