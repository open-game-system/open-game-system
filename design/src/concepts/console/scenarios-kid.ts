import type { Scenario } from "../../harness/types";
import type { S } from "./state";

/** Scenarios owned by the kid surfaces owner (ids must not collide with scenarios.ts). */
export const kidScenarios: Scenario<S>[] = [];
