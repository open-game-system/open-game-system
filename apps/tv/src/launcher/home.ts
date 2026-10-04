import type { Instance, Manifest, SuspendedGame } from "@open-game-system/ogs-protocol";
import { type Dir, type FocusRow, firstFocus, locate, move } from "./focus-grid";
import { buildRows } from "./layout";
import { continueItem, SURPRISE_ITEM } from "./shortcuts";

export interface Art {
  src: string;
  /** The HUD crop: only ever on captured gameplay art, never on the clean kit. */
  safe?: Manifest["art"]["safe"];
}

export interface IconModel {
  itemId: string;
  appId: string;
  name: string;
  tagline: string;
  icon: Art;
  room: Art;
  logo: string | null;
  /** "Paused Thursday", "Tonight at 8:00", or "" for a game not started. */
  tag: string;
  resume: string;
}

export type CardModel =
  | {
      kind: "sitting";
      itemId: string;
      appId: string;
      name: string;
      art: Art;
      tag: string;
      resume: string;
    }
  | { kind: "surprise"; itemId: string; icons: Art[] };

export interface HomeModel {
  icons: IconModel[];
  cards: CardModel[];
}

const MAX_SITTINGS = 3;

const captured = (src: string, safe: Manifest["art"]["safe"]): Art =>
  safe ? { src, safe } : { src };

/** The focused game's art for the whole room: the clean hero, else the captured hero cropped. */
export const roomArt = (g: Manifest): Art =>
  g.art.heroClean ? { src: g.art.heroClean } : captured(g.art.hero ?? g.art.tile, g.art.safe);

/** The square icon, else the captured tile cropped. */
export const iconArt = (g: Manifest): Art =>
  g.art.icon ? { src: g.art.icon } : captured(g.art.tile, g.art.safe);

/**
 * PS5-style home: one row of game icons (paused sittings first, then tonight, then the rest),
 * and activity cards under it: the sittings to jump back into, then Surprise me.
 */
export function buildHome(input: {
  games: Manifest[];
  instances: Instance[];
  suspended: SuspendedGame[];
  now: number;
}): HomeModel {
  const rows = buildRows(input);
  const byId = new Map(input.games.map((g) => [g.appId, g]));
  const boxes = rows.flatMap((r) => r.boxes);
  const icons: IconModel[] = boxes.flatMap((b) => {
    const g = byId.get(b.appId);
    if (!g) return [];
    return [
      {
        itemId: b.itemId,
        appId: b.appId,
        name: b.name,
        tagline: b.tagline,
        icon: iconArt(g),
        room: roomArt(g),
        logo: g.art.logo ?? null,
        tag: b.tag,
        resume: b.resume,
      },
    ];
  });
  const cards: CardModel[] = boxes
    .filter((b) => b.instanceId)
    .slice(0, MAX_SITTINGS)
    .flatMap((b) => {
      const g = byId.get(b.appId);
      return g && b.instanceId
        ? [
            {
              kind: "sitting" as const,
              itemId: continueItem(b.appId, b.instanceId),
              appId: b.appId,
              name: b.name,
              art: roomArt(g),
              tag: b.tag,
              resume: b.resume,
            },
          ]
        : [];
    });
  // Surprise me sits right after the latest sitting: the kids' button is never at the far end.
  if (icons.length >= 2)
    cards.splice(Math.min(1, cards.length), 0, {
      kind: "surprise",
      itemId: SURPRISE_ITEM,
      icons: icons.map((i) => i.icon),
    });
  return { icons, cards };
}

export const homeFocusRows = (home: HomeModel): FocusRow[] => [
  { id: "games", items: home.icons.map((i) => i.itemId) },
  { id: "activity", items: home.cards.map((c) => c.itemId) },
];

/** Where the ring goes when its item left the screen (a page closed): that game, else the first. */
export function recoverFocus(
  rows: FocusRow[],
  focus: string | null,
  lastPage: string | null,
): string | null {
  if (locate(rows, focus)) return null;
  const back = lastPage ? `game:${lastPage}` : null;
  return back && locate(rows, back) ? back : firstFocus(rows);
}

/**
 * The remote on home: along a row as the focus grid moves; down from the icons to the first card
 * (the latest sitting), and back up to the icon the ring came from (`lastIcon`), PS5-style.
 */
export function homeMove(
  rows: FocusRow[],
  focus: string | null,
  dir: Dir,
  lastIcon: string | null,
): string | null {
  // Row 0 is the icons, row 1 the cards.
  const step = `${locate(rows, focus)?.row}:${dir}`;
  if (step === "0:down") return firstCard(rows) ?? focus;
  if (step === "1:up") return iconAbove(rows, lastIcon) ?? focus;
  return move(rows, focus, dir);
}

/** The latest sitting's card. */
const firstCard = (rows: FocusRow[]): string | undefined => rows[1]?.items[0];

/** The icon the ring came down from, while it is still on screen; else the first icon. */
function iconAbove(rows: FocusRow[], lastIcon: string | null): string | undefined {
  const icons = rows[0]?.items ?? [];
  return lastIcon && icons.includes(lastIcon) ? lastIcon : icons[0];
}
