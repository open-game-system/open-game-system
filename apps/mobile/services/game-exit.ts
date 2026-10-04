import type { ClientMessage, InstanceReport } from "@open-game-system/ogs-protocol";
import { leaveGame, type ReturnPill } from "./leave-game";
import type { InstanceSource } from "./ogs-api";

/** Runs a completed exit from the game screen: home (when cast), visit record, pill, back. */
export function exitGame(ctx: {
  appId: string | null;
  name: string;
  url: string;
  ogsCast: boolean;
  reported: boolean;
  now: number;
  instanceId?: string | null;
  send: (msg: ClientMessage) => void;
  report: (report: InstanceReport, source: InstanceSource) => Promise<unknown>;
  setPill: (pill: ReturnPill) => void;
  goBack: () => void;
}): void {
  const out = leaveGame(ctx);
  if (out.home) ctx.send({ type: "home" });
  if (out.visit)
    ctx.report(out.visit, "visit").catch((err: unknown) => {
      console.warn("[ogs] could not record the visit:", err);
    });
  ctx.setPill(out.pill);
  ctx.goBack();
}
