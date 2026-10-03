import all from "virtual:ogs-concepts";
import type { RegisteredConcept } from "./types";

export const CONCEPTS: RegisteredConcept[] = [...all].sort((a, b) => a.id.localeCompare(b.id));

export const conceptById = (id: string | null) => CONCEPTS.find((c) => c.id === id);
