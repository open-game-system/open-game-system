import type { Identity } from "../../../services/identity";
import type { Band } from "../../../services/ogs-api";

export interface Me {
  personId: string;
  name: string;
  sticker: string;
}

export interface Kid extends Me {
  band: Band;
  bandLabel: string;
}

const BAND_LABEL: Record<Band, string> = { grownup: "Grown-up", kid: "Kid", little: "Little" };

/**
 * Your profile from today's data (no profiles backend yet): this phone is registered as the
 * household's first person (personIndex 0), so that person is you. Kids and littles are the
 * managed profiles under you (profiles proposal, Q2). Other grown-ups are not friends: friends
 * need the profiles backend, so they are not shown here.
 */
export function profileView(identity: Identity | null): { me: Me | null; kids: Kid[] } {
  const [first, ...rest] = identity?.people ?? [];
  if (!first) return { me: null, kids: [] };
  return {
    me: { personId: first.personId, name: first.name, sticker: first.sticker },
    kids: rest
      .filter((p) => p.band !== "grownup")
      .map((p) => ({
        personId: p.personId,
        name: p.name,
        sticker: p.sticker,
        band: p.band,
        bandLabel: BAND_LABEL[p.band],
      })),
  };
}
