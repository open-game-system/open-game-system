// The table, drawn: every seat is a place set at one table, each place labelled with its home's
// crest (a whole household) or one person's sticker (a seat of their own), on a plate ringed in the
// seat's colour, with a folded place card that says whose it is and how it stands. The place whose
// roll it is has the dice; a home that's away has its chair pulled out and its place kept.
import { HOME } from "../../../../world";
import { household, short, US, type Night, type NightHome } from "../../nights";
import { Crest, Sticker } from "../../ui/Sticker";
import { PhoneIcon, TvIcon } from "../../ui/Icons";

type Mode = "status" | "seat" | "screen";

interface Place {
  key: string;
  home: NightHome;
  /** A person's own seat (split), or null for the whole household. */
  person: string | null;
  color: string;
  colorName: string;
  label: string;
}

const JUNEAU_GREEN = "#1f8a5b";

function placesOf(n: Night): Place[] {
  return n.homes
    .filter((h) => h.reply !== "declined")
    .flatMap((h): Place[] => {
      if (h.householdId === US && h.seat === "split") {
        return [
          { key: "us-dad", home: h, person: "dad", color: h.color, colorName: h.colorName, label: "Jonathan" },
          { key: "us-juneau", home: h, person: "juneau", color: JUNEAU_GREEN, colorName: "green", label: "Juneau" },
        ];
      }
      return [{ key: h.householdId, home: h, person: null, color: h.color, colorName: h.colorName, label: short(h.name) }];
    });
}

/** Where places sit around the oval (percent of the sheet): 2, 3 or 4 places. */
const SPOTS: Record<number, [number, number][]> = {
  1: [[50, 18]],
  2: [
    [26, 30],
    [74, 30],
  ],
  3: [
    [50, 15],
    [20, 63],
    [80, 63],
  ],
  4: [
    [24, 15],
    [76, 15],
    [20, 66],
    [80, 66],
  ],
};

function stateWord(p: Place, n: Night, mode: Mode): string {
  const h = p.home;
  if (mode === "seat") return p.person ? `${p.colorName} · own hand` : h.householdId === US ? `${p.colorName} · Jonathan + Juneau` : `${p.colorName} · whole home`;
  if (mode === "screen") return h.screen === "phones" ? "on phones" : h.householdId === US ? "living room TV" : "their TV";
  if (h.reply === "invited") return "deciding";
  if (n.status === "live" && n.turnOf === h.householdId) return h.householdId === US ? "our roll" : "rolling";
  if (!h.back) return "away · place kept";
  if (n.status === "live") return "waiting";
  return h.reply === "host" ? "hosting" : "back";
}

function Who({ p }: { p: Place }) {
  if (p.person) {
    const person = HOME.people.find((x) => x.id === p.person);
    return person ? <Sticker person={person} size={48} /> : null;
  }
  return <Crest household={household(p.home.householdId)} size={52} shared={p.home.householdId !== US} dim={!p.home.back} />;
}

export function Table({ n, mode }: { n: Night; mode: Mode }) {
  const places = placesOf(n);
  const spots = SPOTS[places.length] ?? SPOTS[3] ?? [];
  const live = n.status === "live" || n.status === "paused";
  return (
    <figure className="iv-table" aria-label="The table: one place per seat">
      <svg className="iv-table__drawing" viewBox="0 0 358 300" aria-hidden>
        <ellipse cx="181" cy="153" rx="132" ry="70" fill="none" stroke="#2b2118" strokeOpacity=".18" strokeWidth="9" />
        <ellipse cx="179" cy="150" rx="130" ry="68" fill="#ead6b0" stroke="#2b2118" strokeWidth="2.2" />
        <ellipse cx="179" cy="150" rx="116" ry="57" fill="none" stroke="#2b2118" strokeWidth="1" strokeDasharray="2 5" strokeOpacity=".5" />
        <path d="M108 118 q71 -22 142 0" fill="none" stroke="#2b2118" strokeOpacity=".22" strokeWidth="1.2" />
        <path d="M100 168 q79 24 158 0" fill="none" stroke="#2b2118" strokeOpacity=".22" strokeWidth="1.2" />
      </svg>
      <ol className="iv-table__places">
        {places.map((p, i) => {
          const [x, y] = spots[i] ?? [50, 50];
          const turn = live && mode === "status" && n.turnOf === p.home.householdId && n.status === "live";
          const away = mode === "status" && !p.home.back;
          return (
            <li key={p.key} className={`iv-place ${turn ? "is-turn" : ""} ${away ? "is-away" : ""} ${p.home.reply === "invited" && mode === "status" ? "is-pending" : ""}`} style={{ left: `${x}%`, top: `${y}%` }}>
              <span className="iv-place__plate" style={{ borderColor: p.color }}>
                <Who p={p} />
              </span>
              {turn && <Dice />}
              <span className="iv-place__card">
                <b>{p.label}</b>
                <span>
                  {mode === "screen" && (p.home.screen === "phones" ? <PhoneIcon size={13} /> : <TvIcon size={13} />)}
                  {stateWord(p, n, mode)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/** Two drawn dice beside the place whose roll it is. */
function Dice() {
  return (
    <svg className="iv-place__dice" viewBox="0 0 40 24" aria-hidden>
      <g transform="rotate(-12 10 12)">
        <rect x="2" y="3" width="17" height="17" rx="4" fill="#fbf2e4" stroke="#2b2118" strokeWidth="1.6" />
        <circle cx="7" cy="8" r="1.6" fill="#2b2118" />
        <circle cx="14" cy="15" r="1.6" fill="#2b2118" />
      </g>
      <g transform="rotate(10 30 12)">
        <rect x="21" y="4" width="17" height="17" rx="4" fill="#fbf2e4" stroke="#2b2118" strokeWidth="1.6" />
        <circle cx="25.5" cy="8.5" r="1.6" fill="#2b2118" />
        <circle cx="29.5" cy="12.5" r="1.6" fill="#2b2118" />
        <circle cx="33.5" cy="16.5" r="1.6" fill="#2b2118" />
      </g>
    </svg>
  );
}
