import { locate } from "../launcher/focus-grid";
import { type BoxModel, clock, focusRows, type RowModel } from "../launcher/layout";
import type { Household } from "../session/data";
import { Box } from "./Box";
import { Couch } from "./Couch";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Boxes that fit across the shelf before it scrolls (pitches live in styles.css). */
const VISIBLE_BOXES = 5;

export function Home(props: {
  rows: RowModel[];
  focus: string | null;
  household: Household;
  remoteHolder: string | null;
  now: number;
}) {
  const { rows, focus, household, now } = props;
  const at = locate(focusRows(rows), focus) ?? { row: 0, col: 0 };
  const hero: BoxModel | undefined = rows[at.row]?.boxes[at.col] ?? rows[0]?.boxes[0] ?? undefined;
  return (
    <div className="screen home" data-testid="home">
      <header className="topbar">
        <h1 className="room-name">{household.name}' living room</h1>
        <div className="clock">
          <span className="clock-time">{clock(now)}</span>
          <span className="clock-day">{WEEKDAYS[new Date(now).getDay()]}</span>
        </div>
      </header>
      {hero ? <Hero box={hero} /> : <EmptyHero name={props.remoteHolder} />}
      <div className="rows-viewport">
        <div className="rows" style={{ "--row": at.row }}>
          {rows.map((row, r) => (
            <section
              key={row.id}
              className={`row${r === at.row ? " current" : r < at.row ? " above" : ""}`}
              data-row={row.id}
            >
              <h2 className="row-title">{row.title}</h2>
              <div
                className="shelf"
                style={{
                  "--shift": r === at.row ? Math.max(0, at.col - (VISIBLE_BOXES - 1)) : 0,
                }}
              >
                {row.boxes.map((b) => (
                  <Box key={b.itemId} box={b} focused={b.itemId === focus} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <Couch household={household} />
      {props.remoteHolder && (
        <div className="remote-chip" data-testid="remote-chip">
          <RemoteIcon />
          {props.remoteHolder} has the remote
        </div>
      )}
    </div>
  );
}

function Hero({ box }: { box: BoxModel }) {
  return (
    <div className="hero" data-testid="hero" data-hero={box.appId}>
      <img key={box.appId} className="hero-art" src={box.hero} alt="" />
      <div className="hero-text" key={`t-${box.appId}`}>
        {box.tag && <p className="hero-tag">{box.tag}</p>}
        <h2 className="hero-title">{box.name}</h2>
        {box.resume && <p className="hero-resume">{box.resume}</p>}
      </div>
    </div>
  );
}

function EmptyHero({ name }: { name: string | null }) {
  return (
    <div className="hero empty" data-testid="hero">
      <div className="hero-text">
        <h2 className="hero-title">No games yet</h2>
        <p className="hero-resume">Add games on {name ? `${name}'s` : "your"} phone, in Library</p>
      </div>
    </div>
  );
}

export function RemoteIcon() {
  return (
    <svg className="remote-icon" viewBox="0 0 20 32" aria-hidden="true">
      <rect
        x="2"
        y="1"
        width="16"
        height="30"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle cx="10" cy="10" r="3" fill="currentColor" />
    </svg>
  );
}
