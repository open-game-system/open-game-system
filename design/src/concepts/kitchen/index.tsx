// Concept B "Kitchen Table": Porchlight, a family hub. The household is the primary object.
import { defineConcept } from "../../harness/types";
import css from "./concept.css?raw";
import type { S } from "./state";
import { Surface } from "./Surface";
import { scenarios } from "./scenarios";
import { flows } from "./flows";

export const concept = defineConcept<S>({
  id: "kitchen",
  name: "B · Kitchen Table (Porchlight)",
  brief:
    "Porchlight: a family hub. The phone opens to tonight (who's on the couch, on which device, what the TV is doing) and a noticeboard of everything between sittings. Place cards are the identity object: seats, rosters and 'who followed' are all place cards. Games own the TV and their controllers; Porchlight frames them.",
  Surface,
  scenarios,
  flows,
  css,
});
